/**
 * 项目工作流 API
 * 用于获取和保存项目的工作流配置
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { memoryProjects } from '@/lib/memory-storage'
import { getDefaultWorkflow } from '@/lib/workflow/default-workflow'
import { createSystemWorkflow } from '@/lib/workflow/system-workflow'
import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

interface ProjectWorkflow {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * GET /api/projects/[id]/workflow
 * 获取项目的工作流配置
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 尝试从数据库获取
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('projects')
          .select('metadata, name, source_content, style')
          .eq('id', id)
          .maybeSingle()

        if (!error && data?.metadata) {
          const metadata = data.metadata as Record<string, unknown>
          if (metadata.workflow) {
            return successResponse({ workflow: metadata.workflow })
          } else {
            // 项目存在但没有工作流，返回提示需要生成系统工作流
            return successResponse({
              workflow: null,
              needsSystemWorkflow: true,
              projectName: data.name,
              sourceContent: data.source_content,
              style: data.style,
            })
          }
        }
      }
    } catch (dbError) {
      console.warn('Database not available, using memory storage:', dbError)
    }

    // 从内存存储获取
    const project = memoryProjects.find(p => p.id === id)
    if (project?.metadata?.workflow) {
      return successResponse({ workflow: project.metadata.workflow })
    } else if (project) {
      // 项目存在但没有工作流，返回提示需要生成系统工作流
      return successResponse({
        workflow: null,
        needsSystemWorkflow: true,
        projectName: project.name,
        sourceContent: project.sourceContent,
        style: project.style,
      })
    }

    // 如果项目不存在，返回默认工作流
    const defaultWorkflow = getDefaultWorkflow()
    return successResponse({
      workflow: defaultWorkflow,
      isDefault: true
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PUT /api/projects/[id]/workflow
 * 保存项目的工作流配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await getJSON<ProjectWorkflow>(request)
    
    if (!body.nodes || !Array.isArray(body.nodes)) {
      return errorResponse('无效的节点数据', 400)
    }
    
    if (!body.edges || !Array.isArray(body.edges)) {
      return errorResponse('无效的连接数据', 400)
    }
    
    const workflow: ProjectWorkflow = {
      nodes: body.nodes,
      edges: body.edges,
    }
    
    // 尝试保存到数据库
    let savedToDatabase = false
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        
        // 先获取现有的 metadata
        const { data: existingProject } = await db
          .from('projects')
          .select('metadata')
          .eq('id', id)
          .maybeSingle()
        
        const existingMetadata = (existingProject?.metadata as Record<string, unknown>) || {}
        
        const { error } = await db
          .from('projects')
          .update({
            metadata: {
              ...existingMetadata,
              workflow,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        
        if (!error) {
          savedToDatabase = true
        }
      }
    } catch (dbError) {
      console.warn('Failed to save workflow to database:', dbError)
    }
    
    // 同时更新内存存储
    const projectIndex = memoryProjects.findIndex(p => p.id === id)
    if (projectIndex !== -1) {
      const existingMetadata = (memoryProjects[projectIndex].metadata as Record<string, unknown>) || {}
      memoryProjects[projectIndex].metadata = {
        ...existingMetadata,
        workflow,
      }
    }
    
    return successResponse({ 
      workflow,
      savedToDatabase,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/projects/[id]/workflow
 * 生成系统工作流（为旧项目补充）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await getJSON<{ generate?: boolean }>(request)

    // 如果是生成系统工作流的请求
    if (body.generate === true) {
      // 获取项目信息
      let project: any = null

      try {
        const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

        if (isDatabaseConfigured()) {
          const db = getSupabaseClient()
          const { data, error } = await db
            .from('projects')
            .select('id, name, source_content, style, metadata')
            .eq('id', id)
            .maybeSingle()

          if (!error && data) {
            project = data
          }
        }
      } catch (dbError) {
        console.warn('Database not available, using memory storage:', dbError)
      }

      // 从内存获取项目
      if (!project) {
        project = memoryProjects.find(p => p.id === id)
      }

      if (!project) {
        return errorResponse('项目不存在', 404)
      }

      // 生成系统工作流
      const systemWorkflow = createSystemWorkflow(
        project.id,
        project.name,
        project.sourceContent,
        project.style
      )

      // 保存到数据库
      try {
        const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

        if (isDatabaseConfigured()) {
          const db = getSupabaseClient()
          const existingMetadata = (project.metadata as Record<string, unknown>) || {}

          await db
            .from('projects')
            .update({
              metadata: {
                ...existingMetadata,
                workflow: systemWorkflow,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          console.log(`✅ 系统工作流已保存到数据库: ${systemWorkflow.id}`)
        }
      } catch (dbError) {
        console.warn('系统工作流保存到数据库失败，保存到内存:', dbError)
      }

      // 保存到内存
      const projectIndex = memoryProjects.findIndex(p => p.id === id)
      if (projectIndex !== -1) {
        if (!memoryProjects[projectIndex].metadata) {
          memoryProjects[projectIndex].metadata = {}
        }
        memoryProjects[projectIndex].metadata!.workflow = systemWorkflow
        console.log(`✅ 系统工作流已保存到内存: ${systemWorkflow.id}`)
      }

      return successResponse({
        workflow: systemWorkflow,
        message: '系统工作流生成成功',
      })
    }

    // 重置为默认工作流（保留旧功能）
    const defaultWorkflow = getDefaultWorkflow()

    // 尝试保存到数据库
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()

        // 先获取现有的 metadata
        const { data: existingProject } = await db
          .from('projects')
          .select('metadata')
          .eq('id', id)
          .maybeSingle()

        const existingMetadata = (existingProject?.metadata as Record<string, unknown>) || {}

        await db
          .from('projects')
          .update({
            metadata: {
              ...existingMetadata,
              workflow: defaultWorkflow,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
      }
    } catch (dbError) {
      console.warn('Failed to save workflow to database:', dbError)
    }

    // 同时更新内存存储
    const projectIndex = memoryProjects.findIndex(p => p.id === id)
    if (projectIndex !== -1) {
      const existingMetadata = (memoryProjects[projectIndex].metadata as Record<string, unknown>) || {}
      memoryProjects[projectIndex].metadata = {
        ...existingMetadata,
        workflow: defaultWorkflow,
      }
    }

    return successResponse({
      workflow: defaultWorkflow,
      isDefault: true,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
