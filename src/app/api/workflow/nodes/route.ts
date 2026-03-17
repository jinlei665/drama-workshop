/**
 * 节点定义 API
 * 获取可用的节点列表
 */

import { successResponse, errorResponse } from '@/lib/api/response'
import { workflowEngine, getNodesByCategory } from '@/lib/workflow'

/**
 * GET /api/workflow/nodes
 * 获取所有节点定义
 */
export async function GET() {
  try {
    const definitions = workflowEngine.getAllNodeDefinitions()
    const byCategory = getNodesByCategory()
    
    return successResponse({
      definitions: definitions.map(d => ({
        type: d.type,
        category: d.category,
        displayName: d.displayName,
        description: d.description,
        inputs: d.inputs,
        outputs: d.outputs,
      })),
      categories: byCategory,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
