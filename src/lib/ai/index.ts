/**
 * AI 服务统一接口
 * 使用系统自带的模型服务 (coze-coding-dev-sdk)
 * 同时支持 OpenAI 兼容格式的第三方模型
 * 
 * LLM 默认模型: doubao-seed-1-8-251228 (Coze)
 * 图像生成: ImageGenerationClient (Coze)
 * 视频生成: VideoGenerationClient (Coze)
 * 
 * 支持的 LLM Provider:
 * - coze: 豆包/Coze API (默认)
 * - openai-compatible: 任何 OpenAI 兼容服务 (MiniMax, DeepSeek, 智谱, Moonshot, Ollama 等)
 */

import {
  LLMClient,
  ImageGenerationClient,
  VideoGenerationClient,
  Config,
  HeaderUtils,
  APIError,
} from 'coze-coding-dev-sdk'
import { Errors, withRetry, logger } from '@/lib/errors'
import { 
  OpenAICompatibleClient, 
  OPENAI_COMPATIBLE_PROVIDERS,
  type ProviderKey 
} from './openai-compatible'

// ==================== 代理处理工具 ====================

/**
 * 临时禁用代理，避免本地代理干扰 API 请求
 * 在用户本地环境（如 Windows + Clash）中，代理可能导致连接失败
 */
function disableProxy(): { http?: string; https?: string } | null {
  const proxy = {
    http: process.env.HTTP_PROXY,
    https: process.env.HTTPS_PROXY,
  }
  
  // 只有存在代理设置时才禁用
  if (proxy.http || proxy.https) {
    delete process.env.HTTP_PROXY
    delete process.env.HTTPS_PROXY
    delete process.env.http_proxy
    delete process.env.https_proxy
    return proxy
  }
  
  return null
}

/**
 * 恢复代理设置
 */
function restoreProxy(proxy: { http?: string; https?: string } | null): void {
  if (!proxy) return
  
  if (proxy.http) process.env.HTTP_PROXY = proxy.http
  if (proxy.https) process.env.HTTPS_PROXY = proxy.https
}

// ==================== 类型定义 ====================

/** AI 服务配置 */
export interface AIServiceConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  timeout?: number
}

/** LLM 消息格式 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

/** 多模态内容部分 */
export interface ContentPart {
  type: 'text' | 'image_url' | 'video_url'
  text?: string
  image_url?: {
    url: string
    detail?: 'high' | 'low'
  }
  video_url?: {
    url: string
    fps?: number | null
  }
}

/** LLM 配置选项 */
export interface LLMOptions {
  model?: string
  temperature?: number
  thinking?: 'enabled' | 'disabled'
  caching?: 'enabled' | 'disabled'
}

/** 图像生成选项 */
export interface ImageGenerationOptions {
  size?: '2K' | '4K' | string
  watermark?: boolean
  responseFormat?: 'url' | 'b64_json'
  /** 参考图片URL（用于图生图，保持人物一致性） */
  image?: string | string[]
}

/** 视频生成选项 */
export interface VideoGenerationOptions {
  model?: string
  duration?: number
  ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive'
  resolution?: '480p' | '720p' | '1080p'
  generateAudio?: boolean
  watermark?: boolean
}

// ==================== 系统默认模型配置 ====================

/** 系统默认 LLM 模型 */
export const DEFAULT_LLM_MODEL = 'doubao-seed-1-8-251228'

/** LLM Provider 类型 */
export type LLMProvider = 'coze' | 'openai-compatible'

/** 默认 LLM Provider */
export const DEFAULT_LLM_PROVIDER: LLMProvider = 'coze'

/** 系统默认图像模型 */
export const DEFAULT_IMAGE_SIZE = '2K'

/** 系统默认视频模型 */
export const DEFAULT_VIDEO_MODEL = 'doubao-seedance-1-5-pro-251215'

/** 可用的 LLM 模型列表 */
export const AVAILABLE_LLM_MODELS = [
  { value: 'doubao-seed-2-0-pro-260215', label: 'Doubao Seed 2.0 Pro (旗舰)', description: '复杂推理、多模态、长上下文' },
  { value: 'doubao-seed-2-0-lite-260215', label: 'Doubao Seed 2.0 Lite', description: '平衡性能与成本' },
  { value: 'doubao-seed-2-0-mini-260215', label: 'Doubao Seed 2.0 Mini', description: '快速响应、高并发' },
  { value: 'doubao-seed-1-8-251228', label: 'Doubao Seed 1.8 (默认)', description: '多模态 Agent 优化模型' },
  { value: 'doubao-seed-1-6-251015', label: 'Doubao Seed 1.6', description: '通用对话' },
  { value: 'doubao-seed-1-6-flash-250615', label: 'Doubao Seed 1.6 Flash', description: '快速响应' },
  { value: 'doubao-seed-1-6-thinking-250715', label: 'Doubao Seed 1.6 Thinking', description: '深度推理' },
  { value: 'doubao-seed-1-6-vision-250815', label: 'Doubao Seed 1.6 Vision', description: '图像/视频理解' },
  { value: 'doubao-seed-1-6-lite-251015', label: 'Doubao Seed 1.6 Lite', description: '轻量级' },
  { value: 'deepseek-v3-2-251201', label: 'DeepSeek V3.2', description: '高级推理' },
  { value: 'deepseek-r1-250528', label: 'DeepSeek R1', description: '研究分析' },
  { value: 'kimi-k2-250905', label: 'Kimi K2', description: '长上下文处理' },
  { value: 'kimi-k2-5-260127', label: 'Kimi K2.5', description: 'Agent、代码、多模态' },
] as const

// ==================== LLM 服务 ====================

/**
 * 获取用户配置的 Coze API Key
 * 优先级：传入参数 > 用户设置（数据库或内存） > 环境变量
 */
async function getUserCozeConfig(): Promise<{ apiKey?: string; baseUrl?: string }> {
  try {
    // 先尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        // 使用 service_role 客户端绕过 RLS
        const db = getSupabaseClient(true)
        const { data, error } = await db
          .from('user_settings')
          .select('coze_api_key, coze_base_url')
          .maybeSingle()
        
        if (error) {
          console.log('[AI Config] Database query error:', error.message)
        }
        
        if (!error && data?.coze_api_key) {
          console.log('[AI Config] Got config from database')
          return {
            apiKey: data.coze_api_key,
            baseUrl: data.coze_base_url || undefined,
          }
        } else if (!error) {
          console.log('[AI Config] Database query returned no data')
        }
      } catch (dbError) {
        console.log('[AI Config] Database error:', dbError instanceof Error ? dbError.message : String(dbError))
      }
    } else {
      console.log('[AI Config] Database not configured')
    }
    
    // 尝试从内存存储获取
    const { getCozeConfigFromMemory } = await import('@/lib/memory-store')
    const memoryConfig = getCozeConfigFromMemory()
    console.log('[AI Config] Memory config check:', { 
      hasConfig: !!memoryConfig, 
      hasApiKey: !!memoryConfig?.apiKey,
      baseUrl: memoryConfig?.baseUrl 
    })
    if (memoryConfig?.apiKey) {
      console.log('[AI Config] Got config from memory store')
      return memoryConfig
    }
  } catch (err) {
    console.log('[AI Config] Error getting config:', err instanceof Error ? err.message : String(err))
  }
  
  console.log('[AI Config] No config found, returning empty')
  return {}
}

/**
 * 获取服务端 AI 配置（供 API 路由使用）
 */
export async function getServerAIConfig(): Promise<{
  apiKey?: string
  baseUrl?: string
  model: string
  useSystemDefault: boolean
}> {
  const userConfig = await getUserCozeConfig()
  
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  if (userConfig?.apiKey) {
    console.log('[AI Config] Using user config from memory store')
    return {
      apiKey: userConfig.apiKey,
      baseUrl: userConfig.baseUrl || defaultBaseUrl,
      model: DEFAULT_LLM_MODEL,
      useSystemDefault: false,
    }
  }
  
  console.log('[AI Config] Using system default config, baseUrl:', defaultBaseUrl)
  return {
    baseUrl: defaultBaseUrl,
    model: DEFAULT_LLM_MODEL,
    useSystemDefault: true,
  }
}

// ==================== OpenAI 兼容配置 ====================

/**
 * 获取 LLM Provider 配置
 * 支持从环境变量或用户设置获取配置
 */
export interface LLMProviderConfig {
  provider: LLMProvider
  apiKey?: string
  baseUrl?: string
  model?: string
}

/**
 * 获取 LLM Provider 配置
 * 优先级：环境变量 > 用户设置 > 默认值
 */
