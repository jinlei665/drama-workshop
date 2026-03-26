/**
 * API 请求限流器
 * 用于控制 API 调用频率，避免触发限流
 */

import { logger } from './errors'

/** 限流器配置 */
interface RateLimiterConfig {
  /** 每分钟最大请求数 */
  maxRequestsPerMinute: number
  /** 最小请求间隔（毫秒） */
  minInterval: number
  /** 最大并发数 */
  maxConcurrent: number
  /** 限流时的等待时间（毫秒） */
  throttleWait: number
}

/** 默认配置 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequestsPerMinute: 50,  // Coze API 限制 100 QPS，保守设置 50/分钟
  minInterval: 1200,          // 最小间隔 1.2 秒
  maxConcurrent: 3,           // 最大并发 3 个
  throttleWait: 5000,         // 限流等待 5 秒
}

/** 请求记录 */
interface RequestRecord {
  timestamp: number
  success: boolean
  error?: string
}

/** 限流器状态 */
interface RateLimiterState {
  requests: RequestRecord[]
  activeCount: number
  lastRequestTime: number
  queue: Array<(value?: unknown) => void>
}

/** 全局限流器实例 */
const globalState: RateLimiterState = {
  requests: [],
  activeCount: 0,
  lastRequestTime: 0,
  queue: [],
}

/**
 * 清理过期的请求记录（超过1分钟的）
 */
function cleanupOldRequests(): void {
  const oneMinuteAgo = Date.now() - 60000
  globalState.requests = globalState.requests.filter(r => r.timestamp > oneMinuteAgo)
}

/**
 * 获取最近一分钟的请求数
 */
function getRecentRequestCount(): number {
  cleanupOldRequests()
  return globalState.requests.length
}

/**
 * 等待最小间隔
 */
async function waitForMinInterval(config: RateLimiterConfig): Promise<void> {
  const now = Date.now()
  const elapsed = now - globalState.lastRequestTime
  const waitTime = Math.max(0, config.minInterval - elapsed)
  
  if (waitTime > 0) {
    logger.debug(`[RateLimiter] 等待 ${waitTime}ms 以满足最小间隔`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
}

/**
 * 检查是否可以发送请求
 */
async function acquireSlot(config: RateLimiterConfig): Promise<void> {
  // 检查并发数
  while (globalState.activeCount >= config.maxConcurrent) {
    logger.debug(`[RateLimiter] 等待并发槽位，当前: ${globalState.activeCount}/${config.maxConcurrent}`)
    await new Promise(resolve => {
      globalState.queue.push(resolve)
    })
  }

  // 检查每分钟请求数
  while (getRecentRequestCount() >= config.maxRequestsPerMinute) {
    const oldestRequest = globalState.requests[0]
    const waitTime = 60000 - (Date.now() - oldestRequest.timestamp) + 100
    
    logger.warn(`[RateLimiter] 达到每分钟请求上限，等待 ${Math.ceil(waitTime / 1000)} 秒`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
    cleanupOldRequests()
  }

  // 等待最小间隔
  await waitForMinInterval(config)

  // 占用槽位
  globalState.activeCount++
  globalState.lastRequestTime = Date.now()
}

/**
 * 释放槽位
 */
function releaseSlot(): void {
  globalState.activeCount--
  
  // 唤醒队列中的下一个请求
  const next = globalState.queue.shift()
  if (next) {
    next()
  }
}

/**
 * 记录请求结果
 */
function recordRequest(success: boolean, error?: string): void {
  globalState.requests.push({
    timestamp: Date.now(),
    success,
    error,
  })
}

/**
 * 带限流的 API 请求
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  config: Partial<RateLimiterConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  await acquireSlot(finalConfig)
  
  try {
    const result = await fn()
    recordRequest(true)
    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    recordRequest(false, errorMsg)
    
    // 如果是限流错误，等待后重试
    if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('限流')) {
      logger.warn(`[RateLimiter] 检测到限流，等待 ${finalConfig.throttleWait}ms 后重试`)
      await new Promise(resolve => setTimeout(resolve, finalConfig.throttleWait))
      
      try {
        const result = await fn()
        recordRequest(true)
        return result
      } catch (retryError) {
        recordRequest(false, retryError instanceof Error ? retryError.message : String(retryError))
        throw retryError
      }
    }
    
    throw error
  } finally {
    releaseSlot()
  }
}

/**
 * 带重试和限流的 API 请求
 */
export async function withRateLimitAndRetry<T>(
  fn: () => Promise<T>,
  options: {
    config?: Partial<RateLimiterConfig>
    maxRetries?: number
    baseDelay?: number
    shouldRetry?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const {
    config = {},
    maxRetries = 3,
    baseDelay = 2000,
    shouldRetry = defaultShouldRetry
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withRateLimit(fn, config)
    } catch (error) {
      lastError = error

      if (attempt < maxRetries && shouldRetry(error)) {
        const waitTime = baseDelay * Math.pow(2, attempt) // 指数退避
        logger.warn(`[RateLimiter] 第 ${attempt + 1} 次重试，等待 ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        throw error
      }
    }
  }

  throw lastError
}

/**
 * 默认的重试判断逻辑
 */
function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    
    // 限流错误
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('限流')) {
      return true
    }
    
    // 网络错误
    if (msg.includes('timeout') || msg.includes('network') || 
        msg.includes('econnreset') || msg.includes('econnrefused')) {
      return true
    }
    
    // 服务器错误
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      return true
    }
    
    // Coze API 错误码
    if (msg.includes('code: 4101')) {
      // Token 错误不重试
      return false
    }
    
    if (msg.includes('code: 4') || msg.includes('code:5')) {
      // 其他 4xx 和 5xx 错误可以重试
      return true
    }
  }
  
  return false
}

/**
 * 获取限流器状态
 */
export function getRateLimiterStatus(): {
  recentRequests: number
  activeCount: number
  queueLength: number
  maxRequestsPerMinute: number
} {
  cleanupOldRequests()
  return {
    recentRequests: globalState.requests.length,
    activeCount: globalState.activeCount,
    queueLength: globalState.queue.length,
    maxRequestsPerMinute: DEFAULT_CONFIG.maxRequestsPerMinute,
  }
}

/**
 * 视频生成专用配置
 * 视频生成 API 限流更严格
 */
export const VIDEO_RATE_LIMIT_CONFIG: Partial<RateLimiterConfig> = {
  maxRequestsPerMinute: 10,   // 视频生成更保守
  minInterval: 6000,          // 6 秒间隔
  maxConcurrent: 1,           // 串行执行
  throttleWait: 10000,        // 限流等待 10 秒
}

/**
 * 图像生成专用配置
 */
export const IMAGE_RATE_LIMIT_CONFIG: Partial<RateLimiterConfig> = {
  maxRequestsPerMinute: 20,
  minInterval: 3000,          // 3 秒间隔
  maxConcurrent: 2,
  throttleWait: 5000,
}

/**
 * LLM 请求配置
 */
export const LLM_RATE_LIMIT_CONFIG: Partial<RateLimiterConfig> = {
  maxRequestsPerMinute: 60,
  minInterval: 1000,          // 1 秒间隔
  maxConcurrent: 5,
  throttleWait: 2000,
}
