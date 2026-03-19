/**
 * 项目工作流 API
 * 用于获取和保存项目的工作流配置
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { memoryProjects } from '@/lib/memory-storage'
import { getDefaultWorkflow } from '@/lib/workflow/default-workflow'
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
          .select('metadata')
          .eq('id', id)
          .maybeSingle()
        
        if (!error && data?.metadata) {
          const metadata = data.metadata as Record<string, unknown>
          if (metadata.workflow) {
            return successResponse({ workflow: metadata.workflow })
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
    }
    
    // 如果没有保存的工作流，返回默认工作流
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
 * 重置项目的工作流为默认配置
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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