async function getLLMProviderConfig(): Promise<LLMProviderConfig> {
  // 从环境变量获取 Provider 类型
  const envProvider = process.env.LLM_PROVIDER as LLMProvider | undefined
  
  // 如果明确指定使用 openai-compatible
  if (envProvider === 'openai-compatible') {
    const apiKey = process.env.LLM_API_KEY
    const baseUrl = process.env.LLM_BASE_URL
    const model = process.env.LLM_MODEL
    
    // 如果环境变量没有配置，尝试从用户设置获取
    if (!apiKey || !baseUrl) {
      try {
        const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
        
        if (isDatabaseConfigured()) {
          const db = getSupabaseClient()
          const { data, error } = await db
            .from('user_settings')
            .select('llm_api_key, llm_base_url, llm_model, llm_provider')
            .maybeSingle()
          
          if (!error && data) {
            return {
              provider: data.llm_provider || 'openai-compatible',
              apiKey: apiKey || data.llm_api_key,
              baseUrl: baseUrl || data.llm_base_url,
              model: model || data.llm_model,
            }
          }
        }
      } catch {
        // 忽略错误
      }
      
      // 尝试内存存储
      try {
        const { getSettingsFromMemory } = await import('@/lib/memory-store')
        const settings = getSettingsFromMemory()
        
        if (settings?.llm_api_key) {
          return {
            provider: (settings.llm_provider as LLMProvider) || 'openai-compatible',
            apiKey: apiKey || (settings.llm_api_key as string),
            baseUrl: baseUrl || (settings.llm_base_url as string),
            model: model || (settings.llm_model as string),
          }
        }
      } catch {
        // 忽略错误
      }
    }
    
    return {
      provider: 'openai-compatible',
      apiKey,
      baseUrl,
      model,
    }
  }
  
  // 默认使用 Coze
  // 获取 Coze 配置
  const cozeConfig = await getUserCozeConfig()
  
  return {
    provider: 'coze',
    apiKey: cozeConfig.apiKey,
    baseUrl: cozeConfig.baseUrl,
    model: DEFAULT_LLM_MODEL,
  }
}

/**
 * 获取可用的 LLM Provider 列表（用于前端展示）
 */
export function getAvailableProviders() {
  return {
    coze: {
      name: 'Coze / 豆包',
      description: '使用 Coze API，支持豆包系列模型',
      models: AVAILABLE_LLM_MODELS,
    },
    ...OPENAI_COMPATIBLE_PROVIDERS,
  }
}

// ==================== Bot Skills 调用 ====================

/**
 * 获取用户配置的 Bot ID
 * 用于通过 Bot 调用 Skills（如图像生成、视频生成）
 */
async function getBotId(): Promise<string | null> {
  try {
    // 先尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('user_settings')
          .select('coze_bot_id')
          .maybeSingle()
        
        if (!error && data?.coze_bot_id) {
          console.log('[AI Config] Got bot_id from database')
          return data.coze_bot_id
        }
      } catch {
        // 数据库不可用，继续尝试内存存储
      }
    }
    
    // 尝试从内存存储获取
    const { getSettingsFromMemory } = await import('@/lib/memory-store')
    const settings = getSettingsFromMemory()
    if (settings?.coze_bot_id) {
      console.log('[AI Config] Got bot_id from memory store')
      return settings.coze_bot_id as string
    }
  } catch {
    // 忽略错误
  }
  
  return null
}

/**
 * Bot 配置类型
 */
interface BotConfig {
  botId: string | null
  botType: 'v3_chat' | 'stream_run'
  botEndpoint?: string
  botProjectId?: string
  botSessionId?: string
}

/**
 * 获取用户配置的 Bot 配置
 * 包括 Bot ID、API 类型和相关配置
 */
async function getBotConfig(): Promise<BotConfig> {
  try {
    // 先尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        // 使用 service_role 客户端绕过 RLS
        const db = getSupabaseClient(true)
        const { data, error } = await db
          .from('user_settings')
          .select('coze_bot_id, coze_bot_type, coze_bot_endpoint, coze_bot_project_id, coze_bot_session_id')
          .maybeSingle()
        
        // 只要有任何 Bot 相关配置就返回
        if (!error && data && (data.coze_bot_id || data.coze_bot_type === 'stream_run')) {
          console.log('[AI Config] Got bot config from database', { 
            hasBotId: !!data.coze_bot_id,
            botType: data.coze_bot_type,
            hasEndpoint: !!data.coze_bot_endpoint 
          })
          return {
            botId: data.coze_bot_id || null,
            botType: data.coze_bot_type || 'v3_chat',
            botEndpoint: data.coze_bot_endpoint || undefined,
            botProjectId: data.coze_bot_project_id || undefined,
            botSessionId: data.coze_bot_session_id || undefined,
          }
        } else if (!error) {
          console.log('[AI Config] Database query returned no bot config')
        } else {
          console.log('[AI Config] Database query error:', error?.message)
        }
      } catch (dbError) {
        console.log('[AI Config] Database error:', dbError instanceof Error ? dbError.message : String(dbError))
      }
    }
    
    // 尝试从内存存储获取
    const { getCozeConfigFromMemory } = await import('@/lib/memory-store')
    const config = getCozeConfigFromMemory()
    if (config?.botId || config?.botType === 'stream_run') {
      console.log('[AI Config] Got bot config from memory store', {
        hasBotId: !!config?.botId,
        botType: config?.botType,
        hasEndpoint: !!config?.botEndpoint
      })
      return {
        botId: config?.botId || null,
        botType: config?.botType || 'v3_chat',
        botEndpoint: config?.botEndpoint,
        botProjectId: config?.botProjectId,
        botSessionId: config?.botSessionId,
      }
    }
  } catch {
    // 忽略错误
  }
  
  return { botId: null, botType: 'v3_chat' }
}

/**
 * 调用 Stream Run API
 * 新的 Bot API 端点，支持更灵活的调用方式
 */
async function invokeStreamRunAPI(
  prompt: string,
  config: {
    apiKey: string
    endpoint: string
    projectId: string
    sessionId?: string
  }
): Promise<{ content: string }> {
  const { apiKey, endpoint, projectId, sessionId } = config
  
  logger.info('Invoking Stream Run API', { 
    endpoint, 
    projectId,
    hasSessionId: !!sessionId,
    promptLength: prompt.length
  })
  
  const requestBody = {
    content: {
      query: {
        prompt: [
          {
            type: 'text',
            content: {
              text: prompt
            }
          }
        ]
      }
    },
    type: 'query',
    session_id: sessionId || `session_${Date.now()}`,
    project_id: projectId
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    logger.error('Stream Run API failed', { 
      status: response.status, 
      error: errorText.slice(0, 500) 
    })
    throw new Error(`Stream Run API 调用失败: ${response.status} ${response.statusText}`)
  }
  
  // 处理流式响应
  const contentType = response.headers.get('content-type') || ''
  let content = ''
  
  if (contentType.includes('text/event-stream') || contentType.includes('application/stream+json')) {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      
      // 按双换行分割事件
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      
      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue
        
        const lines = eventBlock.split('\n')
        let eventData = ''
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            eventData = line.slice(5).trim()
          }
        }
        
        if (!eventData || eventData === '[DONE]') continue
        
        try {
          const data = JSON.parse(eventData)
          
          // 处理各种响应格式
          if (data.type === 'answer' && data.content) {
            content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
          }
          
          if (data.content && typeof data.content === 'string') {
            content += data.content
          }
          
          // 检查错误
          if (data.code && data.code !== 0) {
            throw new Error(`Stream Run API 错误 (code: ${data.code}): ${data.msg}`)
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            continue
          }
          throw parseError
        }
      }
    }
  } else {
    // 非 SSE 响应
    const responseText = await response.text()
    logger.info('Stream Run non-stream response', { length: responseText.length })
    
    try {
      const data = JSON.parse(responseText)
      if (data.code && data.code !== 0) {
        throw new Error(`Stream Run API 错误 (code: ${data.code}): ${data.msg}`)
      }
      if (data.data?.content) {
        content = data.data.content
      } else if (data.content) {
        content = data.content
      }
    } catch {
      content = responseText
    }
  }
  
  logger.info('Stream Run API completed', { contentLength: content.length })
  return { content }
}

/**
 * 通过 Stream Run API 调用图像生成
 */
