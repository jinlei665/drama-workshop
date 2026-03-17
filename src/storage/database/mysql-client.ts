/**
 * MySQL 客户端（完全动态加载）
 * 仅在配置了 MySQL 时才尝试加载 mysql2
 */

let pool: any = null;

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
 * 动态加载 mysql2
 * 使用 Function 构造器来避免 Webpack 静态分析
 */
function loadMysql2(): any {
  try {
    // 使用 Function 构造器来避免 Webpack 解析 require
    // eslint-disable-next-line no-new-func
    const dynamicRequire = new Function('module', 'return require(module)');
    return dynamicRequire('mysql2/promise');
  } catch (err) {
    console.warn('mysql2 not available:', err);
    return null;
  }
}

/**
 * 创建 MySQL 客户端
 */
export function createMySqlClient() {
  loadEnv();
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl || !databaseUrl.startsWith('mysql://')) {
    throw new Error('MySQL not configured');
  }
  
  // 动态导入 mysql2
  const mysql = loadMysql2();
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
