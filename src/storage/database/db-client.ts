/**
 * 统一数据库客户端
 * 根据 DATABASE_TYPE 环境变量选择使用 Supabase (PostgreSQL) 或 MySQL
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase-client';
import { getMysqlPool, executeSql } from './mysql-client';

export type DatabaseType = 'postgresql' | 'mysql';

/**
 * 获取数据库类型
 */
export function getDatabaseType(): DatabaseType {
  const type = process.env.DATABASE_TYPE?.toLowerCase();
  if (type === 'mysql') {
    return 'mysql';
  }
  return 'postgresql'; // 默认使用 PostgreSQL
}

/**
 * 检查数据库是否已配置
 */
export function isDatabaseConfigured(): { configured: boolean; message: string } {
  const dbType = getDatabaseType();

  if (dbType === 'mysql') {
    if (process.env.DATABASE_URL) {
      return { configured: true, message: 'MySQL 数据库已配置' };
    }
    return {
      configured: false,
      message: 'MySQL 数据库未配置。请设置 DATABASE_URL 环境变量，格式：mysql://user:password@host:port/database'
    };
  }

  // PostgreSQL (Supabase)
  if (isSupabaseConfigured()) {
    return { configured: true, message: 'PostgreSQL (Supabase) 数据库已配置' };
  }
  return {
    configured: false,
    message: 'PostgreSQL 数据库未配置。请设置以下环境变量之一：\n' +
      '  - COZE_SUPABASE_URL 和 COZE_SUPABASE_ANON_KEY\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY'
  };
}

/**
 * 获取数据库客户端
 * 对于 PostgreSQL 返回 Supabase 客户端
 * 对于 MySQL 返回连接池
 */
export function getDatabaseClient() {
  const dbType = getDatabaseType();

  if (dbType === 'mysql') {
    return getMysqlPool();
  }

  return getSupabaseClient();
}

/**
 * 获取 Supabase 客户端（兼容现有代码）
 * 如果使用 MySQL，会抛出错误提示
 */
export function getDb() {
  const dbType = getDatabaseType();

  if (dbType === 'mysql') {
    throw new Error(
      '当前使用 MySQL 数据库，但此操作需要 Supabase 客户端。\n' +
      '请将 DATABASE_TYPE 设置为 postgresql 或配置 Supabase 环境变量。'
    );
  }

  return getSupabaseClient();
}

// 重新导出 Supabase 客户端函数，保持向后兼容
export { getSupabaseClient, isSupabaseConfigured };

// 导出 MySQL 相关函数
export { getMysqlPool, executeSql };