async function invokeStreamRunForImageGeneration(
  prompt: string,
  config: {
    apiKey: string
    endpoint: string
    projectId: string
    sessionId?: string
  },
  referenceImages?: string[]
): Promise<{ urls: string[] }> {
  // 构建图像生成提示词
  let fullPrompt = `请使用图像生成工具生成以下图片：\n${prompt}`
  
  if (referenceImages && referenceImages.length > 0) {
    fullPrompt += `\n\n参考图片（请保持人物外观一致）：`
    for (let i = 0; i < referenceImages.length; i++) {
      fullPrompt += `\n${i + 1}. ${referenceImages[i]}`
    }
  }
  
  const { content } = await invokeStreamRunAPI(fullPrompt, config)
  
  // 从内容中提取图片 URL
  const urls: string[] = []
  
  // 匹配 Markdown 图片语法
  const markdownRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g
  let match
  while ((match = markdownRegex.exec(content)) !== null) {
    urls.push(match[1])
  }
  
  // 匹配直接的图片 URL
  if (urls.length === 0) {
    const urlRegex = /(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|image))/gi
    while ((match = urlRegex.exec(content)) !== null) {
      urls.push(match[1])
    }
  }
  
  if (urls.length === 0) {
    throw new Error('Bot 未返回有效的图片链接。请确保 Bot 已正确配置图像生成 Skill。')
  }
  
  return { urls }
}

/**
 * 通过 Bot 调用图像生成 Skill
 * 当 PAT 没有 ImageGenerationClient 权限时，可以通过配置了图像生成 Skill 的 Bot 来调用
 * 
 * 使用方法：
 * 1. 在 Coze 平台创建一个 Bot
 * 2. 给 Bot 配置图像生成 Skill
 * 3. 在设置页面配置 Bot ID
 * 
 * @param prompt 图像生成提示词
 * @param config API 配置（apiKey, baseUrl）
 * @param referenceImages 参考图片URL列表（用于多人物图生图）
 * @returns 生成的图像 URL 列表
 */
