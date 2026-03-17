/**
 * 工作流节点定义
 * 提供内容分析、人物提取、分镜生成等核心节点
 */

import { workflowEngine, type ExecutionContext } from './engine'
import { invokeLLM, parseLLMJson, getAIConfig } from '@/lib/ai'
import { uploadFile, generateKey } from '@/lib/storage'
import { ProjectService, CharacterService, SceneService } from '@/lib/db'
import { Errors, logger } from '@/lib/errors'

// ============================================
// 分析节点
// ============================================

workflowEngine.registerNode({
  type: 'analyze_content',
  category: 'analysis',
  displayName: '内容分析',
  description: '分析小说/剧本内容，提取故事结构',
  inputs: [
    { name: 'content', type: 'string', required: true, description: '输入文本内容' },
  ],
  outputs: [
    { name: 'summary', type: 'string', description: '故事摘要' },
    { name: 'themes', type: 'array', description: '主题标签' },
    { name: 'tone', type: 'string', description: '整体基调' },
    { name: 'structure', type: 'object', description: '故事结构' },
  ],
  execute: async (inputs, context) => {
    const content = inputs.content as string
    if (!content) throw Errors.ValidationError('缺少内容输入')

    const config = await getAIConfig('llm')
    const settings = await ProjectService.get(context.projectId).then(p => p?.metadata?.settings)

    const prompt = `你是一个专业的剧本分析专家。请分析以下故事内容，提取关键信息。

故事内容：
${content.slice(0, 10000)}

请以 JSON 格式返回：
{
  "summary": "故事摘要（100-200字）",
  "themes": ["主题1", "主题2"],
  "tone": "整体基调（如：温馨、悬疑、幽默）",
  "structure": {
    "type": "三幕式/线性/倒叙等",
    "climax": "高潮描述",
    "ending": "结局类型"
  }
}`

    const response = await invokeLLM(config, [{ role: 'user', content: prompt }])
    const result = parseLLMJson<{
      summary: string
      themes: string[]
      tone: string
      structure: Record<string, unknown>
    }>(response)

    return result
  },
})

workflowEngine.registerNode({
  type: 'extract_characters',
  category: 'analysis',
  displayName: '人物提取',
  description: '从内容中提取人物信息',
  inputs: [
    { name: 'content', type: 'string', required: true, description: '输入文本内容' },
    { name: 'existingCharacters', type: 'array', description: '已有人物列表' },
  ],
  outputs: [
    { name: 'characters', type: 'array', description: '提取的人物列表' },
  ],
  execute: async (inputs, context) => {
    const content = inputs.content as string
    const existing = (inputs.existingCharacters || []) as Array<{ name: string }>

    const config = await getAIConfig('llm')

    const prompt = `你是一个专业的人物设计师。请从以下故事中提取主要人物。

故事内容：
${content.slice(0, 10000)}

${existing.length > 0 ? `已有人物：${existing.map(c => c.name).join('、')}\n请识别这些人物，并补充新人物。` : ''}

请以 JSON 格式返回人物数组：
[
  {
    "name": "人物名称",
    "description": "人物简介",
    "appearance": "外貌描述（详细，用于图像生成）",
    "personality": "性格特点",
    "tags": ["标签1", "标签2"],
    "isExisting": false
  }
]

注意：
1. 只提取有台词或重要动作的人物
2. appearance 需要足够详细，包含服装、发型、体型等
3. 如果是已有人物，isExisting 设为 true`

    const response = await invokeLLM(config, [{ role: 'user', content: prompt }])
    const characters = parseLLMJson<Array<{
      name: string
      description: string
      appearance: string
      personality: string
      tags: string[]
      isExisting?: boolean
    }>>(response)

    return { characters }
  },
})

workflowEngine.registerNode({
  type: 'generate_storyboard',
  category: 'generation',
  displayName: '分镜生成',
  description: '将故事拆分为分镜脚本',
  inputs: [
    { name: 'content', type: 'string', required: true, description: '输入文本内容' },
    { name: 'characters', type: 'array', description: '人物列表' },
    { name: 'style', type: 'string', default: 'cinematic', description: '分镜风格' },
    { name: 'episodeCount', type: 'number', default: 1, description: '集数' },
  ],
  outputs: [
    { name: 'scenes', type: 'array', description: '分镜列表' },
  ],
  execute: async (inputs, context) => {
    const content = inputs.content as string
    const characters = (inputs.characters || []) as Array<{ name: string }>
    const style = (inputs.style || 'cinematic') as string
    const episodeCount = (inputs.episodeCount || 1) as number

    const config = await getAIConfig('llm')

    const prompt = `你是一个专业的分镜师。请将以下故事内容拆分为分镜脚本。

故事内容：
${content.slice(0, 10000)}

人物：${characters.map(c => c.name).join('、')}
风格：${style === 'cinematic' ? '电影感' : style === 'anime' ? '动漫风' : '写实'}
${episodeCount > 1 ? `分为 ${episodeCount} 集` : ''}

请以 JSON 格式返回分镜数组：
[
  {
    "sceneNumber": 1,
    "title": "场景标题",
    "description": "场景描述（用于图像生成，需要详细）",
    "dialogue": "对白（如有）",
    "action": "动作描述",
    "emotion": "情感/氛围",
    "characters": ["出场人物"],
    "shotType": "镜头类型（远景/中景/近景/特写）",
    "duration": 预估时长（秒）
  }
]

要求：
1. 每个场景时长 3-8 秒
2. description 需要包含环境、光线、构图等细节
3. 确保故事的连贯性和节奏感
4. 每集结尾有适当的悬念或过渡`

    const response = await invokeLLM(config, [{ role: 'user', content: prompt }])
    const scenes = parseLLMJson<Array<{
      sceneNumber: number
      title: string
      description: string
      dialogue: string
      action: string
      emotion: string
      characters: string[]
      shotType: string
      duration: number
    }>>(response)

    return { scenes }
  },
})

