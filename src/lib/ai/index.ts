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
import { withRateLimitAndRetry, VIDEO_RATE_LIMIT_CONFIG } from '@/lib/rate-limiter'
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
export const DEFAULT_IMAGE_MODEL = 'doubao-seedream-4-0-250828'

/** 系统默认图像尺寸 */
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
 * 优先级：内存（最新设置） → 数据库 → 环境变量
 */
async function getUserCozeConfig(): Promise<{ apiKey?: string; baseUrl?: string; botId?: string }> {
  try {
    // 优先从内存获取（最新的设置）
    const { getCozeConfigFromMemory } = await import('@/lib/memory-store')
    const memoryConfig = getCozeConfigFromMemory()
    if (memoryConfig?.apiKey) {
      console.log('[AI Config] Got config from memory store, botId:', memoryConfig.botId)
      return { apiKey: memoryConfig.apiKey, baseUrl: memoryConfig.baseUrl, botId: memoryConfig.botId }
    }
    
    // 再尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('user_settings')
          .select('coze_api_key, coze_base_url, coze_bot_id')
          .maybeSingle()
        
        if (error) {
          console.log('[AI Config] Database query error:', error.message)
        }
        
        if (!error && data?.coze_api_key) {
          console.log('[AI Config] Got config from database, botId:', data.coze_bot_id)
          return {
            apiKey: data.coze_api_key,
            baseUrl: data.coze_base_url || undefined,
            botId: data.coze_bot_id || undefined,
          }
        }
      } catch (dbError) {
        console.log('[AI Config] Database error:', dbError instanceof Error ? dbError.message : String(dbError))
      }
    }
  } catch (err) {
    console.log('[AI Config] Error getting config:', err instanceof Error ? err.message : String(err))
  }
  
  console.log('[AI Config] No config found, returning empty')
  return {}
}

/**
 * 获取完整的用户 LLM 配置
 * 包括 llm_provider, llm_api_key, llm_base_url, llm_model
 * 优先级：内存 → 数据库
 */
export async function getUserLLMConfig(): Promise<{
  provider: string
  apiKey?: string
  baseUrl?: string
  model?: string
}> {
  try {
    // 优先从内存获取
    const { getSettingsFromMemory } = await import('@/lib/memory-store')
    const memorySettings = getSettingsFromMemory()
    
    if (memorySettings?.llm_api_key || memorySettings?.llm_provider) {
      console.log('[AI Config] Got LLM config from memory:', {
        provider: memorySettings.llm_provider,
        hasApiKey: !!memorySettings.llm_api_key,
        model: memorySettings.llm_model,
      })
      return {
        provider: (memorySettings.llm_provider as string) || 'doubao',
        apiKey: memorySettings.llm_api_key as string | undefined,
        baseUrl: memorySettings.llm_base_url as string | undefined,
        model: memorySettings.llm_model as string | undefined,
      }
    }
    
    // 再尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('user_settings')
          .select('llm_provider, llm_api_key, llm_base_url, llm_model')
          .maybeSingle()
        
        if (!error && data) {
          console.log('[AI Config] Got LLM config from database:', {
            provider: data.llm_provider,
            hasApiKey: !!data.llm_api_key,
            model: data.llm_model,
          })
          return {
            provider: data.llm_provider || 'doubao',
            apiKey: data.llm_api_key || undefined,
            baseUrl: data.llm_base_url || undefined,
            model: data.llm_model || undefined,
          }
        }
      } catch (dbError) {
        console.log('[AI Config] Database error:', dbError instanceof Error ? dbError.message : String(dbError))
      }
    }
  } catch (err) {
    console.log('[AI Config] Error getting LLM config:', err instanceof Error ? err.message : String(err))
  }
  
  // 返回默认配置
  return {
    provider: 'doubao',
  }
}

/**
 * 获取用户配置的图像生成设置
 * 优先级：内存 → 数据库 → 环境变量
 */
export async function getUserImageConfig(): Promise<{
  provider: string
  apiKey?: string
  baseUrl?: string
  model?: string
  size?: string
}> {
  try {
    // 优先从内存获取
    const { getSettingsFromMemory } = await import('@/lib/memory-store')
    const memorySettings = getSettingsFromMemory()
    
    if (memorySettings?.image_api_key || memorySettings?.image_provider) {
      console.log('[AI Config] Got image config from memory:', {
        provider: memorySettings.image_provider,
        hasApiKey: !!memorySettings.image_api_key,
        model: memorySettings.image_model,
      })
      return {
        provider: (memorySettings.image_provider as string) || 'doubao',
        apiKey: memorySettings.image_api_key as string | undefined,
        baseUrl: memorySettings.image_base_url as string | undefined,
        model: memorySettings.image_model as string | undefined,
        size: memorySettings.image_size as string | undefined,
      }
    }
    
    // 再尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('user_settings')
          .select('image_provider, image_api_key, image_base_url, image_model, image_size')
          .maybeSingle()
        
        if (!error && data) {
          console.log('[AI Config] Got image config from database:', {
            provider: data.image_provider,
            hasApiKey: !!data.image_api_key,
            model: data.image_model,
          })
          return {
            provider: data.image_provider || 'doubao',
            apiKey: data.image_api_key || undefined,
            baseUrl: data.image_base_url || undefined,
            model: data.image_model || undefined,
            size: data.image_size || undefined,
          }
        }
      } catch (dbError) {
        console.log('[AI Config] Database error:', dbError instanceof Error ? dbError.message : String(dbError))
      }
    }
  } catch (err) {
    console.log('[AI Config] Error getting image config:', err instanceof Error ? err.message : String(err))
  }
  
  // 返回默认配置
  return {
    provider: 'doubao',
  }
}

