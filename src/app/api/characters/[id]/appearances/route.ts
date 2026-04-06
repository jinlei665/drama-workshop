/**
 * 人物形象管理 API
 * 支持添加、删除、列表、设置主形象
 * 使用 pg 直连，避免 Supabase schema cache 问题
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { Pool } from 'pg'

// PostgreSQL 连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

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

    try {
      const result = await pool.query(
        `SELECT * FROM character_appearances
         WHERE character_id = $1
         ORDER BY created_at DESC`,
        [characterId]
      )

      const appearances = result.rows.map((row) => ({
        id: row.id,
        characterId: row.character_id,
        name: row.name,
        imageKey: row.image_key,
        imageUrl: row.image_url,
        isPrimary: row.is_primary,
        description: row.description,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      return successResponse({ appearances })
    } catch (dbError) {
      console.error('Database query error:', dbError)
      return errorResponse('数据库查询失败', 500)
    }
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
  const client = await pool.connect()
  try {
    const { id: characterId } = await params
    const body = await getJSON<{
      name?: string
      imageKey: string
      imageUrl?: string
      description?: string
      tags?: string[]
    }>(request)

    console.log('[Add Appearance] Request body:', JSON.stringify(body, null, 2))

    if (!body.imageKey) {
      console.error('[Add Appearance] imageKey is empty')
      return errorResponse('imageKey 不能为空', 400)
    }

    try {
      // 检查是否是第一个形象，如果是则设为主形象
      const existingResult = await client.query(
        'SELECT COUNT(*) as count FROM character_appearances WHERE character_id = $1',
        [characterId]
      )
      const count = parseInt(existingResult.rows[0].count)
      const isFirst = count === 0

      console.log('[Add Appearance] isFirst:', isFirst, 'count:', count)

      // 插入新形象
      const insertResult = await client.query(
        `INSERT INTO character_appearances
         (character_id, name, image_key, image_url, is_primary, description, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          characterId,
          body.name || '默认形象',
          body.imageKey,
          body.imageUrl || null,
          isFirst,
          body.description || null,
          body.tags || [],
        ]
      )

      const data = insertResult.rows[0]

      console.log('[Add Appearance] Insert success:', {
        id: data.id,
        name: data.name,
        imageKey: data.image_key,
      })

      const response = successResponse({
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

      console.log('[Add Appearance] Response created, status:', response.status)
      return response
    } catch (dbError) {
      console.error('[Add Appearance] Database error:', dbError)
      return errorResponse(dbError instanceof Error ? dbError.message : '添加失败', 500)
    }
  } catch (error) {
    console.error('[Add Appearance] Error:', error)
    return errorResponse(error)
  } finally {
    client.release()
  }
}
