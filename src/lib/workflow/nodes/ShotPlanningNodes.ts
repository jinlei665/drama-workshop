/**
 * 剧本分镜 V2 节点实现
 * 包含 Shot 规划节点和分镜生成 V2 节点
 */

import { BaseNodeClass } from '../node/BaseNode'
import { ExecutionContext } from '../types'
import {
  ShotPlan,
  SceneV2,
  ShotSegment,
  calculateSceneDuration,
  generateSeedancePrompt,
} from '@/lib/types/storyboard'

// 导入 AI 相关
import { invokeLLM, parseLLMJson, getUserLLMConfig, getServerAIConfig } from '@/lib/ai'
import { invokeCozeDirect, getCozeDirectConfig } from '@/lib/ai/coze-direct'
import { OpenAICompatibleClient } from '@/lib/ai/openai-compatible'

// ============ PlanShotCountNode ============

const PLAN_SHOT_COUNT_PORTS = {
  inputs: [
    { id: 'content', name: '剧本内容', type: 'text' as const, required: true, connected: false },
  ],
  outputs: [
    { id: 'shotPlan', name: 'Shot规划', type: 'any' as const, required: false, connected: false },
    { id: 'sceneAudit', name: '场景审计', type: 'any' as const, required: false, connected: false },
    { id: 'specialNotes', name: '特殊说明', type: 'any' as const, required: false, connected: false },
  ],
}

