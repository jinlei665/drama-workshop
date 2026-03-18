/**
 * MySQL 客户端（仅服务端使用）
 * 仅在配置了 MySQL 时才尝试加载 mysql2
 * 
 * 注意：此模块依赖 Node.js 原生模块，只能在服务端使用
 */

// 标记为服务端专用
import 'server-only';

let pool: any = null;

/**
 * 动态加载 mysql2（ESM 兼容）
 */
async function loadMysql2(): Promise<any> {
  try {
    const mysql = await import('mysql2/promise');
    return mysql.default || mysql;
  } catch (err) {
    console.warn('mysql2 not available:', err);
    return null;
  }
}

/**
 * 创建 MySQL 客户端（异步版本）
 */
export async function createMySqlClientAsync() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl || !databaseUrl.startsWith('mysql://')) {
    throw new Error('MySQL not configured');
  }
  
  // 动态导入 mysql2
  const mysql = await loadMysql2();
  if (!mysql) {
    throw new Error('mysql2 package not available. Please install it with: pnpm add mysql2');
  }
  
  const url = new URL(databaseUrl);
  pool = mysql.createPool({
    host: url.hostname || 'localhost',
    port: parseInt(url.port) || 3306,
    user: url.username || 'root',
    password: decodeURIComponent(url.password) || '',
    database: url.pathname.slice(1) || 'drama_studio',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  
  return createQueryBuilder(pool);
}

/**
 * 创建 MySQL 客户端（同步版本，向后兼容）
 * 注意：此版本在 ESM 环境下可能失败，建议使用 createMySqlClientAsync
 */
export function createMySqlClient() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl || !databaseUrl.startsWith('mysql://')) {
    throw new Error('MySQL not configured');
  }
  
  // 尝试同步加载（可能在某些环境下失败）
  throw new Error('MySQL client requires async initialization. Please use Supabase client instead.');
}

/**
 * 创建查询构建器
 */
function createQueryBuilder(pool: any) {
  return {
    from: (table: string) => ({
      select: (fields: string = '*') => new QueryBuilder(pool, table, fields),
      insert: (data: any) => new InsertBuilder(pool, table, data),
      update: (data: any) => new UpdateBuilder(pool, table, data),
      delete: () => new DeleteBuilder(pool, table),
    }),
    execute: async (sql: string, params?: any[]) => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    }
  };
}

/**
 * 查询构建器
 */
class QueryBuilder {
  private pool: any;
  private table: string;
  private fields: string;
  private conditions: string[] = [];
  private params: any[] = [];
  private orderByClause: string = '';
  private limitCount: number | null = null;

  constructor(pool: any, table: string, fields: string) {
    this.pool = pool;
    this.table = table;
    this.fields = fields;
  }

  eq(column: string, value: any) {
    this.conditions.push(`${column} = ?`);
    this.params.push(value);
    return this;
  }

  order(column: string, direction: { ascending?: boolean } = {}) {
    this.orderByClause = `ORDER BY ${column} ${direction.ascending === false ? 'DESC' : 'ASC'}`;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async single() {
    this.limitCount = 1;
    const results = await this.execute();
    return { data: results[0] || null, error: null };
  }

  async then(resolve: (value: { data: any[] | null; error: any | null }) => void) {
    try {
      const rows = await this.execute();
      resolve({ data: rows, error: null });
    } catch (error) {
      resolve({ data: null, error });
    }
  }

  private async execute() {
    let sql = `SELECT ${this.fields} FROM ${this.table}`;
    
    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    
    if (this.orderByClause) {
      sql += ` ${this.orderByClause}`;
    }
    
    if (this.limitCount !== null) {
      sql += ` LIMIT ${this.limitCount}`;
    }
    
    const [rows] = await this.pool.execute(sql, this.params);
    return rows as any[];
  }
}

/**
 * 插入构建器
 */
class InsertBuilder {
  private pool: any;
  private table: string;
  private data: any;

  constructor(pool: any, table: string, data: any) {
    this.pool = pool;
    this.table = table;
    this.data = data;
  }

  select() {
    return this;
  }

  async single() {
    try {
      const keys = Object.keys(this.data);
      const values = Object.values(this.data);
      const placeholders = values.map(() => '?').join(', ');
      
      const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
      const [result] = await this.pool.execute(sql, values);
      
      return {
        data: {
          id: (result as any).insertId,
          ...this.data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  async then(resolve: (value: { data: any | null; error: any | null }) => void) {
    const result = await this.single();
    resolve(result);
  }
}

/**
 * 更新构建器
 */
class UpdateBuilder {
  private pool: any;
  private table: string;
  private data: any;
  private conditions: string[] = [];
  private params: any[] = [];

  constructor(pool: any, table: string, data: any) {
    this.pool = pool;
    this.table = table;
    this.data = data;
  }

  eq(column: string, value: any) {
    this.conditions.push(`${column} = ?`);
    this.params.push(value);
    return this;
  }

  select() {
    return this;
  }

  async single() {
    try {
      const keys = Object.keys(this.data);
      const values = Object.values(this.data);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      
      let sql = `UPDATE ${this.table} SET ${setClause}`;
      
      if (this.conditions.length > 0) {
        sql += ` WHERE ${this.conditions.join(' AND ')}`;
      }
      
      await this.pool.execute(sql, [...values, ...this.params]);
      
      return { data: this.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

/**
 * 删除构建器
 */
class DeleteBuilder {
  private pool: any;
  private table: string;
  private conditions: string[] = [];
  private params: any[] = [];

  constructor(pool: any, table: string) {
    this.pool = pool;
    this.table = table;
  }

  eq(column: string, value: any) {
    this.conditions.push(`${column} = ?`);
    this.params.push(value);
    return this;
  }

  async then(resolve: (value: { data: any | null; error: any | null }) => void) {
    try {
      let sql = `DELETE FROM ${this.table}`;
      
      if (this.conditions.length > 0) {
        sql += ` WHERE ${this.conditions.join(' AND ')}`;
      }
      
      await this.pool.execute(sql, this.params);
      resolve({ data: null, error: null });
    } catch (error) {
      resolve({ data: null, error });
    }
  }
}

/**
 * 获取数据库客户端
 */
export function getDb() {
  if (!pool) {
    return createMySqlClient();
  }
  return createQueryBuilder(pool);
}

/**
 * 执行 SQL
 */
export async function executeSql(sql: string, params?: any[]) {
  if (!pool) {
    createMySqlClient();
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 关闭连接
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
