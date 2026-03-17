/**
 * 设置 API 路由
 * 获取和更新用户设置
 * 
 * 默认使用系统自带的模型：
 * - LLM: doubao-seed-1-8-251228
 * - 图像: doubao-seed-3-0 (2K)
 * - 视频: doubao-seedance-1-5-pro-251215 (720p, 16:9)
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_MODEL,
  AVAILABLE_LLM_MODELS,
} from '@/lib/ai'

// 默认设置（使用系统自带模型，无需 API Key）
function getDefaultSettings() {
  return {
    id: 'default',
    // Coze API 配置（自部署时需要配置）
    coze_api_key: null,
    coze_base_url: 'https://api.coze.com',
    // LLM 配置
    llm_provider: 'doubao',
    llm_model: DEFAULT_LLM_MODEL,
    llm_api_key: null, // 系统自带模型，无需 API Key
    llm_base_url: null,
    // 图像配置
    image_provider: 'doubao',
    image_model: 'doubao-seed-3-0',
    image_api_key: null,
    image_base_url: null,
    image_size: DEFAULT_IMAGE_SIZE,
    // 视频配置
    video_provider: 'doubao',
    video_model: DEFAULT_VIDEO_MODEL,
    video_api_key: null,
    video_base_url: null,
    video_resolution: '720p',
    video_ratio: '16:9',
    // 语音配置
    voice_provider: 'doubao',
    voice_model: 'doubao-tts',
    voice_api_key: null,
    voice_base_url: null,
    voice_default_style: 'natural',
    // FFmpeg 配置
    ffmpeg_path: null,
    ffprobe_path: null,
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
    const settings = memorySettings
      ? { ...getDefaultSettings(), ...memorySettings }
      : getDefaultSettings()
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
      // Coze API 配置
      cozeApiKey?: string
      cozeBaseUrl?: string
      // LLM 配置
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
      // FFmpeg 配置
      ffmpegPath?: string
      ffprobePath?: string
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
          coze_api_key: body.cozeApiKey,
          coze_base_url: body.cozeBaseUrl,
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
          ffmpeg_path: body.ffmpegPath,
          ffprobe_path: body.ffprobePath,
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
      coze_api_key: body.cozeApiKey,
      coze_base_url: body.cozeBaseUrl,
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
      ffmpeg_path: body.ffmpegPath,
      ffprobe_path: body.ffprobePath,
    }

    return successResponse({
      saved: true,
      note: 'Saved to memory (database not available)',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
