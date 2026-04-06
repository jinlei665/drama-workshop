/**
 * PostgreSQL 直连客户端
 * 用于绕过 Supabase PostgREST schema cache 问题
 */

import { Pool } from "pg"

// 全局连接池
let pool: Pool | null = null

/**
 * 获取 PostgreSQL 连接池
 */
export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool
  }

  // 获取数据库连接配置（按优先级）
  const connectionString = 
    process.env.DATABASE_URL || 
    process.env.COZE_DATABASE_URL ||
    process.env.PGDATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL 未配置")
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  })

  // 测试连接
  try {
    const client = await pool.connect()
    client.release()
    console.log("[PG Client] Connected to PostgreSQL")
  } catch (err) {
    console.error("[PG Client] Failed to connect:", err)
    throw err
  }

  return pool
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
