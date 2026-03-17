/**
 * 统一数据库客户端
 * 支持本地 MySQL 和 Supabase (PostgreSQL)
 * 
 * 使用方法：
 * 1. 本地 MySQL: 设置 DATABASE_TYPE=mysql 和 DATABASE_URL=mysql://user:pass@host:port/db
 * 2. Supabase: 设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { Pool } from 'mysql2/promise';

// 数据库类型
export type DatabaseType = 'mysql' | 'supabase';

// 缓存的客户端
let cachedPool: Pool | null = null;
let cachedSupabaseClient: any = null;

/**
 * 获取数据库类型
 */
export function getDatabaseType(): DatabaseType {
  const type = process.env.DATABASE_TYPE?.toLowerCase();
  if (type === 'mysql') {
    return 'mysql';
  }
  
  // 检查是否配置了 Supabase
  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL) {
    return 'supabase';
  }
  
  // 默认尝试 MySQL（本地开发优先）
  if (process.env.DATABASE_URL) {
    return 'mysql';
  }
  
  return 'supabase';
}

/**
 * 加载环境变量
 */
function loadEnv(): void {
  try {
    require('dotenv').config();
  } catch {
    // dotenv 不可用
  }
}

/**
 * 获取 MySQL 连接池
 */
async function getMysqlPool(): Promise<Pool> {
  if (cachedPool) {
    return cachedPool;
  }
  
  loadEnv();
  
  const mysql = await import('mysql2/promise');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'MySQL 数据库未配置。\n' +
      '请在 .env 文件中设置 DATABASE_URL=mysql://user:password@host:port/database'
    );
  }
  
  // 解析连接字符串
  const url = new URL(databaseUrl);
  
  cachedPool = mysql.createPool({
    host: url.hostname || 'localhost',
    port: parseInt(url.port) || 3306,
    user: url.username || 'root',
    password: url.password || '',
    database: url.pathname.slice(1) || 'drama_studio',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  
  return cachedPool;
}

/**
 * 获取 Supabase 客户端
 */
async function getSupabaseClient() {
  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }
  
  loadEnv();
  
  const url = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error(
      'Supabase 未配置。\n' +
      '请在 .env 文件中设置以下环境变量：\n' +
      '  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
      '  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...\n\n' +
      '或者使用本地 MySQL 数据库：\n' +
      '  DATABASE_TYPE=mysql\n' +
      '  DATABASE_URL=mysql://root:password@localhost:3306/drama_studio'
    );
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  
  cachedSupabaseClient = createClient(url, anonKey, {
    db: { timeout: 60000 },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  return cachedSupabaseClient;
}

/**
 * 获取数据库客户端
 * 返回统一的数据库操作接口
 */
export async function getDb() {
  const dbType = getDatabaseType();
  
  if (dbType === 'mysql') {
    const pool = await getMysqlPool();
    return {
      type: 'mysql' as const,
      pool,
      // 提供与 Supabase 类似的 API
      from: (table: string) => new MySqlQueryBuilder(pool, table),
    };
  }
  
  const client = await getSupabaseClient();
  return {
    type: 'supabase' as const,
    client,
    from: (table: string) => client.from(table),
  };
}

/**
 * MySQL 查询构建器
 * 提供与 Supabase 类似的 API
 */
class MySqlQueryBuilder {
  private pool: Pool;
  private table: string;
  private conditions: string[] = [];
  private params: any[] = [];
  private orderClause: string = '';
  private limitClause: string = '';
  private selectFields: string = '*';
  
  constructor(pool: Pool, table: string) {
    this.pool = pool;
    this.table = table;
  }
  
  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }
  
  eq(column: string, value: any) {
    this.conditions.push(`${column} = ?`);
    this.params.push(value);
    return this;
  }
  
  order(column: string, direction: 'asc' | 'desc' = 'asc') {
    this.orderClause = `ORDER BY ${column} ${direction.toUpperCase()}`;
    return this;
  }
  
  limit(count: number) {
    this.limitClause = `LIMIT ${count}`;
    return this;
  }
  
  async single() {
    this.limitClause = 'LIMIT 1';
    const result = await this.execute();
    return { data: result[0] || null, error: null };
  }
  
  async execute() {
    let sql = `SELECT ${this.selectFields} FROM ${this.table}`;
    
    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    
    if (this.orderClause) {
      sql += ` ${this.orderClause}`;
    }
    
    if (this.limitClause) {
      sql += ` ${this.limitClause}`;
    }
    
    const [rows] = await this.pool.execute(sql, this.params);
    return rows as any[];
  }
  
  // 提供与 Supabase 兼容的 then 方法
  then(resolve: (value: any) => void, reject?: (reason: any) => void) {
    return this.execute().then(resolve, reject);
  }
}

/**
 * 执行原生 SQL 查询
 */
export async function executeSql(sql: string, params?: any[]): Promise<any> {
  const dbType = getDatabaseType();
  
  if (dbType === 'mysql') {
    const pool = await getMysqlPool();
    const [results] = await pool.execute(sql, params);
    return results;
  }
  
  // Supabase 不支持原生 SQL，使用 RPC
  throw new Error('Supabase 不支持原生 SQL 查询');
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
  cachedSupabaseClient = null;
}

// 导出便捷函数
export { getMysqlPool, getSupabaseClient };
