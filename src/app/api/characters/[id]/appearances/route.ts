/**
 * 人物形象管理 API
 * 支持添加、删除、列表、设置主形象
 * 使用 Supabase + pg fallback 机制，避免 IPv6 连接问题
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

    try {
      // 优先使用 Supabase
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
    } catch (supabaseError) {
      console.warn('[Get Appearances] Supabase failed, falling back to pg:', supabaseError)
    }

    // Fallback to pg
    try {
      const { getPool } = await import('@/storage/database/pg-client')
      const pool = await getPool()

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
    } catch (pgError) {
      console.error('[Get Appearances] PG query error:', pgError)
      return successResponse({ appearances: [] })
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
      // 优先使用 Supabase
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

        console.log('[Add Appearance] Supabase insert result:', { data, error })

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

        console.warn('[Add Appearance] Supabase error:', error)
      }
    } catch (supabaseError) {
      console.warn('[Add Appearance] Supabase failed, falling back to pg:', supabaseError)
    }

    // Fallback to pg
    try {
      const { getPool } = await import('@/storage/database/pg-client')
      const pool = await getPool()

      // 检查是否是第一个形象，如果是则设为主形象
      const existingResult = await pool.query(
        'SELECT COUNT(*) as count FROM character_appearances WHERE character_id = $1',
        [characterId]
      )
      const count = parseInt(existingResult.rows[0].count)
      const isFirst = count === 0

      console.log('[Add Appearance] PG isFirst:', isFirst, 'count:', count)

      // 插入新形象
      const insertResult = await pool.query(
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

      console.log('[Add Appearance] PG insert success:', {
        id: data.id,
        name: data.name,
        imageKey: data.image_key,
      })

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
    } catch (pgError) {
      console.error('[Add Appearance] PG error:', pgError)
      return errorResponse(pgError instanceof Error ? pgError.message : '添加失败', 500)
    }
  } catch (error) {
    console.error('[Add Appearance] Error:', error)
    return errorResponse(error)
  }
}
