import { createClient, SupabaseClient } from '@supabase/supabase-js';

let envLoaded = false;
let cachedClient: SupabaseClient | null = null;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

/**
 * 加载环境变量
 * 支持两种命名方式：
 * 1. COZE_SUPABASE_URL / COZE_SUPABASE_ANON_KEY (Coze 平台)
 * 2. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (标准 Next.js)
 */
function loadEnv(): void {
  if (envLoaded) {
    return;
  }

  try {
    require('dotenv').config();
    envLoaded = true;
  } catch {
    // dotenv not available
  }
}

/**
 * 获取 Supabase 凭据
 * 优先级：COZE_ 前缀 > NEXT_PUBLIC_ 前缀
 */
function getSupabaseCredentials(): SupabaseCredentials | null {
  loadEnv();

  // 优先使用 COZE_ 前缀（Coze 平台）
  let url = process.env.COZE_SUPABASE_URL;
  let anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  // 如果没有 COZE_ 前缀，尝试 NEXT_PUBLIC_ 前缀
  if (!url) {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!anonKey) {
    anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

/**
 * 检查是否配置了 Supabase
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

/**
 * 获取 Supabase 客户端
 * @param token 可选的认证 token
 * @throws 如果未配置 Supabase 凭据
 */
function getSupabaseClient(token?: string): SupabaseClient {
  // 如果已经有缓存的客户端且不需要 token，直接返回
  if (cachedClient && !token) {
    return cachedClient;
  }

  const credentials = getSupabaseCredentials();

  if (!credentials) {
    throw new Error(
      'Supabase 未配置。请设置以下环境变量之一：\n' +
      '  - COZE_SUPABASE_URL 和 COZE_SUPABASE_ANON_KEY\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      '如果您使用 MySQL 数据库，请确保 DATABASE_TYPE=mysql'
    );
  }

  const { url, anonKey } = credentials;

  const client = createClient(url, anonKey, {
    global: token ? {
      headers: { Authorization: `Bearer ${token}` },
    } : undefined,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 缓存非 token 客户端
  if (!token) {
    cachedClient = client;
  }

  return client;
}

export { loadEnv, getSupabaseCredentials, getSupabaseClient };
