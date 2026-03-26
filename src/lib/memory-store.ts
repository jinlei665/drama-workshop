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
    botId: settings.coze_bot_id,
  })
}

/**
 * 从内存获取设置
 */
export function getSettingsFromMemory(): Record<string, unknown> | null {
  const settings = globalForStore.memoryStore.settings
  if (settings) {
    console.log('[MemoryStore] Getting settings from memory:', {
      hasCozeApiKey: !!settings.coze_api_key,
      botId: settings.coze_bot_id,
    })
  } else {
    console.log('[MemoryStore] No settings in memory')
  }
  return settings
}

/**
 * 获取 Coze 配置
 */
export function getCozeConfigFromMemory(): { apiKey?: string; baseUrl?: string; botId?: string } | null {
  const settings = globalForStore.memoryStore.settings
  if (!settings?.coze_api_key) {
    console.log('[MemoryStore] No coze_api_key in memory settings')
    return null
  }
  
  console.log('[MemoryStore] Returning Coze config from memory:', {
    hasApiKey: true,
    baseUrl: settings.coze_base_url,
    botId: settings.coze_bot_id,
  })
  
  return {
    apiKey: settings.coze_api_key as string,
    baseUrl: settings.coze_base_url as string | undefined,
    botId: settings.coze_bot_id as string | undefined,
  }
}
