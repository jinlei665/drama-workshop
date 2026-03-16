import mysql from 'mysql2/promise';

let envLoaded = false;

function loadEnv(): void {
  if (envLoaded || process.env.DATABASE_URL) {
    return;
  }

  try {
    require('dotenv').config();
    envLoaded = true;
  } catch {
    // dotenv not available
  }
}

let pool: mysql.Pool | null = null;

/**
 * 获取 MySQL 数据库连接池
 */
export function getMysqlPool(): mysql.Pool {
  loadEnv();

  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set. Please configure it in .env file.');
    }

    // 解析数据库连接字符串
    // 格式: mysql://user:password@host:port/database
    const url = new URL(databaseUrl);
    
    pool = mysql.createPool({
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || 3306,
      user: url.username || 'root',
      password: url.password || '',
      database: url.pathname.slice(1) || 'drama_studio',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return pool;
}

/**
 * 获取原生 MySQL 连接（用于执行原生 SQL）
 */
export async function getMysqlConnection(): Promise<mysql.PoolConnection> {
  const pool = getMysqlPool();
  return pool.getConnection();
}

/**
 * 执行原生 SQL 查询
 */
export async function executeSql(sql: string, params?: any[]): Promise<any> {
  const pool = getMysqlPool();
  const [results] = await pool.execute(sql, params);
  return results;
}

/**
 * 关闭数据库连接
 */
export async function closeMysqlConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export { loadEnv };
