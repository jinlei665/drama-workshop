/**
 * 全局模型配置状态管理
 * 在应用启动时检查用户配置，提供回退机制
 */

'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { toast } from 'sonner'

// 默认系统配置
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  // LLM 配置
  llmProvider: 'doubao',
  llmModel: 'doubao-seed-1-8-251228',
  llmApiKey: null,
  llmBaseUrl: null,
  // 图像配置
  imageProvider: 'doubao',
  imageModel: 'doubao-seed-3-0',
  imageApiKey: null,
  imageBaseUrl: null,
  imageSize: '2K',
  // 视频配置
  videoProvider: 'doubao',
  videoModel: 'doubao-seedance-1-5-pro-251215',
  videoApiKey: null,
  videoBaseUrl: null,
  videoResolution: '720p',
  videoRatio: '16:9',
  // 语音配置
  voiceProvider: 'doubao',
  voiceModel: 'doubao-tts',
  voiceApiKey: null,
  voiceBaseUrl: null,
  voiceDefaultStyle: 'natural',
}

export interface ModelConfig {
  // LLM
  llmProvider: string
  llmModel: string
  llmApiKey: string | null
  llmBaseUrl: string | null
  // 图像
  imageProvider: string
  imageModel: string
  imageApiKey: string | null
  imageBaseUrl: string | null
  imageSize: string
  // 视频
  videoProvider: string
  videoModel: string
  videoApiKey: string | null
  videoBaseUrl: string | null
  videoResolution: string
  videoRatio: string
  // 语音
  voiceProvider: string
  voiceModel: string
  voiceApiKey: string | null
  voiceBaseUrl: string | null
  voiceDefaultStyle: string
}

interface ModelConfigContextType {
  config: ModelConfig
  loading: boolean
  isLoading: boolean  // 别名，保持兼容
  isConfigured: boolean
  hasCustomConfig: boolean
  hasUserConfig: boolean
  refreshConfig: () => Promise<void>
  // 是否使用系统模型
  useSystemModel: {
    llm: boolean
    image: boolean
    video: boolean
    voice: boolean
  }
}

const ModelConfigContext = createContext<ModelConfigContextType | undefined>(undefined)

export function ModelConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [hasUserConfig, setHasUserConfig] = useState(false)

  const refreshConfig = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      
      if (data.settings) {
        const userConfig = data.settings
        setHasUserConfig(true)
        setConfig({
          llmProvider: userConfig.llm_provider || DEFAULT_MODEL_CONFIG.llmProvider,
          llmModel: userConfig.llm_model || DEFAULT_MODEL_CONFIG.llmModel,
          llmApiKey: userConfig.llm_api_key,
          llmBaseUrl: userConfig.llm_base_url,
          imageProvider: userConfig.image_provider || DEFAULT_MODEL_CONFIG.imageProvider,
          imageModel: userConfig.image_model || DEFAULT_MODEL_CONFIG.imageModel,
          imageApiKey: userConfig.image_api_key,
          imageBaseUrl: userConfig.image_base_url,
          imageSize: userConfig.image_size || DEFAULT_MODEL_CONFIG.imageSize,
          videoProvider: userConfig.video_provider || DEFAULT_MODEL_CONFIG.videoProvider,
          videoModel: userConfig.video_model || DEFAULT_MODEL_CONFIG.videoModel,
          videoApiKey: userConfig.video_api_key,
          videoBaseUrl: userConfig.video_base_url,
          videoResolution: userConfig.video_resolution || DEFAULT_MODEL_CONFIG.videoResolution,
          videoRatio: userConfig.video_ratio || DEFAULT_MODEL_CONFIG.videoRatio,
          voiceProvider: userConfig.voice_provider || DEFAULT_MODEL_CONFIG.voiceProvider,
          voiceModel: userConfig.voice_model || DEFAULT_MODEL_CONFIG.voiceModel,
          voiceApiKey: userConfig.voice_api_key,
          voiceBaseUrl: userConfig.voice_base_url,
          voiceDefaultStyle: userConfig.voice_default_style || DEFAULT_MODEL_CONFIG.voiceDefaultStyle,
        })
        console.log('[ModelConfig] 已加载用户配置')
      } else {
        setHasUserConfig(false)
        setConfig(DEFAULT_MODEL_CONFIG)
        console.log('[ModelConfig] 无用户配置，使用系统默认模型')
      }
    } catch (error) {
      console.error('[ModelConfig] 加载配置失败:', error)
      setHasUserConfig(false)
      setConfig(DEFAULT_MODEL_CONFIG)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshConfig()
  }, [refreshConfig])

  // 判断是否使用系统模型（没有配置 API Key）
  const useSystemModel = {
    llm: !config.llmApiKey,
    image: !config.imageApiKey,
    video: !config.videoApiKey,
    voice: !config.voiceApiKey,
  }

  // 是否已配置（有 API Key 或使用系统模型）
  const isConfigured = hasUserConfig || Object.values(useSystemModel).every(v => v)
  
  // 是否有自定义配置（有 API Key）
  const hasCustomConfig = hasUserConfig && !Object.values(useSystemModel).every(v => v)

  return (
    <ModelConfigContext.Provider value={{
      config,
      loading: isLoading,
      isLoading,
      isConfigured,
      hasCustomConfig,
      hasUserConfig,
      refreshConfig,
      useSystemModel,
    }}>
      {children}
    </ModelConfigContext.Provider>
  )
}

export function useModelConfig() {
  const context = useContext(ModelConfigContext)
  if (context === undefined) {
    throw new Error('useModelConfig must be used within a ModelConfigProvider')
  }
  return context
}

/**
 * 获取用户 AI 服务配置（用于后端 API）
 * 从数据库或内存存储获取用户配置
 */
export async function getUserAIServiceConfig(headers?: Headers): Promise<{
  model: string
  apiKey: string | undefined
  baseUrl: string | undefined
  useSystemDefault: boolean
}> {
  try {
    // 在服务端，直接从数据库获取配置
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('user_settings')
        .select('llm_model, llm_api_key, llm_base_url')
        .limit(1)
        .maybeSingle()
      
      const hasUserKey = !!data?.llm_api_key
      
      return {
        model: data?.llm_model || DEFAULT_MODEL_CONFIG.llmModel,
        apiKey: hasUserKey ? data.llm_api_key : undefined,
        baseUrl: hasUserKey ? data.llm_base_url : undefined,
        useSystemDefault: !hasUserKey,
      }
    }
    
    // 无数据库配置，使用系统默认
    return {
      model: DEFAULT_MODEL_CONFIG.llmModel,
      apiKey: undefined,
      baseUrl: undefined,
      useSystemDefault: true,
    }
  } catch (error) {
    console.error('[ModelConfig] 获取用户配置失败:', error)
    return {
      model: DEFAULT_MODEL_CONFIG.llmModel,
      apiKey: undefined,
      baseUrl: undefined,
      useSystemDefault: true,
    }
  }
}

/**
 * 获取 LLM 配置（用于后端 API）
 */
export async function getLLMConfig(): Promise<{
  model: string
  apiKey: string | undefined
  baseUrl: string | undefined
  useSystemDefault: boolean
}> {
  return getUserAIServiceConfig()
}

/**
 * 显示模型回退提示
 */
export function showFallbackToast(service: string) {
  toast.warning(`${service}模型请求失败，已自动切换到系统模型`, {
    description: '请检查您的模型配置或 API Key 是否正确',
    duration: 5000,
  })
}
