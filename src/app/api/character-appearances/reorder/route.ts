/**
 * 批量更新形象排序 API
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'

/**
 * PUT /api/character-appearances/reorder
 * 批量更新形象的排序
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await getJSON<{
      characterId: string
      appearanceIds: string[]
    }>(request)

    if (!body.characterId || !body.appearanceIds || !Array.isArray(body.appearanceIds)) {
      return errorResponse('缺少必要参数', 400)
    }

    try {
      const { getPool } = await import('@/storage/database/pg-client')

      const pool = await getPool()

      if (!pool) {
        return errorResponse('数据库未配置', 500)
      }

      // 使用事务批量更新排序
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        // 更新每个形象的 sort_order
        for (let i = 0; i < body.appearanceIds.length; i++) {
          const appearanceId = body.appearanceIds[i]
          await client.query(
            'UPDATE character_appearances SET sort_order = $1 WHERE id = $2 AND character_id = $3',
            [i, appearanceId, body.characterId]
          )
        }

        await client.query('COMMIT')

        return successResponse({
          message: '排序更新成功',
          count: body.appearanceIds.length
        })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (dbError) {
      console.warn('Database error:', dbError)
      return errorResponse('数据库操作失败', 500)
    }
  } catch (error) {
    console.error('Reorder error:', error)
    return errorResponse(error)
  }
}
