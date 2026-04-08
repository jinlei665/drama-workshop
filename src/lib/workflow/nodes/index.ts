/**
 * 工作流节点实现
 * 包含所有节点类型的具体实现
 */

import { BaseNodeClass } from '../node/BaseNode'
import { ExecutionContext } from '../types'

// 导入必要的库
import { TTSClient, Config } from 'coze-coding-dev-sdk'
import { generateImage, generateVideoFromImage, invokeLLM, parseLLMJson, getUserLLMConfig, getServerAIConfig } from '@/lib/ai'
import { invokeCozeDirect, getCozeDirectConfig } from '@/lib/ai/coze-direct'
import { OpenAICompatibleClient } from '@/lib/ai/openai-compatible'
import { memoryScenes, memoryCharacters, generateId } from '@/lib/memory-storage'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { uploadImageToStorage, uploadVideoToStorage } from '@/lib/storage/image-storage'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 获取人物库专用的 Supabase 客户端（与服务端 API 保持一致）
 */
function getCharacterLibraryClientForNode() {
  const userUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log('[TextToCharacterNode] Env check:', {
    hasUserUrl: !!userUrl,
    hasServiceKey: !!serviceKey,
    userUrlPrefix: userUrl?.substring(0, 30),
    serviceKeyPrefix: serviceKey?.substring(0, 30),
  })
  
  if (userUrl && serviceKey) {
    // eslint-disable-next-line no-eval
    const createClient = eval("require('@supabase/supabase-js')").createClient
    const client = createClient(userUrl, serviceKey)
    console.log('[TextToCharacterNode] Created Supabase client with service_role key')
    return client
  }
  
  // 回退到沙箱环境
  const cozeUrl = process.env.COZE_SUPABASE_URL
  const cozeKey = process.env.COZE_SUPABASE_ANON_KEY
  
  console.log('[TextToCharacterNode] Falling back to sandbox:', {
    hasCozeUrl: !!cozeUrl,
    hasCozeKey: !!cozeKey,
  })
  
  if (cozeUrl && cozeKey) {
    // eslint-disable-next-line no-eval
    const createClient = eval("require('@supabase/supabase-js')").createClient
    return createClient(cozeUrl, cozeKey)
  }
  
  console.log('[TextToCharacterNode] Falling back to getSupabaseClient()')
  return getSupabaseClient()
}

// ============ 文本输入节点 ============

const TEXT_INPUT_PORTS = {
  inputs: [],
  outputs: [{ id: 'text', name: '文本' }]
}

export class TextInputNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'text-input',
      name: '文本输入',
      description: '输入文本内容',
      inputs: TEXT_INPUT_PORTS.inputs,
      outputs: TEXT_INPUT_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      text: {
        type: 'string',
        required: true,
        default: '',
        description: '输入的文本内容'
      },
      multiline: {
        type: 'boolean',
        required: false,
        default: false,
        description: '是否为多行文本'
      },
      placeholder: {
        type: 'string',
        required: false,
        default: '请输入文本...',
        description: '占位符文本'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    const text = this.params.text || ''
    return { type: 'text', content: text }
  }
}

// ============ 图片输入节点 ============

const IMAGE_INPUT_PORTS = {
  inputs: [],
  outputs: [{ id: 'image', name: '图像' }]
}

export class ImageInputNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'image-input',
      name: '图片输入',
      description: '上传或选择图片',
      inputs: IMAGE_INPUT_PORTS.inputs,
      outputs: IMAGE_INPUT_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      imageUrl: {
        type: 'string',
        required: false,
        default: '',
        description: '图片 URL'
      },
      assetId: {
        type: 'string',
        required: false,
        default: '',
        description: '资产 ID'
      },
      upload: {
        type: 'boolean',
        required: false,
        default: true,
        description: '是否允许上传'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    const imageUrl = this.params.imageUrl || this.params.assetId || ''
    if (!imageUrl) {
      throw new Error('请提供图片 URL 或资产 ID')
    }
    return { type: 'image', url: imageUrl }
  }
}

// ============ 文生图节点 ============

const TEXT_TO_IMAGE_PORTS = {
  inputs: [{ id: 'prompt', name: '提示词' }],
  outputs: [{ id: 'image', name: '图像' }]
}

