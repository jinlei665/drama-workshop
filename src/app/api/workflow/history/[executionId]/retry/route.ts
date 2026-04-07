import { NextRequest, NextResponse } from 'next/server'
import { WorkflowEngine } from '@/lib/workflow/engine/WorkflowEngine'
import type { Workflow } from '@/lib/workflow/types'
import { getDatabaseClient } from '@/storage/database/client'
import { sendExecutionEvent, closeExecutionConnection } from '../ws/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflow/history/[executionId]/retry
 * 重试执行工作流
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params

    const db = getDatabaseClient()

    // 查询执行历史
    const result = await db.query(
      'SELECT * FROM workflow_executions WHERE id = $1',
      [executionId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行记录不存在' },
        { status: 404 }
      )
    }

    const history = result.rows[0]

    // 解析 JSON 字段
    const nodes = typeof history.nodes === 'string' ? JSON.parse(history.nodes) : history.nodes
    const edges = typeof history.edges === 'string' ? JSON.parse(history.edges) : history.edges

    // 创建新的执行 ID
    const newExecutionId = `retry-${Date.now()}`

    console.log('🔄 重试执行工作流:', {
      originalExecutionId: executionId,
      newExecutionId,
      workflowId: history.workflow_id,
    })

    // 构建工作流对象
    const workflow: Workflow = {
      id: history.workflow_id,
      projectId: history.project_id,
      name: '重试工作流',
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
    const nodeResults = new Map()
    const events = []

    // 发送事件到客户端（SSE）
    const emitEvent = (type: string, data: any) => {
      const event = { type, data, timestamp: Date.now() }
      events.push(event)
      sendExecutionEvent(newExecutionId, event)
    }

    // 监听执行事件
    engine.on('node:started', (data: any) => {
      console.log('✅ 节点开始执行:', data.nodeId)
      emitEvent('node:started', data)
    })

    engine.on('node:progress', (data: any) => {
      console.log('📊 节点执行进度:', data.nodeId, data.progress)
      emitEvent('node:progress', data)
    })

    engine.on('node:completed', (data: any) => {
      console.log('✅ 节点执行完成:', data.nodeId, data.result)
      nodeResults.set(data.nodeId, data.result)
      emitEvent('node:completed', data)
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
    })

    // 发送开始执行事件
    emitEvent('execution:started', {
      executionId: newExecutionId,
      workflowId: history.workflow_id,
      projectId: history.project_id,
      isRetry: true,
      originalExecutionId: executionId,
    })

    // 执行工作流
    console.log('⏳ 开始重试执行...')
    const execution = await engine.execute(workflow, {
      projectId: history.project_id,
      variables: {},
      assets: {},
    })

    console.log('🎉 重试执行完成:', execution)

    // 转换结果为数组
    const results = Array.from(nodeResults.entries()).map(([nodeId, result]) => ({
      nodeId,
      result,
    }))

    // 保存新的执行历史
    await fetch(`${process.env.CANONICAL_URL || 'http://localhost:5000'}/api/workflow/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executionId: newExecutionId,
        workflowId: history.workflow_id,
        projectId: history.project_id,
        nodes,
        edges,
        status: execution.status,
        startTime: execution.startTime,
        endTime: execution.endTime,
        results,
        error: execution.error,
      }),
    })

    // 发送完成事件
    emitEvent('execution:completed', { execution, results, isRetry: true })

    // 关闭 SSE 连接
    setTimeout(() => closeExecutionConnection(newExecutionId), 1000)

    return NextResponse.json({
      success: true,
      data: {
        executionId: newExecutionId,
        execution,
        results,
        events,
      },
    })
  } catch (error) {
    console.error('❌ 重试执行失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
