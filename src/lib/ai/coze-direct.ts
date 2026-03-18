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

/**
 * 直接调用 Coze API（使用流式，然后收集完整响应）
 * 
 * SSE 格式：
 * event:conversation.message.completed
 * data:{"id":"xxx","content":"实际回复内容","type":"answer",...}
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

    // 使用流式 API
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
      logger.error('Coze API HTTP error', { status: response.status, body: errorText })
      throw new Error(`Coze API 请求失败: ${response.status} ${response.statusText}`)
    }

    // 读取流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let currentEvent = ''

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
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim()
          }
        }

        if (!eventData) continue
        if (eventData === '[DONE]') continue

        try {
          const data = JSON.parse(eventData)
          
          // 调试日志
          if (currentEvent) {
            console.log('[Coze Stream] Event:', currentEvent)
          }

          // 处理已完成的消息 - 这里包含完整的回答
          if (currentEvent === 'conversation.message.completed') {
            // 只处理 type=answer 的消息
            if (data.type === 'answer' && data.content) {
              fullContent = data.content  // 使用完整内容，不是增量
              console.log('[Coze Stream] Got answer, length:', data.content.length)
            }
          }
          
          // 处理增量消息（可选，用于实时显示）
          if (currentEvent === 'conversation.message.delta') {
            // delta 事件的 content 可能为空，实际在 reasoning_content 中
            // 我们等待 completed 事件获取完整内容
          }
          
          // 处理错误
          if (currentEvent === 'error' || data.code) {
            const errorMsg = data.msg || JSON.stringify(data)
            throw new Error(`Coze API 错误: ${errorMsg}`)
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            // JSON 解析错误，忽略
            console.warn('[Coze Stream] JSON parse error:', eventData.substring(0, 100))
            continue
          }
          throw parseError
        }
      }
    }

    clearTimeout(timeoutId)

    if (!fullContent) {
      logger.error('Coze API returned empty content')
      throw new Error('Coze API 返回空内容，请检查智能体是否正确配置了人设')
    }

    logger.info('Coze Direct API call completed', { responseLength: fullContent.length })
    return fullContent

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
