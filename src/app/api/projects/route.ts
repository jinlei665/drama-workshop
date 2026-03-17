/**
 * 项目 API 路由
 * 提供项目的 CRUD 操作
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON, getQueryParams, parsePagination, validateRequired } from '@/lib/api/response'

// 内存存储（用于开发环境，当数据库不可用时）
const memoryProjects: Array<{
  id: string
  name: string
  description?: string
  sourceContent: string
  sourceType: string
  status: string
  createdAt: string
  updatedAt: string
}> = []

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * GET /api/projects
 * 获取项目列表
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request)
    const { pageSize, offset } = parsePagination(params)
    
    // 尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (!error && data) {
          const projects = data.slice(offset, offset + pageSize)
          return successResponse({
            projects,
            pagination: {
              page: Math.floor(offset / pageSize) + 1,
              pageSize,
            },
          })
        }
      } catch (dbError) {
        console.warn('Database not available, using memory storage:', dbError)
      }
    }
    
    // 使用内存存储
    const projects = memoryProjects.slice(offset, offset + pageSize)
    return successResponse({
      projects,
      pagination: {
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
        total: memoryProjects.length,
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
    
    const project = {
      id: generateId(),
      name: body.name,
      sourceContent: body.sourceContent,
      sourceType: body.sourceType || 'novel',
      description: body.description,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    // 尝试保存到数据库
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('projects')
          .insert({
            name: project.name,
            source_content: project.sourceContent,
            source_type: project.sourceType,
            description: project.description,
            status: project.status,
          })
          .select()
          .single()
        
        if (!error && data) {
          return successResponse({ project: data }, 201)
        }
      } catch (dbError) {
        console.warn('Database not available, saving to memory:', dbError)
      }
    }
    
    // 保存到内存
    memoryProjects.unshift(project)
    return successResponse({ project }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
