/**
 * 本地数据库客户端
 * 用于本地开发和部署，支持 MySQL
 * 
 * 使用方法：
 * 1. 在 .env 中配置 DATABASE_URL=mysql://root:password@localhost:3306/drama_studio
 * 2. 启动 MySQL 数据库
 * 3. 运行 sql/init-mysql.sql 初始化表结构
 */

import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: Pool | null = null;

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
 * 获取数据库连接池
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }
  
  loadEnv();
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error(
      '数据库未配置！\n\n' +
      '请在 .env 文件中添加以下配置：\n\n' +
      '# 方式1: 使用本地 MySQL\n' +
      'DATABASE_TYPE=mysql\n' +
      'DATABASE_URL=mysql://root:password@localhost:3306/drama_studio\n\n' +
      '# 方式2: 使用 Supabase 云服务\n' +
      'DATABASE_TYPE=supabase\n' +
      'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...'
    );
  }
  
  // 解析连接字符串
  let config: mysql.PoolOptions;
  
  if (databaseUrl.startsWith('mysql://')) {
    const url = new URL(databaseUrl);
    config = {
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || 3306,
      user: url.username || 'root',
      password: decodeURIComponent(url.password) || '',
      database: url.pathname.slice(1) || 'drama_studio',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  } else {
    // PostgreSQL 连接字符串（暂时不支持）
    throw new Error(
      '当前仅支持 MySQL 数据库。\n' +
      '请使用 DATABASE_URL=mysql://user:password@host:port/database 格式'
    );
  }
  
  pool = mysql.createPool(config);
  
  return pool;
}

/**
 * 数据库查询构建器
 */
class QueryBuilder {
  private pool: Pool;
  private table: string;
  private _select: string = '*';
  private _where: string[] = [];
  private _params: any[] = [];
  private _orderBy: string = '';
  private _limit: number | null = null;
  private _offset: number | null = null;
  
  constructor(pool: Pool, table: string) {
    this.pool = pool;
    this.table = table;
  }
  
  /**
   * 选择字段
   */
  select(fields: string): this {
    this._select = fields;
    return this;
  }
  
  /**
   * 等于条件
   */
  eq(column: string, value: any): this {
    this._where.push(`${column} = ?`);
    this._params.push(value);
    return this;
  }
  
  /**
   * 不等于条件
   */
  neq(column: string, value: any): this {
    this._where.push(`${column} != ?`);
    this._params.push(value);
    return this;
  }
  
  /**
   * IN 条件
   */
  in(column: string, values: any[]): this {
    const placeholders = values.map(() => '?').join(', ');
    this._where.push(`${column} IN (${placeholders})`);
    this._params.push(...values);
    return this;
  }
  
  /**
   * LIKE 条件
   */
  like(column: string, pattern: string): this {
    this._where.push(`${column} LIKE ?`);
    this._params.push(pattern);
    return this;
  }
  
  /**
   * IS NULL 条件
   */
  isNull(column: string): this {
    this._where.push(`${column} IS NULL`);
    return this;
  }
  
  /**
   * IS NOT NULL 条件
   */
  isNotNull(column: string): this {
    this._where.push(`${column} IS NOT NULL`);
    return this;
  }
  
  /**
   * 排序
   */
  order(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this._orderBy = `ORDER BY ${column} ${direction.toUpperCase()}`;
    return this;
  }
  
  /**
   * 限制数量
   */
  limit(count: number): this {
    this._limit = count;
    return this;
  }
  
  /**
   * 偏移量
   */
  offset(count: number): this {
    this._offset = count;
    return this;
  }
  
