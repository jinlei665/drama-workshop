/**
 * 意图解析器
 * 使用 LLM 解析用户的自然语言输入，识别创作意图
 */

import { llm } from '../../ai/index'

export interface Intent {
  type: 'create_scene' | 'create_character' | 'generate_image' | 'generate_video' | 'complex_workflow'
  confidence: number
  entities: {
    scenes?: string[]
    characters?: string[]
    styles?: string[]
    mood?: string
    duration?: string
    aspect_ratio?: string
  }
  requirements: string[]
  keywords: string[]
}

export interface ParsedRequest {
  intent: Intent
  suggestedWorkflow: {
    nodes: any[]
    edges: any[]
  }
  recommendations: string[]
}

export class IntentParser {
  private systemPrompt = `
你是一个专业的短剧创作助手，负责分析用户的创作需求并生成相应的工作流。

你的任务是：
1. 分析用户的自然语言输入，识别创作意图
2. 提取关键实体信息（场景、角色、风格、情绪等）
3. 生成合适的工作流节点和连接关系
4. 提供创作建议和优化提示

意图类型：
- create_scene: 创建分镜场景
- create_character: 创建角色
- generate_image: 生成图像（文生图、图生图）
- generate_video: 生成视频
- complex_workflow: 复杂工作流（包含多个步骤）

请以 JSON 格式返回结果，包含以下字段：
{
  "intent": {
    "type": "意图类型",
    "confidence": 0.0-1.0,
    "entities": {
      "scenes": ["场景描述1", "场景描述2"],
      "characters": ["角色描述1", "角色描述2"],
      "styles": ["风格1", "风格2"],
      "mood": "情绪",
      "duration": "时长",
      "aspect_ratio": "比例"
    },
    "requirements": ["需求1", "需求2"],
    "keywords": ["关键词1", "关键词2"]
  },
  "suggestedWorkflow": {
    "nodes": [
      {
        "id": "节点ID",
        "type": "节点类型",
        "name": "节点名称",
        "config": {},
        "position": { "x": 0, "y": 0 }
      }
    ],
    "edges": [
      {
        "id": "连接ID",
        "from": "源节点ID",
        "to": "目标节点ID",
        "fromPort": "输出端口",
        "toPort": "输入端口"
      }
    ]
  },
  "recommendations": ["建议1", "建议2"]
}

节点类型说明：
- text_input: 文本输入节点
- image_input: 图片输入节点
- llm_analyze: LLM 分析节点
- text_to_image: 文生图节点
- image_to_image: 图生图节点
- image_to_video: 图生视频节点
- video_merge: 视频合并节点
- audio_generation: 音频生成节点
- asset_output: 资产输出节点
`

  /**
   * 解析用户输入
   */
  async parse(userInput: string): Promise<ParsedRequest> {
    try {
      const response = await llm.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userInput }
        ],
        temperature: 0.3,
        responseFormat: { type: 'json_object' }
      })

      const content = response.choices[0]?.message?.content || '{}'
      return JSON.parse(content)
    } catch (error) {
      console.error('意图解析失败:', error)
      return this.getFallbackResult(userInput)
    }
  }

  /**
   * 获取回退结果（当 LLM 失败时）
   */
  private getFallbackResult(userInput: string): ParsedRequest {
    const keywords = this.extractKeywords(userInput)

    return {
      intent: {
        type: 'complex_workflow',
        confidence: 0.5,
        entities: {},
        requirements: ['解析失败，请手动配置工作流'],
        keywords
      },
      suggestedWorkflow: {
        nodes: [],
        edges: []
      },
      recommendations: ['建议提供更详细的创作描述']
    }
  }

  /**
   * 提取关键词（简单的规则匹配）
   */
  private extractKeywords(text: string): string[] {
    const patterns = {
      scenes: /场景|画面|镜头|分镜/g,
      characters: /角色|人物|主角|配角/g,
      styles: /风格|写实|动漫|卡通|油画|水彩/g,
      mood: /情绪|氛围|情感/g,
      video: /视频|动画|镜头运动/g,
      audio: /配音|音效|语音/g
    }

    const keywords: string[] = []

    Object.entries(patterns).forEach(([key, pattern]) => {
      const matches = text.match(pattern)
      if (matches) {
        keywords.push(...matches.filter((v, i, a) => a.indexOf(v) === i))
      }
    })

    return keywords
  }

  /**
   * 意图增强（结合上下文）
   */
  async enhanceIntent(
    parsedRequest: ParsedRequest,
    context: {
      projectAssets?: any[]
      previousWorkflows?: any[]
      userPreferences?: any
    }
  ): Promise<ParsedRequest> {
    const enhanced = { ...parsedRequest }

    // 基于项目资产推荐使用现有资源
    if (context.projectAssets && context.projectAssets.length > 0) {
      const imageAssets = context.projectAssets.filter(a => a.type === 'image')
      if (imageAssets.length > 0 && parsedRequest.intent.type === 'generate_video') {
        enhanced.recommendations.push(
          `发现 ${imageAssets.length} 个现有图片资源，可以直接用于视频生成`
        )
      }
    }

    // 基于用户偏好调整建议
    if (context.userPreferences?.defaultStyle) {
      enhanced.intent.entities.styles = [
        ...(enhanced.intent.entities.styles || []),
        context.userPreferences.defaultStyle
      ]
    }

    return enhanced
  }
}
