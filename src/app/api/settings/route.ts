/**
 * 设置 API 路由
 * 获取和更新用户设置
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'

// 默认设置（从环境变量读取）
function getDefaultSettings() {
  return {
    id: 'default',
    llm_provider: process.env.LLM_PROVIDER || 'minimax',
    llm_model: process.env.LLM_MODEL || 'MiniMax-Text-01',
    llm_api_key: process.env.LLM_API_KEY || null,
    llm_base_url: process.env.LLM_BASE_URL || null,
    image_provider: process.env.IMAGE_PROVIDER || 'doubao',
    image_model: process.env.IMAGE_MODEL || 'doubao-seed-3-0',
    image_api_key: process.env.IMAGE_API_KEY || null,
    image_base_url: process.env.IMAGE_BASE_URL || null,
    image_size: '2K',
    video_provider: process.env.VIDEO_PROVIDER || 'doubao',
    video_model: process.env.VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215',
    video_api_key: process.env.VIDEO_API_KEY || null,
    video_base_url: process.env.VIDEO_BASE_URL || null,
    video_resolution: '720p',
    video_ratio: '16:9',
    voice_provider: process.env.VOICE_PROVIDER || 'doubao',
    voice_model: process.env.VOICE_MODEL || 'doubao-tts',
    voice_api_key: process.env.VOICE_API_KEY || null,
    voice_base_url: process.env.VOICE_BASE_URL || null,
    voice_default_style: 'natural',
  }
}

// 内存存储（用于开发环境，当数据库不可用时）
let memorySettings: Record<string, unknown> | null = null

/**
 * GET /api/settings
 * 获取设置
 */
export async function GET() {
  try {
    // 尝试从数据库获取
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        const { data, error } = await db
          .from('user_settings')
          .select('*')
          .maybeSingle()
        
        if (!error && data) {
          return successResponse({ settings: data })
        }
      } catch (dbError) {
        console.warn('Database not available, using memory settings:', dbError)
      }
    }
    
    // 使用内存设置或默认设置
    const settings = memorySettings ? { ...getDefaultSettings(), ...memorySettings } : getDefaultSettings()
    return successResponse({ settings })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PUT /api/settings
 * 更新设置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await getJSON<{
      llmProvider?: string
      llmModel?: string
      llmApiKey?: string
      llmBaseUrl?: string
      imageProvider?: string
      imageModel?: string
      imageApiKey?: string
      imageBaseUrl?: string
      imageSize?: string
      videoProvider?: string
      videoModel?: string
      videoApiKey?: string
      videoBaseUrl?: string
      videoResolution?: string
      videoRatio?: string
      voiceProvider?: string
      voiceModel?: string
      voiceApiKey?: string
      voiceBaseUrl?: string
      voiceDefaultStyle?: string
    }>(request)
    
    // 尝试保存到数据库
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const db = getSupabaseClient()
        
        // 检查是否存在设置
        const { data: existing } = await db
          .from('user_settings')
          .select('id')
          .maybeSingle()
        
        const settingsData = {
          llm_provider: body.llmProvider,
          llm_model: body.llmModel,
          llm_api_key: body.llmApiKey,
          llm_base_url: body.llmBaseUrl,
          image_provider: body.imageProvider,
          image_model: body.imageModel,
          image_api_key: body.imageApiKey,
          image_base_url: body.imageBaseUrl,
          image_size: body.imageSize,
          video_provider: body.videoProvider,
          video_model: body.videoModel,
          video_api_key: body.videoApiKey,
          video_base_url: body.videoBaseUrl,
          video_resolution: body.videoResolution,
          video_ratio: body.videoRatio,
          voice_provider: body.voiceProvider,
          voice_model: body.voiceModel,
          voice_api_key: body.voiceApiKey,
          voice_base_url: body.voiceBaseUrl,
          voice_default_style: body.voiceDefaultStyle,
          updated_at: new Date().toISOString(),
        }
        
        if (existing?.id) {
          const { error } = await db
            .from('user_settings')
            .update(settingsData)
            .eq('id', existing.id)
          
          if (error) throw error
        } else {
          const { error } = await db
            .from('user_settings')
            .insert({ id: 'default', ...settingsData })
          
          if (error) throw error
        }
        
        return successResponse({ saved: true })
      } catch (dbError) {
        console.warn('Database not available, saving to memory:', dbError)
      }
    }
    
    // 保存到内存
    memorySettings = {
      llm_provider: body.llmProvider,
      llm_model: body.llmModel,
      llm_api_key: body.llmApiKey,
      llm_base_url: body.llmBaseUrl,
      image_provider: body.imageProvider,
      image_model: body.imageModel,
      image_api_key: body.imageApiKey,
      image_base_url: body.imageBaseUrl,
      image_size: body.imageSize,
      video_provider: body.videoProvider,
      video_model: body.videoModel,
      video_api_key: body.videoApiKey,
      video_base_url: body.videoBaseUrl,
      video_resolution: body.videoResolution,
      video_ratio: body.videoRatio,
      voice_provider: body.voiceProvider,
      voice_model: body.voiceModel,
      voice_api_key: body.voiceApiKey,
      voice_base_url: body.voiceBaseUrl,
      voice_default_style: body.voiceDefaultStyle,
    }
    
    return successResponse({ saved: true, note: 'Saved to memory (database not available)' })
  } catch (error) {
    return errorResponse(error)
  }
}