  /**
   * 执行查询并返回多行
   */
  async then(resolve: (value: { data: any[] | null; error: any | null }) => void, reject?: (reason: any) => void) {
    try {
      let sql = `SELECT ${this._select} FROM ${this.table}`;
      
      if (this._where.length > 0) {
        sql += ` WHERE ${this._where.join(' AND ')}`;
      }
      
      if (this._orderBy) {
        sql += ` ${this._orderBy}`;
      }
      
      if (this._limit !== null) {
        sql += ` LIMIT ${this._limit}`;
      }
      
      if (this._offset !== null) {
        sql += ` OFFSET ${this._offset}`;
      }
      
      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, this._params);
      resolve({ data: rows as any[], error: null });
    } catch (error) {
      resolve({ data: null, error });
    }
  }
  
  /**
   * 执行查询并返回单行
   */
  async single(): Promise<{ data: any | null; error: any | null }> {
    this._limit = 1;
    
    let sql = `SELECT ${this._select} FROM ${this.table}`;
    
    if (this._where.length > 0) {
      sql += ` WHERE ${this._where.join(' AND ')}`;
    }
    
    if (this._orderBy) {
      sql += ` ${this._orderBy}`;
    }
    
    sql += ' LIMIT 1';
    
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(sql, this._params);
      return { data: (rows as any[])[0] || null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
  
  /**
   * 获取查询结果（兼容 Supabase API）
   */
  async get(): Promise<{ data: any[] | null; error: any | null }> {
    return new Promise((resolve) => {
      this.then(resolve);
    });
  }
}

/**
 * 插入构建器
 */
class InsertBuilder {
  private pool: Pool;
  private table: string;
  private data: any;
  
  constructor(pool: Pool, table: string, data: any) {
    this.pool = pool;
    this.table = table;
    this.data = data;
  }
  
  async then(resolve: (value: { data: any | null; error: any | null }) => void, reject?: (reason: any) => void) {
    try {
      const keys = Object.keys(this.data);
      const values = Object.values(this.data);
      const placeholders = values.map(() => '?').join(', ');
      
      const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
      const [result] = await this.pool.execute(sql, values as any[]);
      
      resolve({
        data: { id: (result as ResultSetHeader).insertId, ...this.data },
        error: null
      });
    } catch (error) {
      resolve({ data: null, error });
    }
  }
  
  select(fields: string): this {
    // 兼容 Supabase API，这里不做实际操作
    return this;
  }
}

/**
 * 更新构建器
 */
class UpdateBuilder {
  private pool: Pool;
  private table: string;
  private data: any;
  private _where: string[] = [];
  private _params: any[] = [];
  
  constructor(pool: Pool, table: string, data: any) {
    this.pool = pool;
    this.table = table;
    this.data = data;
  }
  
  eq(column: string, value: any): this {
    this._where.push(`${column} = ?`);
    this._params.push(value);
    return this;
  }
  
  async then(resolve: (value: { data: any | null; error: any | null }) => void, reject?: (reason: any) => void) {
    try {
      const keys = Object.keys(this.data);
      const values = Object.values(this.data);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      
      let sql = `UPDATE ${this.table} SET ${setClause}`;
      
      if (this._where.length > 0) {
        sql += ` WHERE ${this._where.join(' AND ')}`;
      }
      
      await this.pool.execute(sql, [...values, ...this._params]);
      
      resolve({ data: this.data, error: null });
    } catch (error) {
      resolve({ data: null, error });
    }
  }
  
  select(fields: string): this {
    return this;
  }
}

/**
 * 删除构建器
 */
class DeleteBuilder {
  private pool: Pool;
  private table: string;
  private _where: string[] = [];
  private _params: any[] = [];
  
  constructor(pool: Pool, table: string) {
    this.pool = pool;
    this.table = table;
  }
  
  eq(column: string, value: any): this {
    this._where.push(`${column} = ?`);
    this._params.push(value);
    return this;
  }
  
  async then(resolve: (value: { data: any | null; error: any | null }) => void, reject?: (reason: any) => void) {
    try {
      let sql = `DELETE FROM ${this.table}`;
      
      if (this._where.length > 0) {
        sql += ` WHERE ${this._where.join(' AND ')}`;
      }
      
      await this.pool.execute(sql, this._params);
      resolve({ data: null, error: null });
    } catch (error) {
      resolve({ data: null, error });
    }
  }
}

/**
 * 数据库客户端
 */
class DatabaseClient {
  private pool: Pool;
  
  constructor(pool: Pool) {
    this.pool = pool;
  }
  
  /**
   * 选择表
   */
  from(table: string) {
    return {
      select: (fields: string = '*') => new QueryBuilder(this.pool, table).select(fields),
      insert: (data: any) => new InsertBuilder(this.pool, table, data),
      update: (data: any) => new UpdateBuilder(this.pool, table, data),
      delete: () => new DeleteBuilder(this.pool, table),
      
      // 兼容 Supabase 链式调用
      then: (resolve: any) => new QueryBuilder(this.pool, table).then(resolve),
    };
  }
  
  /**
   * 执行原生 SQL
   */
  async execute(sql: string, params?: any[]) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }
}

/**
 * 获取数据库客户端
 */
export function getDb(): DatabaseClient {
  const pool = getPool();
  return new DatabaseClient(pool);
}

/**
 * 执行 SQL 查询
 */
export async function executeSql(sql: string, params?: any[]): Promise<any> {
  const pool = getPool();
  const [results] = await pool.execute(sql, params);
  return results;
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// 默认导出
export default getDb;
