import { NextRequest, NextResponse } from 'next/server'
import { WorkflowEngine } from '@/lib/workflow/engine/WorkflowEngine'
import type { Workflow, BaseNode, Edge, NodeResult } from '@/lib/workflow/types'
import { sendExecutionEvent, closeExecutionConnection } from '../ws/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflow/execute
 * 执行工作流（支持实时状态推送）
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
    })

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
    emitEvent('execution:started', { executionId, workflowId, projectId })

    // 执行工作流
    console.log('⏳ 开始执行...')
    const execution = await engine.execute(workflow, {
      projectId,
      variables: {},
      assets: {},
    })

    console.log('🎉 工作流执行完成:', execution)

    // 转换结果为数组
    const results = Array.from(nodeResults.entries()).map(([nodeId, result]) => ({
      nodeId,
      result,
    }))

    // 发送完成事件
    emitEvent('execution:completed', { execution, results })

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
    const executionId = body.executionId || `exec-${Date.now()}`
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
