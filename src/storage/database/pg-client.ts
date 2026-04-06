/**
 * PostgreSQL 直连客户端
 * 用于绕过 Supabase PostgREST schema cache 问题
 */

import { Pool } from "pg"

// 全局连接池
let pool: Pool | null = null

// IPv4 地址映射（从环境变量读取，避免硬编码）
const DB_IPV4_HOST = process.env.PGDATABASE_IPV4_HOST || process.env.DB_IPV4_HOST || ''

/**
 * 从连接字符串中提取主机信息
 */
function parseConnectionString(connectionString: string): { host: string; port: number; database: string; user?: string; password?: string } {
  try {
    // 解析 postgresql://user:pass@host:port/database?options
    const match = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/)
    if (match) {
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4], 10),
        database: match[5],
      }
    }
  } catch (e) {
    console.error("[PG Client] Failed to parse connection string:", e)
  }
  throw new Error("无法解析数据库连接字符串")
}

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

  // 解析连接字符串
  const parsed = parseConnectionString(connectionString)

  // 优先使用环境变量中指定的 IPv4 地址
  const host = DB_IPV4_HOST || parsed.host

  pool = new Pool({
    host,
    port: parsed.port,
    database: parsed.database,
    user: parsed.user,
    password: parsed.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('sslmode=verify-full') ? { 
      rejectUnauthorized: false,
    } : undefined,
  })

  // 记录连接池状态
  pool.on('error', (err) => {
    console.error("[PG Client] Unexpected pool error:", err)
  })

  console.log(`[PG Client] PostgreSQL pool created (host: ${host})`)
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