workflowEngine.registerNode({
  type: 'generate_character_image',
  category: 'generation',
  displayName: '人物图像生成',
  description: '生成人物参考图像',
  inputs: [
    { name: 'character', type: 'object', required: true, description: '人物信息' },
    { name: 'style', type: 'string', default: 'realistic', description: '图像风格' },
  ],
  outputs: [
    { name: 'imageUrl', type: 'string', description: '生成的图像 URL' },
    { name: 'characterId', type: 'string', description: '人物 ID' },
  ],
  execute: async (inputs, context) => {
    const character = inputs.character as {
      id?: string
      name: string
      appearance: string
      tags?: string[]
    }
    const style = (inputs.style || 'realistic') as string

    // 调用图像生成 API
    const config = await getAIConfig('image')
    // TODO: 调用实际的图像生成 API
    // 这里需要根据 SDK 文档实现

    const prompt = `Character portrait: ${character.appearance}, ${style} style, high quality, detailed face`

    // 模拟生成（实际应调用 API）
    logger.info('Generating character image', { characterId: character.id, name: character.name })

    // 实际实现中应该调用图像生成 API 并上传
    const imageUrl = character.id 
      ? `/api/characters/${character.id}/reference.png`
      : undefined

    return {
      imageUrl,
      characterId: character.id,
    }
  },
})

workflowEngine.registerNode({
  type: 'generate_scene_image',
  category: 'generation',
  displayName: '分镜图像生成',
  description: '生成分镜场景图像',
  inputs: [
    { name: 'scene', type: 'object', required: true, description: '分镜信息' },
    { name: 'characters', type: 'array', description: '人物列表（含图像）' },
    { name: 'style', type: 'string', default: 'cinematic', description: '图像风格' },
  ],
  outputs: [
    { name: 'imageUrl', type: 'string', description: '生成的图像 URL' },
    { name: 'sceneId', type: 'string', description: '分镜 ID' },
  ],
  execute: async (inputs, context) => {
    const scene = inputs.scene as {
      id?: string
      description: string
      characters?: string[]
      shotType?: string
    }
    const characters = (inputs.characters || []) as Array<{
      name: string
      imageUrl?: string
      appearance?: string
    }>
    const style = (inputs.style || 'cinematic') as string

    // 构建提示词
    let prompt = scene.description
    
    // 添加人物信息
    const sceneCharacters = characters.filter(c => 
      scene.characters?.includes(c.name)
    )
    
    if (sceneCharacters.length > 0) {
      prompt += `\nCharacters: ${sceneCharacters.map(c => c.appearance).join(', ')}`
    }

    // 添加镜头类型
    if (scene.shotType) {
      const shotMapping: Record<string, string> = {
        '远景': 'wide shot, establishing shot',
        '中景': 'medium shot',
        '近景': 'close-up shot',
        '特写': 'extreme close-up',
      }
      prompt += `, ${shotMapping[scene.shotType] || scene.shotType}`
    }

    prompt += `, ${style} style, high quality, cinematic lighting`

    // TODO: 调用实际的图像生成 API
    logger.info('Generating scene image', { sceneId: scene.id, prompt })

    return {
      imageUrl: scene.id ? `/api/scenes/${scene.id}/image.png` : undefined,
      sceneId: scene.id,
    }
  },
})

workflowEngine.registerNode({
  type: 'generate_video',
  category: 'generation',
  displayName: '视频生成',
  description: '从图像生成视频',
  inputs: [
    { name: 'imageUrl', type: 'string', required: true, description: '图像 URL' },
    { name: 'prompt', type: 'string', description: '动作提示' },
    { name: 'duration', type: 'number', default: 5, description: '视频时长' },
  ],
  outputs: [
    { name: 'videoUrl', type: 'string', description: '生成的视频 URL' },
  ],
  execute: async (inputs, context) => {
    const imageUrl = inputs.imageUrl as string
    const prompt = (inputs.prompt || '') as string
    const duration = (inputs.duration || 5) as number

    if (!imageUrl) throw Errors.ValidationError('缺少图像 URL')

    // TODO: 调用视频生成 API
    logger.info('Generating video', { imageUrl, prompt, duration })

    return {
      videoUrl: imageUrl.replace('.png', '.mp4'),
    }
  },
})

// 导出节点类型供前端使用
export const NODE_CATEGORIES = {
  analysis: {
    name: '分析',
    color: '#3b82f6',
    nodes: ['analyze_content', 'extract_characters'],
  },
  generation: {
    name: '生成',
    color: '#10b981',
    nodes: ['generate_storyboard', 'generate_character_image', 'generate_scene_image', 'generate_video'],
  },
}

export function getNodesByCategory(): Record<string, Array<{ type: string; displayName: string; description: string }>> {
  const result: Record<string, Array<{ type: string; displayName: string; description: string }>> = {}
  
  for (const [category, config] of Object.entries(NODE_CATEGORIES)) {
    result[category] = config.nodes.map(type => {
      const def = workflowEngine.getNodeDefinition(type)!
      return {
        type,
        displayName: def.displayName,
        description: def.description,
      }
    })
  }
  
  return result
}
