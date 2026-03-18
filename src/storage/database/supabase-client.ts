/**
 * 统一数据库客户端
 * 自动检测数据库类型，支持：
 * - Supabase（推荐用于云部署）
 * - 内存存储（默认，无需配置）
 * 
 * 注意：MySQL 支持已移除，请使用 Supabase 或内存存储
 */

// 类型定义
export type DatabaseType = 'supabase' | 'memory';

// 缓存的客户端
let cachedClient: any = null;
let cachedDbType: DatabaseType | null = null;

/**
 * 获取数据库类型
 * Next.js 会自动加载 .env 文件，无需手动加载
 */
export function getDatabaseType(): DatabaseType {
  if (cachedDbType) {
    return cachedDbType;
  }
  
  // 检查是否配置了 Supabase
  const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    cachedDbType = 'supabase';
    return 'supabase';
  }
  
  // 默认使用内存存储
  cachedDbType = 'memory';
  return 'memory';
}

/**
 * 获取数据库客户端
 */
export function getSupabaseClient(token?: string): any {
  if (cachedClient) {
    return cachedClient;
  }
  
  const dbType = getDatabaseType();
  
  // 如果是内存模式，返回内存存储客户端
  if (dbType === 'memory') {
    cachedClient = createMemoryClient();
    return cachedClient;
  }
  
  // 使用 Supabase（动态加载，避免客户端打包）
  const url = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.warn('Database not configured, using memory storage');
    cachedClient = createMemoryClient();
    cachedDbType = 'memory';
    return cachedClient;
  }
  
  // 动态导入 @supabase/supabase-js
  // 使用 eval 避免被 Webpack/Turbopack 静态分析
  // eslint-disable-next-line no-eval
  const createClient = eval("require('@supabase/supabase-js')").createClient;
  
  cachedClient = createClient(url, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  return cachedClient;
}

/**
 * 创建内存存储客户端
 * 实现完整的 Supabase-like API
 */
function createMemoryClient() {
  const storage: Record<string, any[]> = {
    projects: [],
    characters: [],
    scenes: [],
    episodes: [],
    user_settings: [],
  };
  
  let idCounter = 1;
  
  const generateId = () => `${Date.now()}-${idCounter++}`;
  
  /**
   * 构建查询链
   */
  function buildQueryChain(table: string) {
    let filters: Array<{ type: string; column: string; value: any }> = [];
    let orders: Array<{ column: string; ascending: boolean }> = [];
    let limitCount: number | null = null;
    
    const executeQuery = async () => {
      let data = [...(storage[table] || [])];
      
      // 应用过滤条件
      for (const filter of filters) {
        if (filter.type === 'eq') {
          data = data.filter(item => item[filter.column] === filter.value);
        } else if (filter.type === 'in') {
          data = data.filter(item => filter.value.includes(item[filter.column]));
        } else if (filter.type === 'neq') {
          data = data.filter(item => item[filter.column] !== filter.value);
        }
      }
      
      // 应用排序
      for (const order of orders) {
        data.sort((a, b) => {
          const aVal = a[order.column];
          const bVal = b[order.column];
          if (aVal === bVal) return 0;
          const cmp = aVal < bVal ? -1 : 1;
          return order.ascending ? cmp : -cmp;
        });
      }
      
      // 应用限制
      if (limitCount !== null) {
        data = data.slice(0, limitCount);
      }
      
      return data;
    };
    
    const chain = {
      select: (fields: string = '*') => {
        const selectChain = {
          eq: (column: string, value: any) => {
            filters.push({ type: 'eq', column, value });
            return selectChain;
          },
          neq: (column: string, value: any) => {
            filters.push({ type: 'neq', column, value });
            return selectChain;
          },
          in: (column: string, value: any[]) => {
            filters.push({ type: 'in', column, value });
            return selectChain;
          },
          order: (column: string, options?: { ascending?: boolean }) => {
            orders.push({ column, ascending: options?.ascending ?? true });
            return selectChain;
          },
          limit: (count: number) => {
            limitCount = count;
            return selectChain;
          },
          single: async () => {
            const data = await executeQuery();
            const item = data[0] || null;
            return { data: item, error: item ? null : { message: 'Not found' } };
          },
          maybeSingle: async () => {
            const data = await executeQuery();
            const item = data[0] || null;
            return { data: item, error: null };
          },
          then: async (resolve: (value: { data: any[] | null; error: any | null }) => void) => {
            const data = await executeQuery();
            resolve({ data, error: null });
          }
        };
        return selectChain;
      },
      insert: (data: any | any[]) => {
        const items = Array.isArray(data) ? data : [data];
        const insertedItems: any[] = [];
        
        const insertChain = {
          select: () => ({
            single: async () => {
              const item = {
                id: generateId(),
                ...items[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              if (!storage[table]) storage[table] = [];
              storage[table].push(item);
              return { data: item, error: null };
            }
          }),
          then: async (resolve: (value: { data: any | null; error: any | null }) => void) => {
            for (const itemData of items) {
              const item = {
                id: generateId(),
                ...itemData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              if (!storage[table]) storage[table] = [];
              storage[table].push(item);
              insertedItems.push(item);
            }
            resolve({ data: insertedItems.length === 1 ? insertedItems[0] : insertedItems, error: null });
          }
        };
        return insertChain;
      },
      update: (data: any) => {
        let updateFilters: Array<{ type: string; column: string; value: any }> = [];
        
        const updateChain = {
          eq: (column: string, value: any) => {
            updateFilters.push({ type: 'eq', column, value });
            return updateChain;
          },
          select: () => ({
            single: async () => {
              const items = storage[table] || [];
              let targetItem = items.find(item => {
                return updateFilters.every(f => item[f.column] === f.value);
              });
              
              if (targetItem) {
                Object.assign(targetItem, data, { updated_at: new Date().toISOString() });
                return { data: targetItem, error: null };
              }
              return { data: null, error: { message: 'Not found' } };
            }
          })
        };
        return updateChain;
      },
      delete: () => {
        let deleteFilters: Array<{ type: string; column: string; value: any }> = [];
        
        const deleteChain = {
          eq: (column: string, value: any) => {
            deleteFilters.push({ type: 'eq', column, value });
            return deleteChain;
          },
          then: async (resolve: (value: { data: any | null; error: any | null }) => void) => {
            const items = storage[table] || [];
            const index = items.findIndex(item => {
              return deleteFilters.every(f => item[f.column] === f.value);
            });
            if (index !== -1) {
              items.splice(index, 1);
            }
            resolve({ data: null, error: null });
          }
        };
        return deleteChain;
      }
    };
    
    return chain;
  }
  
  return {
    from: (table: string) => buildQueryChain(table)
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

/**
 * 获取数据库客户端（兼容旧代码）
 */
export const getDb = async () => {
  return getSupabaseClient();
};

/**
 * 执行 SQL（内存存储不支持）
 */
export const executeSql = async (sql: string, params?: any[]) => {
  const db = await getDb();
  if (db.execute) {
    return db.execute(sql, params);
  }
  throw new Error('SQL execution not supported in memory mode');
};

/**
 * 关闭数据库连接
 */
export const closeDatabase = async () => {
  cachedClient = null;
  cachedDbType = null;
};
