/**
 * 单个人物 API 路由
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { memoryCharacters } from '@/lib/memory-storage'

/**
 * GET /api/characters/[id]
 * 获取单个人物
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
          .from('characters')
          .select('*')
          .eq('id', id)
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
              // imageUrl 优先使用 front_view_key（可能是完整URL或文件key）
              imageUrl: data.front_view_key
                ? (data.front_view_key.startsWith('http')
                    ? data.front_view_key
                    : `/characters/${data.front_view_key}`)
                : data.image_url,
              frontViewKey: data.front_view_key,
              projectId: data.project_id,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }
          })
        }
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }
    
    // 从内存获取
    const character = memoryCharacters.find(c => c.id === id)
    if (character) {
      return successResponse({ character })
    }
    
    return errorResponse('人物不存在', 404)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * DELETE /api/characters/[id]
 * 删除人物
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 尝试从数据库删除
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { error } = await db
          .from('characters')
          .delete()
          .eq('id', id)
        
        if (!error) {
          return successResponse({ success: true })
        }
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }
    
    // 从内存删除
    const index = memoryCharacters.findIndex(c => c.id === id)
    if (index !== -1) {
      memoryCharacters.splice(index, 1)
      return successResponse({ success: true })
    }
    
    return errorResponse('人物不存在', 404)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PATCH /api/characters/[id]
 * 更新人物
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    // 尝试更新数据库
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        
        const updateData: Record<string, any> = {}
        if (body.name) updateData.name = body.name
        if (body.description !== undefined) updateData.description = body.description
        if (body.appearance !== undefined) updateData.appearance = body.appearance
        if (body.personality !== undefined) updateData.personality = body.personality
        if (body.gender !== undefined) updateData.gender = body.gender
        if (body.age !== undefined) updateData.age = body.age
        if (body.style !== undefined) updateData.style = body.style
        if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl
        
        const { data, error } = await db
          .from('characters')
          .update(updateData)
          .eq('id', id)
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
              // imageUrl 优先使用 front_view_key
              imageUrl: data.front_view_key
                ? (data.front_view_key.startsWith('http')
                    ? data.front_view_key
                    : `/characters/${data.front_view_key}`)
                : data.image_url,
              frontViewKey: data.front_view_key,
              projectId: data.project_id,
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
    const index = memoryCharacters.findIndex(c => c.id === id)
    if (index !== -1) {
      memoryCharacters[index] = {
        ...memoryCharacters[index],
        ...body,
      }
      return successResponse({ character: memoryCharacters[index] })
    }
    
    return errorResponse('更新失败', 500)
  } catch (error) {
    return errorResponse(error)
  }
}