export class TextToImageNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'text-to-image',
      name: '文生图',
      description: '根据文本生成图片',
      inputs: TEXT_TO_IMAGE_PORTS.inputs,
      outputs: TEXT_TO_IMAGE_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      prompt: {
        type: 'string',
        required: false,
        description: '提示词'
      },
      style: {
        type: 'string',
        required: false,
        default: 'realistic',
        enum: ['realistic', 'anime', 'cartoon', 'oil_painting'],
        description: '风格'
      },
      size: {
        type: 'string',
        required: false,
        default: '2K',
        enum: ['2K', '4K'],
        description: '图片尺寸'
      },
      referenceImage: {
        type: 'string',
        required: false,
        default: '',
        description: '参考图片 URL（可选）'
      },
      watermark: {
        type: 'boolean',
        required: false,
        default: false,
        description: '是否添加水印'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    // 统一处理所有输入端口
    console.log('[TextToImageNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))

    // 从输入端口获取值
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(`[TextToImageNode] Input port '${input.id}' has value:`, typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue)

        if (typeof inputValue === 'object') {
          // 优先使用 extractedUrl（参考图片）
          if (input.extractedUrl && input.extractedUrl.startsWith('http')) {
            this.params.referenceImage = input.extractedUrl
          }
          // 获取文本内容作为提示词
          this.params.prompt = inputValue.content || inputValue.text || this.params.prompt || ''
          if (inputValue.url && !this.params.referenceImage && inputValue.url.startsWith('http')) {
            this.params.referenceImage = inputValue.url
          }
        } else if (typeof inputValue === 'string') {
          // 字符串可能是提示词或URL
          if (inputValue.startsWith('http')) {
            this.params.referenceImage = inputValue
          } else {
            this.params.prompt = inputValue
          }
        }
      }
    }

    const prompt = this.params.prompt || ''
    const style = this.params.style || 'realistic'
    const size = this.params.size || '2K'
    const referenceImage = this.params.referenceImage

    console.log('[TextToImageNode] Final params:', { prompt: prompt?.substring(0, 50), style, size, hasRefImage: !!referenceImage })

    if (!prompt) {
      throw new Error('请提供提示词')
    }

    // 构建完整提示词
    let fullPrompt = prompt
    if (style === 'realistic') {
      fullPrompt += '，写实风格，真实感人像摄影，光影自然，细腻皮肤纹理'
    } else if (style === 'anime') {
      fullPrompt += '，动漫风格，二次元，精致线条，明亮色彩'
    } else if (style === 'cartoon') {
      fullPrompt += '，卡通风格，可爱活泼，圆润线条'
    } else if (style === 'oil_painting') {
      fullPrompt += '，油画风格，厚重笔触，色彩丰富'
    }

    // 生成图片
    const result = await generateImage(
      fullPrompt,
      {
        size: size as '2K' | '4K',
        watermark: this.params.watermark,
        image: referenceImage ? [referenceImage] : undefined
      }
    )

    let imageUrl = result.urls[0]
    console.log('[TextToImageNode] Generated image URL:', imageUrl?.substring(0, 100))

    // 将图片上传到存储
    try {
      const storageUrl = await uploadImageToStorage(imageUrl, `workflow/text-to-image/${Date.now()}.png`)
      if (storageUrl) {
        console.log('[TextToImageNode] Image uploaded to storage:', storageUrl)
        imageUrl = storageUrl
      }
    } catch (storageError) {
      console.warn('[TextToImageNode] Failed to upload image to storage:', storageError)
    }

    return {
      type: 'image',
      url: imageUrl,
      prompt,
      style,
      size
    }
  }
}

// ============ 图生视频节点 ============

const IMAGE_TO_VIDEO_PORTS = {
  inputs: [
    { id: 'prompt', name: '提示词' },
    { id: 'firstFrame', name: '首帧图像' },
    { id: 'lastFrame', name: '尾帧图像' }
  ],
  outputs: [{ id: 'video', name: '视频' }]
}

