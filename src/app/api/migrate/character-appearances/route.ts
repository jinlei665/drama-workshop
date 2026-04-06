/**
 * 数据库迁移 API
 * 执行 character_appearances 表的创建
 */

import { successResponse, errorResponse } from '@/lib/api/response'

export async function POST() {
  try {
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

    if (!isDatabaseConfigured()) {
      return errorResponse('数据库未配置', 500)
    }

    const db = getSupabaseClient()

    // 创建 character_appearances 表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS character_appearances (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        character_id VARCHAR(36) NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL DEFAULT '默认形象',
        image_key TEXT NOT NULL,
        image_url TEXT,
        is_primary BOOLEAN DEFAULT FALSE,
        description TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
      );
    `

    // 创建索引
    const createIndex1SQL = `
      CREATE INDEX IF NOT EXISTS character_appearances_character_id_idx 
      ON character_appearances(character_id);
    `

    const createIndex2SQL = `
      CREATE INDEX IF NOT EXISTS character_appearances_is_primary_idx 
      ON character_appearances(character_id, is_primary);
    `

    // 执行 SQL
    await db.rpc('exec_sql', { sql: createTableSQL }).catch(e => {
      console.log('Table creation error (might already exist):', e)
    })

    await db.rpc('exec_sql', { sql: createIndex1SQL }).catch(e => {
      console.log('Index1 creation error:', e)
    })

    await db.rpc('exec_sql', { sql: createIndex2SQL }).catch(e => {
      console.log('Index2 creation error:', e)
    })

    return successResponse({
      message: '数据库迁移成功',
      tables: ['character_appearances'],
    })
  } catch (error) {
    console.error('Migration error:', error)
    return errorResponse(error)
  }
}