export class PlanShotCountNode extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'plan-shot-count',
      name: 'Shot数量规划',
      description: '分析剧本进行 Shot 数量规划和时长估算',
      inputs: PLAN_SHOT_COUNT_PORTS.inputs,
      outputs: PLAN_SHOT_COUNT_PORTS.outputs,
      ...config,
    })
  }

  getParamSchema() {
    return {
      content: {
        type: 'string',
        required: false,
        description: '剧本内容',
      },
      targetDuration: {
        type: 'number',
        required: false,
        default: 60,
        description: '目标时长（秒）',
      },
      videoType: {
        type: 'string',
        required: false,
        default: 'short-drama',
        enum: ['short-drama', 'commercial', 'music-video', 'default'],
        description: '视频类型',
      },
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    console.log('[PlanShotCountNode] Processing inputs:', JSON.stringify(this.inputs, null, 2))

    // 从输入端口获取剧本内容
    let content = ''
    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(
          `[PlanShotCountNode] Input port '${input.id}' has value:`,
          typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue
        )

        if (typeof inputValue === 'object') {
          content = inputValue.content || inputValue.text || inputValue.script || JSON.stringify(inputValue)
        } else if (typeof inputValue === 'string') {
          content = inputValue
        }
      }
    }

    // 如果没有从输入获取到，使用参数
    if (!content) {
      content = this.params.content || ''
    }

    if (!content) {
      throw new Error('请提供剧本内容')
    }

    const targetDuration = this.params.targetDuration || 60
    const videoType = this.params.videoType || 'short-drama'

    // 获取配置
    const aiConfig = await getServerAIConfig()
    const llmConfig = await getUserLLMConfig()

    // 构建系统提示词
    const systemPrompt = `你是一个专业的短剧视频策划师。请分析剧本内容，进行 Shot 数量规划和时长估算。

请严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "sceneAudit": {
    "totalScenes": 场景总数（数字）,
    "estimatedDurationMs": 估算总时长（毫秒）,
    "sceneBreakdown": [
      {
        "sceneNumber": 分镜编号,
        "estimatedDurationMs": 估算时长（毫秒）,
        "complexity": "场景复杂度（low/medium/high）"
      }
    ]
  },
  "shotPlan": [
    {
      "sceneNumber": 分镜编号,
      "shotCount": 该分镜需要的 Shot 数量,
      "totalDurationMs": 该分镜总时长（毫秒）,
      "shotTypes": ["镜头类型列表，如 long/medium/close-up 等"]
    }
  ],
  "specialNotes": ["特殊说明列表"]
}

## 分析原则

### 1. 物理空间识别
- 识别剧本中描述的不同物理空间（如：客厅、办公室、街道等）
- 同一物理空间的连续动作可以合并为一个分镜
- 不同物理空间的变化必然导致分镜切换

### 2. 场景合并决策
- 对话场景：根据对话长度和情绪复杂度决定分镜数量
- 动作场景：复杂动作拆分为多个 Shot
- 情感场景：可合并多个短动作到一个 Shot

### 3. 时长规划
- 短视频每个 Shot 平均 3-5 秒
- 对话场景：每句对话 2-3 秒
- 动作场景：每个动作 2-4 秒
- 目标总时长：${targetDuration} 秒

### 4. 视频类型影响
- 短剧 (short-drama): 节奏紧凑，Shot 数量适中
- 商业广告 (commercial): 节奏快，Shot 数量多
- 音乐MV (music-video): 注重节奏感和视觉冲击

注意：
1. videoType 为 "${videoType}"，请根据类型调整 Shot 规划
2. 估算时长应考虑剪辑和转场时间
3. 请确保 Shot 规划合理，便于实际拍摄和剪辑`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请分析以下剧本内容：\n\n${content}` },
    ]

    // 调用 LLM
    let responseContent: string | undefined = undefined

    const isVolcengineModel = llmConfig.model?.startsWith('doubao-seed-')
    const useCustomLLMProvider =
      llmConfig.provider && (llmConfig.provider !== 'doubao' || isVolcengineModel)

    if (useCustomLLMProvider && llmConfig.apiKey) {
      try {
        const client = new OpenAICompatibleClient({
          apiKey: llmConfig.apiKey || '',
          baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
          model: llmConfig.model || 'gpt-3.5-turbo',
        })
        responseContent = await client.invoke(messages, { temperature: 0.3 })
      } catch (err) {
        console.warn('[PlanShotCountNode] Custom LLM failed, falling back to Coze')
      }
    }

    if (!responseContent) {
      const cozeDirectConfig = await getCozeDirectConfig()
      const shouldUseCozeDirect =
        (llmConfig.provider === 'doubao' || !llmConfig.provider) &&
        cozeDirectConfig?.botId &&
        cozeDirectConfig?.apiKey

      if (shouldUseCozeDirect) {
        responseContent = await invokeCozeDirect(messages, cozeDirectConfig)
      } else if (aiConfig.apiKey) {
        responseContent = await invokeLLM(
          messages,
          { model: aiConfig.model, temperature: 0.3 },
          {
            apiKey: aiConfig.apiKey,
            baseUrl: aiConfig.baseUrl,
            model: aiConfig.model,
          }
        )
      } else {
        responseContent = await invokeLLM(messages, { model: aiConfig.model, temperature: 0.3 })
      }
    }

    console.log(`[PlanShotCountNode] Raw response length: ${responseContent?.length || 0}`)

    // 解析 JSON
    const result = parseLLMJson<ShotPlan>(responseContent || '{}')

    if (!result || !result.shotPlan) {
      throw new Error('Shot 规划解析失败')
    }

    console.log('[PlanShotCountNode] Shot plan generated:', JSON.stringify(result, null, 2))

    return {
      type: 'shot-plan',
      shotPlan: result.shotPlan,
      sceneAudit: result.sceneAudit,
      specialNotes: result.specialNotes || [],
      targetDuration,
      videoType,
    }
  }
}

// ============ GenerateStoryboardV2Node ============

const GENERATE_STORYBOARD_V2_PORTS = {
  inputs: [
    { id: 'content', name: '剧本内容', type: 'text' as const, required: true, connected: false },
    { id: 'shotPlan', name: 'Shot规划', type: 'any' as const, required: false, connected: false },
    { id: 'characters', name: '人物列表', type: 'any' as const, required: false, connected: false },
    { id: 'style', name: '风格', type: 'text' as const, required: false, connected: false },
  ],
  outputs: [
    { id: 'scenes', name: '分镜列表', type: 'any' as const, required: false, connected: false },
  ],
}

export class GenerateStoryboardV2Node extends BaseNodeClass {
  constructor(config: any) {
    super({
      type: 'generate-storyboard-v2',
      name: '分镜生成V2',
      description: '基于 Shot 规划生成分镜，包含 videoPrompt 和 shotSegments',
      inputs: GENERATE_STORYBOARD_V2_PORTS.inputs,
      outputs: GENERATE_STORYBOARD_V2_PORTS.outputs,
      ...config,
    })
  }

  getParamSchema() {
    return {
      content: {
        type: 'string',
        required: false,
        description: '剧本内容',
      },
      style: {
        type: 'string',
        required: false,
        default: 'realistic',
        description: '画面风格',
      },
      numScenes: {
        type: 'number',
        required: false,
        default: 8,
        description: '生成分镜数量',
      },
    }
  }

  async process(context: ExecutionContext): Promise<any> {
    console.log(
      '[GenerateStoryboardV2Node] Processing inputs:',
      JSON.stringify(this.inputs, null, 2)
    )

    // 从输入端口获取数据
    let content = ''
    let shotPlan: ShotPlan | null = null
    let characters: string[] = []
    let style = this.params.style || 'realistic'

    for (const input of this.inputs) {
      if (input.value !== undefined && input.value !== null) {
        const inputValue = input.value
        console.log(
          `[GenerateStoryboardV2Node] Input port '${input.id}' has value:`,
          typeof inputValue === 'object' ? JSON.stringify(inputValue) : inputValue
        )

        if (typeof inputValue === 'object') {
          if (input.id === 'shotPlan' || input.id === 'sceneAudit') {
            // Shot 规划输入
            shotPlan = inputValue.shotPlan || inputValue
          } else if (input.id === 'characters') {
            // 人物列表输入
            if (Array.isArray(inputValue)) {
              characters = inputValue.map((c) => (typeof c === 'string' ? c : c.name))
            } else if (inputValue.characters) {
              characters = inputValue.characters.map((c: any) => (typeof c === 'string' ? c : c.name))
            }
          } else {
            content = inputValue.content || inputValue.text || inputValue.script || JSON.stringify(inputValue)
          }
        } else if (typeof inputValue === 'string') {
          if (input.id === 'style') {
            style = inputValue
          } else {
            content = inputValue
          }
        }
      }
    }

    // 如果没有从输入获取到，使用参数
    if (!content) {
      content = this.params.content || ''
    }

    if (!content) {
      throw new Error('请提供剧本内容')
    }

    const numScenes = this.params.numScenes || 8
    const projectId = this.params.projectId || context.projectId || 'temp'

    // 获取配置
    const aiConfig = await getServerAIConfig()
    const llmConfig = await getUserLLMConfig()

    // 构建系统提示词
    const systemPrompt = `你是一个专业的短剧视频分镜师。请根据剧本内容和 Shot 规划，生成详细的分镜信息。