export class ImageToVideoNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'image-to-video',
      name: '图生视频',
      description: '根据图片生成视频',
      inputs: IMAGE_TO_VIDEO_PORTS.inputs,
      outputs: IMAGE_TO_VIDEO_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      firstFrame: {
        type: 'string',
        required: false,
        description: '首帧图片 URL'
      },
      lastFrame: {
        type: 'string',
        required: false,
        description: '尾帧图片 URL（可选）'
      },
      prompt: {
        type: 'string',
        required: false,
        default: '',
        description: '提示词'
      },
      duration: {
        type: 'number',
        required: false,
        default: 6,
        min: 4,
        max: 12,
        description: '视频时长（秒）'
      },
      ratio: {
        type: 'string',
        required: false,
        default: '16:9',
        enum: ['16:9', '9:16'],
        description: '视频比例'
      },
      motionBucketId: {
        type: 'number',
        required: false,
        default: 127,
        min: 1,
        max: 255,
        description: '运动强度 (1-255)'
      },
      condAug: {
        type: 'number',
        required: false,
        default: 0.02,
        min: 0,
        max: 1,
        description: '条件增强 (0-1)'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    // 统一处理所有输入端口
    console.log('[ImageToVideoNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))
    console.log('[ImageToVideoNode] Processing params:', JSON.stringify(this.params, null, 2))

    // 从输入端口获取值
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(`[ImageToVideoNode] Input port '${input.id}' has value:`, typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue)

        // 优先使用 extractedUrl（已从对象中提取的 URL）
        let extractedValue = input.extractedUrl

        // 如果没有 extractedUrl，则从对象中提取
        if (!extractedValue) {
          if (typeof inputValue === 'object' && inputValue !== null) {
            extractedValue = inputValue.url || inputValue.content || inputValue.text || JSON.stringify(inputValue)
          } else if (typeof inputValue === 'string') {
            extractedValue = inputValue
          }
        }

        // 根据端口 ID 设置对应的参数
        if (input.id === 'image' || input.id === 'firstFrame') {
          this.params.firstFrame = extractedValue
        } else if (input.id === 'lastFrameImage' || input.id === 'lastFrame') {
          this.params.lastFrame = extractedValue
        } else if (input.id === 'prompt' || input.id === 'text') {
          this.params.prompt = extractedValue
        } else {
          this.params[input.id] = extractedValue
        }
      }
    }

    // 最终参数值
    const firstFrame = this.params.firstFrame || this.params.image
    const lastFrame = this.params.lastFrame || this.params.lastFrameImage
    const prompt = this.params.prompt || ''

    console.log('[ImageToVideoNode] Final params:', { firstFrame, lastFrame, prompt })

    if (!firstFrame) {
      throw new Error('首帧图片 URL 是必填的')
    }

    // 生成视频
    const result = await generateVideoFromImage(
      prompt || firstFrame,
      firstFrame,
      {
        duration: this.params.duration,
        ratio: this.params.ratio as '16:9' | '9:16',
        generateAudio: true,
      }
    )

    console.log('[ImageToVideoNode] Video generated, URL:', result.videoUrl?.substring(0, 100))

    // 将视频上传到存储
    let videoUrl = result.videoUrl
    try {
      const storageUrl = await uploadVideoToStorage(result.videoUrl, `workflow/image-to-video/${Date.now()}.mp4`)
      if (storageUrl) {
        console.log('[ImageToVideoNode] Video uploaded to storage:', storageUrl)
        videoUrl = storageUrl
      }
    } catch (storageError) {
      console.warn('[ImageToVideoNode] Failed to upload video to storage:', storageError)
    }

    return {
      type: 'video',
      url: videoUrl,
      lastFrameUrl: result.lastFrameUrl,
      duration: this.params.duration,
      ratio: this.params.ratio
    }
  }
}

// ============ 文字转语音节点 ============

const TEXT_TO_AUDIO_PORTS = {
  inputs: [{ id: 'text', name: '文本' }],
  outputs: [{ id: 'audio', name: '音频' }]
}

