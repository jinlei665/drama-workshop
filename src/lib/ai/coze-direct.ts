/**
 * Coze API 直接调用实现
 * 用于支持用户自己的 Coze API Key (pat-xxx)
 * 
 * 使用方式：
 * 1. 在 Coze 平台创建一个智能体
 * 2. 获取 bot_id（URL 中的数字）
 * 3. 在设置中配置 API Key 和 Bot ID
 */

import { Errors, logger } from '@/lib/errors'

/** Coze API 配置 */
export interface CozeDirectConfig {
  apiKey: string
  baseUrl?: string
  botId?: string
  timeout?: number
}

/** Coze 消息格式 */
export interface CozeMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Coze API 响应 */
interface CozeChatResponse {
  code: number
  msg: string
  data?: {
    id: string
    conversation_id: string
    status: string
    messages?: Array<{
      id: string
      role: string
      type: string
      content: string
      content_type: string
    }>
  }
  detail?: {
    logid: string
  }
}

/** 流式响应事件 */
interface CozeStreamEvent {
  event: string
  data?: {
    id: string
    conversation_id: string
    status: string
    messages?: Array<{
      id: string
      role: string
      type: string
      content: string
      content_type: string
    }>
  }
  msg?: string
  code?: number
}

/**
 * 直接调用 Coze API（非流式）
 */
export async function invokeCozeDirect(
  messages: CozeMessage[],
  config: CozeDirectConfig
): Promise<string> {
  const { apiKey, baseUrl = 'https://api.coze.cn', botId, timeout = 120000 } = config

  if (!apiKey) {
    throw Errors.AIConfigMissing('Coze')
  }

  if (!botId) {
    throw new Error('需要配置 Bot ID。请在 Coze 平台创建智能体并获取 Bot ID。')
  }

  logger.info('Coze Direct API call started', { 
    botId, 
    baseUrl,
    messageCount: messages.length 
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    // 构建 additional_messages
    const additionalMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      content_type: 'text'
    }))

    const response = await fetch(`${baseUrl}/v3/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: 'drama-workshop-user',
        stream: false,
        auto_save_history: true,
        additional_messages: additionalMessages,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Coze API HTTP error', { status: response.status, body: errorText })
      throw new Error(`Coze API 请求失败: ${response.status} ${response.statusText}`)
    }

    const result: CozeChatResponse = await response.json()

    if (result.code !== 0) {
      logger.error('Coze API error', { code: result.code, msg: result.msg })
      throw new Error(`Coze API 错误: ${result.msg}`)
    }

    // 提取助手回复
    const assistantMessages = result.data?.messages?.filter(
      msg => msg.role === 'assistant' && msg.type === 'answer'
    ) || []

    if (assistantMessages.length === 0) {
      throw new Error('Coze API 未返回有效回复')
    }

    // 合并所有回复内容
    const content = assistantMessages.map(msg => msg.content).join('')

    logger.info('Coze Direct API call completed', { responseLength: content.length })

    return content
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw Errors.AITimeout('Coze')
    }
    
    logger.error('Coze Direct API call failed', error)
    throw error
  }
}

/**
 * 流式调用 Coze API
 */
export async function* streamCozeDirect(
  messages: CozeMessage[],
  config: CozeDirectConfig
): AsyncGenerator<string> {
  const { apiKey, baseUrl = 'https://api.coze.cn', botId, timeout = 120000 } = config

  if (!apiKey) {
    throw Errors.AIConfigMissing('Coze')
  }

  if (!botId) {
    throw new Error('需要配置 Bot ID。请在 Coze 平台创建智能体并获取 Bot ID。')
  }

  logger.info('Coze Direct API stream started', { botId, baseUrl })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const additionalMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      content_type: 'text'
    }))

    const response = await fetch(`${baseUrl}/v3/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: 'drama-workshop-user',
        stream: true,
        auto_save_history: true,
        additional_messages: additionalMessages,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Coze API 请求失败: ${response.status}`)
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
      
      // 解析 SSE 事件
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          
          if (data === '[DONE]') {
            clearTimeout(timeoutId)
            return
          }

          try {
            const event: CozeStreamEvent = JSON.parse(data)
            
            // 处理消息增量事件
            if (event.event === 'conversation.message.delta' && event.data?.messages) {
              for (const msg of event.data.messages) {
                if (msg.content) {
                  yield msg.content
                }
              }
            }
            
            // 处理错误事件
            if (event.event === 'error') {
              throw new Error(`Coze API 流式错误: ${event.msg || '未知错误'}`)
            }
          } catch (parseError) {
            // 忽略解析错误，继续处理
            if (parseError instanceof SyntaxError) {
              continue
            }
            throw parseError
          }
        }
      }
    }

    clearTimeout(timeoutId)
    logger.info('Coze Direct API stream completed')
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw Errors.AITimeout('Coze')
    }
    
    logger.error('Coze Direct API stream failed', error)
    throw error
  }
}

/**
 * 获取用户的 Coze 配置（包含 bot_id）
 */
export async function getCozeDirectConfig(): Promise<CozeDirectConfig | null> {
  try {
    // 尝试从内存存储获取
    const { getCozeConfigFromMemory } = await import('@/lib/memory-store')
    const memoryConfig = getCozeConfigFromMemory()
    
    if (memoryConfig?.apiKey) {
      // 尝试获取 bot_id
      const botId = await getCozeBotId()
      
      return {
        apiKey: memoryConfig.apiKey,
        baseUrl: memoryConfig.baseUrl,
        botId: botId || undefined,
      }
    }
    
    // 尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      const db = getSupabaseClient()
      const { data, error } = await db
        .from('user_settings')
        .select('coze_api_key, coze_base_url, coze_bot_id')
        .maybeSingle()
      
      if (!error && data?.coze_api_key) {
        return {
          apiKey: data.coze_api_key,
          baseUrl: data.coze_base_url || undefined,
          botId: data.coze_bot_id || undefined,
        }
      }
    }
  } catch {
    // 忽略错误
  }
  
  return null
}

/**
 * 获取 Coze Bot ID
 */
async function getCozeBotId(): Promise<string | null> {
  try {
    const { getSettingsFromMemory } = await import('@/lib/memory-store')
    const settings = getSettingsFromMemory()
    return (settings?.coze_bot_id as string) || null
  } catch {
    return null
  }
}
