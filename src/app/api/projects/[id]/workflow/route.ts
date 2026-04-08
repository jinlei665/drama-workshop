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
 * 检查工作流是否为旧格式（没有使用 React Flow 的节点类型）
 */
function isOldWorkflowFormat(workflow: any): boolean {
  if (!workflow || !workflow.nodes) return false
  // 旧格式的节点类型可能是自定义的，不是新的节点类型
  const oldNodeTypes = ['script-to-scenes', 'image-input', 'video-compose']
  const newNodeTypes = ['text-input', 'text-to-image', 'image-to-video', 'text-to-character', 'character-triple-views']
  
  const nodeTypes = workflow.nodes.map((n: any) => n.type)
  // 如果有旧格式的节点类型但没有新格式的节点类型，说明是旧格式
  const hasOldType = nodeTypes.some((t: string) => oldNodeTypes.includes(t))
  const hasNewType = nodeTypes.some((t: string) => newNodeTypes.includes(t))
  
  return hasOldType && !hasNewType
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
    console.log(`🔍 GET Workflow API - 项目ID: ${id}`)

    // 尝试从数据库获取项目信息
    let projectData: any = null
    let existingWorkflow: any = null

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
          projectData = data
          console.log(`✅ 找到项目: ${data.name}`)
          
          // 检查是否有已保存的工作流
          if (data.metadata?.workflow) {
            existingWorkflow = data.metadata.workflow
            console.log(`📋 项目有已保存的工作流: ${existingWorkflow.id}`)
          }
        }
      }
    } catch (dbError) {
      console.warn('数据库查询失败:', dbError)
    }

    // 如果项目存在于内存中，也检查工作流
    const memoryProject = memoryProjects.find(p => p.id === id)
    if (!projectData && memoryProject) {
      projectData = memoryProject
      if (memoryProject.metadata?.workflow) {
        existingWorkflow = memoryProject.metadata.workflow
      }
    }

    // 生成新的系统工作流（使用项目内容填充参数）
    let systemWorkflow: any = null
    if (projectData) {
      console.log(`🔄 生成系统工作流`)
      systemWorkflow = createSystemWorkflow(
        projectData.id,
        projectData.name,
        projectData.source_content || projectData.sourceContent || '',
        projectData.style
      )
      console.log(`✨ 系统工作流生成完成: ${systemWorkflow.nodes.length} 个节点`)
    }

    // 决定返回哪个工作流
    let workflowToReturn: any
    let isSystem = false
    let readonly = true

    if (existingWorkflow) {
      // 如果有已保存的工作流，检查是否是旧格式
      if (isOldWorkflowFormat(existingWorkflow)) {
        console.log(`⚠️ 检测到旧格式工作流，将使用新的系统工作流`)
        workflowToReturn = systemWorkflow
        isSystem = true
        readonly = true
        
        // 异步更新数据库中的工作流
        tryUpdateWorkflow(id, systemWorkflow).catch(console.error)
      } else {
        console.log(`✅ 使用已保存的工作流: ${existingWorkflow.id}`)
        workflowToReturn = existingWorkflow
        // 检查是否是系统工作流
        isSystem = existingWorkflow.system === true
        readonly = existingWorkflow.readonly !== false
      }
    } else if (systemWorkflow) {
      // 没有已保存的工作流，使用新生成的系统工作流
      console.log(`📝 没有已保存的工作流，使用新生成的系统工作流`)
      workflowToReturn = systemWorkflow
      isSystem = true
      readonly = true
      
      // 异步保存到数据库
      tryUpdateWorkflow(id, systemWorkflow).catch(console.error)
    } else {
      // 项目不存在，返回默认工作流
      console.log(`⚠️ 项目不存在，返回默认工作流`)
      const defaultWorkflow = getDefaultWorkflow()
      return successResponse({
        workflow: defaultWorkflow,
        isDefault: true
      })
    }

    return successResponse({
      workflow: workflowToReturn,
      isSystem,
      readonly,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * 尝试更新项目的工作流数据
 */
async function tryUpdateWorkflow(projectId: string, workflow: any) {
  try {
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      const db = getSupabaseClient()
      await db
        .from('projects')
        .update({
          metadata: {
            workflow,
            workflowUpdatedAt: new Date().toISOString(),
          },
        })
        .eq('id', projectId)
      
      console.log(`✅ 工作流已更新到数据库`)
    }
  } catch (dbError) {
    console.warn('⚠️ 工作流更新失败:', dbError)
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
 * 强制重新生成系统工作流
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🔥 POST /api/projects/[id]/workflow - 强制重新生成系统工作流')

  try {
    const { id } = await params

    // 获取项目信息
    let project: any = null

    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('projects')
          .select('id, name, source_content, style')
          .eq('id', id)
          .maybeSingle()

        if (!error && data) {
          project = data
        }
      }
    } catch (dbError) {
      console.warn('Database query failed:', dbError)
    }

    // 从内存获取项目
    if (!project) {
      project = memoryProjects.find(p => p.id === id)
    }

    if (!project) {
      return errorResponse('项目不存在', 404)
    }

    // 生成新的系统工作流
    console.log(`🔄 重新生成系统工作流，项目: ${project.name}`)
    
    const systemWorkflow = createSystemWorkflow(
      project.id,
      project.name,
      project.source_content || project.sourceContent || '',
      project.style
    )

    // 保存到数据库
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        
        await db
          .from('projects')
          .update({
            metadata: {
              workflow: systemWorkflow,
              workflowUpdatedAt: new Date().toISOString(),
            },
          })
          .eq('id', id)

        console.log(`✅ 系统工作流已保存到数据库`)
      }
    } catch (dbError) {
      console.warn('Failed to save to database:', dbError)
    }

    // 保存到内存
    const projectIndex = memoryProjects.findIndex(p => p.id === id)
    if (projectIndex !== -1) {
      if (!memoryProjects[projectIndex].metadata) {
        memoryProjects[projectIndex].metadata = {}
      }
      memoryProjects[projectIndex].metadata!.workflow = systemWorkflow
    }

    return successResponse({
      workflow: systemWorkflow,
      message: '系统工作流已重新生成',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
