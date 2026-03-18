/**
 * Coze API 直接调用实现
 * 用于支持用户自己的 Coze API Key (pat-xxx)
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

  logger.info('Coze Direct API call started', { botId, baseUrl, messageCount: messages.length })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const additionalMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      content_type: 'text'
    }))

    // 打印请求内容，方便调试
    console.log('\n========== Coze API 请求内容 ==========')
    console.log('Bot ID:', botId)
    console.log('Messages:')
    additionalMessages.forEach((msg, i) => {
      console.log(`\n--- Message ${i + 1} (${msg.role}) ---`)
      console.log(msg.content.slice(0, 500) + (msg.content.length > 500 ? '...(截断)' : ''))
    })
    console.log('========================================\n')

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

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let currentEvent = ''
    let deltaCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('[Coze Stream] Stream done, total delta:', deltaCount, 'content length:', fullContent.length)
        break
      }

      // 打印原始响应数据
      const chunk = decoder.decode(value, { stream: true })
      console.log('[Coze Stream] Raw chunk:', chunk.slice(0, 500))
      
      buffer += chunk
      
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

        // 打印每个事件
        console.log(`[Coze Stream] Event: ${currentEvent}, Data: ${eventData.slice(0, 200)}${eventData.length > 200 ? '...' : ''}`)

        if (!eventData || eventData === '[DONE]') continue

        try {
          const data = JSON.parse(eventData)
          
          // 处理 delta 事件 - 增量内容（流式输出的关键）
          if (currentEvent === 'conversation.message.delta') {
            deltaCount++
            // delta 事件中的 content 是增量内容，需要累加
            if (data.content) {
              fullContent += data.content
            }
            if (deltaCount === 1 || deltaCount % 50 === 0) {
              console.log('[Coze Stream] Delta events:', deltaCount, 'content length:', fullContent.length)
            }
          }
          
          // 处理已完成的消息
          if (currentEvent === 'conversation.message.completed') {
            console.log('[Coze Stream] Message completed, type:', data.type, 'content length:', data.content?.length || 0)
            // 如果 delta 没有内容，从 completed 消息中获取
            if (!fullContent && data.content) {
              fullContent = data.content
            }
          }
          
          // 处理 chat 完成
          if (currentEvent === 'conversation.chat.completed') {
            console.log('[Coze Stream] Chat completed')
          }
          
          // 处理错误
          if (currentEvent === 'error' || (data.code && data.code !== 0)) {
            throw new Error(`Coze API 错误: ${data.msg || JSON.stringify(data)}`)
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) continue
          throw parseError
        }
      }
    }

    clearTimeout(timeoutId)

    if (!fullContent) {
      logger.error('Coze API returned empty content', { deltaCount })
      throw new Error('Coze API 返回空内容。可能智能体未正确配置，请在 Coze 平台检查智能体的人设设置。')
    }

    logger.info('Coze Direct API call completed', { responseLength: fullContent.length, deltaCount })
    return fullContent

  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw Errors.AITimeout('Coze')
    }
    throw error
  }
}

export async function getCozeDirectConfig(): Promise<CozeDirectConfig | null> {
  try {
    const { getCozeConfigFromMemory } = await import('@/lib/memory-store')
    const memoryConfig = getCozeConfigFromMemory()
    
    if (memoryConfig?.apiKey) {
      const botId = await getCozeBotId()
      return {
        apiKey: memoryConfig.apiKey,
        baseUrl: memoryConfig.baseUrl,
        botId: botId || undefined,
      }
    }
    
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
  } catch {}
  return null
}

async function getCozeBotId(): Promise<string | null> {
  try {
    const { getSettingsFromMemory } = await import('@/lib/memory-store')
    const settings = getSettingsFromMemory()
    return (settings?.coze_bot_id as string) || null
  } catch {
    return null
  }
}