请严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "scenes": [
    {
      "sceneNumber": 分镜编号（从1开始）,
      "shotId": Shot编号,
      "title": "分镜标题",
      "durationMs": 时长（毫秒）,
      "description": "场景画面描述（详细描述环境、光线、构图）",
      "videoPrompt": "Seedance 视频生成提示词（包含人物动作、环境描述、氛围要求）",
      "dialogue": "对白内容（可选）",
      "action": "动作/表演描述",
      "emotion": "情绪氛围（如：紧张、温馨、悲伤）",
      "characters": ["出场人物名称"],
      "shotType": "景别（如：远景、全景、中景、近景、特写）",
      "shotSegments": [
        {
          "startTimeMs": 起始时间（毫秒）,
          "endTimeMs": 结束时间（毫秒）,
          "shotType": "该段落镜头类型",
          "description": "该段落描述"
        }
      ],
      "firstFrameNeeded": 是否需要生成首帧（布尔值）,
      "lastFrameNeeded": 是否需要生成尾帧（布尔值）,
      "firstFrameDescription": "首帧图片描述",
      "lastFrameDescription": "尾帧图片描述",
      "transition": "转场效果（如：cut/fade/dissolve）"
    }
  ]
}

## 分镜生成核心原则

### 1. 首尾帧模式
- 如果场景有明显的首尾状态变化（如：开门前/开门后），应设置 firstFrameNeeded 和 lastFrameNeeded 为 true
- 首帧描述：描述该 Shot 开始时的画面状态
- 尾帧描述：描述该 Shot 结束时的画面状态
- 短动作场景可以只设置首帧或尾帧

### 2. Shot 段落划分
- 每个分镜可以有 1-3 个 Shot 段落
- 每个段落需要独立的时间范围
- 段落之间可以是不同角度或不同动作阶段
- 段落时长：每个段落 2-4 秒

### 3. Seedance 提示词优化
- videoPrompt 应包含：主体描述 + 动作 + 环境 + 氛围 + 风格要求
- 格式：人物（动作），场景（环境），氛围（情绪），风格（电影感）
- 示例："一位侠女站立在悬崖边，长发随风飘动，夕阳照射，氛围悲伤而坚定，电影质感"

### 4. 时长控制
- 单个分镜总时长：3-8 秒
- 如果对话或动作内容超过 8 秒，必须拆分
- 每个 shotSegment 建议 2-4 秒

### 5. 人物一致性
- 同一分镜中的人物应保持一致描述
- 不同分镜之间注意人物状态连续性

