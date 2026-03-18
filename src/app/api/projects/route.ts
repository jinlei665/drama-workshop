/**
 * 项目 API 路由
 * 提供项目的 CRUD 操作
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON, getQueryParams, parsePagination } from '@/lib/api/response'
import { memoryProjects, generateId, generateUUID } from '@/lib/memory-storage'

/**
 * GET /api/projects
 * 获取项目列表
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request)
    const { pageSize, offset } = parsePagination(params)
    
    // 尝试从数据库获取
    let useDatabase = false
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
        
        // 只有当没有错误且有数据时才使用数据库
        // 如果表不存在，error.code 会是 '42P01' (PostgreSQL)
        if (!error && data && data.length > 0) {
          useDatabase = true
          // 转换字段名以匹配前端期望
          const projects = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            sourceContent: p.source_content,
            sourceType: p.source_type,
            style: p.style || 'realistic_cinema',
            status: p.status || 'draft',
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }))
          
          return successResponse({
            projects: projects.slice(offset, offset + pageSize),
            pagination: {
              page: Math.floor(offset / pageSize) + 1,
              pageSize,
              total: projects.length,
            },
          })
        }
        
        // 数据库配置了但表可能不存在，打印警告
        if (error) {
          console.warn('Database query error, falling back to memory storage:', error.message)
        }
      }
    } catch (dbError) {
      console.warn('Database not available, using memory storage:', dbError)
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
      style?: string
    }>(request)
    
    if (!body.name?.trim()) {
      return errorResponse('项目名称不能为空', 400)
    }
    
    if (!body.sourceContent?.trim()) {
      return errorResponse('内容不能为空', 400)
    }
    
    const project = {
      id: generateUUID(),  // 使用 UUID 格式
      name: body.name,
      sourceContent: body.sourceContent,
      sourceType: body.sourceType || 'novel',
      description: body.description,
      style: body.style || 'realistic_cinema',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    // 尝试保存到数据库
    let savedToDatabase = false
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('projects')
          .insert({
            id: project.id,  // 显式传入 ID
            name: project.name,
            source_content: project.sourceContent,
            source_type: project.sourceType,
            description: project.description,
            style: project.style,
            status: project.status,
          })
          .select()
          .single()
        
        if (!error && data) {
          savedToDatabase = true
          // 触发异步分析
          triggerAnalysis(data.id, project.sourceContent, project.style).catch(console.error)
          
          return successResponse({
            project: {
              id: data.id,
              name: data.name,
              description: data.description,
              sourceContent: data.source_content,
              sourceType: data.source_type,
              style: data.style || project.style,
              status: data.status,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }
          }, 201)
        } else if (error) {
          console.warn('⚠️ 数据库保存失败，请确保已在 Supabase 中创建必要的表！')
          console.warn('⚠️ 错误详情:', error.message)
          console.warn('⚠️ 数据将保存到内存，刷新页面后会丢失！')
        }
      }
    } catch (dbError) {
      console.warn('⚠️ 数据库不可用，数据将保存到内存，刷新页面后会丢失！')
      console.warn('⚠️ 请在 Supabase 中执行建表 SQL 或注释掉 NEXT_PUBLIC_SUPABASE_URL')
    }
    
    // 保存到内存
    if (!savedToDatabase) {
      console.log('📝 保存到内存存储:', project.id, project.name)
    }
    memoryProjects.unshift(project)
    
    // 触发异步分析
    triggerAnalysis(project.id, project.sourceContent, project.style).catch(console.error)
    
    return successResponse({ project }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * 触发项目内容分析（异步）
 */
async function triggerAnalysis(projectId: string, content: string, style?: string) {
  try {
    // 更新项目状态为分析中
    const projectIndex = memoryProjects.findIndex(p => p.id === projectId)
    if (projectIndex !== -1) {
      memoryProjects[projectIndex].status = 'analyzing'
    }
    
    // 更新数据库中的项目状态
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        await db
          .from('projects')
          .update({ status: 'analyzing', updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }
    } catch (dbError) {
      console.warn('Failed to update project status in database:', dbError)
    }
    
    // 调用分析 API
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:5000'
    
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        content,
      }),
    })
    
    const result = await response.json()
    
    if (result.characters || result.scenes) {
      // 更新内存中的项目状态
      if (projectIndex !== -1) {
        memoryProjects[projectIndex].status = 'ready'
      }
      
      // 更新数据库中的项目状态
      try {
        const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
        
        if (isDatabaseConfigured()) {
          const db = getSupabaseClient()
          await db
            .from('projects')
            .update({ status: 'ready', updated_at: new Date().toISOString() })
            .eq('id', projectId)
        }
      } catch (dbError) {
        console.warn('Failed to update project status in database:', dbError)
      }
      
      console.log(`Analysis completed for project ${projectId}:`, {
        characters: result.characters?.length || 0,
        scenes: result.scenes?.length || 0,
      })
    } else {
      console.error(`Analysis failed for project ${projectId}:`, result.error)
      
      // 更新内存中的项目状态
      if (projectIndex !== -1) {
        memoryProjects[projectIndex].status = 'error'
      }
      
      // 更新数据库中的项目状态
      try {
        const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
        
        if (isDatabaseConfigured()) {
          const db = getSupabaseClient()
          await db
            .from('projects')
            .update({ status: 'error', updated_at: new Date().toISOString() })
            .eq('id', projectId)
        }
      } catch (dbError) {
        console.warn('Failed to update project status in database:', dbError)
      }
    }
  } catch (error) {
    console.error('Failed to trigger analysis:', error)
    // 更新项目状态为错误
    const projectIndex = memoryProjects.findIndex(p => p.id === projectId)
    if (projectIndex !== -1) {
      memoryProjects[projectIndex].status = 'error'
    }
    
    // 更新数据库中的项目状态
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        await db
          .from('projects')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }
    } catch (dbError) {
      console.warn('Failed to update project status in database:', dbError)
    }
  }
}
