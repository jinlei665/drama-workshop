/**
 * 单个人物形象 API
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'

/**
 * DELETE /api/character-appearances/[id]
 * 删除人物形象
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appearanceId } = await params

    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()

        // 先获取形象信息，获取characterId
        const { data: appearance } = await db
          .from('character_appearances')
          .select('character_id, is_primary')
          .eq('id', appearanceId)
          .single()

        if (!appearance) {
          return errorResponse('形象不存在', 404)
        }

        // 删除形象
        const { error } = await db
          .from('character_appearances')
          .delete()
          .eq('id', appearanceId)

        if (error) {
          return errorResponse(error.message, 500)
        }

        // 如果删除的是主形象，需要设置另一个形象为主形象
        if (appearance.is_primary) {
          const { data: remaining } = await db
            .from('character_appearances')
            .select('id')
            .eq('character_id', appearance.character_id)
            .limit(1)

          if (remaining && remaining.length > 0) {
            await db
              .from('character_appearances')
              .update({ is_primary: true })
              .eq('id', remaining[0].id)
          }
        }

        return successResponse({ message: '删除成功' })
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }

    return errorResponse('数据库不可用', 500)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PATCH /api/character-appearances/[id]
 * 更新人物形象信息
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appearanceId } = await params
    const body = await getJSON<{
      name?: string
      imageUrl?: string
      isPrimary?: boolean
      description?: string
      tags?: string[]
    }>(request)

    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()

        // 如果设置为主形象，需要先将其他形象设为非主
        if (body.isPrimary === true) {
          // 先获取characterId
          const { data: appearance } = await db
            .from('character_appearances')
            .select('character_id')
            .eq('id', appearanceId)
            .single()

          if (appearance) {
            await db
              .from('character_appearances')
              .update({ is_primary: false })
              .eq('character_id', appearance.character_id)
          }
        }

        // 更新形象
        const { data, error } = await db
          .from('character_appearances')
          .update({
            ...(body.name !== undefined && { name: body.name }),
            ...(body.imageUrl !== undefined && { image_url: body.imageUrl }),
            ...(body.isPrimary !== undefined && { is_primary: body.isPrimary }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.tags !== undefined && { tags: body.tags }),
          })
          .eq('id', appearanceId)
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
          })
        }

        return errorResponse(error?.message || '更新失败', 500)
      }
    } catch (dbError) {
      console.warn('Database not available:', dbError)
    }

    return errorResponse('数据库不可用', 500)
  } catch (error) {
    return errorResponse(error)
  }
}
