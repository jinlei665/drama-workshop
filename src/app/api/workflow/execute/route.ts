import { NextRequest, NextResponse } from 'next/server'
import { WorkflowEngine } from '@/lib/workflow/engine/WorkflowEngine'
import type { Workflow, BaseNode, Edge, NodeResult, WorkflowExecution } from '@/lib/workflow/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflow/execute
 * 执行工作流
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nodes, edges, workflowId = `workflow-${Date.now()}`, projectId = 'temp' } = body

    if (!nodes || !edges) {
      return NextResponse.json(
        { success: false, error: '缺少 nodes 或 edges 参数' },
        { status: 400 }
      )
    }

    console.log('🚀 开始执行工作流:', { nodes: nodes.length, edges: edges.length, workflowId, projectId })

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

    // 监听执行事件
    engine.on('node:started', (data: any) => {
      console.log('✅ 节点开始执行:', data.nodeId)
      events.push({ type: 'node:started', data, timestamp: Date.now() })
    })

    engine.on('node:completed', (data: any) => {
      console.log('✅ 节点执行完成:', data.nodeId, data.result)
      nodeResults.set(data.nodeId, data.result)
      events.push({ type: 'node:completed', data, timestamp: Date.now() })
    })

    engine.on('node:failed', (data: any) => {
      console.error('❌ 节点执行失败:', data.nodeId, data.error)
      nodeResults.set(data.nodeId, {
        nodeId: data.nodeId,
        status: 'error',
        error: data.error,
        duration: 0,
      })
      events.push({ type: 'node:failed', data, timestamp: Date.now() })
    })

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

    return NextResponse.json({
      success: true,
      data: {
        execution,
        results,
        events,
      },
    })
  } catch (error) {
    console.error('❌ 执行工作流时发生错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
