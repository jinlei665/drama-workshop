/**
 * 提示词优化 API
 * 使用 LLM 优化用户的提示词
 */

import { NextRequest, NextResponse } from 'next/server'
import { Config, HeaderUtils, LLMClient } from 'coze-coding-dev-sdk'
import { getCozeConfigFromMemory } from '@/lib/memory-store'
import { getSupabaseClient, isDatabaseConfigured } from '@/storage/database/supabase-client'

export async function POST(request: NextRequest) {
  try {
    const { prompt, type = 'image' } = await request.json()

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入提示词' },
        { status: 400 }
      )
    }

    // 根据类型选择不同的系统提示词
    const systemPrompt = type === 'video' 
      ? `你是一位专业的 AI 视频生成提示词工程师。你的任务是将用户输入的简短描述优化为详细的、高质量的视频生成提示词。

优化原则：
1. 详细描述场景：包括环境、背景，光线等
2. 描述主体：包括人物/物体的外观、表情、动作等
3. 添加氛围：包括情绪、风格、色调等
4. 使用专业的视频生成术语

输出格式：
- 直接输出优化后的提示词，不需要解释
- 保持在 200-500 字之间
- 使用英文逗号分隔各项描述，便于 AI 理解

请直接输出优化后的提示词，不要添加任何前缀说明。`
      : `你是一位专业的 AI 图像生成提示词工程师。你的任务是将用户输入的简短描述优化为详细的、高质量的图像生成提示词。

优化原则：
1. 详细描述主体：包括外观特征、表情、姿态等
2. 描述环境和背景：场景设置，光线效果等
3. 指定艺术风格：如写实、动漫、油画等
4. 添加细节质量词：如4K、高清、精致等
5. 添加情绪和氛围词

输出格式：
- 直接输出优化后的提示词，不需要解释
- 保持在 100-300 字之间
- 使用英文逗号分隔各项描述
- 根据选择的风格自动添加相关描述词

请直接输出优化后的提示词，不要添加任何前缀说明。`

    // 获取用户配置（从内存或数据库）
    let apiKey: string | undefined
    let baseUrl: string | undefined

    // 优先从内存获取（最新的设置）
    const memoryConfig = getCozeConfigFromMemory()
    if (memoryConfig?.apiKey) {
      apiKey = memoryConfig.apiKey
      baseUrl = memoryConfig.baseUrl
    } else {
      // 再尝试从数据库获取
      if (isDatabaseConfigured()) {
        try {
          const db = getSupabaseClient()
          const { data, error } = await db
            .from('user_settings')
            .select('coze_api_key, coze_base_url')
            .maybeSingle()
          
          if (!error && data?.coze_api_key) {
            apiKey = data.coze_api_key
            baseUrl = data.coze_base_url || undefined
          }
        } catch (err) {
          console.log('[Optimize Prompt] Database error:', err instanceof Error ? err.message : String(err))
        }
      }
    }

    // 创建 LLM 客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
    const config = new Config({
      apiKey,
      baseUrl: baseUrl || process.env.COZE_BASE_URL || 'https://api.coze.cn',
      timeout: 120000,
    })
    const client = new LLMClient(config, customHeaders)

    // 调用 LLM 进行优化
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ]

    const response = await client.invoke(messages, {
      temperature: 0.7,
    })

    return NextResponse.json({
      success: true,
      data: {
        original: prompt,
        optimized: response.content.trim()
      }
    })
  } catch (error: unknown) {
    console.error('提示词优化失败:', error)
    // 检查是否是认证错误
    const err = error as { code?: string; message?: string }
    if (err.code === 'ErrNoPermission' || err.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: '请先在设置中配置 Coze API Key' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { success: false, error: '优化失败，请重试' },
      { status: 500 }
    )
  }
}