async function invokeBotForImageGeneration(
  prompt: string,
  config?: { apiKey?: string; baseUrl?: string },
  referenceImages?: string[]
): Promise<{ urls: string[] }> {
  const { apiKey, baseUrl = 'https://api.coze.cn' } = config || {}
  const botConfig = await getBotConfig()
  const { botId, botType, botEndpoint, botProjectId, botSessionId } = botConfig
  
  if (!apiKey) {
    throw new Error('通过 Bot 调用图像生成需要配置 Coze API Key')
  }
  
  // 如果是 stream_run 类型，使用新的 API（不需要 botId）
  if (botType === 'stream_run') {
    if (!botEndpoint || !botProjectId) {
      throw new Error('Stream Run 模式需要配置端点 URL 和 Project ID')
    }
    
    console.log('[AI Config] Using Stream Run API for image generation')
    return invokeStreamRunForImageGeneration(prompt, {
      apiKey,
      endpoint: botEndpoint,
      projectId: botProjectId,
      sessionId: botSessionId,
    }, referenceImages)
  }
  
  // V3 Chat 模式需要 botId
  if (!botId) {
    throw new Error('通过 Bot 调用图像生成需要配置 Bot ID。请在 Coze 平台创建配置了图像生成 Skill 的智能体，并在设置页面配置 Bot ID。')
  }
  
  // 默认使用 v3/chat API
  logger.info('Invoking Bot for image generation via v3/chat', { 
    botId, 
    promptLength: prompt.length,
    referenceImageCount: referenceImages?.length || 0
  })
  
  // 构建消息内容
  let userContent = `请使用图像生成工具生成以下图片：\n${prompt}`
  
  // 如果有参考图片，在提示词中添加参考图片信息
  // 注意：Coze Bot 的多模态消息格式可能不兼容，这里用文本方式传递
  if (referenceImages && referenceImages.length > 0) {
    userContent += `\n\n参考图片（请保持人物外观一致）：`
    for (let i = 0; i < referenceImages.length; i++) {
      userContent += `\n${i + 1}. ${referenceImages[i]}`
    }
  }
  
  // 调用 Bot API，通过特定 prompt 触发图像生成 Skill
  // 注意：Coze API 要求 auto_save_history=false 时必须使用 stream=true
  const response = await fetch(`${baseUrl}/v3/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bot_id: botId,
      user_id: 'drama-workshop-image-gen',
      stream: true,
      auto_save_history: false,
      additional_messages: [{
        role: 'user',
        content: userContent,
        content_type: 'text'
      }],
      // 同时在自定义参数中传递 reference_images（供 Bot Skill 使用）
      custom_variables: referenceImages && referenceImages.length > 0 ? {
        reference_images: referenceImages
      } : undefined,
    }),
  })
  
  // 处理流式响应
  if (!response.ok) {
    const errorText = await response.text()
    console.log('[Bot Image] Response status:', response.status)
    console.log('[Bot Image] Response preview:', errorText.slice(0, 500))
    throw new Error(`Bot API 调用失败: ${response.status} ${response.statusText} - ${errorText}`)
  }
  
  console.log('[Bot Image] Response status:', response.status)
  console.log('[Bot Image] Content-Type:', response.headers.get('content-type'))
  
  // 检查是否是流式响应
  const contentType = response.headers.get('content-type') || ''
  let content = ''
  
  if (contentType.includes('text/event-stream') || contentType.includes('application/stream+json')) {
    // 处理 SSE 流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      
      // 按双换行分割事件
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      
      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue
        
        const lines = eventBlock.split('\n')
        let eventData = ''
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            eventData = line.slice(5).trim()
          }
        }
        
        if (!eventData || eventData === '[DONE]') continue
        
        try {
          const data = JSON.parse(eventData)
          
          // 处理 conversation.message.completed 事件
          if (data.type === 'answer' && data.content) {
            content = data.content
          }
          
          // 处理 delta 事件
          if (data.content && typeof data.content === 'string') {
            content += data.content
          }
          
          // 检查错误
          if (data.code && data.code !== 0) {
            throw new Error(`Bot API 错误 (code: ${data.code}): ${data.msg}`)
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            continue
          }
          throw parseError
        }
      }
    }
  } else {
    // 非 SSE 响应（可能是错误）
    const responseText = await response.text()
    console.log('[Bot Image] Non-stream response:', responseText.slice(0, 500))
    
    // 尝试解析为 JSON
    try {
      const data = JSON.parse(responseText)
      
      // 检查错误码
      if (data.code && data.code !== 0) {
        throw new Error(`Bot API 错误 (code: ${data.code}): ${data.msg}`)
      }
      
      // 提取内容
      if (data.data?.[0]?.content) {
        content = data.data[0].content
      } else if (data.messages?.[0]?.content) {
        content = data.messages[0].content
      } else if (data.content) {
        content = data.content
      }
    } catch {
      // 可能整个响应就是内容
      content = responseText
    }
  }
  
  console.log('[Bot Image] Content length:', content.length, 'preview:', content.slice(0, 300))
  
  // 从内容中提取图片 URL
  const urls: string[] = []
  
  // 匹配 Markdown 图片语法 ![alt](url)
  const markdownRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g
  let match
  while ((match = markdownRegex.exec(content)) !== null) {
    urls.push(match[1])
  }
  
  // 匹配直接的图片 URL
  if (urls.length === 0) {
    const urlRegex = /(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|image))/gi
    while ((match = urlRegex.exec(content)) !== null) {
      urls.push(match[1])
    }
  }
  
  // 匹配 Coze 文件链接格式
  if (urls.length === 0) {
    const cozeUrlRegex = /(https?:\/\/[^\s"'<>]+\/file\/[^\s"'<>]+)/gi
    while ((match = cozeUrlRegex.exec(content)) !== null) {
      urls.push(match[1])
    }
  }
  
  // 匹配 Coze CDN 链接
  if (urls.length === 0) {
    const cdnUrlRegex = /(https?:\/\/[^\s"'<>]*\.coze\.cn[^\s"'<>]*)/gi
    while ((match = cdnUrlRegex.exec(content)) !== null) {
      if (match[1].includes('image') || match[1].includes('file') || match[1].includes('cdn')) {
        urls.push(match[1])
      }
    }
  }
  
  if (urls.length === 0) {
    logger.warn('Bot returned no image URLs', { content: content.slice(0, 500) })
    throw new Error('Bot 未返回有效的图片链接。请确保 Bot 已正确配置图像生成 Skill。')
  }
  
  logger.info('Bot image generation completed', { count: urls.length })
  return { urls }
}

/**
 * 通过 Stream Run API 调用视频生成
 */
async function invokeStreamRunForVideoGeneration(
  prompt: string,
  config: {
    apiKey: string
    endpoint: string
    projectId: string
    sessionId?: string
  },
  imageUrl?: string,
  lastFrameUrl?: string
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  // 构建视频生成提示词
  let videoPrompt = ''
  
  if (imageUrl && lastFrameUrl) {
    videoPrompt = `请使用图生视频功能，根据以下首帧和尾帧图片生成视频：

首帧图片URL：${imageUrl}
尾帧图片URL：${lastFrameUrl}

视频要求：
1. 以首帧图片作为视频的第一帧
2. 以尾帧图片作为视频的最后一帧
3. ${prompt}
4. 保持画面风格一致，确保从首帧到尾帧的自然过渡
5. 请直接返回生成的视频链接`
  } else if (imageUrl) {
    videoPrompt = `请使用图生视频功能，根据以下首帧图片生成视频：

首帧图片URL：${imageUrl}

视频要求：
1. 以提供的图片作为视频的第一帧
2. ${prompt}
3. 保持画面风格一致
4. 请直接返回生成的视频链接，并返回尾帧图片链接`
  } else {
    videoPrompt = `请生成以下视频：

${prompt}

请直接返回生成的视频链接。`
  }
  
  const { content } = await invokeStreamRunAPI(videoPrompt, config)
  
  // 从内容中提取视频 URL
  return extractVideoUrlFromContent(content)
}

/**
 * 通过 Bot 调用视频生成 Skill
 * 当 PAT 没有 VideoGenerationClient 权限时，可以通过配置了视频生成 Skill 的 Bot 来调用
 * 
 * @param prompt 视频生成提示词
 * @param config API 配置（apiKey, baseUrl）
 * @param imageUrl 可选的首帧图片 URL（用于图生视频）
 * @returns 生成的视频 URL
 */
async function invokeBotForVideoGeneration(
  prompt: string,
  config?: { apiKey?: string; baseUrl?: string },
  imageUrl?: string,
  lastFrameUrl?: string
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  const { apiKey, baseUrl = 'https://api.coze.cn' } = config || {}
  const botConfig = await getBotConfig()
  const { botId, botType, botEndpoint, botProjectId, botSessionId } = botConfig
  
  if (!apiKey) {
    throw new Error('通过 Bot 调用视频生成需要配置 Coze API Key')
  }
  
  // 如果是 stream_run 类型，使用新的 API（不需要 botId）
  if (botType === 'stream_run') {
    if (!botEndpoint || !botProjectId) {
      throw new Error('Stream Run 模式需要配置端点 URL 和 Project ID')
    }
    
    console.log('[AI Config] Using Stream Run API for video generation')
    return invokeStreamRunForVideoGeneration(prompt, {
      apiKey,
      endpoint: botEndpoint,
      projectId: botProjectId,
      sessionId: botSessionId,
    }, imageUrl, lastFrameUrl)
  }
  
  // V3 Chat 模式需要 botId
  if (!botId) {
    throw new Error('通过 Bot 调用视频生成需要配置 Bot ID。请在 Coze 平台创建配置了视频生成 Skill 的智能体，并在设置页面配置 Bot ID。')
  }
  
  // 默认使用 v3/chat API
  logger.info('Invoking Bot for video generation via v3/chat', { 
    botId, 
    baseUrl, 
    hasImageUrl: !!imageUrl,
    hasLastFrameUrl: !!lastFrameUrl
  })
  
  // 构建视频生成提示词
  let videoPrompt = ''
  
  if (imageUrl && lastFrameUrl) {
    // 首尾帧模式 - 同时提供首帧和尾帧
    videoPrompt = `请使用图生视频功能，根据以下首帧和尾帧图片生成视频：

首帧图片URL：${imageUrl}
尾帧图片URL：${lastFrameUrl}

视频要求：
1. 以首帧图片作为视频的第一帧
2. 以尾帧图片作为视频的最后一帧
3. ${prompt}
4. 保持画面风格一致，确保从首帧到尾帧的自然过渡
5. 请直接返回生成的视频链接`
  } else if (imageUrl) {
    // 仅首帧模式 - 图生视频
    videoPrompt = `请使用图生视频功能，根据以下首帧图片生成视频：

首帧图片URL：${imageUrl}

视频要求：
1. 以提供的图片作为视频的第一帧
2. ${prompt}
3. 保持画面风格一致
4. 请直接返回生成的视频链接，并返回尾帧图片链接`
  } else {
    // 纯文本生成视频模式
    videoPrompt = `请生成以下视频：

${prompt}

请直接返回生成的视频链接。`
  }
  
  logger.info('Bot video generation prompt', { 
    hasImageUrl: !!imageUrl, 
    promptLength: videoPrompt.length
  })
  
  // 调用 Bot API
  // 注意：Coze API 要求 auto_save_history=false 时必须使用 stream=true
  const response = await fetch(`${baseUrl}/v3/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bot_id: botId,
      user_id: 'drama-workshop-video-gen',
      stream: true,
      auto_save_history: false,
      additional_messages: [{
        role: 'user',
        content: videoPrompt,
        content_type: 'text'
      }],
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    logger.error('Bot video API failed', { status: response.status, error: errorText.slice(0, 500) })
    throw new Error(`Bot API 调用失败: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`)
  }
  
  logger.info('Bot video API response ok, processing stream...')
  
  // 检查响应类型
  const responseContentType = response.headers.get('content-type') || ''
  logger.info('Bot video response content-type:', { contentType: responseContentType })
  
  // 如果不是流式响应，直接读取完整内容
  if (!responseContentType.includes('text/event-stream') && !responseContentType.includes('application/stream+json')) {
    const responseText = await response.text()
    logger.info('Bot video non-stream response:', { length: responseText.length, preview: responseText.slice(0, 500) })
    
    // 尝试解析为 JSON
    let content = ''
    try {
      const data = JSON.parse(responseText)
      
      // 检查错误码
      if (data.code && data.code !== 0) {
        throw new Error(`Bot API 错误 (code: ${data.code}): ${data.msg}`)
      }
      
      // 提取内容
      if (data.data?.[0]?.content) {
        content = data.data[0].content
      } else if (data.messages?.[0]?.content) {
        content = data.messages[0].content
      } else if (data.content) {
        content = data.content
      }
    } catch {
      // 可能整个响应就是内容
      content = responseText
    }
    
    // 从内容中提取视频 URL
    return extractVideoUrlFromContent(content)
  }
  
  // 处理流式响应
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法获取响应流')
  }
  
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let chunkCount = 0
  let firstChunk = true
  
  // 设置超时（3分钟）
  const timeout = setTimeout(() => {
    logger.warn('Bot video stream timeout after 3 minutes', { contentLength: content.length, chunkCount })
  }, 180000)
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        logger.info('Bot video stream done', { chunkCount, contentLength: content.length })
        break
      }
      
      chunkCount++
      const chunk = decoder.decode(value, { stream: true })
      
      // 打印第一个 chunk 的内容，用于诊断
      if (firstChunk) {
        logger.info('Bot video first chunk received', { 
          chunkLength: chunk.length, 
          preview: chunk.slice(0, 500) 
        })
        firstChunk = false
      }
      
      buffer += chunk
      
      // 每 10 个 chunk 打印一次进度
      if (chunkCount % 10 === 0) {
        logger.info('Bot video stream progress', { chunkCount, bufferSize: buffer.length })
      }
      
      // 按双换行分割事件
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      
      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue
        
        const lines = eventBlock.split('\n')
        let eventData = ''
        let eventType = ''
        
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          }
          if (line.startsWith('data:')) {
            eventData = line.slice(5).trim()
          }
        }
        
        if (!eventData || eventData === '[DONE]') continue
        
        try {
          const data = JSON.parse(eventData)
          
          // 打印所有事件类型和关键字段
          if (chunkCount <= 5 || eventType.includes('completed') || data.status === 'completed') {
            logger.info('Bot video event detail', { 
              eventType, 
              dataType: data.type, 
              dataStatus: data.status,
              hasContent: !!data.content,
              hasDataContent: !!(data.data?.content || data.data?.[0]?.content),
              dataKeys: Object.keys(data).slice(0, 10)
            })
          }
          
          // 处理各种可能的内容字段
          // 1. conversation.message.completed 事件 - 只处理 answer 类型
          if (eventType === 'conversation.message.completed') {
            // data.type 是消息类型：answer, follow_up, verbose 等
            // 只有 answer 类型包含实际的视频 URL
            const messageType = data.type
            if (data.content && messageType === 'answer') {
              content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
              logger.info('Bot video got answer content', { 
                messageType, 
                contentLength: content.length,
                preview: content.slice(0, 200)
              })
            } else if (data.content) {
              logger.info('Bot video ignoring non-answer message', { 
                messageType, 
                contentLength: typeof data.content === 'string' ? data.content.length : JSON.stringify(data.content).length
              })
            }
          }
          
          // 2. answer 事件（带内容）- 但不覆盖已有内容（优先保留 conversation.message.completed 的内容）
          if (data.type === 'answer' && data.content && !content) {
            content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
          }
          
          // 3. delta 事件（流式输出）
          if (data.content && typeof data.content === 'string' && !content) {
            content += data.content
          }
          
          // 4. data 数组格式
          if (data.data && !content) {
            if (Array.isArray(data.data)) {
              for (const item of data.data) {
                if (item.content) {
                  content += typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
                }
              }
            } else if (data.data.content) {
              content += typeof data.data.content === 'string' ? data.data.content : JSON.stringify(data.data.content)
            }
          }
          
          // 检查错误
          if (data.code && data.code !== 0) {
            logger.error('Bot video API error', { code: data.code, msg: data.msg })
            throw new Error(`Bot API 错误 (code: ${data.code}): ${data.msg}`)
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            // JSON 解析失败，可能是非标准格式
            logger.warn('Bot video JSON parse error', { eventData: eventData.slice(0, 200) })
            continue
          }
          throw parseError
        }
      }
    }
  } finally {
    clearTimeout(timeout)
  }
  
  // 从内容中提取视频 URL
  return extractVideoUrlFromContent(content)
}

