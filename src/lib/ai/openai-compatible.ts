/**
 * OpenAI 兼容客户端封装
 * 支持所有 OpenAI 兼容的 API 服务：
 * - MiniMax (https://api.minimax.chat)
 * - DeepSeek (https://api.deepseek.com)
 * - 智谱 GLM (https://open.bigmodel.cn)
 * - Moonshot (https://api.moonshot.cn)
 * - 通义千问 (https://dashscope.aliyuncs.com/compatible-mode/v1)
 * - 本地 Ollama (http://localhost:11434/v1)
 * - 任何 OpenAI 兼容服务
 */

import { logger } from '@/lib/errors'

/** OpenAI 兼容配置 */
export interface OpenAICompatibleConfig {
  apiKey: string
  baseUrl: string
  model: string
  timeout?: number
}

/** 消息格式 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

/** 多模态内容 */
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

/** 调用选项 */
export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
}

/** 流式响应块 */
export interface StreamChunk {
  delta: string
  finishReason?: string
}

/**
 * OpenAI 兼容客户端
 */
export class OpenAICompatibleClient {
  private config: OpenAICompatibleConfig

  constructor(config: OpenAICompatibleConfig) {
    this.config = {
      timeout: 300000, // 5分钟默认超时
      ...config,
    }
  }

  /**
   * 非流式调用
   */
  async invoke(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.formatMessages(messages),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API 错误 (${response.status}): ${error}`)
      }

      const data = await response.json()
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('API 返回格式错误：缺少 content')
      }

      return data.choices[0].message.content
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时')
      }
      throw error
    }
  }

  /**
   * 流式调用
   */
  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.formatMessages(messages),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stream: true,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API 错误 (${response.status}): ${error}`)
      }

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
        
        // 处理 SSE 格式
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一个不完整的行

        for (const line of lines) {
          const trimmed = line.trim()
          
          if (!trimmed || trimmed === 'data: [DONE]') continue
          
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6))
              const delta = json.choices?.[0]?.delta?.content
              
              if (delta) {
                yield delta
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时')
      }
      throw error
    }
  }

  /**
   * 格式化消息
   */
  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' 
        ? msg.content 
        : msg.content.map(part => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text }
            }
            if (part.type === 'image_url') {
              return { type: 'image_url', image_url: part.image_url }
            }
            return part
          })
    }))
  }
}

/**
 * 预设的 OpenAI 兼容服务配置
 */
export const OPENAI_COMPATIBLE_PROVIDERS = {
  // MiniMax
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat'],
  },
  // DeepSeek
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  // 智谱 GLM
  zhipu: {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-4-flash', 'glm-4-plus'],
  },
  // Moonshot
  moonshot: {
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  // 通义千问（OpenAI 兼容模式）
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  // 本地 Ollama
  ollama: {
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3', 'qwen2', 'mistral'],
  },
  // 自定义
  custom: {
    name: '自定义服务',
    baseUrl: '',
    models: [],
  },
} as const

export type ProviderKey = keyof typeof OPENAI_COMPATIBLE_PROVIDERS
