/**
 * AI 服务统一接口
 * 封装所有 AI 服务的调用
 */

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { Errors, withRetry, logger } from '@/lib/errors'

/** AI 服务配置 */
export interface AIServiceConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  timeout?: number
}

/** 创建 LLM 客户端 */
export function createLLMClient(config: AIServiceConfig, headers?: Record<string, string>) {
  if (!config.apiKey) {
    throw Errors.AIConfigMissing('LLM')
  }

  const clientConfig = new Config({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeout: config.timeout || 120000,
    retryTimes: 3,
    retryDelay: 5000,
  })

  return new LLMClient(clientConfig, headers)
}

/** 调用 LLM */
export async function invokeLLM(
  config: AIServiceConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    temperature?: number
    maxTokens?: number
  }
): Promise<string> {
  const client = createLLMClient(config)

  logger.info('LLM invoke started', { model: config.model })

  try {
    const response = await withRetry(
      () => client.invoke(messages, {
        model: config.model,
        temperature: options?.temperature ?? 0.7,
      }),
      { maxRetries: 3, delay: 10000 }
    )

    logger.info('LLM invoke completed', { responseLength: response.content.length })
    return response.content
  } catch (err) {
    logger.error('LLM invoke failed', err)
    
    if (err instanceof Error && err.message.includes('timeout')) {
      throw Errors.AITimeout('LLM')
    }
    throw Errors.AIRequestFailed('LLM', err instanceof Error ? err.message : undefined)
  }
}

/** 流式调用 LLM */
export async function* streamLLM(
  config: AIServiceConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    temperature?: number
  }
): AsyncGenerator<string> {
  const client = createLLMClient(config)

  logger.info('LLM stream started', { model: config.model })

  try {
    const stream = client.stream(messages, {
      model: config.model,
      temperature: options?.temperature ?? 0.7,
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

/** 解析 LLM 返回的 JSON */
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

/** 获取默认 AI 配置 */
export function getDefaultAIConfig(type: 'llm' | 'image' | 'video'): AIServiceConfig {
  const prefix = type.toUpperCase()
  
  return {
    apiKey: process.env[`${prefix}_API_KEY`] || '',
    baseUrl: process.env[`${prefix}_BASE_URL`],
    model: process.env[`${prefix}_MODEL`],
  }
}

/** 获取 AI 配置（异步版本，供工作流节点使用） */
export async function getAIConfig(type: 'llm' | 'image' | 'video'): Promise<AIServiceConfig> {
  return getDefaultAIConfig(type)
}

/** 从请求头提取转发头 */
export function extractHeaders(headers: Headers): Record<string, string> {
  return HeaderUtils.extractForwardHeaders(headers)
}