/**
 * 从 Bot 响应内容中提取视频 URL 和尾帧 URL
 */
function extractVideoUrlFromContent(content: string): { videoUrl: string; lastFrameUrl?: string } {
  logger.info('Extracting video URL from content', { contentLength: content.length, preview: content.slice(0, 300) })
  
  // 打印完整内容以便调试（如果内容不太长）
  if (content.length < 2000) {
    logger.info('Full Bot response content', { content })
  }
  
  let videoUrl = ''
  let lastFrameUrl: string | undefined
  
  // 1. 匹配 Markdown 格式的视频链接: ![video](url)
  const markdownRegex = /!\[video\]\((https?:\/\/[^)]+)\)/i
  const markdownMatch = markdownRegex.exec(content)
  if (markdownMatch) {
    videoUrl = markdownMatch[1]
    logger.info('Found video URL in Markdown format', { videoUrl })
  }
  
  // 2. 匹配视频 URL（mp4, webm 等格式）
  if (!videoUrl) {
    const videoRegex = /(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)(?:\?[^\s"'<>]*)?)/i
    const match = videoRegex.exec(content)
    if (match) {
      videoUrl = match[1]
      logger.info('Found direct video URL', { videoUrl })
    }
  }
  
  // 3. 匹配 Coze 文件链接格式 (可能是下载页面)
  if (!videoUrl) {
    // 匹配 coze.cn/file/ 或 coze.com/file/ 格式
    const cozeFileRegex = /(https?:\/\/[^\s"'<>]*\.?coze\.(?:cn|com)\/file\/[^\s"'<>]+)/i
    const cozeFileMatch = cozeFileRegex.exec(content)
    if (cozeFileMatch) {
      videoUrl = cozeFileMatch[1]
      logger.info('Found Coze file URL', { videoUrl })
    }
  }
  
  // 4. 匹配火山引擎 TOS URL
  if (!videoUrl) {
    const tosRegex = /(https?:\/\/[^\s"'<>]*\.?tos-cn-[^\s"'<>]+\.volces\.com[^\s"'<>]*)/i
    const tosMatch = tosRegex.exec(content)
    if (tosMatch) {
      videoUrl = tosMatch[1]
      logger.info('Found Volcengine TOS URL', { videoUrl })
    }
  }
  
  // 5. 匹配 Coze 存储链接
  if (!videoUrl) {
    const cozeStorageRegex = /(https?:\/\/[^\s"'<>]*tos\.coze\.site[^\s"'<>]*)/i
    const cozeStorageMatch = cozeStorageRegex.exec(content)
    if (cozeStorageMatch) {
      videoUrl = cozeStorageMatch[1]
      logger.info('Found Coze storage URL', { videoUrl })
    }
  }
  
  // 6. 匹配任何看起来像视频链接的 URL
  if (!videoUrl) {
    const anyUrlRegex = /(https?:\/\/[^\s"'<>]*(?:video|file|download|output)[^\s"'<>]*)/i
    const anyMatch = anyUrlRegex.exec(content)
    if (anyMatch) {
      videoUrl = anyMatch[1]
      logger.info('Found generic video-related URL', { videoUrl })
    }
  }
  
  // 提取尾帧图片 URL
  // 匹配 Markdown 格式: ![last_frame](url) 或 ![尾帧](url)
  const lastFrameMarkdownRegex = /!\[(?:last_frame|尾帧)\]\((https?:\/\/[^)]+)\)/i
  const lastFrameMarkdownMatch = lastFrameMarkdownRegex.exec(content)
  if (lastFrameMarkdownMatch) {
    lastFrameUrl = lastFrameMarkdownMatch[1]
    logger.info('Found last frame URL in Markdown format', { lastFrameUrl })
  }
  
  // 匹配 JSON 格式的尾帧: "last_frame_url": "..." 或 "lastFrameUrl": "..."
  if (!lastFrameUrl) {
    const lastFrameJsonRegex = /"(?:last_frame_url|lastFrameUrl)"\s*:\s*"(https?:\/\/[^"]+)"/i
    const lastFrameJsonMatch = lastFrameJsonRegex.exec(content)
    if (lastFrameJsonMatch) {
      lastFrameUrl = lastFrameJsonMatch[1]
      logger.info('Found last frame URL in JSON format', { lastFrameUrl })
    }
  }
  
  // 匹配尾帧图片 URL（png, jpg 等格式，排除已经是视频 URL 的部分）
  if (!lastFrameUrl && videoUrl) {
    const imageRegex = /(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp)(?:\?[^\s"'<>]*)?)/gi
    const imageMatches = content.match(imageRegex)
    if (imageMatches && imageMatches.length > 0) {
      // 过滤掉可能与视频URL重复的URL，取最后一个作为尾帧
      const potentialLastFrame = imageMatches.find(url => url !== videoUrl) || imageMatches[imageMatches.length - 1]
      if (potentialLastFrame && potentialLastFrame !== videoUrl) {
        lastFrameUrl = potentialLastFrame
        logger.info('Found last frame URL as image', { lastFrameUrl })
      }
    }
  }
  
  if (!videoUrl) {
    logger.warn('Bot returned no video URL', { content: content.slice(0, 500) })
    throw new Error('Bot 未返回有效的视频链接。请确保 Bot 已正确配置视频生成 Skill。')
  }
  
  logger.info('Bot video generation completed', { videoUrl, lastFrameUrl })
  return { videoUrl, lastFrameUrl }
}

// ==================== LLM 服务 ====================

/**
 * 创建 LLM 客户端
 * 支持用户配置的 Coze API Key
 */
export async function createLLMClientAsync(
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<LLMClient> {
  // 获取用户配置
  const userConfig = await getUserCozeConfig()
  
  // 优先级：传入参数 > 用户配置 > 环境变量 > 默认值
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  const clientConfig = new Config({
    apiKey: config?.apiKey || userConfig.apiKey, // 优先使用传入参数，其次用户配置
    baseUrl: config?.baseUrl || userConfig.baseUrl || defaultBaseUrl,
    timeout: config?.timeout || 300000, // 5分钟超时（分析长文本可能需要更长时间）
  })

  console.log('[LLM Client] Config:', {
    hasApiKey: !!(config?.apiKey || userConfig.apiKey),
    baseUrl: config?.baseUrl || userConfig.baseUrl || defaultBaseUrl,
    timeout: clientConfig.timeout,
  })

  return new LLMClient(clientConfig, headers)
}

/**
 * 创建 LLM 客户端（同步版本，兼容旧代码）
 */
export function createLLMClient(
  config?: AIServiceConfig,
  headers?: Record<string, string>
): LLMClient {
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  const clientConfig = new Config({
    apiKey: config?.apiKey, // 可选，系统会自动处理
    baseUrl: config?.baseUrl || defaultBaseUrl,
    timeout: config?.timeout || 300000, // 5分钟超时
  })

  return new LLMClient(clientConfig, headers)
}

/**
 * 调用 LLM（非流式）
 * 支持多种 Provider：
 * - coze: 使用 Coze SDK
 * - openai-compatible: 使用 OpenAI 兼容 API
 */
export async function invokeLLM(
  messages: LLMMessage[],
  options?: LLMOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<string> {
  // 获取 Provider 配置
  const providerConfig = await getLLMProviderConfig()
  
  // 检查是否强制使用 OpenAI 兼容模式（通过环境变量或配置）
  const forceOpenAI = process.env.LLM_PROVIDER === 'openai-compatible' || 
                      providerConfig.provider === 'openai-compatible'
  
  // 如果配置了 OpenAI 兼容模式且有必要的配置
  if (forceOpenAI && providerConfig.apiKey && providerConfig.baseUrl) {
    const model = options?.model || config?.model || providerConfig.model || 'gpt-3.5-turbo'
    
    logger.info('LLM invoke started (OpenAI Compatible)', { 
      provider: providerConfig.provider,
      model,
      baseUrl: providerConfig.baseUrl,
    })
    
    try {
      const client = new OpenAICompatibleClient({
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        model,
        timeout: config?.timeout || 300000,
      })
      
      const response = await client.invoke(
        messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { temperature: options?.temperature ?? 0.7 }
      )
      
      logger.info('LLM invoke completed (OpenAI Compatible)', { responseLength: response.length })
      return response
    } catch (err) {
      logger.error('LLM invoke failed (OpenAI Compatible)', err)
      throw err
    }
  }
  
  // 使用 Coze SDK
  const model = options?.model || config?.model || providerConfig.model || DEFAULT_LLM_MODEL
  const hasUserConfig = !!(config?.apiKey || providerConfig.apiKey)

  logger.info('LLM invoke started (Coze)', { 
    model, 
    hasUserConfig,
    useSystemDefault: !config?.apiKey && !providerConfig.apiKey 
  })

  // 如果有用户配置，先尝试用户配置
  if (hasUserConfig) {
    try {
      const clientConfig = {
        ...config,
        apiKey: config?.apiKey || providerConfig.apiKey,
        baseUrl: config?.baseUrl || providerConfig.baseUrl,
      }
      const client = createLLMClient(clientConfig, headers)
      const response = await withRetry(
        () =>
          client.invoke(messages, {
            model,
            temperature: options?.temperature ?? 0.7,
            thinking: options?.thinking ?? 'disabled',
            caching: options?.caching ?? 'disabled',
          }),
        { maxRetries: 2, delay: 3000 }
      )

      logger.info('LLM invoke completed with user config (Coze)', { responseLength: response.content.length })
      return response.content
    } catch (userError) {
      logger.warn('LLM invoke failed with user config, falling back to system model (Coze)', { 
        error: userError instanceof Error ? userError.message : String(userError) 
      })
      
      // 用户配置失败，尝试系统模型
      try {
        const systemClient = createLLMClient(undefined, headers)
        const response = await systemClient.invoke(messages, {
          model: DEFAULT_LLM_MODEL,
          temperature: options?.temperature ?? 0.7,
          thinking: options?.thinking ?? 'disabled',
          caching: options?.caching ?? 'disabled',
        })

        logger.info('LLM invoke completed with system fallback (Coze)', { responseLength: response.content.length })
        
        // 返回结果，同时标记使用了回退
        return response.content
      } catch (systemError) {
        logger.error('LLM invoke failed with both user and system config (Coze)', { userError, systemError })
        // 抛出特殊错误，让调用方知道回退也失败了
        const error = new Error('用户模型和系统模型均请求失败')
        ;(error as any).fallbackAttempted = true
        ;(error as any).originalError = userError
        throw error
      }
    }
  }

  // 使用系统默认模型
  const client = createLLMClient(config, headers)

  try {
    const response = await withRetry(
      () =>
        client.invoke(messages, {
          model,
          temperature: options?.temperature ?? 0.7,
          thinking: options?.thinking ?? 'disabled',
          caching: options?.caching ?? 'disabled',
        }),
      { maxRetries: 1, delay: 3000 } // 减少重试次数，避免长时间等待
    )

    logger.info('LLM invoke completed (Coze)', { responseLength: response.content.length })
    return response.content
  } catch (err) {
    logger.error('LLM invoke failed', err)

    if (err instanceof APIError) {
      throw Errors.AIRequestFailed('LLM', `${err.message} (status: ${err.statusCode})`)
    }
    if (err instanceof Error && err.message.includes('timeout')) {
      // 添加更友好的错误提示
      throw new Error('LLM 请求超时。可能原因：(1) 网络连接不稳定，请检查网络；(2) 服务繁忙，请稍后重试；(3) 建议在设置中配置您自己的 Coze API Key')
    }
    throw Errors.AIRequestFailed('LLM', err instanceof Error ? err.message : undefined)
  }
}

/**
 * 流式调用 LLM
 * 支持多种 Provider：
 * - coze: 使用 Coze SDK
 * - openai-compatible: 使用 OpenAI 兼容 API
 */
export async function* streamLLM(
  messages: LLMMessage[],
  options?: LLMOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): AsyncGenerator<string> {
  // 获取 Provider 配置
  const providerConfig = await getLLMProviderConfig()
  
  // 检查是否强制使用 OpenAI 兼容模式
  const forceOpenAI = process.env.LLM_PROVIDER === 'openai-compatible' || 
                      providerConfig.provider === 'openai-compatible'
  
  // 如果配置了 OpenAI 兼容模式且有必要的配置
  if (forceOpenAI && providerConfig.apiKey && providerConfig.baseUrl) {
    const model = options?.model || config?.model || providerConfig.model || 'gpt-3.5-turbo'
    
    logger.info('LLM stream started (OpenAI Compatible)', { 
      provider: providerConfig.provider,
      model,
      baseUrl: providerConfig.baseUrl,
    })
    
    try {
      const client = new OpenAICompatibleClient({
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        model,
        timeout: config?.timeout || 300000,
      })
      
      const stream = client.stream(
        messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { temperature: options?.temperature ?? 0.7 }
      )
      
      for await (const chunk of stream) {
        yield chunk
      }
      
      logger.info('LLM stream completed (OpenAI Compatible)')
      return
    } catch (err) {
      logger.error('LLM stream failed (OpenAI Compatible)', err)
      throw err
    }
  }
  
  // 使用 Coze SDK
  const client = createLLMClient(config, headers)
  const model = options?.model || config?.model || DEFAULT_LLM_MODEL

  logger.info('LLM stream started (Coze)', { model })

  try {
    const stream = client.stream(messages, {
      model,
      temperature: options?.temperature ?? 0.7,
      thinking: options?.thinking ?? 'disabled',
      caching: options?.caching ?? 'disabled',
    })

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content.toString()
      }
    }

    logger.info('LLM stream completed (Coze)')
  } catch (err) {
    logger.error('LLM stream failed (Coze)', err)
    throw Errors.AIRequestFailed('LLM', err instanceof Error ? err.message : undefined)
  }
}

// ==================== 图像生成服务 ====================

/**
 * 创建图像生成客户端
 * 支持用户配置的 Coze API Key
 */
export async function createImageClientAsync(
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<ImageGenerationClient> {
  // 获取用户配置
  const userConfig = await getUserCozeConfig()
  
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  const clientConfig = new Config({
    apiKey: config?.apiKey || userConfig.apiKey,
    baseUrl: config?.baseUrl || userConfig.baseUrl || defaultBaseUrl,
    timeout: config?.timeout || 180000, // 3分钟超时
  })

  return new ImageGenerationClient(clientConfig, headers)
}

/**
 * 创建图像生成客户端（同步版本）
 */
export function createImageClient(
  config?: AIServiceConfig,
  headers?: Record<string, string>
): ImageGenerationClient {
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  const clientConfig = new Config({
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl || defaultBaseUrl,
    timeout: config?.timeout || 180000, // 3分钟超时
  })

  return new ImageGenerationClient(clientConfig, headers)
}

/**
 * 生成图像 - 直接调用 Coze API
 * 支持用户配置的 Coze API Key
 */
export async function generateImage(
  prompt: string,
  options?: ImageGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ urls: string[]; b64List?: string[] }> {
  // 禁用代理，避免本地代理干扰
  const savedProxy = disableProxy()
  
  try {
    logger.info('Image generation started', { prompt: prompt.slice(0, 100), size: options?.size })

    // 获取用户配置，提前检查是否有 Bot ID
    const userConfig = await getUserCozeConfig()
    const apiKey = config?.apiKey || userConfig?.apiKey
    const botId = await getBotId()
    
    // 策略1: 先尝试沙箱内置凭证（仅在有沙箱环境时）
    const hasSandboxCredentials = !!process.env.COZE_WORKLOAD_IDENTITY_API_KEY
    if (hasSandboxCredentials) {
      try {
        const sdkConfig = new Config()
        const client = new ImageGenerationClient(sdkConfig, headers)

        const response = await client.generate({
          prompt,
          size: options?.size || DEFAULT_IMAGE_SIZE,
          watermark: options?.watermark ?? false,
          responseFormat: options?.responseFormat || 'url',
          image: options?.image,  // 参考图片，用于保持人物一致性
        })

        if (response.data && Array.isArray(response.data)) {
          const helper = client.getResponseHelper(response)
          if (helper.success) {
            logger.info('Image generation completed with sandbox credentials', { count: helper.imageUrls.length })
            return {
              urls: helper.imageUrls,
              b64List: helper.imageB64List.length > 0 ? helper.imageB64List : undefined,
            }
          }
        }
      } catch (sandboxErr) {
        const errMsg = sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr)
        logger.warn('Sandbox credentials failed, trying user config:', { error: errMsg })
      }
    }

    // 策略2: 如果配置了 Bot ID，优先使用 Bot Skills（只需要对话权限）
    if (apiKey && botId) {
      logger.info('Trying image generation via Bot Skills (has Bot ID)')
      try {
        // 传入参考图片数组（用于多人物图生图）
        const referenceImages = options?.image 
          ? (Array.isArray(options.image) ? options.image : [options.image])
          : undefined
        
        const botResult = await invokeBotForImageGeneration(
          prompt, 
          {
            apiKey,
            baseUrl: config?.baseUrl || userConfig?.baseUrl,
          },
          referenceImages
        )
        
        if (botResult.urls.length > 0) {
          logger.info('Image generation completed via Bot Skills', { count: botResult.urls.length })
          return { urls: botResult.urls }
        }
      } catch (botErr) {
        const errMsg = botErr instanceof Error ? botErr.message : String(botErr)
        logger.warn('Bot Skills failed for image generation:', { error: errMsg })
        // Bot Skills 失败，继续尝试 PAT 直接调用
      }
    }

    // 策略3: 尝试用户配置的 PAT 直接调用图像生成 API（需要专门权限）
    if (apiKey) {
      try {
        logger.info('Trying image generation with user credentials (direct API)')
        
        const userConfigObj = new Config({
          apiKey,
          baseUrl: config?.baseUrl || userConfig?.baseUrl || 'https://api.coze.cn',
          timeout: 180000,
        })
        const client = new ImageGenerationClient(userConfigObj, headers)

        const response = await client.generate({
          prompt,
          size: options?.size || DEFAULT_IMAGE_SIZE,
          watermark: options?.watermark ?? false,
          responseFormat: options?.responseFormat || 'url',
          image: options?.image,  // 参考图片，用于保持人物一致性
        })

        // 检查响应结构
        console.log('[User PAT] Response structure:', {
          hasData: !!response.data,
          dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
          hasError: !!response.error,
          error: response.error,
        })
        
        // 处理错误响应
        if (response.error) {
          const errorMsg = response.error.message || JSON.stringify(response.error)
          // 检查是否是权限错误
          if (errorMsg.includes('token') || errorMsg.includes('权限') || errorMsg.includes('permission')) {
            throw new Error('PAT 权限不足：请确保您的 Coze PAT 有「图像生成」权限')
          }
          throw new Error(`图像生成失败: ${errorMsg}`)
        }
        
        // 检查数据是否有效
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          try {
            const helper = client.getResponseHelper(response)
            if (helper.success && helper.imageUrls.length > 0) {
              logger.info('Image generation completed with user credentials', { count: helper.imageUrls.length })
              return {
                urls: helper.imageUrls,
                b64List: helper.imageB64List.length > 0 ? helper.imageB64List : undefined,
              }
            }
          } catch (helperErr) {
            // getResponseHelper 可能因为响应格式不正确而失败
            const errMsg = helperErr instanceof Error ? helperErr.message : String(helperErr)
            console.log('[User PAT] getResponseHelper failed:', errMsg)
            
            // 尝试直接从 response.data 提取 URL
            if (response.data && Array.isArray(response.data)) {
              const urls = response.data
                .filter((item: unknown): item is { url: string } => 
                  typeof item === 'object' && item !== null && 'url' in item
                )
                .map((item: { url: string }) => item.url)
              
              if (urls.length > 0) {
                logger.info('Image generation completed with user credentials (direct extract)', { count: urls.length })
                return { urls }
              }
            }
          }
        }
        
        // 响应格式不正确，可能是权限问题
        console.log('[User PAT] Invalid response format, full response:', JSON.stringify(response).slice(0, 500))
        throw new Error('PAT 可能没有图像生成权限，请检查您的 Coze PAT 配置')
      } catch (patErr) {
        const errMsg = patErr instanceof Error ? patErr.message : String(patErr)
        logger.warn('User PAT failed for image generation:', { error: errMsg })
      }
    }

    // 所有策略都失败
    throw new Error('图像生成失败：所有方式均不可用。请确保：(1) 在沙箱环境中运行，或 (2) 配置有效的 Coze API Key，或 (3) 创建配置了图像生成 Skill 的 Bot 并配置 Bot ID。')
  } catch (err) {
    logger.error('Image generation failed', err)
    
    if (err instanceof APIError) {
      throw new Error(`图像生成失败: ${err.message} (status: ${err.statusCode})`)
    }
    throw err
  } finally {
    // 恢复代理设置
    restoreProxy(savedProxy)
  }
}

/**
 * 图生图
 * 优先使用沙箱内置凭证，失败后回退到用户配置
 */
export async function generateImageFromImage(
  prompt: string,
  imageUrl: string | string[],
  options?: ImageGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ urls: string[] }> {
  // 策略1: 先尝试沙箱内置凭证
  try {
    const sdkConfig = new Config()
    const client = new ImageGenerationClient(sdkConfig, headers)

    logger.info('Image-to-image generation started with sandbox credentials')

    const response = await client.generate({
      prompt,
      image: imageUrl,
      size: options?.size || DEFAULT_IMAGE_SIZE,
      watermark: options?.watermark ?? false,
    })

    const helper = client.getResponseHelper(response)
    if (helper.success) {
      return { urls: helper.imageUrls }
    }
  } catch (sandboxErr) {
    const errMsg = sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr)
    logger.warn('Sandbox credentials failed for image-to-image:', { error: errMsg })
  }

  // 获取用户配置
  const userConfig = await getUserCozeConfig()
  const apiKey = config?.apiKey || userConfig?.apiKey
  
  // 策略2: 如果配置了 Bot ID，优先使用 Bot Skills
  const botId = await getBotId()
  if (apiKey && botId) {
    logger.info('Trying image-to-image via Bot Skills')
    try {
      const botResult = await invokeBotForImageGeneration(
        `[图生图] 参考图片：${Array.isArray(imageUrl) ? imageUrl.join(', ') : imageUrl}\n\n提示词：${prompt}`,
        { apiKey, baseUrl: config?.baseUrl || userConfig?.baseUrl }
      )
      if (botResult.urls.length > 0) {
        return { urls: botResult.urls }
      }
    } catch (botErr) {
      logger.warn('Bot Skills failed for image-to-image:', { error: botErr instanceof Error ? botErr.message : String(botErr) })
    }
  }

  // 策略3: 回退到用户 PAT 直接调用
  
  if (!apiKey) {
    throw new Error('图像生成失败：沙箱凭证不可用，且未配置用户 API Key。')
  }

  const userConfigObj = new Config({
    apiKey,
    baseUrl: config?.baseUrl || userConfig?.baseUrl || 'https://api.coze.cn',
    timeout: 180000,
  })
  const client = new ImageGenerationClient(userConfigObj, headers)

  logger.info('Image-to-image generation started with user credentials')

  const response = await client.generate({
    prompt,
    image: imageUrl,
    size: options?.size || DEFAULT_IMAGE_SIZE,
    watermark: options?.watermark ?? false,
  })

  const helper = client.getResponseHelper(response)

  if (!helper.success) {
    throw new Error(helper.errorMessages.join('; '))
  }

  return { urls: helper.imageUrls }
}

// ==================== 视频生成服务 ====================

/**
 * 创建视频生成客户端
 * 支持用户配置的 Coze API Key
 */
export async function createVideoClientAsync(
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<VideoGenerationClient> {
  // 获取用户配置
  const userConfig = await getUserCozeConfig()
  
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  const clientConfig = new Config({
    apiKey: config?.apiKey || userConfig.apiKey,
    baseUrl: config?.baseUrl || userConfig.baseUrl || defaultBaseUrl,
    timeout: config?.timeout || 600000, // 10分钟超时
  })

  return new VideoGenerationClient(clientConfig, headers)
}

/**
 * 创建视频生成客户端（同步版本）
 */
export function createVideoClient(
  config?: AIServiceConfig,
  headers?: Record<string, string>
): VideoGenerationClient {
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  const clientConfig = new Config({
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl || defaultBaseUrl,
    timeout: config?.timeout || 600000, // 10分钟超时
  })

  return new VideoGenerationClient(clientConfig, headers)
}

/**
 * 文生视频
 * 支持用户配置的 Coze API Key
 */
export async function generateVideo(
  prompt: string,
  options?: VideoGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  // 注意：不再禁用代理，因为用户可能需要代理访问 API
  
  try {
    logger.info('Video generation started', { prompt: prompt.slice(0, 100) })

    // 策略1: 尝试直接调用视频生成 API
    try {
      const client = await createVideoClientAsync(config, headers)

      const content = [{ type: 'text' as const, text: prompt }]

      const response = await client.videoGeneration(content, {
        model: options?.model || DEFAULT_VIDEO_MODEL,
        duration: options?.duration ?? 5,
        ratio: options?.ratio ?? '16:9',
        resolution: options?.resolution ?? '720p',
        generateAudio: options?.generateAudio ?? true,
        watermark: options?.watermark ?? false,
      })

      if (response.videoUrl) {
        logger.info('Video generation completed via direct API')
        return {
          videoUrl: response.videoUrl,
          lastFrameUrl: response.lastFrameUrl || undefined,
        }
      }
    } catch (directErr) {
      const errMsg = directErr instanceof Error ? directErr.message : String(directErr)
      logger.warn('Direct video generation API failed:', { error: errMsg })
      // 直接调用失败，尝试 Bot Skills
    }

    // 策略2: 通过 Bot 调用 Skills
    logger.info('Trying video generation via Bot Skills')
    try {
      const userConfig = await getUserCozeConfig()
      const botResult = await invokeBotForVideoGeneration(prompt, {
        apiKey: config?.apiKey || userConfig?.apiKey || undefined,
        baseUrl: config?.baseUrl || userConfig?.baseUrl,
      })
      
      if (botResult.videoUrl) {
        logger.info('Video generation completed via Bot Skills')
        return { videoUrl: botResult.videoUrl }
      }
    } catch (botErr) {
      const errMsg = botErr instanceof Error ? botErr.message : String(botErr)
      logger.warn('Bot Skills failed for video generation:', { error: errMsg })
    }

    // 所有策略都失败
    throw new Error('视频生成失败：所有方式均不可用。请确保：(1) 在沙箱环境中运行，或 (2) 配置有效的 Coze API Key，或 (3) 创建配置了视频生成 Skill 的 Bot 并配置 Bot ID。')
  } catch (err) {
    logger.error('Video generation failed', err)

    if (err instanceof APIError) {
      throw Errors.AIRequestFailed('Video', `${err.message} (status: ${err.statusCode})`)
    }
    throw err
  }
}

/**
 * 图生视频（首帧）
 * 支持用户配置的 Coze API Key
 */
export async function generateVideoFromImage(
  prompt: string,
  firstFrameUrl: string,
  options?: VideoGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  // 注意：不再禁用代理，因为用户可能需要代理访问 API
  // 如果遇到代理问题，可以在调用时传入特定配置
  
  try {
    logger.info('Image-to-video generation started')

    // 策略1: 尝试直接调用视频生成 API
    try {
      const client = await createVideoClientAsync(config, headers)

      const content = [
        {
          type: 'image_url' as const,
          image_url: { url: firstFrameUrl },
          role: 'first_frame' as const,
        },
        { type: 'text' as const, text: prompt },
      ]

      const response = await client.videoGeneration(content, {
        model: options?.model || DEFAULT_VIDEO_MODEL,
        duration: options?.duration ?? 5,
        ratio: options?.ratio ?? '16:9',
        resolution: options?.resolution ?? '720p',
        generateAudio: options?.generateAudio ?? true,
        returnLastFrame: true,
      })

      if (response.videoUrl) {
        logger.info('Image-to-video generation completed via direct API')
        return {
          videoUrl: response.videoUrl,
          lastFrameUrl: response.lastFrameUrl || undefined,
        }
      }
    } catch (directErr) {
      const errMsg = directErr instanceof Error ? directErr.message : String(directErr)
      logger.warn('Direct image-to-video API failed:', { error: errMsg })
      // 直接调用失败，尝试 Bot Skills
    }

    // 策略2: 通过 Bot 调用 Skills
    logger.info('Trying image-to-video via Bot Skills')
    try {
      const userConfig = await getUserCozeConfig()
      logger.info('Bot Skills config check', { 
        hasConfigApiKey: !!config?.apiKey,
        hasUserConfig: !!userConfig,
        hasUserApiKey: !!userConfig?.apiKey,
        userBaseUrl: userConfig?.baseUrl
      })
      
      const botResult = await invokeBotForVideoGeneration(
        prompt,
        {
          apiKey: config?.apiKey || userConfig?.apiKey || undefined,
          baseUrl: config?.baseUrl || userConfig?.baseUrl,
        },
        firstFrameUrl  // 传递图片 URL 作为第三个参数
      )
      
      if (botResult.videoUrl) {
        logger.info('Image-to-video generation completed via Bot Skills')
        return { 
          videoUrl: botResult.videoUrl,
          lastFrameUrl: botResult.lastFrameUrl 
        }
      }
    } catch (botErr) {
      const errMsg = botErr instanceof Error ? botErr.message : String(botErr)
      logger.warn('Bot Skills failed for image-to-video:', { error: errMsg })
    }

    // 所有策略都失败
    throw new Error('视频生成失败：所有方式均不可用。请确保：(1) 在沙箱环境中运行，或 (2) 配置有效的 Coze API Key，或 (3) 创建配置了视频生成 Skill 的 Bot 并配置 Bot ID。')
  } catch (err) {
    logger.error('Image-to-video generation failed', err)

    if (err instanceof APIError) {
      throw err
    }
    throw Errors.AIRequestFailed('Video', err instanceof Error ? err.message : undefined)
  }
}

/**
 * 图生视频（首帧 + 尾帧）
 * 支持用户配置的 Coze API Key
 */
export async function generateVideoFromFrames(
  prompt: string,
  firstFrameUrl: string,
  lastFrameUrl: string,
  options?: VideoGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  // 注意：不再禁用代理，因为用户可能需要代理访问 API
  
  try {
    logger.info('Frame-to-video generation started')

    // 策略1: 尝试直接调用视频生成 API
    try {
      const client = await createVideoClientAsync(config, headers)

      const content = [
        {
          type: 'image_url' as const,
          image_url: { url: firstFrameUrl },
          role: 'first_frame' as const,
        },
        {
          type: 'image_url' as const,
          image_url: { url: lastFrameUrl },
          role: 'last_frame' as const,
        },
        { type: 'text' as const, text: prompt },
      ]

      const response = await client.videoGeneration(content, {
        model: options?.model || DEFAULT_VIDEO_MODEL,
        duration: options?.duration ?? 5,
        ratio: options?.ratio ?? '16:9',
        resolution: options?.resolution ?? '720p',
        generateAudio: options?.generateAudio ?? true,
      })

      if (response.videoUrl) {
        logger.info('Frame-to-video generation completed via direct API')
        return { videoUrl: response.videoUrl }
      }
    } catch (directErr) {
      const errMsg = directErr instanceof Error ? directErr.message : String(directErr)
      logger.warn('Direct frame-to-video API failed:', { error: errMsg })
      // 直接调用失败，尝试 Bot Skills
    }

    // 策略2: 通过 Bot 调用 Skills
    logger.info('Trying frame-to-video via Bot Skills')
    try {
      const userConfig = await getUserCozeConfig()
      const botResult = await invokeBotForVideoGeneration(
        prompt,
        {
          apiKey: config?.apiKey || userConfig?.apiKey || undefined,
          baseUrl: config?.baseUrl || userConfig?.baseUrl,
        },
        firstFrameUrl,  // 传递首帧图片 URL
        lastFrameUrl    // 传递尾帧图片 URL
      )
      
      if (botResult.videoUrl) {
        logger.info('Frame-to-video generation completed via Bot Skills')
        return { videoUrl: botResult.videoUrl }
      }
    } catch (botErr) {
      const errMsg = botErr instanceof Error ? botErr.message : String(botErr)
      logger.warn('Bot Skills failed for frame-to-video:', { error: errMsg })
    }

    // 所有策略都失败
    throw new Error('视频生成失败：所有方式均不可用。请确保：(1) 在沙箱环境中运行，或 (2) 配置有效的 Coze API Key，或 (3) 创建配置了视频生成 Skill 的 Bot 并配置 Bot ID。')
  } catch (err) {
    logger.error('Frame-to-video generation failed', err)

    if (err instanceof APIError) {
      throw err
    }
    throw Errors.AIRequestFailed('Video', err instanceof Error ? err.message : undefined)
  }
}

// ==================== 工具函数 ====================

/**
 * 解析 LLM 返回的 JSON
 */
export function parseLLMJson<T>(content: string): T {
  // 尝试提取 JSON 代码块
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const jsonStr = jsonMatch ? jsonMatch[1] : content.trim()

  try {
    return JSON.parse(jsonStr) as T
  } catch {
    // 尝试修复常见的 JSON 格式问题
    const fixed = jsonStr
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/'/g, '"')

    try {
      return JSON.parse(fixed) as T
    } catch {
      throw Errors.AIResponseInvalid('LLM')
    }
  }
}

/**
 * 从请求头提取转发头
 */
export function extractHeaders(headers: Headers): Record<string, string> {
  return HeaderUtils.extractForwardHeaders(headers)
}

/**
 * 获取默认 AI 配置（兼容旧代码）
 */
export function getDefaultAIConfig(type: 'llm' | 'image' | 'video'): AIServiceConfig {
  // 系统自带模型不需要配置，返回空对象即可
  // 保留此函数以兼容旧代码
  return {}
}

/**
 * 获取 AI 配置（异步版本，供工作流节点使用）
 */
export async function getAIConfig(type: 'llm' | 'image' | 'video'): Promise<AIServiceConfig> {
  return getDefaultAIConfig(type)
}
