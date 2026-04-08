/**
 * 提示词优化 API
 * 使用 LLM 优化用户的提示词
 * 优先级：用户配置的 API Key > 沙盒系统自带的 API Key
 */

import { NextRequest, NextResponse } from 'next/server'
import { invokeLLM } from '@/lib/ai'

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

    // 调用 LLM 优化提示词
    const result = await invokeLLM(
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ],
      { temperature: 0.7 }
    )

    return NextResponse.json({
      success: true,
      data: {
        original: prompt,
        optimized: result.trim()
      }
    })
  } catch (error: unknown) {
    console.error('提示词优化失败:', error)
    // 检查是否是认证错误
    const err = error as { code?: string; message?: string }
    if (err.code === 'ErrNoPermission' || err.message?.includes('Unauthorized') || err.message?.includes('权限')) {
      return NextResponse.json(
        { success: false, error: 'LLM 调用权限不足，请检查 API Key 配置' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { success: false, error: '优化失败，请重试' },
      { status: 500 }
    )
  }
}
