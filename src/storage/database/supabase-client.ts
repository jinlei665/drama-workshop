/**
 * 统一数据库客户端
 * 自动检测数据库类型，支持：
 * - 本地 MySQL（推荐用于本地开发）
 * - Supabase（推荐用于云部署）
 */

import { Pool } from 'mysql2/promise';

// 导出本地数据库客户端
export { getDb, getPool, executeSql, closeDatabase } from './local-db';

// 类型定义
export type { DatabaseType } from './db-client';
export { getDatabaseType } from './db-client';

// 兼容旧代码的函数
let cachedClient: any = null;

/**
 * 获取 Supabase 客户端（兼容旧代码）
 * 优先使用本地 MySQL
 */
export function getSupabaseClient(token?: string): any {
  if (cachedClient) {
    return cachedClient;
  }
  
  // 加载环境变量
  try {
    require('dotenv').config();
  } catch {}
  
  // 检查是否使用本地数据库
  const dbType = process.env.DATABASE_TYPE?.toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;
  
  // 如果配置了 MySQL，返回本地数据库客户端
  if (dbType === 'mysql' || (databaseUrl && databaseUrl.startsWith('mysql://'))) {
    const { getDb } = require('./local-db');
    cachedClient = getDb();
    return cachedClient;
  }
  
  // 使用 Supabase
  const url = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error(
      '数据库未配置！\n\n' +
      '请在 .env 文件中配置以下任一选项：\n\n' +
      '选项1: 使用本地 MySQL（推荐用于本地开发）\n' +
      'DATABASE_TYPE=mysql\n' +
      'DATABASE_URL=mysql://root:password@localhost:3306/drama_studio\n\n' +
      '选项2: 使用 Supabase 云服务\n' +
      'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...'
    );
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
 * 检查数据库是否配置
 */
export function isDatabaseConfigured(): boolean {
  try {
    require('dotenv').config();
  } catch {}
  
  const dbType = process.env.DATABASE_TYPE?.toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  return !!(dbType === 'mysql' || databaseUrl?.startsWith('mysql://') || supabaseUrl);
}

/**
 * 检查 Supabase 是否配置（兼容旧代码）
 */
export function isSupabaseConfigured(): boolean {
  return isDatabaseConfigured();
}
