/**
 * 统一数据库客户端
 * 自动检测数据库类型，支持：
 * - 本地 MySQL（推荐用于本地开发）
 * - Supabase（推荐用于云部署）
 */

// 类型定义
export type DatabaseType = 'mysql' | 'supabase' | 'memory';

// 缓存的客户端
let cachedClient: any = null;
let cachedDbType: DatabaseType | null = null;

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
 * 获取数据库类型
 */
export function getDatabaseType(): DatabaseType {
  if (cachedDbType) {
    return cachedDbType;
  }
  
  loadEnv();
  
  const dbType = process.env.DATABASE_TYPE?.toLowerCase();
  if (dbType === 'mysql') {
    cachedDbType = 'mysql';
    return 'mysql';
  }
  
  // 检查是否配置了 Supabase
  const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    cachedDbType = 'supabase';
    return 'supabase';
  }
  
  // 检查是否有 MySQL 连接字符串
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.startsWith('mysql://')) {
    cachedDbType = 'mysql';
    return 'mysql';
  }
  
  // 默认使用内存存储
  cachedDbType = 'memory';
  return 'memory';
}

/**
 * 获取 Supabase 客户端
 */
export function getSupabaseClient(token?: string): any {
  if (cachedClient) {
    return cachedClient;
  }
  
  loadEnv();
  
  const dbType = getDatabaseType();
  
  // 如果是内存模式，返回内存存储客户端
  if (dbType === 'memory') {
    cachedClient = createMemoryClient();
    return cachedClient;
  }
  
  // 如果配置了 MySQL，尝试动态加载 mysql2
  if (dbType === 'mysql') {
    try {
      const { createMySqlClient } = require('./mysql-client');
      cachedClient = createMySqlClient();
      return cachedClient;
    } catch (err) {
      console.warn('MySQL not available, falling back to memory storage:', err);
      cachedClient = createMemoryClient();
      cachedDbType = 'memory';
      return cachedClient;
    }
  }
  
  // 使用 Supabase
  const url = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.warn('Database not configured, using memory storage');
    cachedClient = createMemoryClient();
    cachedDbType = 'memory';
    return cachedClient;
  }
  
  const { createClient } = require('@supabase/supabase-js');
  
  cachedClient = createClient(url, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  return cachedClient;
}

/**
 * 创建内存存储客户端
 */
function createMemoryClient() {
  const storage: Record<string, any[]> = {
    projects: [],
    characters: [],
    scenes: [],
    episodes: [],
  };
  
  let idCounter = 1;
  
  const generateId = () => `${Date.now()}-${idCounter++}`;
  
  return {
    from: (table: string) => ({
      select: (fields: string = '*') => ({
        order: (column: string, options?: { ascending?: boolean }) => ({
          limit: (count: number) => ({
            then: async (resolve: (value: { data: any[] | null; error: any | null }) => void) => {
              const data = storage[table] || [];
              resolve({ data, error: null });
            }
          }),
          then: async (resolve: (value: { data: any[] | null; error: any | null }) => void) => {
            const data = storage[table] || [];
            resolve({ data, error: null });
          }
        }),
        eq: (column: string, value: any) => ({
          single: async () => {
            const data = storage[table] || [];
            const item = data.find(item => item[column] === value);
            return { data: item || null, error: null };
          },
          then: async (resolve: (value: { data: any[] | null; error: any | null }) => void) => {
            const data = storage[table] || [];
            const filtered = data.filter(item => item[column] === value);
            resolve({ data: filtered, error: null });
          }
        }),
        then: async (resolve: (value: { data: any[] | null; error: any | null }) => void) => {
          const data = storage[table] || [];
          resolve({ data, error: null });
        }
      }),
      insert: (data: any) => ({
        select: () => ({
          single: async () => {
            const item = {
              id: generateId(),
              ...data,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            if (!storage[table]) storage[table] = [];
            storage[table].push(item);
            return { data: item, error: null };
          }
        }),
        then: async (resolve: (value: { data: any | null; error: any | null }) => void) => {
          const item = {
            id: generateId(),
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (!storage[table]) storage[table] = [];
          storage[table].push(item);
          resolve({ data: item, error: null });
        }
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          select: () => ({
            single: async () => {
              const items = storage[table] || [];
              const index = items.findIndex(item => item[column] === value);
              if (index !== -1) {
                items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
                return { data: items[index], error: null };
              }
              return { data: null, error: { message: 'Not found' } };
            }
          })
        })
      }),
      delete: () => ({
        eq: (column: string, value: any) => ({
          then: async (resolve: (value: { data: any | null; error: any | null }) => void) => {
            const items = storage[table] || [];
            const index = items.findIndex(item => item[column] === value);
            if (index !== -1) {
              items.splice(index, 1);
            }
            resolve({ data: null, error: null });
          }
        })
      })
    })
  };
}

/**
 * 检查数据库是否配置
 */
export function isDatabaseConfigured(): boolean {
  const dbType = getDatabaseType();
  return dbType !== 'memory';
}

/**
 * 检查 Supabase 是否配置（兼容旧代码）
 */
export function isSupabaseConfigured(): boolean {
  return isDatabaseConfigured();
}

// 导出本地数据库客户端（动态加载）
export const getDb = async () => {
  const dbType = getDatabaseType();
  
  if (dbType === 'memory') {
    return getSupabaseClient();
  }
  
  if (dbType === 'mysql') {
    try {
      const { getDb: getMySqlDb } = require('./mysql-client');
      return getMySqlDb();
    } catch {
      return getSupabaseClient();
    }
  }
  
  return getSupabaseClient();
};

export const executeSql = async (sql: string, params?: any[]) => {
  const db = await getDb();
  if (db.execute) {
    return db.execute(sql, params);
  }
  throw new Error('SQL execution not supported');
};

export const closeDatabase = async () => {
  cachedClient = null;
  cachedDbType = null;
};
