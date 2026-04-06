/**
 * 单个项目 API 路由
 * 提供单个项目的操作
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { 
  memoryProjects, 
  memoryCharacters, 
  memoryScenes, 
  memoryEpisodes,
  generateId 
} from '@/lib/memory-storage'

interface RouteParams {
  params: Promise<{ id: string }>
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
    const { id } = await params
    console.log(`[Project API] Fetching project: ${id}`)
    
    // 尝试从数据库获取
    let useDatabase = false
    try {
      const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        // 优先使用 admin 客户端（绕过 RLS）
        const db = getAdminClient()
        
        // 获取项目
        const { data: project, error: projectError } = await db
          .from('projects')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        
        console.log(`[Project API] Database query result:`, {
          hasProject: !!project,
          projectError: projectError?.message
        })
        
        // 如果表不存在或其他数据库错误，回退到内存存储
        if (projectError) {
          console.warn('[Project API] Database query error, falling back to memory:', projectError.message)
        } else if (project) {
          useDatabase = true
          // 获取人物
          const { data: characters, error: charError } = await db
            .from('characters')
            .select('*')
            .eq('project_id', id)
          
          console.log(`[Project API] Characters query:`, {
            count: characters?.length,
            error: charError?.message
          })
          
          if (charError) console.warn('[Project API] Failed to fetch characters:', charError.message)
          
          // 获取分镜
          const { data: scenes, error: sceneError } = await db
            .from('scenes')
            .select('*')
            .eq('project_id', id)
            .order('scene_number', { ascending: true })
          
          console.log(`[Project API] Scenes query:`, {
            count: scenes?.length,
            error: sceneError?.message
          })
          
          // 获取剧集
          const { data: episodes, error: epError } = await db
            .from('episodes')
            .select('*')
            .eq('project_id', id)
          
          if (epError) console.warn('Failed to fetch episodes:', epError.message)
          
          return successResponse({
            project: {
              id: project.id,
              name: project.name,
              description: project.description,
              sourceContent: project.source_content,
              sourceType: project.source_type,
              style: project.style || 'realistic_cinema',
              status: project.status,
              createdAt: project.created_at,
              updatedAt: project.updated_at,
            },
            characters: (characters || []).map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              appearance: c.appearance,
              personality: c.personality,
              tags: c.tags || [],
              frontViewKey: c.front_view_key,
              sideViewKey: c.side_view_key,
              backViewKey: c.back_view_key,
              status: c.status,
              // imageUrl 优先使用 front_view_key（可能是完整URL或文件key）
              imageUrl: c.front_view_key
                ? (c.front_view_key.startsWith('http')
                    ? c.front_view_key
                    : `/characters/${c.front_view_key}`)
                : c.image_url,
              createdAt: c.created_at,
            })),
            scenes: (scenes || []).map((s: any) => ({
              id: s.id,
              sceneNumber: s.scene_number,
              title: s.title,
              description: s.description,
              dialogue: s.dialogue,
              action: s.action,
              emotion: s.emotion,
              characterIds: s.character_ids || [],
              scriptId: s.script_id,
              imageKey: s.image_key,
              imageUrl: s.image_url,
              videoUrl: s.video_url,
              videoStatus: s.video_status,
              status: s.status,
              metadata: s.metadata,
              createdAt: s.created_at,
            })),
            episodes: episodes || [],
          })
        }
      }
    } catch (dbError) {
      console.warn('Database not available, using memory storage:', dbError)
    }
    
    // 使用内存存储（数据库未配置或查询失败时）
    console.log(`[Project API] Using memory storage for project: ${id}`)
    console.log(`[Project API] Memory projects: ${memoryProjects.length}, characters: ${memoryCharacters.length}, scenes: ${memoryScenes.length}`)
    
    const project = memoryProjects.find(p => p.id === id)
    
    if (!project) {
      console.warn(`[Project API] Project not found in memory: ${id}`)
      return errorResponse('项目不存在', 404)
    }
    
    const characters = memoryCharacters.filter(c => c.projectId === id)
    const scenes = memoryScenes.filter(s => s.projectId === id)
    const episodes = memoryEpisodes.filter(e => e.projectId === id)
    
    console.log(`[Project API] Found in memory: project=${project.name}, characters=${characters.length}, scenes=${scenes.length}`)
    
    return successResponse({
      project,
      characters,
      scenes,
      episodes,
    })
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
    const { id } = await params
    const body = await request.json()
    
    // 尝试更新数据库
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        }
        if (body.name) updateData.name = body.name
        if (body.description !== undefined) updateData.description = body.description
        if (body.status) updateData.status = body.status
        
        const { data, error } = await db
          .from('projects')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        
        if (!error && data) {
          return successResponse({
            project: {
              id: data.id,
              name: data.name,
              description: data.description,
              sourceContent: data.source_content,
              sourceType: data.source_type,
              status: data.status,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }
          })
        }
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }
    
    // 更新内存
    const index = memoryProjects.findIndex(p => p.id === id)
    if (index !== -1) {
      memoryProjects[index] = {
        ...memoryProjects[index],
        ...body,
        updatedAt: new Date().toISOString(),
      }
      return successResponse({ project: memoryProjects[index] })
    }
    
    return errorResponse('项目不存在', 404)
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
    const { id } = await params
    
    // 尝试从数据库删除
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        
        // 删除关联数据
        await db.from('scenes').delete().eq('project_id', id)
        await db.from('characters').delete().eq('project_id', id)
        await db.from('episodes').delete().eq('project_id', id)
        
        // 删除项目
        await db.from('projects').delete().eq('id', id)
        
        return successResponse({ deleted: true })
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }
    
    // 从内存删除
    const projectIndex = memoryProjects.findIndex(p => p.id === id)
    if (projectIndex !== -1) {
      memoryProjects.splice(projectIndex, 1)
      
      // 删除关联的人物和分镜
      for (let i = memoryCharacters.length - 1; i >= 0; i--) {
        if (memoryCharacters[i].projectId === id) {
          memoryCharacters.splice(i, 1)
        }
      }
      
      for (let i = memoryScenes.length - 1; i >= 0; i--) {
        if (memoryScenes[i].projectId === id) {
          memoryScenes.splice(i, 1)
        }
      }
      
      for (let i = memoryEpisodes.length - 1; i >= 0; i--) {
        if (memoryEpisodes[i].projectId === id) {
          memoryEpisodes.splice(i, 1)
        }
      }
      
      return successResponse({ deleted: true })
    }
    
    return errorResponse('项目不存在', 404)
  } catch (error) {
    return errorResponse(error)
  }
}