export class TextToAudioNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'text-to-audio',
      name: '文字转语音',
      description: '将文本转换为语音',
      inputs: TEXT_TO_AUDIO_PORTS.inputs,
      outputs: TEXT_TO_AUDIO_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      text: {
        type: 'string',
        required: false,
        description: '要转换的文本'
      },
      style: {
        type: 'string',
        required: false,
        default: 'natural',
        enum: ['natural', 'female', 'male', 'narration', 'female_soft', 'cute_girl'],
        description: '语音风格'
      },
      speed: {
        type: 'number',
        required: false,
        default: 1.0,
        min: 0.5,
        max: 2.0,
        description: '语速 (0.5-2.0)'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    // 统一处理所有输入端口
    console.log('[TextToAudioNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))

    // 从输入端口获取文本
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(`[TextToAudioNode] Input port '${input.id}' has value:`, typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue)

        if (typeof inputValue === 'object') {
          this.params.text = inputValue.content || inputValue.text || inputValue.description || JSON.stringify(inputValue)
        } else if (typeof inputValue === 'string') {
          this.params.text = inputValue
        }
      }
    }

    const text = this.params.text || ''
    if (!text) {
      throw new Error('请提供要转换的文本')
    }

    const style = this.params.style || 'natural'
    const speed = this.params.speed || 1.0

    // 语音风格映射到 speaker ID
    const VOICE_STYLE_MAP: Record<string, string> = {
      'natural': 'zh_female_xiaohe_uranus_bigtts',
      'female': 'zh_female_xiaohe_uranus_bigtts',
      'male': 'zh_male_m191_uranus_bigtts',
      'narration': 'zh_male_dayi_saturn_bigtts',
      'female_soft': 'zh_female_mizai_saturn_bigtts',
      'cute_girl': 'saturn_zh_female_keainvsheng_tob',
    }

    const speaker = VOICE_STYLE_MAP[style] || VOICE_STYLE_MAP['natural']

    // 获取 Coze 配置 - 优先从内存获取
    let apiKey: string | undefined
    let baseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'

    // 尝试从内存获取配置
    try {
      const { getCozeConfigFromMemory } = await import('@/lib/memory-store')
      const cozeConfig = getCozeConfigFromMemory()
      if (cozeConfig?.apiKey) {
        apiKey = cozeConfig.apiKey
        baseUrl = cozeConfig.baseUrl || baseUrl
        console.log('[TextToAudioNode] Using Coze config from memory, baseUrl:', baseUrl)
      } else {
        console.log('[TextToAudioNode] No Coze config in memory')
      }
    } catch (err) {
      console.log('[TextToAudioNode] Memory config not available:', err)
    }

    // 如果内存没有，尝试从 getServerAIConfig 获取
    if (!apiKey) {
      try {
        const aiConfig = await getServerAIConfig()
        if (aiConfig.apiKey) {
          apiKey = aiConfig.apiKey
          baseUrl = aiConfig.baseUrl || baseUrl
          console.log('[TextToAudioNode] Using Coze config from getServerAIConfig, baseUrl:', baseUrl)
        } else {
          console.log('[TextToAudioNode] No API Key in getServerAIConfig, useSystemDefault:', aiConfig.useSystemDefault)
        }
      } catch (err) {
        console.log('[TextToAudioNode] getServerAIConfig error:', err)
      }
    }

    // 检查环境变量
    if (!apiKey) {
      apiKey = process.env.COZE_API_KEY
      if (apiKey) {
        console.log('[TextToAudioNode] Using API Key from environment variable')
      }
    }

    // 检查是否有 API Key
    if (!apiKey) {
      console.log('[TextToAudioNode] No user API Key configured, will use sandbox default credentials')
    } else {
      console.log(`[TextToAudioNode] Using user API Key: ***${apiKey.slice(-4)}`)
    }

    // 设置 baseUrl（沙盒默认使用 api.coze.cn）
    console.log(`[TextToAudioNode] Using baseUrl: ${baseUrl}`)
    console.log(`[TextToAudioNode] Generating audio with style: ${style}, speaker: ${speaker}`)

    // 使用 Coze TTS - 不传入 apiKey 让 SDK 使用沙盒默认凭证
    const config = new Config({
      baseUrl: baseUrl,
      timeout: 60000,
    })

    const ttsClient = new TTSClient(config)

    try {
      console.log(`[TextToAudioNode] Calling TTS API with text length: ${text.length}`)

      const response = await ttsClient.synthesize({
        uid: `workflow_${Date.now()}`,
        text: text,
        speaker: speaker,
        audioFormat: 'mp3',
        sampleRate: 24000,
      })

      console.log(`[TextToAudioNode] TTS response:`, response)

      if (!response.audioUri) {
        throw new Error('TTS 返回的音频 URI 为空')
      }

      const voiceUrl = response.audioUri
      const voiceSize = response.audioSize

      console.log(`[TextToAudioNode] Audio generated: ${voiceUrl}, size: ${voiceSize} bytes`)

      return {
        type: 'audio',
        url: voiceUrl,
        text,
        style,
        speed,
        size: voiceSize
      }
    } catch (ttsError) {
      console.error('[TextToAudioNode] TTS error:', ttsError)
      const errorMessage = ttsError instanceof Error ? ttsError.message : '未知错误'
      throw new Error(`语音生成失败: ${errorMessage}`)
    }
  }
}

// ============ 脚本分析生成分镜节点 ============

const SCRIPT_TO_SCENES_PORTS = {
  inputs: [{ id: 'script', name: '脚本' }],
  outputs: [{ id: 'scenes', name: '分镜' }]
}

