/**
 * 文本输入节点
 */

import { BaseNodeClass } from '../node/BaseNode'
import { ExecutionContext } from '../types'

export class TextInputNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'text-input',
      name: '文本输入',
      description: '输入文本内容',
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

  validateParams(): { valid: boolean; errors: string[] } {
    const schema = this.getParamSchema()
    const errors: string[] = []

    // 检查 prompt 是否有值（要么从参数，要么从输入端口）
    const promptInput = this.inputs.find((inp: any) => inp.id === 'prompt')
    const hasPromptInput = promptInput && promptInput.value !== undefined && promptInput.value !== null && promptInput.value !== ''
    const hasPromptParam = this.params.prompt !== undefined && this.params.prompt !== null && this.params.prompt !== ''

    if (!hasPromptInput && !hasPromptParam) {
      errors.push('prompt 是必填的（请从输入端口连接或手动填写）')
    }

    // 检查其他参数
    for (const [key, spec] of Object.entries(schema)) {
      if (key === 'prompt') continue  // 已经在上面检查过了

      const value = this.params[key]

      // 检查必填参数
      if (spec.required && (value === undefined || value === null || value === '')) {
        errors.push(`参数 "${key}" 是必填的`)
        continue
      }

      // 检查参数类型
      if (value !== undefined && value !== null) {
        if (spec.type === 'number' && typeof value !== 'number') {
          errors.push(`参数 "${key}" 应该是数字类型`)
        }
        if (spec.type === 'string' && typeof value !== 'string') {
          errors.push(`参数 "${key}" 应该是字符串类型`)
        }
        if (spec.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`参数 "${key}" 应该是布尔类型`)
        }
        if (spec.type === 'array' && !Array.isArray(value)) {
          errors.push(`参数 "${key}" 应该是数组类型`)
        }
      }

      // 检查选项值
      if ('enum' in spec && spec.enum && value !== undefined && !(spec.enum as any[]).includes(value)) {
        errors.push(`参数 "${key}" 的值 "${value}" 不在允许的选项中: ${(spec.enum as any[]).join(', ')}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    const text = this.params.text || ''
    return { type: 'text', content: text }
  }
}

/**
 * 图片输入节点
 */

import { BaseNodeClass as BaseNodeClass2 } from '../node/BaseNode'

export class ImageInputNode extends BaseNodeClass2 {
  constructor(config: any) {
    super({
      type: 'image-input',
      name: '图片输入',
      description: '上传或选择图片',
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

/**
 * 文生图节点
 */

import { BaseNodeClass as BaseNodeClass3 } from '../node/BaseNode'
import { generateImage } from '@/lib/ai'

export class TextToImageNode extends BaseNodeClass3 {
  constructor(config: any) {
    super({
      type: 'text-to-image',
      name: '文生图',
      description: '根据文本生成图片',
      ...config
    })
  }

  getParamSchema() {
    return {
      prompt: {
        type: 'string',
        required: false,  // 改为可选，因为可以从输入端口获取
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
    // 优先从输入端口获取 prompt，如果没有则从参数获取
    let prompt = this.params.prompt

    // 检查输入端口是否有连接
    const promptInput = this.inputs.find((inp: any) => inp.id === 'prompt')
    if (promptInput && promptInput.value) {
      // 如果输入端口有值（来自上游节点），使用输入值
      prompt = promptInput.value
    }

    const style = this.params.style || 'realistic'
    const size = this.params.size || '2K'
    const referenceImage = this.params.referenceImage

    // 构建完整提示词
    let fullPrompt = prompt
    if (style === 'realistic') {
      fullPrompt += '，写实风格，真实感，细腻的皮肤纹理，光影效果自然'
    } else if (style === 'anime') {
      fullPrompt += '，动漫风格，二次元，精美的线条，明亮的色彩'
    } else if (style === 'cartoon') {
      fullPrompt += '，卡通风格，可爱，活泼，圆润的线条'
    } else if (style === 'oil_painting') {
      fullPrompt += '，油画风格，厚重的笔触，丰富的色彩层次'
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

    const imageUrl = result.urls[0]

    return {
      type: 'image',
      url: imageUrl,
      prompt,
      style,
      size
    }
  }
}

/**
 * 图生视频节点
 */

import { BaseNodeClass as BaseNodeClass4 } from '../node/BaseNode'
import { generateVideoFromImage } from '@/lib/ai'

export class ImageToVideoNode extends BaseNodeClass4 {
  constructor(config: any) {
    super({
      type: 'image-to-video',
      name: '图生视频',
      description: '根据图片生成视频',
      ...config
    })
  }

  getParamSchema() {
    return {
      firstFrame: {
        type: 'string',
        required: true,
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
    const firstFrame = this.params.firstFrame
    const lastFrame = this.params.lastFrame
    const prompt = this.params.prompt || ''

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

    return {
      type: 'video',
      url: result.videoUrl,
      lastFrameUrl: result.lastFrameUrl,
      duration: this.params.duration,
      ratio: this.params.ratio
    }
  }
}
