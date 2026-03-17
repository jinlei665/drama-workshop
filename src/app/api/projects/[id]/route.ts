/**
 * 单个项目 API 路由
 * 提供单个项目的操作
 */

import { NextRequest } from 'next/server'
import { ProjectService } from '@/lib/db'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/projects/[id]
 * 获取单个项目详情
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const project = await ProjectService.get(params.id)
    
    if (!project) {
      return successResponse(null, 404)
    }
    
    return successResponse(project)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PUT /api/projects/[id]
 * 更新项目
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const body = await getJSON<{
      name?: string
      description?: string
      status?: string
      metadata?: Record<string, unknown>
    }>(request)
    
    const project = await ProjectService.update(params.id, {
      name: body.name,
      description: body.description,
      status: body.status as 'draft' | 'analyzing' | 'ready' | 'generating' | 'completed' | 'error' | undefined,
      metadata: body.metadata,
    })
    
    return successResponse(project)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * DELETE /api/projects/[id]
 * 删除项目
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await ProjectService.delete(params.id)
    
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