export class ScriptToScenesNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'script-to-scenes',
      name: '脚本分析',
      description: '分析脚本生成分镜',
      inputs: SCRIPT_TO_SCENES_PORTS.inputs,
      outputs: SCRIPT_TO_SCENES_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      script: {
        type: 'string',
        required: false,
        description: '脚本内容'
      },
      numScenes: {
        type: 'number',
        required: false,
        default: 5,
        min: 1,
        max: 20,
        description: '生成分镜数量'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    // 统一处理所有输入端口
    console.log('[ScriptToScenesNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))

    // 从输入端口获取脚本
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(`[ScriptToScenesNode] Input port '${input.id}' has value:`, typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue)

        if (typeof inputValue === 'object') {
          this.params.script = inputValue.content || inputValue.text || inputValue.script || JSON.stringify(inputValue)
        } else if (typeof inputValue === 'string') {
          this.params.script = inputValue
        }
      }
    }

    const script = this.params.script || ''
    if (!script) {
      throw new Error('请提供脚本内容')
    }

    const numScenes = this.params.numScenes || 5
    const projectId = this.params.projectId || context.projectId || 'temp'

    // 获取配置
    const aiConfig = await getServerAIConfig()
    const llmConfig = await getUserLLMConfig()

    // 构建系统提示词
    const systemPrompt = `你是一个专业的短剧视频分镜师。请根据以下脚本内容，生成详细的分镜信息。

请严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "分镜标题",
      "description": "场景画面描述（详细描述环境、光线、构图）",
      "dialogue": "对白内容",
      "action": "动作/表演描述",
      "emotion": "情绪氛围（如：紧张、温馨、悲伤）",
      "shotType": "景别（如：远景、全景、中景、近景、特写）",
      "cameraMovement": "镜头运动（如：固定、推镜、拉镜、摇镜）",
      "characterNames": ["出场人物名称"]
    }
  ]
}

注意：
1. 生成分镜数量建议为 ${numScenes} 个
2. 每个场景应该是一个独立的视频分镜
3. 场景描述要详细，包含视觉元素、光影效果
4. 景别和镜头运动要符合影视剧拍摄规范
5. 这是短剧视频分镜，不是漫画`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请分析以下脚本内容生成分镜：\n\n${script}` },
    ]

    // 调用 LLM
    let responseContent: string | undefined = undefined

    // 检查是否使用自定义 LLM Provider
    const isVolcengineModel = llmConfig.model?.startsWith('doubao-seed-')
    const useCustomLLMProvider = llmConfig.provider &&
      (llmConfig.provider !== 'doubao' || isVolcengineModel)

    if (useCustomLLMProvider && llmConfig.apiKey) {
      try {
        const client = new OpenAICompatibleClient({
          apiKey: llmConfig.apiKey || '',
          baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
          model: llmConfig.model || 'gpt-3.5-turbo',
        })
        responseContent = await client.invoke(messages, { temperature: 0.3 })
      } catch (err) {
        console.warn('[ScriptToScenesNode] Custom LLM failed, falling back to Coze')
      }
    }

    if (!responseContent) {
      // 使用 Coze/豆包模型
      const cozeDirectConfig = await getCozeDirectConfig()
      const shouldUseCozeDirect = (llmConfig.provider === 'doubao' || !llmConfig.provider) &&
        cozeDirectConfig?.botId && cozeDirectConfig?.apiKey

      if (shouldUseCozeDirect) {
        responseContent = await invokeCozeDirect(messages, cozeDirectConfig)
      } else if (aiConfig.apiKey) {
        responseContent = await invokeLLM(messages, {
          model: aiConfig.model,
          temperature: 0.3,
        }, {
          apiKey: aiConfig.apiKey,
          baseUrl: aiConfig.baseUrl,
          model: aiConfig.model,
        })
      } else {
        responseContent = await invokeLLM(messages, {
          model: aiConfig.model,
          temperature: 0.3,
        })
      }
    }

    console.log(`[ScriptToScenesNode] Raw response length: ${responseContent?.length || 0}`)

    // 解析 JSON
    const result = parseLLMJson<{ scenes: any[] }>(responseContent || '{}')

    // 获取现有分镜数量（用于计算 scene_number）
    let existingSceneCount = 0
    try {
      const client = getSupabaseClient()
      const { count } = await client
        .from('scenes')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
      existingSceneCount = count || 0
    } catch (err) {
      console.warn('[ScriptToScenesNode] Failed to get existing scene count:', err)
      // 回退到内存计数
      existingSceneCount = memoryScenes.filter(s => s.projectId === projectId).length
    }

    // 生成场景 ID 并尝试保存到数据库
    const scenes: any[] = []
    let dbSavedCount = 0

    for (let i = 0; i < (result?.scenes || []).length; i++) {
      const scene: Record<string, any> = result.scenes[i]
      const sceneId = `scene_${generateId()}`
      const sceneNumber = existingSceneCount + i + 1

      // 构建元数据
      const metadata: Record<string, any> = {}
      if (scene.shotType) {
        metadata.shotType = scene.shotType
      }
      if (scene.cameraMovement) {
        metadata.cameraMovement = scene.cameraMovement
      }
      if (scene.characterNames && Array.isArray(scene.characterNames)) {
        metadata.characterNames = scene.characterNames
      }

      const savedScene: any = {
        id: sceneId,
        projectId,
        sceneNumber,
        title: scene.title || `分镜 ${sceneNumber}`,
        description: scene.description,
        dialogue: scene.dialogue || '',
        action: scene.action || '',
        emotion: scene.emotion || '',
        metadata,
        createdAt: new Date().toISOString(),
      }

      // 尝试保存到数据库
      let sceneDbId: string | null = null
      try {
        const client = getSupabaseClient()
        const dbData = {
          id: sceneId,
          project_id: projectId,
          scene_number: sceneNumber,
          title: savedScene.title,
          description: savedScene.description,
          dialogue: savedScene.dialogue,
          action: savedScene.action,
          emotion: savedScene.emotion,
          character_ids: scene.characterNames || [],
          metadata: metadata,
          status: 'pending',
        }

        const { data: dbScene, error } = await client
          .from('scenes')
          .insert(dbData)
          .select()
          .single()

        if (!error && dbScene) {
          console.log(`[ScriptToScenesNode] Scene saved to database: ${dbScene.id}`)
          sceneDbId = dbScene.id
          savedScene.id = dbScene.id // 使用数据库 ID
          dbSavedCount++
        } else {
          console.warn('[ScriptToScenesNode] Failed to save scene to database:', error?.message)
        }
      } catch (err) {
        console.warn('[ScriptToScenesNode] Database save failed for scene:', err)
      }

      // 保存到内存（作为 fallback 或补充）
      memoryScenes.push(savedScene)
      scenes.push(savedScene)
    }

    console.log(`[ScriptToScenesNode] Generated ${scenes.length} scenes, ${dbSavedCount} saved to database`)

    return {
      type: 'scenes',
      scenes: scenes,
      count: scenes.length,
      dbSaved: dbSavedCount > 0,
    }
  }
}

// ============ LLM 处理节点 ============

const LLM_PROCESS_PORTS = {
  inputs: [{ id: 'input', name: '输入' }],
  outputs: [{ id: 'output', name: '输出' }]
}

export class LLMProcessNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'llm-process',
      name: 'LLM 处理',
      description: '使用大语言模型处理输入',
      inputs: LLM_PROCESS_PORTS.inputs,
      outputs: LLM_PROCESS_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      prompt: {
        type: 'string',
        required: false,
        description: '提示词/指令'
      },
      systemPrompt: {
        type: 'string',
        required: false,
        default: '你是一个有用的AI助手。',
        description: '系统提示词'
      },
      temperature: {
        type: 'number',
        required: false,
        default: 0.7,
        min: 0,
        max: 2,
        description: '温度 (0-2)'
      },
      model: {
        type: 'string',
        required: false,
        description: '模型名称（可选，使用配置默认模型）'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    // 统一处理所有输入端口
    console.log('[LLMProcessNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))

    // 从输入端口获取输入
    let inputText = ''
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(`[LLMProcessNode] Input port '${input.id}' has value:`, typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue)

        if (typeof inputValue === 'object') {
          inputText = inputValue.content || inputValue.text || inputValue.description || JSON.stringify(inputValue)
        } else if (typeof inputValue === 'string') {
          inputText = inputValue
        }
      }
    }

    const systemPrompt = this.params.systemPrompt || '你是一个有用的AI助手。'
    const userPrompt = this.params.prompt || ''
    const temperature = this.params.temperature ?? 0.7
    const model = this.params.model

    // 构建消息
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // 如果有输入文本，添加到用户消息
    if (inputText) {
      if (userPrompt) {
        messages.push({ role: 'user', content: `${userPrompt}\n\n${inputText}` })
      } else {
        messages.push({ role: 'user', content: inputText })
      }
    } else if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt })
    } else {
      throw new Error('请提供输入文本或提示词')
    }

    // 获取配置
    const aiConfig = await getServerAIConfig()
    const llmConfig = await getUserLLMConfig()

    // 调用 LLM
    let responseContent: string | undefined = undefined

    // 检查是否使用自定义 LLM Provider
    const isVolcengineModel = llmConfig.model?.startsWith('doubao-seed-')
    const useCustomLLMProvider = llmConfig.provider &&
      (llmConfig.provider !== 'doubao' || isVolcengineModel)

    if (useCustomLLMProvider && llmConfig.apiKey) {
      try {
        const client = new OpenAICompatibleClient({
          apiKey: llmConfig.apiKey || '',
          baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
          model: model || llmConfig.model,
        })
        responseContent = await client.invoke(messages, { temperature })
      } catch (err) {
        console.warn('[LLMProcessNode] Custom LLM failed, falling back to Coze')
      }
    }

    if (!responseContent) {
      // 使用 Coze/豆包模型
      const cozeDirectConfig = await getCozeDirectConfig()
      const shouldUseCozeDirect = (llmConfig.provider === 'doubao' || !llmConfig.provider) &&
        cozeDirectConfig?.botId && cozeDirectConfig?.apiKey

      if (shouldUseCozeDirect) {
        responseContent = await invokeCozeDirect(messages, cozeDirectConfig)
      } else if (aiConfig.apiKey) {
        responseContent = await invokeLLM(messages, {
          model: model || aiConfig.model,
          temperature,
        }, {
          apiKey: aiConfig.apiKey,
          baseUrl: aiConfig.baseUrl,
          model: model || aiConfig.model,
        })
      } else {
        responseContent = await invokeLLM(messages, {
          model: model || aiConfig.model,
          temperature,
        })
      }
    }

    console.log(`[LLMProcessNode] Response length: ${responseContent?.length || 0}`)

    return {
      type: 'text',
      content: responseContent,
      text: responseContent
    }
  }
}

// ============ 视频合成节点 ============

const VIDEO_COMPOSE_PORTS = {
  inputs: [{ id: 'videos', name: '视频列表' }],
  outputs: [{ id: 'video', name: '视频' }]
}

export class VideoComposeNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'video-compose',
      name: '视频合成',
      description: '合并多个视频片段',
      inputs: VIDEO_COMPOSE_PORTS.inputs,
      outputs: VIDEO_COMPOSE_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      videos: {
        type: 'any',
        required: false,
        description: '视频列表'
      },
      outputName: {
        type: 'string',
        required: false,
        default: 'composed_video',
        description: '输出文件名'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    // 统一处理所有输入端口
    console.log('[VideoComposeNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))

    // 从输入端口获取视频列表
    let videoList: string[] = []
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(`[VideoComposeNode] Input port '${input.id}' has value:`, typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue)

        if (Array.isArray(inputValue)) {
          videoList = inputValue.map(v => typeof v === 'string' ? v : v.url)
        } else if (typeof inputValue === 'object') {
          if (inputValue.scenes && Array.isArray(inputValue.scenes)) {
            videoList = inputValue.scenes
              .filter((s: any) => s.videoUrl)
              .map((s: any) => s.videoUrl)
          } else if (inputValue.url) {
            videoList = [inputValue.url]
          } else if (inputValue.video) {
            videoList = [inputValue.video]
          }
        } else if (typeof inputValue === 'string') {
          videoList = [inputValue]
        }
      }
    }

    // 也从参数获取视频列表
    if (this.params.videos) {
      if (Array.isArray(this.params.videos)) {
        videoList = [...videoList, ...this.params.videos.map((v: any) => typeof v === 'string' ? v : v.url)]
      }
    }

    if (videoList.length === 0) {
      throw new Error('请提供要合成的视频列表')
    }

    // 过滤掉空值
    videoList = videoList.filter(Boolean)
    if (videoList.length === 0) {
      throw new Error('视频列表为空，请确保视频已生成')
    }

    console.log(`[VideoComposeNode] Composing ${videoList.length} videos`)

    // 创建临时文件
    const tempDir = '/tmp/workflow-videos'
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const outputName = this.params.outputName || 'composed_video'
    const outputPath = `${tempDir}/${outputName}_${Date.now()}.mp4`
    const concatListPath = `${tempDir}/concat_${Date.now()}.txt`

    try {
      // 下载视频到本地
      const localVideos: string[] = []
      for (let i = 0; i < videoList.length; i++) {
        const videoUrl = videoList[i]
        const localPath = `${tempDir}/video_${Date.now()}_${i}.mp4`

        console.log(`[VideoComposeNode] Downloading video ${i + 1}: ${videoUrl}`)

        // 使用 curl 下载视频
        await execAsync(`curl -s -L -o "${localPath}" "${videoUrl}"`)

        // 检查文件是否下载成功
        if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
          throw new Error(`视频 ${i + 1} 下载失败`)
        }

        localVideos.push(localPath)
      }

      // 创建 FFmpeg concat 文件
      const concatContent = localVideos.map(v => `file '${v}'`).join('\n')
      fs.writeFileSync(concatListPath, concatContent)

      console.log(`[VideoComposeNode] Running FFmpeg concat...`)

      // 使用 FFmpeg 合并视频
      await execAsync(`ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}" -y`)

      // 检查输出文件
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error('视频合成失败')
      }

      // 读取输出文件
      const outputBuffer = fs.readFileSync(outputPath)
      const storagePath = `workflow/video-compose/${outputName}_${Date.now()}.mp4`

      let finalUrl = outputPath
      try {
        // 使用 ali-oss SDK 上传视频
        const OSS = await import('ali-oss')
        const ossClient = new OSS.default({
          region: process.env.S3_REGION || 'oss-cn-chengdu',
          accessKeyId: process.env.S3_ACCESS_KEY || '',
          accessKeySecret: process.env.S3_SECRET_KEY || '',
          bucket: process.env.S3_BUCKET || 'drama-studio',
          secure: true,
        })

        // 上传视频
        await ossClient.put(storagePath, outputBuffer)

        // 设置为公开读取
        await ossClient.putACL(storagePath, 'public-read')

        // 生成公网 URL
        const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
        finalUrl = `${endpoint}/${storagePath}`

        console.log(`[VideoComposeNode] Uploaded to storage: ${finalUrl}`)
      } catch (storageError) {
        console.warn('[VideoComposeNode] Failed to upload to storage, using local path')
      }

      console.log(`[VideoComposeNode] Composed video: ${finalUrl}`)

      // 清理临时文件
      localVideos.forEach(v => {
        try { fs.unlinkSync(v) } catch {}
      })
      try { fs.unlinkSync(concatListPath) } catch {}

      return {
        type: 'video',
        url: finalUrl,
        duration: 0
      }
    } catch (error) {
      console.error('[VideoComposeNode] Error:', error)

      // 清理临时文件
      try { fs.unlinkSync(concatListPath) } catch {}

      // 如果 FFmpeg 不可用，返回第一个视频作为降级方案
      if (videoList.length > 0) {
        console.log('[VideoComposeNode] FFmpeg not available, returning first video as fallback')
        return {
          type: 'video',
          url: videoList[0],
          warning: '视频合成失败，返回原始视频'
        }
      }

      throw error
    }
  }
}

