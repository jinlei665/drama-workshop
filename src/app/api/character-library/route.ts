/**
 * 人物库 API
 * 用于保存和获取通用人物模板
 * 
 * 数据库策略：优先使用沙箱环境的 Supabase（因为用户配置的 Supabase 可能没有 character_library 表）
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { getSupabaseClient, isDatabaseConfigured } from '@/storage/database/supabase-client'
import { memoryCharacterLibrary, generateId } from '@/lib/memory-storage'

// 获取人物库专用的数据库客户端
// 优先使用沙箱环境的 Supabase
function getCharacterLibraryClient() {
  const cozeUrl = process.env.COZE_SUPABASE_URL
  const cozeKey = process.env.COZE_SUPABASE_ANON_KEY
  
  if (cozeUrl && cozeKey) {
    // 使用沙箱环境的 Supabase
    console.log('[Character Library] Using sandbox Supabase:', cozeUrl)
    // eslint-disable-next-line no-eval
    const createClient = eval("require('@supabase/supabase-js')").createClient
    return createClient(cozeUrl, cozeKey, {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  
  // 回退到默认客户端
  return getSupabaseClient()
}

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
        const db = getCharacterLibraryClient()
        console.log('[Character Library] Querying database...')
        let query = db
          .from('character_library')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
        }
        
        const result = await query
        const { data, error } = result
        
        console.log('[Character Library] Query result:', { dataLength: data?.length, error })
        
        if (error) {
          console.warn('[Character Library] Database query error:', error)
        } else if (data) {
          // 转换 snake_case 到 camelCase
          const characters = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            appearance: item.appearance,
            personality: item.personality,
            tags: item.tags || [],
            imageUrl: item.image_url,
            frontViewKey: item.front_view_key,
            style: item.style,
            createdAt: item.created_at,
          }))
          console.log('[Character Library] Loaded from database, count:', characters.length)
          return successResponse({ characters })
        }
      } catch (dbError) {
        console.warn('[Character Library] Database query failed:', dbError)
      }
    }
    
    // 使用内存存储
    console.log('[Character Library] Using memory storage, count:', memoryCharacterLibrary.length)
    let filtered = memoryCharacterLibrary
    if (search) {
      filtered = memoryCharacterLibrary.filter(c => 
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
      imageUrl: body.imageUrl || undefined,
      frontViewKey: body.frontViewKey || undefined,
      style: body.style || 'realistic',
      createdAt: new Date().toISOString(),
    }
    
    // 尝试保存到数据库
    let savedToDatabase = false
    console.log('[Character Library] Trying to save to database...')
    
    try {
      const db = getCharacterLibraryClient()
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
      
      if (error) {
        console.warn('[Character Library] Database insert error:', error)
      } else if (data) {
        savedToDatabase = true
        console.log('[Character Library] Saved to database:', data)
      }
    } catch (dbError) {
      console.warn('[Character Library] Failed to save to database:', dbError)
    }
    
    // 如果数据库保存失败，保存到内存
    if (!savedToDatabase) {
      memoryCharacterLibrary.unshift(character)
      console.log('[Character Library] Saved to memory, total count:', memoryCharacterLibrary.length)
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
    try {
      const db = getCharacterLibraryClient()
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
    
    // 从内存删除
    const index = memoryCharacterLibrary.findIndex(c => c.id === id)
    if (index !== -1) {
      memoryCharacterLibrary.splice(index, 1)
      return successResponse({ success: true })
    }
    
    return errorResponse('人物不存在', 404)
  } catch (error) {
    return errorResponse(error)
  }
}
