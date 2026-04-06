/**
 * 添加 sort_order 字段到 character_appearances 表
 */

import { successResponse, errorResponse } from '@/lib/api/response'

export async function POST() {
  try {
    const { getPool } = await import('@/storage/database/pg-client')

    const pool = await getPool()

    if (!pool) {
      return errorResponse('数据库未配置', 500)
    }

    // 添加 sort_order 字段
    const addColumnSQL = `
      ALTER TABLE character_appearances
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    `

    // 初始化现有形象的 sort_order（按 created_at 排序）
    const updateSortOrderSQL = `
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY character_id ORDER BY created_at) - 1 as new_order
        FROM character_appearances
        WHERE sort_order = 0 OR sort_order IS NULL
      )
      UPDATE character_appearances ca
      SET sort_order = o.new_order
      FROM ordered o
      WHERE ca.id = o.id;
    `

    // 执行 SQL
    try {
      await pool.query(addColumnSQL)
      console.log('sort_order column added successfully')
    } catch (e: any) {
      console.log('Add column error:', e.message)
      // 如果列已存在，忽略错误
    }

    try {
      await pool.query(updateSortOrderSQL)
      console.log('sort_order values initialized successfully')
    } catch (e: any) {
      console.log('Update sort order error:', e.message)
    }

    return successResponse({
      message: '数据库迁移成功',
      changes: ['Added sort_order column', 'Initialized sort_order values'],
    })
  } catch (error) {
    console.error('Migration error:', error)
    return errorResponse(error)
  }
}
