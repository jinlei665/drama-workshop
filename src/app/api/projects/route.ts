/**
 * 项目 API 路由
 * 提供项目的 CRUD 操作
 */

import { NextRequest } from 'next/server'
import { ProjectService } from '@/lib/db'
import { successResponse, errorResponse, getJSON, getQueryParams, parsePagination, validateRequired } from '@/lib/api/response'

/**
 * GET /api/projects
 * 获取项目列表
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request)
    const { pageSize, offset } = parsePagination(params)
    
    const projects = await ProjectService.list(pageSize, offset)
    
    return successResponse({
      projects,
      pagination: {
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/projects
 * 创建新项目
 */
export async function POST(request: NextRequest) {
  try {
    const body = await getJSON<{
      name: string
      sourceContent: string
      sourceType?: string
      description?: string
    }>(request)
    
    validateRequired(body, ['name', 'sourceContent'])
    
    const project = await ProjectService.create({
      name: body.name,
      sourceContent: body.sourceContent,
      sourceType: body.sourceType,
      description: body.description,
    })
    
    return successResponse(project, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