/**
 * 获取用户视频配置
 * 优先级：内存 → 数据库 → 默认值
 */
export async function getUserVideoConfig(): Promise<{
  provider: string
  apiKey?: string
  baseUrl?: string
  model?: string
  resolution?: string
  ratio?: string
}> {
  try {
    // 优先从内存获取
    const { getSettingsFromMemory } = await import('@/lib/memory-store')
    const memorySettings = getSettingsFromMemory()
    
    if (memorySettings?.video_api_key || memorySettings?.video_provider) {
      console.log('[AI Config] Got video config from memory:', {
        provider: memorySettings.video_provider,
        hasApiKey: !!memorySettings.video_api_key,
        model: memorySettings.video_model,
      })
      return {
        provider: (memorySettings.video_provider as string) || 'doubao',
        apiKey: memorySettings.video_api_key as string | undefined,
        baseUrl: memorySettings.video_base_url as string | undefined,
        model: memorySettings.video_model as string | undefined,
        resolution: memorySettings.video_resolution as string | undefined,
        ratio: memorySettings.video_ratio as string | undefined,
      }
    }
    
    // 再尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('user_settings')
          .select('video_provider, video_api_key, video_base_url, video_model, video_resolution, video_ratio')
          .maybeSingle()
        
        if (!error && data) {
          console.log('[AI Config] Got video config from database:', {
            provider: data.video_provider,
            hasApiKey: !!data.video_api_key,
            model: data.video_model,
          })
          return {
            provider: data.video_provider || 'doubao',
            apiKey: data.video_api_key || undefined,
            baseUrl: data.video_base_url || undefined,
            model: data.video_model || undefined,
            resolution: data.video_resolution || undefined,
            ratio: data.video_ratio || undefined,
          }
        }
      } catch (dbError) {
        console.log('[AI Config] Database error:', dbError instanceof Error ? dbError.message : String(dbError))
      }
    }
  } catch (err) {
    console.log('[AI Config] Error getting video config:', err instanceof Error ? err.message : String(err))
  }
  
  // 返回默认配置
  return {
    provider: 'doubao',
  }
}

// 默认视频配置
const DEFAULT_VIDEO_RESOLUTION = '720p'
const DEFAULT_VIDEO_RATIO = '16:9'

/**
 * 火山引擎视频生成 API 内容类型
 */
interface VolcengineVideoContent {
  type: 'text' | 'image_url' | 'draft_task'
  text?: string
  image_url?: { url: string }
  role?: 'first_frame' | 'last_frame' | 'reference_image'
  draft_task?: { id: string }
}

/**
 * 火山引擎视频生成请求参数
 */
interface VolcengineVideoRequest {
  model: string
  content: VolcengineVideoContent[]
  ratio?: string
  resolution?: string
  duration?: number
  seed?: number
  camera_fixed?: boolean
  watermark?: boolean
  generate_audio?: boolean
  return_last_frame?: boolean
  callback_url?: string
}

/**
 * 火山引擎视频生成任务响应
 */
interface VolcengineVideoTaskResponse {
  id: string
}

/**
 * 火山引擎视频任务状态响应
 */
interface VolcengineVideoStatusResponse {
  id: string
  model: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'expired'
  error?: {
    code: string
    message: string
  }
  content?: {
    video_url?: string
    last_frame_url?: string
  }
  created_at: number
  updated_at: number
  duration?: number
  resolution?: string
  ratio?: string
}

/**
 * 创建火山引擎视频生成任务
 */
async function createVolcengineVideoTask(
  apiKey: string,
  baseUrl: string,
  request: VolcengineVideoRequest
): Promise<string> {
  const url = `${baseUrl}/contents/generations/tasks`
  
  console.log('[Volcengine Video] Creating task:', {
    url,
    model: request.model,
    contentCount: request.content.length,
  })
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`创建视频任务失败 (${response.status}): ${errorText}`)
  }
  
  const data: VolcengineVideoTaskResponse = await response.json()
  console.log('[Volcengine Video] Task created:', data.id)
  
  return data.id
}

/**
 * 查询火山引擎视频任务状态
 */
