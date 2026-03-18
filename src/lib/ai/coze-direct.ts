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

    console.log('[Coze Request] bot_id:', botId, 'messages:', additionalMessages.length)

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
    const eventTypes = new Set<string>() // 记录所有事件类型

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('[Coze Stream] Stream done. Events received:', Array.from(eventTypes))
        break
      }

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

        // 打印所有事件用于调试
        console.log('[Coze Stream] Event:', currentEvent, 'Data length:', eventData?.length || 0)
        
        if (!eventData || eventData === '[DONE]') continue

        try {
          const data = JSON.parse(eventData)
          eventTypes.add(currentEvent) // 记录事件类型
          
          // 处理已完成的消息
          if (currentEvent === 'conversation.message.completed') {
            console.log('[Coze Stream] Message completed:', {
              type: data.type,
              content_type: data.content_type,
              content_length: data.content?.length || 0,
              content_preview: typeof data.content === 'string' ? data.content.slice(0, 200) : JSON.stringify(data.content).slice(0, 200)
            })
            if (data.type === 'answer' && data.content) {
              fullContent = data.content
            }
          }
          
          // 处理 delta 事件（增量内容）
          if (currentEvent === 'conversation.message.delta') {
            deltaCount++
            if (data.content) {
              fullContent += data.content
            }
          }
          
          // 处理错误
          if (currentEvent === 'error' || (data.code && data.code !== 0)) {
            console.error('[Coze Stream] Error event:', data)
            throw new Error(`Coze API 错误: ${data.msg || JSON.stringify(data)}`)
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            console.log('[Coze Stream] Failed to parse:', eventData.slice(0, 200))
            continue
          }
          throw parseError
        }
      }
    }

    clearTimeout(timeoutId)

    console.log('[Coze Stream] Final result - deltaCount:', deltaCount, 'fullContent length:', fullContent.length)

    if (!fullContent) {
      logger.error('Coze API returned empty content', { deltaCount, eventTypes: Array.from(eventTypes) })
      throw new Error('Coze API 返回空内容。收到的事件类型: ' + Array.from(eventTypes).join(', ') + '。请检查 Bot 配置。')
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
