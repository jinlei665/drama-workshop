/**
 * 内存存储模块
 * 用于在数据库不可用时持久化设置
 * 
 * 使用 globalThis 确保在热重载时不会丢失数据
 */

interface MemoryStore {
  settings: Record<string, unknown> | null
}

const globalForStore = globalThis as unknown as { memoryStore: MemoryStore }

// 初始化全局内存存储
if (!globalForStore.memoryStore) {
  globalForStore.memoryStore = {
    settings: null,
  }
}

/**
 * 获取内存存储实例
 */
export function getMemoryStore(): MemoryStore {
  return globalForStore.memoryStore
}

/**
 * 保存设置到内存
 */
export function saveSettingsToMemory(settings: Record<string, unknown>): void {
  globalForStore.memoryStore.settings = { ...settings }
  console.log('[MemoryStore] Settings saved:', {
    hasCozeApiKey: !!settings.coze_api_key,
    cozeBaseUrl: settings.coze_base_url,
  })
}

/**
 * 从内存获取设置
 */
export function getSettingsFromMemory(): Record<string, unknown> | null {
  return globalForStore.memoryStore.settings
}

/**
 * 获取 Coze 配置
 */
export function getCozeConfigFromMemory(): { 
  apiKey?: string; 
  baseUrl?: string; 
  botId?: string;
  botType?: 'v3_chat' | 'stream_run';
  botEndpoint?: string;
  botProjectId?: string;
  botSessionId?: string;
} | null {
  const settings = globalForStore.memoryStore.settings
  if (!settings?.coze_api_key) {
    return null
  }
  
  return {
    apiKey: settings.coze_api_key as string,
    baseUrl: settings.coze_base_url as string | undefined,
    botId: settings.coze_bot_id as string | undefined,
    botType: (settings.coze_bot_type as 'v3_chat' | 'stream_run') || 'v3_chat',
    botEndpoint: settings.coze_bot_endpoint as string | undefined,
    botProjectId: settings.coze_bot_project_id as string | undefined,
    botSessionId: settings.coze_bot_session_id as string | undefined,
  }
}