// ============ 角色生成节点 ============

const TEXT_TO_CHARACTER_PORTS = {
  inputs: [{ id: 'description', name: '角色描述' }],
  outputs: [
    { id: 'character', name: '角色' },
    { id: 'image', name: '图像' }
  ]
}

export class TextToCharacterNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'text-to-character',
      name: '角色生成',
      description: '根据描述创建角色',
      inputs: TEXT_TO_CHARACTER_PORTS.inputs,
      outputs: TEXT_TO_CHARACTER_PORTS.outputs,
      ...config
    })
  }

  getParamSchema() {
    return {
      description: {
        type: 'string',
        required: false,
        description: '角色描述'
      },
      style: {
        type: 'string',
        required: false,
        default: 'realistic',
        enum: ['realistic', 'anime', 'cartoon', 'oil_painting'],
        description: '图像风格'
      },
      name: {
        type: 'string',
        required: false,
        description: '角色名称（可选）'
      },
      personality: {
        type: 'string',
        required: false,
        description: '性格特点（可选）'
      }
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    // 统一处理所有输入端口
    console.log('[TextToCharacterNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))

    // 从输入端口获取描述
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(`[TextToCharacterNode] Input port '${input.id}' has value:`, typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue)

        if (typeof inputValue === 'object') {
          // 支持多种输入格式
          // { type: 'text', content: '...' } - 从文本输入节点传入
          // { description: '...' } - 直接描述对象
          // { name: '...' } - 角色名称
          // { personality: '...' } - 性格特点
          if (inputValue.content) {
            // 从 content 字段获取文本内容（如 TextInput 节点输出）
            this.params.description = inputValue.content
          }
          if (inputValue.description) {
            this.params.description = inputValue.description
          }
          if (inputValue.name) {
            this.params.name = inputValue.name
          }
          if (inputValue.personality) {
            this.params.personality = inputValue.personality
          }
        } else if (typeof inputValue === 'string') {
          this.params.description = inputValue
        }
      }
    }

    let description = this.params.description || ''
    const style = this.params.style || 'realistic'
    const name = this.params.name || ''
    const personality = this.params.personality || ''
    const projectId = this.params.projectId || context.projectId || 'temp'

    // 如果描述为空，尝试从输入生成
    if (!description) {
      if (name || personality) {
        description = `角色${name ? ` "${name}"` : ''}：${personality || '一个有趣的角色'}`
      } else {
        throw new Error('请提供角色描述')
      }
    }

    console.log(`[TextToCharacterNode] Generating character with description: ${description.substring(0, 100)}...`)

    // 生成角色图像
    let imageUrl: string | undefined
    let frontViewKey: string | undefined

    try {
      const result = await generateImage(
        `${description}，角色立绘，人物特写，写实风格`,
        { size: '2K' }
      )
      imageUrl = result.urls[0]

      // 上传到存储
      try {
        const storageUrl = await uploadImageToStorage(imageUrl, `workflow/character/${Date.now()}.png`)
        if (storageUrl) {
          imageUrl = storageUrl
          // 提取 key
          if (storageUrl.includes('workflow/character/')) {
            frontViewKey = storageUrl.split('workflow/character/')[1]
          }
        }
      } catch (err) {
        console.warn('[TextToCharacterNode] Failed to upload to storage')
      }
    } catch (error) {
      console.error('[TextToCharacterNode] Image generation failed:', error)
    }

    // 保存角色到人物库
    const characterId = `char_${generateId()}`
    const characterName = name || `角色_${Date.now()}`
    const character: any = {
      id: characterId,
      projectId,
      name: characterName,
      description,
      personality,
      style,
      imageUrl,
      createdAt: new Date().toISOString(),
    }

    // 通过 API 保存到人物库（复用 character-library API 路由）
    let dbSaved = false
    let savedToLibrary = false
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'
      console.log('[TextToCharacterNode] Saving to character library via API...')
      
      const response = await fetch(`${apiUrl}/api/character-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: characterName,
          description: description,
          appearance: description,
          personality: personality,
          style: style,
          imageUrl: imageUrl,
          frontViewKey: frontViewKey,
          tags: [],
        }),
      })
      
      const result = await response.json()
      console.log('[TextToCharacterNode] API response:', result)
      
      if (result.success && result.data?.character) {
        console.log(`[TextToCharacterNode] Character saved to character_library via API: ${result.data.character.id}`)
        character.dbId = result.data.character.id
        character.id = result.data.character.id
        savedToLibrary = true
        dbSaved = true
      } else {
        console.warn('[TextToCharacterNode] Failed to save to character_library via API:', result.error)
      }
    } catch (err) {
      console.warn('[TextToCharacterNode] API save failed:', err)
    }

    // 保存到内存（作为 fallback 或补充）
    if (!dbSaved) {
      memoryCharacters.push(character)
    }

    console.log(`[TextToCharacterNode] Created character: ${character.name} (${savedToLibrary ? 'character_library' : 'memory'})`)

    // 返回友好提示，告知用户角色已保存到人物库
    const message = savedToLibrary 
      ? `角色"${characterName}"已创建并保存到人物库，请前往人物库页面查看和管理`
      : `角色"${characterName}"已创建（临时保存）`

    return {
      type: 'character',
      character: character,
      image: imageUrl ? { type: 'image', url: imageUrl } : undefined,
      dbSaved,
      message, // 输出友好提示信息
      libraryUrl: '/characters', // 提供人物库链接
    }
  }
}
