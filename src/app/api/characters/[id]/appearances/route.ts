/**
 * 人物形象管理 API
 * 支持添加、删除、列表、设置主形象
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'

/**
 * GET /api/characters/[id]/appearances
 * 获取人物的所有形象
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params

    // 尝试从数据库获取
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()

        const { data, error } = await db
          .from('character_appearances')
          .select('*')
          .eq('character_id', characterId)
          .order('created_at', { ascending: false })

        if (!error && data) {
          const appearances = data.map((app: any) => ({
            id: app.id,
            characterId: app.character_id,
            name: app.name,
            imageKey: app.image_key,
            imageUrl: app.image_url,
            isPrimary: app.is_primary,
            description: app.description,
            tags: app.tags || [],
            createdAt: app.created_at,
            updatedAt: app.updated_at,
          }))

          return successResponse({ appearances })
        }
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }

    return successResponse({ appearances: [] })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/characters/[id]/appearances
 * 添加人物新形象
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params
    const body = await getJSON<{
      name?: string
      imageKey: string
      imageUrl?: string
      description?: string
      tags?: string[]
    }>(request)

    if (!body.imageKey) {
      return errorResponse('imageKey 不能为空', 400)
    }

    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()

        // 检查是否是第一个形象，如果是则设为主形象
        const { data: existing } = await db
          .from('character_appearances')
          .select('id')
          .eq('character_id', characterId)

        const isFirst = !existing || existing.length === 0

        const { data, error } = await db
          .from('character_appearances')
          .insert({
            character_id: characterId,
            name: body.name || '默认形象',
            image_key: body.imageKey,
            image_url: body.imageUrl,
            is_primary: isFirst,
            description: body.description,
            tags: body.tags || [],
          })
          .select()
          .single()

        if (!error && data) {
          return successResponse({
            appearance: {
              id: data.id,
              characterId: data.character_id,
              name: data.name,
              imageKey: data.image_key,
              imageUrl: data.image_url,
              isPrimary: data.is_primary,
              description: data.description,
              tags: data.tags || [],
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            }
          }, 201)
        }

        return errorResponse(error?.message || '添加失败', 500)
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }

    return errorResponse('数据库不可用', 500)
  } catch (error) {
    return errorResponse(error)
  }
}