### 6. 转场效果
- 场景切换常用：cut（直切）、fade（淡入淡出）、dissolve（叠化）
- 动接动场景：使用 cut
- 时间过渡场景：使用 fade 或 dissolve

注意：
1. 生成分镜数量建议为 ${numScenes} 个，具体数量根据对话量和场景复杂度调整
2. 每个场景应该是一个独立的视频分镜
3. videoPrompt 是给 Seedance 图生视频模型用的，必须详细且可执行
4. shotSegments 用于精确控制视频时间轴
5. 这是短剧视频分镜，不是漫画`

    // 构建 Shot 规划上下文
    let shotPlanContext = ''
    if (shotPlan && shotPlan.shotPlan) {
      shotPlanContext = `\n## Shot 规划参考（请尽量遵循）\n`
      for (const plan of shotPlan.shotPlan) {
        shotPlanContext += `分镜 ${plan.sceneNumber}: ${plan.shotCount} 个 Shot，总时长 ${plan.totalDurationMs}ms，镜头类型: ${plan.shotTypes.join(', ')}\n`
      }
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请分析以下剧本内容生成分镜：\n\n${content}${shotPlanContext}` },
    ]

    // 调用 LLM
    let responseContent: string | undefined = undefined

    const isVolcengineModel = llmConfig.model?.startsWith('doubao-seed-')
    const useCustomLLMProvider =
      llmConfig.provider && (llmConfig.provider !== 'doubao' || isVolcengineModel)

    if (useCustomLLMProvider && llmConfig.apiKey) {
      try {
        const client = new OpenAICompatibleClient({
          apiKey: llmConfig.apiKey || '',
          baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
          model: llmConfig.model || 'gpt-3.5-turbo',
        })
        responseContent = await client.invoke(messages, { temperature: 0.3 })
      } catch (err) {
        console.warn('[GenerateStoryboardV2Node] Custom LLM failed, falling back to Coze')
      }
    }

    if (!responseContent) {
      const cozeDirectConfig = await getCozeDirectConfig()
      const shouldUseCozeDirect =
        (llmConfig.provider === 'doubao' || !llmConfig.provider) &&
        cozeDirectConfig?.botId &&
        cozeDirectConfig?.apiKey

      if (shouldUseCozeDirect) {
        responseContent = await invokeCozeDirect(messages, cozeDirectConfig)
      } else if (aiConfig.apiKey) {
        responseContent = await invokeLLM(
          messages,
          { model: aiConfig.model, temperature: 0.3 },
          {
            apiKey: aiConfig.apiKey,
            baseUrl: aiConfig.baseUrl,
            model: aiConfig.model,
          }
        )
      } else {
        responseContent = await invokeLLM(messages, { model: aiConfig.model, temperature: 0.3 })
      }
    }

    console.log(
      `[GenerateStoryboardV2Node] Raw response length: ${responseContent?.length || 0}`
    )

    // 解析 JSON
    const result = parseLLMJson<{ scenes: SceneV2[] }>(responseContent || '{}')

    if (!result || !result.scenes) {
      throw new Error('分镜 V2 解析失败')
    }

    // 转换为 SceneV2 格式并补充 videoPrompt
    const scenes: SceneV2[] = result.scenes.map((scene: any, index: number) => {
      // 如果没有 videoPrompt，生成一个
      if (!scene.videoPrompt) {
        scene.videoPrompt = generateSeedancePrompt(scene.description, style, scene.characters)
      }

      // 如果没有 shotSegments，创建一个默认段落
      if (!scene.shotSegments || scene.shotSegments.length === 0) {
        const duration = scene.durationMs || calculateSceneDuration(scene)
        scene.shotSegments = [
          {
            startTimeMs: 0,
            endTimeMs: duration,
            shotType: scene.shotType || 'medium',
            description: scene.description,
          } as ShotSegment,
        ]
      }

      // 确保首尾帧字段存在
      if (scene.firstFrameNeeded === undefined) {
        scene.firstFrameNeeded = true
      }
      if (scene.lastFrameNeeded === undefined) {
        scene.lastFrameNeeded = index < result.scenes.length - 1 // 最后一个分镜通常不需要尾帧
      }

      return scene as SceneV2
    })

    console.log(
      `[GenerateStoryboardV2Node] Generated ${scenes.length} scenes with V2 format`
    )

    return {
      type: 'scenes-v2',
      scenes,
      count: scenes.length,
      style,
    }
  }
}
