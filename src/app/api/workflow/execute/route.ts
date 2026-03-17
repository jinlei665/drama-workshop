/**
 * 工作流执行 API
 * 执行节点式工作流
 */

import { NextRequest } from 'next/server'
import { workflowEngine } from '@/lib/workflow'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

// 简单的 UUID 生成函数
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * POST /api/workflow/execute
 * 执行工作流
 */
export async function POST(request: NextRequest) {
  try {
    const body = await getJSON<{
      projectId: string
      nodes: Array<{
        id: string
        type: string
        data?: Record<string, unknown>
        position?: { x: number; y: number }
      }>
      edges: Array<{
        id: string
        source: string
        target: string
        sourceHandle?: string
        targetHandle?: string
      }>
    }>(request)
    
    // 转换节点格式
    const nodes: WorkflowNode[] = body.nodes.map(n => ({
      id: n.id,
      type: n.type,
      data: n.data || {},
      position: n.position,
    }))
    
    const edges: WorkflowEdge[] = body.edges
    
    // 验证工作流
    const validation = workflowEngine.validateWorkflow(nodes, edges)
    if (!validation.valid) {
      return successResponse({
        success: false,
        errors: validation.errors,
      }, 400)
    }
    
    // 创建执行 ID
    const executionId = generateId()
    
    // 异步执行工作流
    workflowEngine.execute(
      executionId,
      nodes,
      edges,
      {
        projectId: body.projectId,
        onProgress: (nodeId, progress, message) => {
          console.log(`[${executionId}] Node ${nodeId}: ${progress}% - ${message || ''}`)
        },
        onError: (nodeId, error) => {
          console.error(`[${executionId}] Node ${nodeId} error:`, error)
        },
        onComplete: (nodeId, outputs) => {
          console.log(`[${executionId}] Node ${nodeId} completed:`, Object.keys(outputs))
        },
      }
    ).catch(err => {
      console.error(`[${executionId}] Workflow failed:`, err)
    })
    
    return successResponse({
      executionId,
      status: 'started',
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * GET /api/workflow/execute?executionId=xxx
 * 获取执行状态
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const executionId = url.searchParams.get('executionId')
    
    if (!executionId) {
      return successResponse({
        status: 'error',
        message: '缺少 executionId 参数',
      }, 400)
    }
    
    const execution = workflowEngine.getExecution(executionId)
    
    if (!execution) {
      return successResponse({
        status: 'not_found',
        message: '执行记录不存在',
      }, 404)
    }
    
    return successResponse({
      id: execution.id,
      status: execution.status,
      startTime: execution.startTime,
      endTime: execution.endTime,
      error: execution.error,
      nodeStatuses: Object.fromEntries(execution.nodeStatuses),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
