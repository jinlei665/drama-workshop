/**
 * AI 服务统一接口
 * 使用系统自带的模型服务 (coze-coding-dev-sdk)
 * 
 * LLM 默认模型: doubao-seed-1-8-251228
 * 图像生成: ImageGenerationClient
 * 视频生成: VideoGenerationClient
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
 * 优先级：传入参数 > 用户设置 > 环境变量
 */
async function getUserCozeConfig(): Promise<{ apiKey?: string; baseUrl?: string }> {
  try {
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      const db = getSupabaseClient()
      const { data } = await db
        .from('user_settings')
        .select('coze_api_key, coze_base_url')
        .maybeSingle()
      
      if (data?.coze_api_key) {
        return {
          apiKey: data.coze_api_key,
          baseUrl: data.coze_base_url || undefined,
        }
      }
    }
  } catch {
    // 忽略错误，使用默认配置
  }
  
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
  
  if (userConfig.apiKey) {
    return {
      apiKey: userConfig.apiKey,
      baseUrl: userConfig.baseUrl,
      model: DEFAULT_LLM_MODEL,
      useSystemDefault: false,
    }
  }
  
  return {
    model: DEFAULT_LLM_MODEL,
    useSystemDefault: true,
  }
}

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
  
  const clientConfig = new Config({
    apiKey: config?.apiKey || userConfig.apiKey, // 优先使用传入参数，其次用户配置
    baseUrl: config?.baseUrl || userConfig.baseUrl,
    timeout: config?.timeout || 120000, // 2分钟超时
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
  const clientConfig = new Config({
    apiKey: config?.apiKey, // 可选，系统会自动处理
    baseUrl: config?.baseUrl,
    timeout: config?.timeout || 120000, // 2分钟超时
  })

  return new LLMClient(clientConfig, headers)
}

/**
 * 调用 LLM（非流式）
 * 支持用户配置回退到系统模型
 */
export async function invokeLLM(
  messages: LLMMessage[],
  options?: LLMOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<string> {
  const model = options?.model || config?.model || DEFAULT_LLM_MODEL
  const hasUserConfig = !!(config?.apiKey)

  logger.info('LLM invoke started', { 
    model, 
    hasUserConfig,
    useSystemDefault: !config?.apiKey 
  })

  // 如果有用户配置，先尝试用户配置
  if (hasUserConfig) {
    try {
      const client = createLLMClient(config, headers)
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

      logger.info('LLM invoke completed with user config', { responseLength: response.content.length })
      return response.content
    } catch (userError) {
      logger.warn('LLM invoke failed with user config, falling back to system model', { 
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

        logger.info('LLM invoke completed with system fallback', { responseLength: response.content.length })
        
        // 返回结果，同时标记使用了回退
        return response.content
      } catch (systemError) {
        logger.error('LLM invoke failed with both user and system config', { userError, systemError })
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
      { maxRetries: 3, delay: 5000 }
    )

    logger.info('LLM invoke completed', { responseLength: response.content.length })
    return response.content
  } catch (err) {
    logger.error('LLM invoke failed', err)

    if (err instanceof APIError) {
      throw Errors.AIRequestFailed('LLM', `${err.message} (status: ${err.statusCode})`)
    }
    if (err instanceof Error && err.message.includes('timeout')) {
      throw Errors.AITimeout('LLM')
    }
    throw Errors.AIRequestFailed('LLM', err instanceof Error ? err.message : undefined)
  }
}

/**
 * 流式调用 LLM
 */
export async function* streamLLM(
  messages: LLMMessage[],
  options?: LLMOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): AsyncGenerator<string> {
  const client = createLLMClient(config, headers)
  const model = options?.model || config?.model || DEFAULT_LLM_MODEL

  logger.info('LLM stream started', { model })

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

    logger.info('LLM stream completed')
  } catch (err) {
    logger.error('LLM stream failed', err)
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
  
  const clientConfig = new Config({
    apiKey: config?.apiKey || userConfig.apiKey,
    baseUrl: config?.baseUrl || userConfig.baseUrl,
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
  const clientConfig = new Config({
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl,
    timeout: config?.timeout || 180000, // 3分钟超时
  })

  return new ImageGenerationClient(clientConfig, headers)
}

/**
 * 生成图像
 * 支持用户配置的 Coze API Key
 */
export async function generateImage(
  prompt: string,
  options?: ImageGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ urls: string[]; b64List?: string[] }> {
  const client = await createImageClientAsync(config, headers)

  logger.info('Image generation started', { prompt: prompt.slice(0, 100), size: options?.size })

  try {
    const response = await client.generate({
      prompt,
      size: options?.size || DEFAULT_IMAGE_SIZE,
      watermark: options?.watermark ?? false,
      responseFormat: options?.responseFormat || 'url',
    })

    const helper = client.getResponseHelper(response)

    if (!helper.success) {
      throw new Error(helper.errorMessages.join('; '))
    }

    logger.info('Image generation completed', { count: helper.imageUrls.length })

    return {
      urls: helper.imageUrls,
      b64List: helper.imageB64List.length > 0 ? helper.imageB64List : undefined,
    }
  } catch (err) {
    logger.error('Image generation failed', err)

    if (err instanceof APIError) {
      throw Errors.AIRequestFailed('Image', `${err.message} (status: ${err.statusCode})`)
    }
    throw Errors.AIRequestFailed('Image', err instanceof Error ? err.message : undefined)
  }
}

/**
 * 图生图
 * 支持用户配置的 Coze API Key
 */
export async function generateImageFromImage(
  prompt: string,
  imageUrl: string | string[],
  options?: ImageGenerationOptions,
  config?: AIServiceConfig,
  headers?: Record<string, string>
): Promise<{ urls: string[] }> {
  const client = await createImageClientAsync(config, headers)

  logger.info('Image-to-image generation started')

  try {
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
  } catch (err) {
    logger.error('Image-to-image generation failed', err)
    throw Errors.AIRequestFailed('Image', err instanceof Error ? err.message : undefined)
  }
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
  
  const clientConfig = new Config({
    apiKey: config?.apiKey || userConfig.apiKey,
    baseUrl: config?.baseUrl || userConfig.baseUrl,
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
  const clientConfig = new Config({
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl,
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
  const client = await createVideoClientAsync(config, headers)

  logger.info('Video generation started', { prompt: prompt.slice(0, 100) })

  try {
    const content = [{ type: 'text' as const, text: prompt }]

    const response = await client.videoGeneration(content, {
      model: options?.model || DEFAULT_VIDEO_MODEL,
      duration: options?.duration ?? 5,
      ratio: options?.ratio ?? '16:9',
      resolution: options?.resolution ?? '720p',
      generateAudio: options?.generateAudio ?? true,
      watermark: options?.watermark ?? false,
    })

    if (!response.videoUrl) {
      throw new Error('Video generation failed: no video URL returned')
    }

    logger.info('Video generation completed')

    return {
      videoUrl: response.videoUrl,
      lastFrameUrl: response.lastFrameUrl || undefined,
    }
  } catch (err) {
    logger.error('Video generation failed', err)

    if (err instanceof APIError) {
      throw Errors.AIRequestFailed('Video', `${err.message} (status: ${err.statusCode})`)
    }
    throw Errors.AIRequestFailed('Video', err instanceof Error ? err.message : undefined)
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
  const client = await createVideoClientAsync(config, headers)

  logger.info('Image-to-video generation started')

  try {
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

    if (!response.videoUrl) {
      throw new Error('Video generation failed: no video URL returned')
    }

    return {
      videoUrl: response.videoUrl,
      lastFrameUrl: response.lastFrameUrl || undefined,
    }
  } catch (err) {
    logger.error('Image-to-video generation failed', err)
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
): Promise<{ videoUrl: string }> {
  const client = await createVideoClientAsync(config, headers)

  logger.info('Frame-to-video generation started')

  try {
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

    if (!response.videoUrl) {
      throw new Error('Video generation failed: no video URL returned')
    }

    return { videoUrl: response.videoUrl }
  } catch (err) {
    logger.error('Frame-to-video generation failed', err)
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
