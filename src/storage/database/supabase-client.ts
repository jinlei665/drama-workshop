/**
 * 统一数据库客户端
 * 自动检测数据库类型，支持：
 * - Supabase（推荐用于云部署）
 * - 内存存储（默认，无需配置）
 * 
 * 注意：MySQL 支持已移除，请使用 Supabase 或内存存储
 */

// 导入全局内存存储，确保与 memory-storage.ts 同步
import { memoryProjects, memoryCharacters, memoryScenes, memoryEpisodes, memoryCharacterLibrary } from '@/lib/memory-storage';

// 类型定义
export type DatabaseType = 'supabase' | 'memory';

// 缓存的客户端
let cachedClient: any = null;
let cachedDbType: DatabaseType | null = null;

/**
 * 获取数据库类型
 * Next.js 会自动加载 .env 文件，无需手动加载
 * 
 * 优先级：用户配置的 NEXT_PUBLIC_SUPABASE_URL > 沙箱环境的 COZE_SUPABASE_URL
 */
export function getDatabaseType(): DatabaseType {
  if (cachedDbType) {
    return cachedDbType;
  }
  
  // 优先检查用户配置的 Supabase（NEXT_PUBLIC_SUPABASE_URL）
  const userSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (userSupabaseUrl) {
    cachedDbType = 'supabase';
    return 'supabase';
  }
  
  // 然后检查沙箱环境的 Supabase（COZE_SUPABASE_URL）
  const cozeSupabaseUrl = process.env.COZE_SUPABASE_URL;
  if (cozeSupabaseUrl) {
    cachedDbType = 'supabase';
    return 'supabase';
  }
  
  // 默认使用内存存储
  cachedDbType = 'memory';
  return 'memory';
}

/**
 * 获取数据库客户端
 * 优先级：用户配置的 Supabase > 沙箱环境的 Supabase > 内存存储
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
  
  // 优先使用用户配置的 Supabase
  // NEXT_PUBLIC_SUPABASE_URL 优先于 COZE_SUPABASE_URL
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    console.warn('Database not configured, using memory storage');
    cachedClient = createMemoryClient();
    cachedDbType = 'memory';
    return cachedClient;
  }
  
  console.log(`[Database] Connecting to Supabase: ${url}`);
  
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
 * 使用全局内存存储，确保与其他模块共享数据
 */
function createMemoryClient() {
  // 使用全局内存存储（与 memory-storage.ts 同步）
  // 注意：这里的 key 需要转换：projectId -> project_id
  const getTable = (table: string) => {
    switch (table) {
      case 'projects':
        return memoryProjects;
      case 'characters':
        return memoryCharacters;
      case 'scenes':
        return memoryScenes;
      case 'episodes':
        return memoryEpisodes;
      case 'character_library':
        return memoryCharacterLibrary;
      default:
        return [];
    }
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
      const tableData = getTable(table);
      let data: any[] = [...tableData];

      // 应用过滤条件（支持 snake_case 字段名）
      for (const filter of filters) {
        const filterKey = filter.column;
        if (filter.type === 'eq') {
          data = data.filter((item: any) => {
            // 同时检查 camelCase 和 snake_case
            const camelKey = filterKey.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
            const val = item[filterKey] ?? item[camelKey];
            return val === filter.value;
          });
        } else if (filter.type === 'in') {
          data = data.filter((item: any) => {
            const camelKey = filterKey.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
            const val = item[filterKey] ?? item[camelKey];
            return filter.value.includes(val);
          });
        } else if (filter.type === 'neq') {
          data = data.filter((item: any) => {
            const camelKey = filterKey.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
            const val = item[filterKey] ?? item[camelKey];
            return val !== filter.value;
          });
        }
      }

      // 应用排序
      for (const order of orders) {
        data.sort((a: any, b: any) => {
          const camelKey = order.column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
          const aVal = a[order.column] ?? a[camelKey];
          const bVal = b[order.column] ?? b[camelKey];
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
                id: items[0].id || generateId(),
                ...items[0],
                created_at: items[0].created_at || items[0].createdAt || new Date().toISOString(),
                updated_at: items[0].updated_at || items[0].updatedAt || new Date().toISOString(),
              };
              const tableData = getTable(table);
              (tableData as any[]).push(item);
              return { data: item, error: null };
            }
          }),
          then: async (resolve: (value: { data: any | null; error: any | null }) => void) => {
            const tableData = getTable(table);
            for (const itemData of items) {
              const item = {
                id: itemData.id || generateId(),
                ...itemData,
                created_at: itemData.created_at || itemData.createdAt || new Date().toISOString(),
                updated_at: itemData.updated_at || itemData.updatedAt || new Date().toISOString(),
              };
              (tableData as any[]).push(item);
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
              const tableData = getTable(table);
              let targetItem = (tableData as any[]).find((item: any) => {
                return updateFilters.every(f => {
                  const camelKey = f.column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
                  const val = item[f.column] ?? item[camelKey];
                  return val === f.value;
                });
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
            const tableData = getTable(table);
            for (let i = (tableData as any[]).length - 1; i >= 0; i--) {
              const item = (tableData as any[])[i];
              const shouldDelete = deleteFilters.every(f => {
                const camelKey = f.column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
                const val = item[f.column] ?? item[camelKey];
                return val === f.value;
              });
              if (shouldDelete) {
                (tableData as any[]).splice(i, 1);
              }
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
