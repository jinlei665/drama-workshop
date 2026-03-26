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
  maxRequestsPerMinute: 50,
  minInterval: 1200,
  maxConcurrent: 3,
  throttleWait: 5000,
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

function cleanupOldRequests(): void {
  const oneMinuteAgo = Date.now() - 60000
  globalState.requests = globalState.requests.filter(r => r.timestamp > oneMinuteAgo)
}

function getRecentRequestCount(): number {
  cleanupOldRequests()
  return globalState.requests.length
}

async function waitForMinInterval(config: RateLimiterConfig): Promise<void> {
  const now = Date.now()
  const elapsed = now - globalState.lastRequestTime
  const waitTime = Math.max(0, config.minInterval - elapsed)
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
}

async function acquireSlot(config: RateLimiterConfig): Promise<void> {
  while (globalState.activeCount >= config.maxConcurrent) {
    await new Promise(resolve => {
      globalState.queue.push(resolve)
    })
  }
  while (getRecentRequestCount() >= config.maxRequestsPerMinute) {
    const oldestRequest = globalState.requests[0]
    const waitTime = 60000 - (Date.now() - oldestRequest.timestamp) + 100
    logger.warn(`[RateLimiter] 达到每分钟请求上限，等待 ${Math.ceil(waitTime / 1000)} 秒`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
    cleanupOldRequests()
  }
  await waitForMinInterval(config)
  globalState.activeCount++
  globalState.lastRequestTime = Date.now()
}

function releaseSlot(): void {
  globalState.activeCount--
  const next = globalState.queue.shift()
  if (next) next()
}

function recordRequest(success: boolean, error?: string): void {
  globalState.requests.push({ timestamp: Date.now(), success, error })
}

export async function withRateLimitAndRetry<T>(
  fn: () => Promise<T>,
  options: {
    config?: Partial<RateLimiterConfig>
    maxRetries?: number
    baseDelay?: number
    shouldRetry?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const { config = {}, maxRetries = 3, baseDelay = 2000, shouldRetry = defaultShouldRetry } = options
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await acquireSlot(finalConfig)
      try {
        const result = await fn()
        recordRequest(true)
        return result
      } catch (error) {
        lastError = error
        recordRequest(false, error instanceof Error ? error.message : String(error))
        if (attempt < maxRetries && shouldRetry(error)) {
          const waitTime = baseDelay * Math.pow(2, attempt)
          logger.warn(`[RateLimiter] 第 ${attempt + 1} 次重试，等待 ${waitTime}ms`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        } else {
          throw error
        }
      } finally {
        releaseSlot()
      }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('限流')) return true
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset')) return true
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return true
    if (msg.includes('code: 4101')) return false
    if (msg.includes('code: 4') || msg.includes('code:5')) return true
  }
  return false
}

export const VIDEO_RATE_LIMIT_CONFIG: Partial<RateLimiterConfig> = {
  maxRequestsPerMinute: 10,
  minInterval: 6000,
  maxConcurrent: 1,
  throttleWait: 10000,
}

export const IMAGE_RATE_LIMIT_CONFIG: Partial<RateLimiterConfig> = {
  maxRequestsPerMinute: 20,
  minInterval: 3000,
  maxConcurrent: 2,
  throttleWait: 5000,
}

export const LLM_RATE_LIMIT_CONFIG: Partial<RateLimiterConfig> = {
  maxRequestsPerMinute: 60,
  minInterval: 1000,
  maxConcurrent: 5,
  throttleWait: 2000,
}
