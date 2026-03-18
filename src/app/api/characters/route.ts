/**
 * 人物 API 路由
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON, getQueryParams, parsePagination } from '@/lib/api/response'
import { memoryCharacters, generateUUID } from '@/lib/memory-storage'

/**
 * GET /api/characters
 * 获取人物列表
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request)
    const { pageSize, offset } = parsePagination(params)
    const projectId = params.get('projectId')
    
    // 尝试从数据库获取
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        
        let query = db.from('characters').select('*')
        if (projectId) {
          query = query.eq('project_id', projectId)
        }
        
        const { data, error } = await query.order('created_at', { ascending: false })
        
        if (!error && data) {
          // 转换字段名
          const characters = data.map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            appearance: c.appearance,
            personality: c.personality,
            gender: c.gender,
            age: c.age,
            style: c.style,
            imageUrl: c.image_url,
            projectId: c.project_id,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }))
          
          return successResponse({
            characters: characters.slice(offset, offset + pageSize),
            pagination: {
              page: Math.floor(offset / pageSize) + 1,
              pageSize,
              total: characters.length,
            },
          })
        }
      }
    } catch (dbError) {
      console.warn('Database not available, using memory storage:', dbError)
    }
    
    // 使用内存存储
    let filtered = memoryCharacters
    if (projectId) {
      filtered = filtered.filter(c => c.projectId === projectId)
    }
    
    const characters = filtered.slice(offset, offset + pageSize)
    return successResponse({
      characters,
      pagination: {
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
        total: filtered.length,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/characters
 * 创建新人物
 */
export async function POST(request: NextRequest) {
  try {
    const body = await getJSON<{
      name: string
      description?: string
      appearance?: string
      personality?: string
      gender?: string
      age?: string
      style?: string
      projectId?: string
    }>(request)
    
    if (!body.name?.trim()) {
      return errorResponse('人物名称不能为空', 400)
    }
    
    const character = {
      id: generateUUID(),  // 使用 UUID 格式
      name: body.name,
      description: body.description,
      appearance: body.appearance,
      personality: body.personality,
      gender: body.gender,
      age: body.age,
      style: body.style || 'realistic',
      projectId: body.projectId || '',
      tags: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    
    // 尝试保存到数据库
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('characters')
          .insert({
            id: character.id,  // 显式传入 ID
            name: character.name,
            description: character.description,
            appearance: character.appearance,
            personality: character.personality,
            gender: character.gender,
            age: character.age,
            style: character.style,
            project_id: character.projectId,
            status: character.status,
          })
          .select()
          .single()
        
        if (!error && data) {
          return successResponse({
            character: {
              id: data.id,
              name: data.name,
              description: data.description,
              appearance: data.appearance,
              personality: data.personality,
              gender: data.gender,
              age: data.age,
              style: data.style,
              imageUrl: data.image_url,
              projectId: data.project_id,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }
          }, 201)
        }
      }
    } catch (dbError) {
      console.warn('Database not available, saving to memory:', dbError)
    }
    
    // 保存到内存
    memoryCharacters.push(character)
    return successResponse({ character }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