async function queryVolcengineVideoTask(
  apiKey: string,
  baseUrl: string,
  taskId: string
): Promise<VolcengineVideoStatusResponse> {
  const url = `${baseUrl}/contents/generations/tasks/${taskId}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`查询视频任务失败 (${response.status}): ${errorText}`)
  }
  
  return await response.json()
}

/**
 * 轮询等待视频生成完成
 */
async function waitForVolcengineVideo(
  apiKey: string,
  baseUrl: string,
  taskId: string,
  maxWaitTime: number = 600000, // 默认等待 10 分钟
  pollInterval: number = 5000   // 每 5 秒查询一次
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  const startTime = Date.now()
  
  console.log('[Volcengine Video] Waiting for task:', taskId)
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await queryVolcengineVideoTask(apiKey, baseUrl, taskId)
    
    console.log('[Volcengine Video] Task status:', {
      id: taskId,
      status: status.status,
      progress: `${Math.round((Date.now() - startTime) / 1000)}s`,
    })
    
    if (status.status === 'succeeded') {
      if (!status.content?.video_url) {
        throw new Error('视频生成成功但未返回视频 URL')
      }
      console.log('[Volcengine Video] Task succeeded:', {
        videoUrl: status.content.video_url.substring(0, 80),
        hasLastFrame: !!status.content.last_frame_url,
      })
      return {
        videoUrl: status.content.video_url,
        lastFrameUrl: status.content.last_frame_url,
      }
    }
    
    if (status.status === 'failed') {
      throw new Error(`视频生成失败: ${status.error?.message || '未知错误'}`)
    }
    
    if (status.status === 'expired') {
      throw new Error('视频生成任务超时')
    }
    
    // 等待后继续轮询
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  throw new Error('视频生成超时')
}

/**
 * 使用火山引擎 API 生成视频
 * 支持文生视频、图生视频（首帧）、首尾帧生视频
 */
export async function generateVideoWithVolcengine(params: {
  apiKey: string
  baseUrl: string
  model?: string
  prompt: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  resolution?: string
  ratio?: string
  duration?: number
  watermark?: boolean
  generateAudio?: boolean
  returnLastFrame?: boolean
}): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  const {
    apiKey,
    baseUrl,
    model = DEFAULT_VIDEO_MODEL,
    prompt,
    firstFrameUrl,
    lastFrameUrl,
    resolution = DEFAULT_VIDEO_RESOLUTION,
    ratio = DEFAULT_VIDEO_RATIO,
    duration = 5,
    watermark = false,
    generateAudio = true,
    returnLastFrame = true,
  } = params
  
  // 辅助函数：将图片 URL 转换为 base64 格式
  async function convertImageToBase64(url: string): Promise<string> {
    console.log('[Volcengine Video] Downloading image for base64 conversion...')
    
    // 检查是否是本地 URL，直接读取文件系统
    const isLocal = url.startsWith('http://localhost') || 
                    url.startsWith('https://localhost') ||
                    url.includes('://127.0.0.1')
    
    if (isLocal) {
      // 从 URL 中提取路径（去掉 http://localhost:5000 前缀）
      const urlObj = new URL(url)
      const localPath = urlObj.pathname
      const fs = await import('fs')
      const path = await import('path')
      
      // 构建完整文件路径
      const filePath = path.join(process.cwd(), 'public', localPath)
      console.log(`[Volcengine Video] Reading local file: ${filePath}`)
      
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath)
        const base64 = buffer.toString('base64')
        // 检测图片格式
        const ext = path.extname(filePath).toLowerCase().replace('.', '')
        const format = ext === 'jpg' ? 'jpeg' : ext || 'png'
        console.log(`[Volcengine Video] Local file read successfully, size: ${(buffer.length / 1024).toFixed(2)} KB`)
        return `data:image/${format};base64,${base64}`
      } else {
        console.warn(`[Volcengine Video] Local file not found: ${filePath}, trying HTTP fetch`)
      }
    }
    
    // 非本地 URL 或本地文件不存在，通过 HTTP 请求下载
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      redirect: 'follow',
    })
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    // 检测图片格式
    const contentType = response.headers.get('content-type') || 'image/png'
    const format = contentType.split('/')[1] || 'png'
    return `data:image/${format};base64,${base64}`
  }
  
  // 检查 URL 是否是火山引擎 TOS URL（可能无法被视频 API 访问）
  const isVolcengineTosUrl = (url: string) => 
    url.includes('ark-content-generation') || 
    url.includes('tos-cn-beijing.volces.com')
  
  // 检查 URL 是否是本地 URL（外部服务器无法访问）
  const isLocalUrl = (url: string) => 
    url.startsWith('http://localhost') || 
    url.startsWith('https://localhost') ||
    url.includes('://127.0.0.1') ||
    url.includes('://[::1]')
  
  // 判断是否需要转换为 base64（TOS URL 或本地 URL）
  const needsBase64Conversion = (url: string) => 
    isVolcengineTosUrl(url) || isLocalUrl(url)
  
  // 转换图片 URL 为可用格式
  let processedFirstFrameUrl = firstFrameUrl
  let processedLastFrameUrl = lastFrameUrl
  
  try {
    if (firstFrameUrl && needsBase64Conversion(firstFrameUrl)) {
      console.log('[Volcengine Video] Converting first frame to base64...', {
        isTos: isVolcengineTosUrl(firstFrameUrl),
        isLocal: isLocalUrl(firstFrameUrl),
      })
      processedFirstFrameUrl = await convertImageToBase64(firstFrameUrl)
    }
    if (lastFrameUrl && needsBase64Conversion(lastFrameUrl)) {
      console.log('[Volcengine Video] Converting last frame to base64...', {
        isTos: isVolcengineTosUrl(lastFrameUrl),
        isLocal: isLocalUrl(lastFrameUrl),
      })
      processedLastFrameUrl = await convertImageToBase64(lastFrameUrl)
    }
  } catch (conversionError) {
    console.warn('[Volcengine Video] Failed to convert images to base64, trying original URLs:', conversionError)
    // 如果转换失败，继续使用原始 URL
  }
  
  // 构建内容数组
  const content: VolcengineVideoContent[] = []
  
  // 添加图片内容
  if (processedFirstFrameUrl && processedLastFrameUrl) {
    // 首尾帧生视频
    content.push({
      type: 'image_url',
      image_url: { url: processedFirstFrameUrl },
      role: 'first_frame',
    })
    content.push({
      type: 'image_url',
      image_url: { url: processedLastFrameUrl },
      role: 'last_frame',
    })
  } else if (processedFirstFrameUrl) {
    // 仅首帧图生视频
    content.push({
      type: 'image_url',
      image_url: { url: processedFirstFrameUrl },
      role: 'first_frame',
    })
  }
  
  // 添加文本提示词
  content.push({
    type: 'text',
    text: prompt,
  })
  
  // 构建请求
  const request: VolcengineVideoRequest = {
    model,
    content,
    ratio,
    resolution,
    duration,
    watermark,
    generate_audio: generateAudio,
    return_last_frame: returnLastFrame,
  }
  
  console.log('[Volcengine Video] Starting generation:', {
    model,
    hasFirstFrame: !!firstFrameUrl,
    hasLastFrame: !!lastFrameUrl,
    resolution,
    ratio,
    duration,
  })
  
  // 创建任务
  const taskId = await createVolcengineVideoTask(apiKey, baseUrl, request)
  
  // 等待完成
  return await waitForVolcengineVideo(apiKey, baseUrl, taskId)
}

/**
 * 获取服务端 AI 配置（供 API 路由使用）
 */
export async function getServerAIConfig(): Promise<{
  apiKey?: string
  baseUrl?: string
  model: string
  useSystemDefault: boolean
  llmProvider?: string
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
}> {
  const userConfig = await getUserCozeConfig()
  const llmConfig = await getUserLLMConfig()
  
  // 国内用户默认使用 api.coze.cn
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  if (userConfig?.apiKey) {
    console.log('[AI Config] Using user config from memory store')
    return {
      apiKey: userConfig.apiKey,
      baseUrl: userConfig.baseUrl || defaultBaseUrl,
      model: DEFAULT_LLM_MODEL,
      useSystemDefault: false,
      llmProvider: llmConfig.provider,
      llmApiKey: llmConfig.apiKey,
      llmBaseUrl: llmConfig.baseUrl,
      llmModel: llmConfig.model,
    }
  }
  
  console.log('[AI Config] Using system default config, baseUrl:', defaultBaseUrl)
  return {
    baseUrl: defaultBaseUrl,
    model: DEFAULT_LLM_MODEL,
    useSystemDefault: true,
    llmProvider: llmConfig.provider,
    llmApiKey: llmConfig.apiKey,
    llmBaseUrl: llmConfig.baseUrl,
    llmModel: llmConfig.model,
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
 * 优先级：内存 → 数据库
 */
async function getBotId(): Promise<string | null> {
  try {
    // 策略1: 优先从内存获取（最新的设置）
    const { getSettingsFromMemory } = await import('@/lib/memory-store')
    const memorySettings = getSettingsFromMemory()
    if (memorySettings?.coze_bot_id) {
      console.log('[AI Config] Got bot_id from memory store:', memorySettings.coze_bot_id)
      return memorySettings.coze_bot_id as string
    }
    
    // 策略2: 从 getUserCozeConfig 获取（也会优先检查内存）
    const userConfig = await getUserCozeConfig()
    if (userConfig?.botId) {
      console.log('[AI Config] Got bot_id from user config:', userConfig.botId)
      return userConfig.botId
    }
    
    // 策略3: 最后尝试从数据库直接获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('user_settings')
          .select('coze_bot_id')
          .maybeSingle()
        
        if (!error && data?.coze_bot_id) {
          console.log('[AI Config] Got bot_id from database:', data.coze_bot_id)
          return data.coze_bot_id
        }
      } catch {
        // 数据库不可用
      }
    }
    
    console.log('[AI Config] No bot_id found in memory, user config, or database')
  } catch (err) {
    console.log('[AI Config] Error getting bot_id:', err instanceof Error ? err.message : String(err))
  }
  
  return null
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
  const botId = await getBotId()
  
  if (!apiKey) {
    throw new Error('通过 Bot 调用图像生成需要配置 Coze API Key')
  }
  
  if (!botId) {
    throw new Error('通过 Bot 调用图像生成需要配置 Bot ID。请在 Coze 平台创建配置了图像生成 Skill 的智能体，并在设置页面配置 Bot ID。')
  }
  
  logger.info('Invoking Bot for image generation', { 
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
  const botId = await getBotId()
  
  if (!apiKey) {
    throw new Error('通过 Bot 调用视频生成需要配置 Coze API Key')
  }
  
  if (!botId) {
    throw new Error('通过 Bot 调用视频生成需要配置 Bot ID。请在 Coze 平台创建配置了视频生成 Skill 的智能体，并在设置页面配置 Bot ID。')
  }
  
  logger.info('Invoking Bot for video generation', { 
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

  // 使用限流器包装 API 调用
  return withRateLimitAndRetry(
    async () => {
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
  
  // 设置超时（10分钟，视频生成需要较长时间）
  const timeout = setTimeout(() => {
    logger.warn('Bot video stream timeout after 10 minutes', { contentLength: content.length, chunkCount })
  }, 600000)
  
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
          
          // 打印所有事件类型和关键字段（前20个事件或完成事件）
          if (chunkCount <= 20 || eventType.includes('completed') || data.status === 'completed') {
            logger.info('Bot video event detail', { 
              eventType, 
              dataType: data.type, 
              dataStatus: data.status,
              hasContent: !!data.content,
              hasDataContent: !!(data.data?.content || data.data?.[0]?.content),
              dataKeys: Object.keys(data).slice(0, 10)
            })
          }
          
          // 处理 conversation.chat.completed 事件 - 对话完成
          if (eventType === 'conversation.chat.completed') {
            logger.info('Bot video chat completed', { 
              status: data.status,
              usage: data.usage,
              lastError: data.last_error
            })
            // 检查是否有错误
            if (data.last_error?.code && data.last_error.code !== 0) {
              logger.error('Bot video chat error', { code: data.last_error.code, msg: data.last_error.msg })
            }
          }
          
          // 处理各种可能的内容字段
          // 1. conversation.message.completed 事件
          if (eventType === 'conversation.message.completed') {
            const messageType = data.type
            
            // 处理 answer 类型 - 包含最终回复
            if (data.content && messageType === 'answer') {
              content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
              logger.info('Bot video got answer content', { 
                messageType, 
                contentLength: content.length,
                preview: content.slice(0, 200)
              })
            }
            // 处理 function_call 类型 - 包含插件调用参数，不包含视频结果
            // 注意：function_call 只是工具调用的参数，真正的结果在 tool_response 中
            else if (data.content && messageType === 'function_call') {
              const fcContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
              logger.info('Bot video got function_call content (tool invocation params)', { 
                messageType, 
                contentLength: fcContent.length,
                fullContent: fcContent.slice(0, 2000)  // 打印完整内容用于调试
              })
              // 不保存 function_call 内容，因为它只是工具调用的参数，不是结果
              // 真正的视频结果会在 tool_response 中返回
              // 如果 content 已经有值，不要覆盖
              logger.info('Bot video waiting for tool_response...')
            }
            // 处理 tool_response 类型 - 包含工具执行结果
            else if (data.content && messageType === 'tool_response') {
              const trContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
              logger.info('Bot video got tool_response content', { 
                messageType, 
                contentLength: trContent.length,
                fullContent: trContent.slice(0, 2000)  // 打印完整内容用于调试
              })
              // tool_response 通常包含最终结果
              content = trContent
            }
            else if (data.content) {
              const otherContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
              // verbose 类型可能包含工具执行状态
              if (messageType === 'verbose') {
                logger.info('Bot video got verbose message', { 
                  contentLength: otherContent.length,
                  contentPreview: otherContent.slice(0, 1000)
                })
                // 检查是否包含视频相关信息
                if (otherContent.includes('video') || otherContent.includes('mp4') || otherContent.includes('url')) {
                  logger.info('Bot video verbose contains video-related info')
                  // 不覆盖已有内容，但记录下来
                  if (!content) content = otherContent
                }
              } else {
                logger.info('Bot video ignoring other message type', { 
                  messageType, 
                  contentLength: otherContent.length,
                  contentPreview: otherContent.slice(0, 500)
                })
              }
            }
          }
          
          // 2. answer 事件（带内容）- 但不覆盖已有内容
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
    },
    {
      config: VIDEO_RATE_LIMIT_CONFIG,
      maxRetries: 3,
      baseDelay: 5000,
    }
  )
}

/**
 * 检查 URL 是否是有效的视频 URL（排除图标等无关 URL）
 */
function isValidVideoUrl(url: string): boolean {
  // 排除 plugin_icon 和 BIZ_BOT_ICON（Bot 图标）
  if (url.includes('plugin_icon') || url.includes('BIZ_BOT_ICON')) {
    logger.warn('Skipping invalid video URL (plugin icon)', { url: url.slice(0, 100) })
    return false
  }
  // 排除头像相关的 URL
  if (url.includes('avatar') || url.includes('/icon/')) {
    logger.warn('Skipping invalid video URL (avatar/icon)', { url: url.slice(0, 100) })
    return false
  }
  return true
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
  if (markdownMatch && isValidVideoUrl(markdownMatch[1])) {
    videoUrl = markdownMatch[1]
    logger.info('Found video URL in Markdown format', { videoUrl })
  }
  
  // 2. 匹配视频 URL（mp4, webm 等格式）
  if (!videoUrl) {
    const videoRegex = /(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)(?:\?[^\s"'<>]*)?)/i
    const match = videoRegex.exec(content)
    if (match && isValidVideoUrl(match[1])) {
      videoUrl = match[1]
      logger.info('Found direct video URL', { videoUrl })
    }
  }
  
  // 3. 匹配 Coze 文件链接格式 (可能是下载页面)
  if (!videoUrl) {
    // 匹配 coze.cn/file/ 或 coze.com/file/ 格式
    const cozeFileRegex = /(https?:\/\/[^\s"'<>]*\.?coze\.(?:cn|com)\/file\/[^\s"'<>]+)/i
    const cozeFileMatch = cozeFileRegex.exec(content)
    if (cozeFileMatch && isValidVideoUrl(cozeFileMatch[1])) {
      videoUrl = cozeFileMatch[1]
      logger.info('Found Coze file URL', { videoUrl })
    }
  }
  
  // 4. 匹配火山引擎 TOS URL
  if (!videoUrl) {
    const tosRegex = /(https?:\/\/[^\s"'<>]*\.?tos-cn-[^\s"'<>]+\.volces\.com[^\s"'<>]*)/i
    const tosMatch = tosRegex.exec(content)
    if (tosMatch && isValidVideoUrl(tosMatch[1])) {
      videoUrl = tosMatch[1]
      logger.info('Found Volcengine TOS URL', { videoUrl })
    }
  }
  
  // 5. 匹配 Coze 存储链接
  if (!videoUrl) {
    const cozeStorageRegex = /(https?:\/\/[^\s"'<>]*tos\.coze\.site[^\s"'<>]*)/i
    const cozeStorageMatch = cozeStorageRegex.exec(content)
    if (cozeStorageMatch && isValidVideoUrl(cozeStorageMatch[1])) {
      videoUrl = cozeStorageMatch[1]
      logger.info('Found Coze storage URL', { videoUrl })
    }
  }
  
  // 6. 匹配任何看起来像视频链接的 URL
  if (!videoUrl) {
    const anyUrlRegex = /(https?:\/\/[^\s"'<>]*(?:video|file|download|output)[^\s"'<>]*)/i
    const anyMatch = anyUrlRegex.exec(content)
    if (anyMatch && isValidVideoUrl(anyMatch[1])) {
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
 * 使用 OpenAI 兼容格式生成图像
 * 支持火山引擎、阿里云等 OpenAI 兼容的图像生成 API
 */
async function generateImageWithOpenAICompatible(params: {
  prompt: string
  apiKey: string
  baseUrl: string
  model: string
  size?: string
  watermark?: boolean
  image?: string | string[]
}): Promise<{ urls: string[]; b64List?: string[] }> {
  const { prompt, apiKey, baseUrl, model, size = '2K', watermark = false, image } = params
  
  // 构建请求体
  // 火山引擎支持 size 参数为分辨率（1K/2K/4K）或像素尺寸（2048x2048）
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    size,  // 直接传递分辨率字符串，如 "2K"
    response_format: 'url',
  }
  
  // 火山引擎等 Provider 支持额外参数
  // 参考：https://www.volcengine.com/docs/82379/1541523
  // 火山引擎 URL 格式: https://ark.cn-beijing.volces.com/api/v3
  if (baseUrl.includes('volces.com') || baseUrl.includes('volcengine') || baseUrl.includes('doubao')) {
    requestBody.watermark = watermark
  }
  
  // 图生图：传入参考图片
  if (image) {
    const imageUrls = Array.isArray(image) ? image : [image]
    if (imageUrls.length === 1) {
      requestBody.image = imageUrls[0]
    } else {
      // 多张参考图片（多人物融合）
      requestBody.image = imageUrls
    }
  }
  
  logger.info('Calling OpenAI-compatible image API', { 
    baseUrl, 
    model, 
    size,
    hasImage: !!image 
  })
  
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    logger.error('OpenAI-compatible image API error', { 
      status: response.status, 
      error: errorText.slice(0, 500) 
    })
    throw new Error(`图像生成 API 错误 (${response.status}): ${errorText.slice(0, 200)}`)
  }
  
  const data = await response.json()
  
  // 提取图片 URL
  const urls: string[] = []
  const b64List: string[] = []
  
  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item.url) {
        urls.push(item.url)
      } else if (item.b64_json) {
        b64List.push(item.b64_json)
        // 如果返回的是 base64，可以转换为临时 URL
        // 但这里直接返回 b64，让调用方处理
      }
    }
  }
  
  if (urls.length === 0 && b64List.length === 0) {
    logger.warn('OpenAI-compatible API returned no images', { response: JSON.stringify(data).slice(0, 500) })
    throw new Error('图像生成 API 未返回有效图片')
  }
  
  logger.info('OpenAI-compatible image generation completed', { urlCount: urls.length, b64Count: b64List.length })
  
  return {
    urls,
    b64List: b64List.length > 0 ? b64List : undefined,
  }
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
    
    // 策略1: 检查用户是否配置了自定义图像 Provider
    const imageConfig = await getUserImageConfig()
    
    // 判断是否使用自定义 Provider：
    // 1. 配置了 API Key 和 Base URL
    // 2. Base URL 不是 Coze API（api.coze.cn 或 api.coze.com）
    const isCustomProvider = imageConfig.apiKey && imageConfig.baseUrl && 
      !imageConfig.baseUrl.includes('api.coze.cn') && 
      !imageConfig.baseUrl.includes('api.coze.com')
    
    if (isCustomProvider) {
      logger.info('Trying image generation with custom provider', { 
        provider: imageConfig.provider,
        baseUrl: imageConfig.baseUrl,
        model: imageConfig.model 
      })
      
      try {
        // 使用 OpenAI 兼容格式调用图像生成 API
        const result = await generateImageWithOpenAICompatible({
          prompt,
          apiKey: imageConfig.apiKey!,
          baseUrl: imageConfig.baseUrl!,
          model: imageConfig.model || DEFAULT_IMAGE_MODEL,
          size: options?.size || imageConfig.size || DEFAULT_IMAGE_SIZE,
          watermark: options?.watermark ?? false,
          image: options?.image,
        })
        
        if (result.urls.length > 0) {
          logger.info('Image generation completed with custom provider', { 
            provider: imageConfig.provider,
            count: result.urls.length 
          })
          return result
        }
      } catch (customErr) {
        const errMsg = customErr instanceof Error ? customErr.message : String(customErr)
        logger.warn('Custom provider failed for image generation:', { error: errMsg })
        // 自定义 Provider 失败，继续尝试其他方式
      }
    }
    
    // 策略2: 先尝试沙箱内置凭证（仅在有沙箱环境时）
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

    // 策略3: 如果配置了 Bot ID，使用 Bot Skills（只需要对话权限）
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

    // 策略4: 尝试用户配置的 PAT 直接调用图像生成 API（需要专门权限）
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
 * 策略顺序：沙箱凭证 → 用户 PAT → Bot Skills
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

    // 策略1: 优先尝试沙箱内置凭证（仅在有沙箱环境时）
    const hasSandboxCredentials = !!process.env.COZE_WORKLOAD_IDENTITY_API_KEY
    if (hasSandboxCredentials) {
      try {
        const sdkConfig = new Config()
        const client = new VideoGenerationClient(sdkConfig, headers)

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
          logger.info('Video generation completed with sandbox credentials')
          return {
            videoUrl: response.videoUrl,
            lastFrameUrl: response.lastFrameUrl || undefined,
          }
        }
      } catch (sandboxErr) {
        const errMsg = sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr)
        logger.warn('Sandbox credentials failed for video generation:', { error: errMsg })
      }
    }

    // 策略2: 尝试用户 PAT 直接调用 API
    try {
      const userConfig = await getUserCozeConfig()
      const apiKey = config?.apiKey || userConfig?.apiKey
      
      if (apiKey) {
        const clientConfig = new Config({
          apiKey,
          baseUrl: config?.baseUrl || userConfig?.baseUrl || 'https://api.coze.cn',
          timeout: 600000,
        })
        const client = new VideoGenerationClient(clientConfig, headers)

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
          logger.info('Video generation completed via user PAT')
          return {
            videoUrl: response.videoUrl,
            lastFrameUrl: response.lastFrameUrl || undefined,
          }
        }
      }
    } catch (directErr) {
      const errMsg = directErr instanceof Error ? directErr.message : String(directErr)
      logger.warn('Direct video generation API failed:', { error: errMsg })
    }

    // 策略3: 通过 Bot 调用 Skills（仅在配置了 Bot ID 时）
    const botId = await getBotId()
    if (botId) {
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
 * 支持用户配置的火山引擎 API
 * 策略顺序：自定义 Provider（火山引擎等）→ 沙箱凭证 → 用户 PAT → Bot Skills
 */
export async function generateVideoFromImage(
  prompt: string,
  firstFrameUrl: string,
  options?: VideoGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  try {
    logger.info('Image-to-video generation started')

    // 策略0: 检查用户配置的自定义 Provider（火山引擎等）
    const videoConfig = await getUserVideoConfig()
    
    // 判断是否使用自定义 Provider：
    // 1. 配置了 API Key 和 Base URL
    // 2. Base URL 不是 Coze API（api.coze.cn 或 api.coze.com）
    const isCustomProvider = videoConfig.apiKey && videoConfig.baseUrl && 
      !videoConfig.baseUrl.includes('api.coze.cn') && 
      !videoConfig.baseUrl.includes('api.coze.com')
    
    if (isCustomProvider) {
      logger.info('Trying video generation with custom provider', { 
        provider: videoConfig.provider,
        baseUrl: videoConfig.baseUrl,
        model: videoConfig.model 
      })
      
      try {
        const result = await generateVideoWithVolcengine({
          apiKey: videoConfig.apiKey!,
          baseUrl: videoConfig.baseUrl!,
          model: videoConfig.model || options?.model || DEFAULT_VIDEO_MODEL,
          prompt,
          firstFrameUrl,
          resolution: options?.resolution || videoConfig.resolution || DEFAULT_VIDEO_RESOLUTION,
          ratio: options?.ratio || videoConfig.ratio || DEFAULT_VIDEO_RATIO,
          duration: options?.duration ?? 5,
          watermark: options?.watermark ?? false,
          generateAudio: options?.generateAudio ?? true,
          returnLastFrame: true,
        })
        
        logger.info('Video generation completed with custom provider', { 
          provider: videoConfig.provider,
        })
        return result
      } catch (customErr) {
        const errMsg = customErr instanceof Error ? customErr.message : String(customErr)
        logger.warn('Custom provider failed for video generation:', { error: errMsg })
        // 自定义 Provider 失败，继续尝试其他方式
      }
    }

    // 策略1: 优先尝试沙箱内置凭证（仅在有沙箱环境时）
    const hasSandboxCredentials = !!process.env.COZE_WORKLOAD_IDENTITY_API_KEY
    if (hasSandboxCredentials) {
      try {
        const sdkConfig = new Config()
        const client = new VideoGenerationClient(sdkConfig, headers)

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
          logger.info('Image-to-video generation completed with sandbox credentials')
          return {
            videoUrl: response.videoUrl,
            lastFrameUrl: response.lastFrameUrl || undefined,
          }
        }
      } catch (sandboxErr) {
        const errMsg = sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr)
        logger.warn('Sandbox credentials failed for image-to-video:', { error: errMsg })
      }
    }

    // 策略2: 尝试用户 PAT 直接调用 API
    try {
      const userConfig = await getUserCozeConfig()
      const apiKey = config?.apiKey || userConfig?.apiKey
      
      if (apiKey) {
        const clientConfig = new Config({
          apiKey,
          baseUrl: config?.baseUrl || userConfig?.baseUrl || 'https://api.coze.cn',
          timeout: 600000,
        })
        const client = new VideoGenerationClient(clientConfig, headers)

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
          logger.info('Image-to-video generation completed via user PAT')
          return {
            videoUrl: response.videoUrl,
            lastFrameUrl: response.lastFrameUrl || undefined,
          }
        }
      }
    } catch (directErr) {
      const errMsg = directErr instanceof Error ? directErr.message : String(directErr)
      logger.warn('Direct image-to-video API failed:', { error: errMsg })
    }

    // 策略3: 通过 Bot 调用 Skills（仅在配置了 Bot ID 时）
    const botId = await getBotId()
    if (botId) {
      logger.info('Trying image-to-video via Bot Skills')
      try {
        const userConfig = await getUserCozeConfig()
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
 * 支持用户配置的火山引擎 API
 * 策略顺序：自定义 Provider（火山引擎等）→ 沙箱凭证 → 用户 PAT → Bot Skills
 */
export async function generateVideoFromFrames(
  prompt: string,
  firstFrameUrl: string,
  lastFrameUrl: string,
  options?: VideoGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  try {
    logger.info('Frame-to-video generation started')

    // 策略0: 检查用户配置的自定义 Provider（火山引擎等）
    const videoConfig = await getUserVideoConfig()
    
    // 判断是否使用自定义 Provider：
    // 1. 配置了 API Key 和 Base URL
    // 2. Base URL 不是 Coze API（api.coze.cn 或 api.coze.com）
    const isCustomProvider = videoConfig.apiKey && videoConfig.baseUrl && 
      !videoConfig.baseUrl.includes('api.coze.cn') && 
      !videoConfig.baseUrl.includes('api.coze.com')
    
    if (isCustomProvider) {
      logger.info('Trying frame-to-video with custom provider', { 
        provider: videoConfig.provider,
        baseUrl: videoConfig.baseUrl,
        model: videoConfig.model 
      })
      
      try {
        const result = await generateVideoWithVolcengine({
          apiKey: videoConfig.apiKey!,
          baseUrl: videoConfig.baseUrl!,
          model: videoConfig.model || options?.model || DEFAULT_VIDEO_MODEL,
          prompt,
          firstFrameUrl,
          lastFrameUrl,
          resolution: options?.resolution || videoConfig.resolution || DEFAULT_VIDEO_RESOLUTION,
          ratio: options?.ratio || videoConfig.ratio || DEFAULT_VIDEO_RATIO,
          duration: options?.duration ?? 5,
          watermark: options?.watermark ?? false,
          generateAudio: options?.generateAudio ?? true,
          returnLastFrame: true,
        })
        
        logger.info('Frame-to-video generation completed with custom provider', { 
          provider: videoConfig.provider,
        })
        return result
      } catch (customErr) {
        const errMsg = customErr instanceof Error ? customErr.message : String(customErr)
        logger.warn('Custom provider failed for frame-to-video:', { error: errMsg })
        // 自定义 Provider 失败，继续尝试其他方式
      }
    }

    // 策略1: 优先尝试沙箱内置凭证（仅在有沙箱环境时）
    const hasSandboxCredentials = !!process.env.COZE_WORKLOAD_IDENTITY_API_KEY
    if (hasSandboxCredentials) {
      try {
        const sdkConfig = new Config()
        const client = new VideoGenerationClient(sdkConfig, headers)

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
          logger.info('Frame-to-video generation completed with sandbox credentials')
          return { videoUrl: response.videoUrl }
        }
      } catch (sandboxErr) {
        const errMsg = sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr)
        logger.warn('Sandbox credentials failed for frame-to-video:', { error: errMsg })
      }
    }

    // 策略2: 尝试用户 PAT 直接调用 API
    try {
      const userConfig = await getUserCozeConfig()
      const apiKey = config?.apiKey || userConfig?.apiKey
      
      if (apiKey) {
        const clientConfig = new Config({
          apiKey,
          baseUrl: config?.baseUrl || userConfig?.baseUrl || 'https://api.coze.cn',
          timeout: 600000,
        })
        const client = new VideoGenerationClient(clientConfig, headers)

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
          logger.info('Frame-to-video generation completed via user PAT')
          return { videoUrl: response.videoUrl }
        }
      }
    } catch (directErr) {
      const errMsg = directErr instanceof Error ? directErr.message : String(directErr)
      logger.warn('Direct frame-to-video API failed:', { error: errMsg })
    }

    // 策略3: 通过 Bot 调用 Skills（仅在配置了 Bot ID 时）
    const botId = await getBotId()
    if (botId) {
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
