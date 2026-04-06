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
    // 测试连接是否仍然有效
    try {
      const client = await pool.connect()
      const result = await client.query('SELECT 1')
      client.release()
      if (result.rows[0]['?column?'] === 1) {
        return pool
      }
    } catch (err) {
      console.warn("[PG Client] Pool connection failed, recreating:", err)
      // 连接失败，关闭并重新创建
      try {
        await pool.end()
      } catch (endErr) {
        console.error("[PG Client] Failed to end pool:", endErr)
      }
      pool = null
    }
  }

  // 获取数据库连接配置（按优先级）
  // 优先使用 Supabase 的 DATABASE_URL，避免使用沙箱的内部数据库
  let connectionString = process.env.DATABASE_URL

  // 如果 Supabase URL 不可用，再尝试其他方式
  if (!connectionString) {
    connectionString = process.env.PGDATABASE_URL
  }

  if (!connectionString) {
    connectionString = process.env.COZE_DATABASE_URL
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL 未配置")
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // 强制跳过证书验证（仅用于开发环境）
    ssl: {
      rejectUnauthorized: false,
    },
  })

  // 测试连接
  try {
    const client = await pool.connect()
    client.release()
    console.log("[PG Client] Connected to PostgreSQL")
  } catch (err) {
    console.error("[PG Client] Failed to connect:", err)
    pool = null
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
