/**
 * 人物库 API
 * 用于保存和获取通用人物模板
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { getSupabaseClient, isDatabaseConfigured } from '@/storage/database/supabase-client'
import { memoryCharacters, generateId } from '@/lib/memory-storage'

// 内存存储的人物库
const characterLibrary: any[] = []

/**
 * GET /api/character-library
 * 获取人物库列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    
    // 尝试从数据库获取
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        let query = db
          .from('character_library')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
        }
        
        const { data, error } = await query
        
        if (!error && data) {
          return successResponse({ characters: data })
        }
      } catch (dbError) {
        console.warn('Database query failed, using memory:', dbError)
      }
    }
    
    // 使用内存存储
    let filtered = characterLibrary
    if (search) {
      filtered = characterLibrary.filter(c => 
        c.name.includes(search) || 
        (c.description && c.description.includes(search))
      )
    }
    
    return successResponse({ characters: filtered })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/character-library
 * 添加人物到人物库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await getJSON<{
      name: string
      description?: string
      appearance: string
      personality?: string
      tags?: string[]
      imageUrl?: string
      frontViewKey?: string
      style?: string
    }>(request)
    
    if (!body.name?.trim()) {
      return errorResponse('人物名称不能为空', 400)
    }
    
    if (!body.appearance?.trim()) {
      return errorResponse('外貌描述不能为空', 400)
    }
    
    const character = {
      id: generateId('lib'),
      name: body.name,
      description: body.description || '',
      appearance: body.appearance,
      personality: body.personality || '',
      tags: body.tags || [],
      imageUrl: body.imageUrl || null,
      frontViewKey: body.frontViewKey || null,
      style: body.style || 'realistic',
      createdAt: new Date().toISOString(),
    }
    
    // 尝试保存到数据库
    let savedToDatabase = false
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('character_library')
          .insert({
            id: character.id,
            name: character.name,
            description: character.description,
            appearance: character.appearance,
            personality: character.personality,
            tags: character.tags,
            image_url: character.imageUrl,
            front_view_key: character.frontViewKey,
            style: character.style,
          })
          .select()
          .single()
        
        if (!error && data) {
          savedToDatabase = true
        }
      } catch (dbError) {
        console.warn('Failed to save to database:', dbError)
      }
    }
    
    // 如果数据库保存失败，保存到内存
    if (!savedToDatabase) {
      characterLibrary.unshift(character)
    }
    
    return successResponse({ character }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * DELETE /api/character-library?id=xxx
 * 从人物库删除人物
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return errorResponse('缺少人物ID', 400)
    }
    
    // 尝试从数据库删除
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { error } = await db
          .from('character_library')
          .delete()
          .eq('id', id)
        
        if (!error) {
          return successResponse({ success: true })
        }
      } catch (dbError) {
        console.warn('Failed to delete from database:', dbError)
      }
    }
    
    // 从内存删除
    const index = characterLibrary.findIndex(c => c.id === id)
    if (index !== -1) {
      characterLibrary.splice(index, 1)
      return successResponse({ success: true })
    }
    
    return errorResponse('人物不存在', 404)
  } catch (error) {
    return errorResponse(error)
  }
}
