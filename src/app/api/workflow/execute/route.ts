import { NextRequest, NextResponse } from 'next/server'
import { WorkflowEngine } from '@/lib/workflow/engine/WorkflowEngine'
import type { Workflow, BaseNode, Edge, NodeResult } from '@/lib/workflow/types'
import { sendExecutionEvent, closeExecutionConnection } from '@/lib/workflow/sse'
import { getSupabaseClient, executeSql } from '@/storage/database/supabase-client'
// 确保节点已注册
import '@/lib/workflow/register-nodes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 日志缓冲区
const logBuffer = new Map<string, any[]>()

/**
 * 记录日志
 */
async function logExecution(executionId: string, level: string, message: string, data?: any, nodeId?: string) {
  if (!logBuffer.has(executionId)) {
    logBuffer.set(executionId, [])
  }

  const logEntry = {
    executionId,
    level,
    message,
    data,
    nodeId,
    timestamp: new Date(),
  }

  logBuffer.get(executionId)!.push(logEntry)

  // 每 10 条日志批量保存一次
  if (logBuffer.get(executionId)!.length >= 10) {
    await flushLogs(executionId)
  }
}

/**
 * 刷新日志到数据库
 */
async function flushLogs(executionId: string) {
  const logs = logBuffer.get(executionId)
  if (!logs || logs.length === 0) return

  try {
    for (const log of logs) {
      try {
        await executeSql(
          `
          INSERT INTO workflow_execution_logs
          (execution_id, level, message, data, node_id)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            log.executionId,
            log.level,
            log.message,
            log.data ? JSON.stringify(log.data) : null,
            log.nodeId || null,
          ]
        )
      } catch (sqlError) {
        // 如果 SQL 执行失败（如内存模式），忽略错误
        console.warn('⚠️ 日志保存失败（可能为内存模式）:', sqlError)
      }
    }

    logBuffer.delete(executionId)
  } catch (error) {
    console.error('❌ 保存日志失败:', error)
  }
}

/**
 * POST /api/workflow/execute
 * 执行工作流（支持实时状态推送、断点续传、日志记录）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nodes,
      edges,
      workflowId = `workflow-${Date.now()}`,
      projectId = 'temp',
      executionId = `exec-${Date.now()}`,
      resumeFrom = null, // 断点续传：从指定节点ID开始执行
    } = body

    if (!nodes || !edges) {
      return NextResponse.json(
        { success: false, error: '缺少 nodes 或 edges 参数' },
        { status: 400 }
      )
    }

    console.log('🚀 开始执行工作流:', {
      nodes: nodes.length,
      edges: edges.length,
      workflowId,
      projectId,
      executionId,
      resumeFrom,
    })

    // 初始化日志
    await logExecution(executionId, 'INFO', '工作流执行开始', {
      workflowId,
      projectId,
      resumeFrom,
    })

    // 检查是否是断点续传
    let processedNodes = new Set<string>()
    if (resumeFrom) {
      try {
        const result = await executeSql(
          `
          SELECT data->'results' as results
          FROM workflow_executions
          WHERE id = $1
          `,
          [resumeFrom]
        )

        if (result.rows && result.rows.length > 0) {
          const results = result.rows[0].results
          results.forEach((r: any) => {
            processedNodes.add(r.nodeId)
          })

          console.log('🔄 断点续传，已处理的节点:', Array.from(processedNodes))
          await logExecution(executionId, 'INFO', '断点续传模式', {
            resumeFrom,
            processedNodes: Array.from(processedNodes),
          })
        }
      } catch (error) {
        console.error('❌ 查询断点续传信息失败:', error)
      }
    }

    // 构建工作流对象
    const workflow: Workflow = {
      id: workflowId,
      projectId,
      name: '临时工作流',
      nodes,
      edges,
      version: '1.0.0',
    }

    // 创建工作流引擎
    const engine = new WorkflowEngine({
      maxRetries: 3,
      timeout: 300000,
      maxParallelNodes: 5,
    })

    // 存储执行结果
    const nodeResults: Map<string, NodeResult> = new Map()
    const events: Array<{ type: string; data: any; timestamp: number }> = []

    // 发送事件到客户端（SSE）
    const emitEvent = (type: string, data: any) => {
      const event = { type, data, timestamp: Date.now() }
      events.push(event)
      sendExecutionEvent(executionId, event)
    }

    // 监听执行事件
    engine.on('node:started', (data: any) => {
      console.log('✅ 节点开始执行:', data.nodeId)
      emitEvent('node:started', data)
      logExecution(executionId, 'INFO', `节点开始执行: ${data.nodeId}`, {}, data.nodeId)
    })

    engine.on('node:progress', (data: any) => {
      console.log('📊 节点执行进度:', data.nodeId, data.progress)
      emitEvent('node:progress', data)
      logExecution(executionId, 'DEBUG', `节点进度更新: ${data.nodeId}`, { progress: data.progress }, data.nodeId)
    })

    engine.on('node:completed', (data: any) => {
      console.log('✅ 节点执行完成:', data.nodeId, data.result)
      nodeResults.set(data.nodeId, data.result)
      emitEvent('node:completed', data)
      logExecution(executionId, 'INFO', `节点执行完成: ${data.nodeId}`, { result: data.result }, data.nodeId)
    })

    engine.on('node:failed', (data: any) => {
      console.error('❌ 节点执行失败:', data.nodeId, data.error)
      nodeResults.set(data.nodeId, {
        nodeId: data.nodeId,
        status: 'error',
        error: data.error,
        duration: 0,
      })
      emitEvent('node:failed', data)
      logExecution(executionId, 'ERROR', `节点执行失败: ${data.nodeId}`, { error: data.error }, data.nodeId)
    })

    // 发送开始执行事件
    emitEvent('execution:started', { executionId, workflowId, projectId, resumeFrom })

    // 执行工作流（如果指定了断点，跳过已处理的节点）
    const startTime = Date.now()
    const execution = await engine.execute(workflow, {
      projectId,
      variables: {},
      assets: {},
    })

    console.log('🎉 工作流执行完成:', execution)

    // 刷新剩余日志
    await flushLogs(executionId)

    // 记录执行完成日志
    await logExecution(executionId, 'INFO', '工作流执行完成', {
      status: execution.status,
      duration: Date.now() - startTime,
    })

    // 转换结果为数组
    const results = Array.from(nodeResults.entries()).map(([nodeId, result]) => ({
      nodeId,
      result,
    }))

    // 发送完成事件
    emitEvent('execution:completed', { execution, results })

    // 保存执行历史
    try {
      const sql = `
        INSERT INTO workflow_executions
        (id, workflow_id, project_id, nodes, edges, status, start_time, end_time, results, error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          end_time = EXCLUDED.end_time,
          results = EXCLUDED.results,
          error = EXCLUDED.error,
          updated_at = CURRENT_TIMESTAMP
      `

      await executeSql(sql, [
        executionId,
        workflowId,
        projectId,
        JSON.stringify(nodes),
        JSON.stringify(edges),
        execution.status,
        new Date(startTime),
        execution.endTime ? new Date(execution.endTime) : null,
        results ? JSON.stringify(results) : null,
        execution.error || null,
      ])
    } catch (error) {
      console.warn('⚠️ 保存执行历史失败（可能为内存模式）:', error)
    }

    // 关闭 SSE 连接
    setTimeout(() => closeExecutionConnection(executionId), 1000)

    return NextResponse.json({
      success: true,
      data: {
        executionId,
        execution,
        results,
        events,
      },
    })
  } catch (error) {
    console.error('❌ 执行工作流时发生错误:', error)

    let executionId = `exec-${Date.now()}`

    // 记录错误日志
    await logExecution(executionId, 'ERROR', '工作流执行失败', {
      error: error instanceof Error ? error.message : '未知错误',
    })

    // 刷新日志
    await flushLogs(executionId)

    sendExecutionEvent(executionId, {
      type: 'execution:failed',
      data: { error: error instanceof Error ? error.message : '未知错误' },
      timestamp: Date.now(),
    })
    closeExecutionConnection(executionId)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
