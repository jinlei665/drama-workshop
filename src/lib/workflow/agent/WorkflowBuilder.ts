/**
 * 工作流构建器
 * 根据解析出的意图自动构建工作流
 */

import { Intent, ParsedRequest } from './IntentParser'
import { Workflow } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { getDefaultWorkflow } from '../default-workflow'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  nodes: any[]
  edges: any[]
}

export class WorkflowBuilder {
  private templates: Map<string, WorkflowTemplate> = new Map()

  constructor() {
    this.initializeTemplates()
  }

  /**
   * 初始化预设模板
   */
  private initializeTemplates(): void {
    // 文生图工作流
    this.templates.set('text-to-image', {
      id: 'text-to-image',
      name: '文生图',
      description: '根据文字描述生成图片',
      category: '图像生成',
      nodes: [
        {
          id: 'text_input_1',
          type: 'text_input',
          name: '文本输入',
          config: { label: '场景描述', placeholder: '描述你想要的场景...' },
          position: { x: 100, y: 100 }
        },
        {
          id: 'image_gen_1',
          type: 'text_to_image',
          name: '文生图',
          config: {
            style: 'realistic',
            width: 1024,
            height: 1024,
            count: 1
          },
          position: { x: 400, y: 100 }
        },
        {
          id: 'output_1',
          type: 'asset_output',
          name: '输出',
          config: { format: 'png' },
          position: { x: 700, y: 100 }
        }
      ],
      edges: [
        {
          id: 'edge_1',
          from: 'text_input_1',
          to: 'image_gen_1',
          fromPort: 'text',
          toPort: 'prompt'
        },
        {
          id: 'edge_2',
          from: 'image_gen_1',
          to: 'output_1',
          fromPort: 'image',
          toPort: 'asset'
        }
      ]
    })

    // 图生视频工作流
    this.templates.set('image-to-video', {
      id: 'image-to-video',
      name: '图生视频',
      description: '根据图片生成视频',
      category: '视频生成',
      nodes: [
        {
          id: 'image_input_1',
          type: 'image_input',
          name: '图片输入',
          config: { label: '选择参考图片' },
          position: { x: 100, y: 100 }
        },
        {
          id: 'text_input_1',
          type: 'text_input',
          name: '动作描述',
          config: { label: '描述视频动作', placeholder: '描述想要的动作...' },
          position: { x: 100, y: 250 }
        },
        {
          id: 'video_gen_1',
          type: 'image_to_video',
          name: '图生视频',
          config: {
            duration: 5,
            aspect_ratio: '16:9',
            motion_strength: 0.5
          },
          position: { x: 400, y: 175 }
        },
        {
          id: 'output_1',
          type: 'asset_output',
          name: '输出',
          config: { format: 'mp4' },
          position: { x: 700, y: 175 }
        }
      ],
      edges: [
        {
          id: 'edge_1',
          from: 'image_input_1',
          to: 'video_gen_1',
          fromPort: 'image',
          toPort: 'reference_image'
        },
        {
          id: 'edge_2',
          from: 'text_input_1',
          to: 'video_gen_1',
          fromPort: 'text',
          toPort: 'motion_prompt'
        },
        {
          id: 'edge_3',
          from: 'video_gen_1',
          to: 'output_1',
          fromPort: 'video',
          toPort: 'asset'
        }
      ]
    })

    // 首尾帧视频生成工作流
    this.templates.set('end-frame-video', {
      id: 'end-frame-video',
      name: '首尾帧视频',
      description: '使用首尾帧生成过渡视频',
      category: '视频生成',
      nodes: [
        {
          id: 'image_input_1',
          type: 'image_input',
          name: '首帧图片',
          config: { label: '选择起始图片' },
          position: { x: 100, y: 100 }
        },
        {
          id: 'image_input_2',
          type: 'image_input',
          name: '尾帧图片',
          config: { label: '选择结束图片' },
          position: { x: 100, y: 250 }
        },
        {
          id: 'text_input_1',
          type: 'text_input',
          name: '过渡描述',
          config: { label: '过渡描述', placeholder: '描述如何过渡...' },
          position: { x: 100, y: 400 }
        },
        {
          id: 'video_gen_1',
          type: 'image_to_video',
          name: '首尾帧生成',
          config: {
            mode: 'end_frame',
            duration: 6,
            aspect_ratio: '16:9'
          },
          position: { x: 400, y: 250 }
        },
        {
          id: 'output_1',
          type: 'asset_output',
          name: '输出',
          config: { format: 'mp4' },
          position: { x: 700, y: 250 }
        }
      ],
      edges: [
        {
          id: 'edge_1',
          from: 'image_input_1',
          to: 'video_gen_1',
          fromPort: 'image',
          toPort: 'start_image'
        },
        {
          id: 'edge_2',
          from: 'image_input_2',
          to: 'video_gen_1',
          fromPort: 'image',
          toPort: 'end_image'
        },
        {
          id: 'edge_3',
          from: 'text_input_1',
          to: 'video_gen_1',
          fromPort: 'text',
          toPort: 'transition_prompt'
        },
        {
          id: 'edge_4',
          from: 'video_gen_1',
          to: 'output_1',
          fromPort: 'video',
          toPort: 'asset'
        }
      ]
    })

    // 角色三视图生成工作流
    this.templates.set('character-triple-view', {
      id: 'character-triple-view',
      name: '角色三视图',
      description: '生成角色的正、侧、背三视图',
      category: '角色设计',
      nodes: [
        {
          id: 'image_input_1',
          type: 'image_input',
          name: '参考图片',
          config: { label: '上传角色正面图' },
          position: { x: 100, y: 200 }
        },
        {
          id: 'text_input_1',
          type: 'text_input',
          name: '角色描述',
          config: { label: '角色特征', placeholder: '描述角色特征...' },
          position: { x: 100, y: 50 }
        },
        {
          id: 'image_gen_front',
          type: 'image_to_image',
          name: '正面视图',
          config: { view: 'front' },
          position: { x: 400, y: 50 }
        },
        {
          id: 'image_gen_side',
          type: 'image_to_image',
          name: '侧面视图',
          config: { view: 'side' },
          position: { x: 400, y: 200 }
        },
        {
          id: 'image_gen_back',
          type: 'image_to_image',
          name: '背面视图',
          config: { view: 'back' },
          position: { x: 400, y: 350 }
        },
        {
          id: 'output_1',
          type: 'asset_output',
          name: '输出',
          config: { format: 'png' },
          position: { x: 700, y: 200 }
        }
      ],
      edges: [
        {
          id: 'edge_1',
          from: 'text_input_1',
          to: 'image_gen_front',
          fromPort: 'text',
          toPort: 'prompt'
        },
        {
          id: 'edge_2',
          from: 'image_input_1',
          to: 'image_gen_front',
          fromPort: 'image',
          toPort: 'reference_image'
        },
        {
          id: 'edge_3',
          from: 'text_input_1',
          to: 'image_gen_side',
          fromPort: 'text',
          toPort: 'prompt'
        },
        {
          id: 'edge_4',
          from: 'image_input_1',
          to: 'image_gen_side',
          fromPort: 'image',
          toPort: 'reference_image'
        },
        {
          id: 'edge_5',
          from: 'text_input_1',
          to: 'image_gen_back',
          fromPort: 'text',
          toPort: 'prompt'
        },
        {
          id: 'edge_6',
          from: 'image_input_1',
          to: 'image_gen_back',
          fromPort: 'image',
          toPort: 'reference_image'
        },
        {
          id: 'edge_7',
          from: 'image_gen_front',
          to: 'output_1',
          fromPort: 'image',
          toPort: 'asset'
        },
        {
          id: 'edge_8',
          from: 'image_gen_side',
          to: 'output_1',
          fromPort: 'image',
          toPort: 'asset'
        },
        {
          id: 'edge_9',
          from: 'image_gen_back',
          to: 'output_1',
          fromPort: 'image',
          toPort: 'asset'
        }
      ]
    })
  }

  /**
   * 根据意图构建工作流
   */
  buildFromIntent(parsedRequest: ParsedRequest, projectId: string): Workflow {
    // 如果 LLM 已经返回了建议的工作流，直接使用
    if (parsedRequest.suggestedWorkflow.nodes.length > 0) {
      return this.createWorkflow(
        parsedRequest.suggestedWorkflow.nodes,
        parsedRequest.suggestedWorkflow.edges,
        projectId
      )
    }

    // 否则根据意图类型使用预设模板
    const template = this.getTemplateByIntent(parsedRequest.intent)
    if (template) {
      return this.createWorkflow(template.nodes, template.edges, projectId)
    }

    // 默认创建一个基础工作流
    return this.createDefaultWorkflow(projectId)
  }

  /**
   * 根据意图类型获取模板
   */
  private getTemplateByIntent(intent: Intent): WorkflowTemplate | null {
    switch (intent.type) {
      case 'create_scene':
        return this.templates.get('text-to-image') || null
      case 'generate_image':
        return this.templates.get('text-to-image') || null
      case 'generate_video':
        return this.templates.get('image-to-video') || null
      default:
        return null
    }
  }

  /**
   * 创建工作流
   */
  private createWorkflow(nodes: any[], edges: any[], projectId: string): Workflow {
    return {
      id: uuidv4(),
      name: 'AI 生成的工作流',
      description: '根据用户需求自动生成',
      projectId,
      version: '1',
      status: 'draft',
      nodes,
      edges,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'AI Assistant',
      },
    }
  }

  /**
   * 创建默认工作流
   */
  private createDefaultWorkflow(projectId: string): Workflow {
    const defaultConfig = getDefaultWorkflow()

    return {
      id: uuidv4(),
      projectId,
      name: '短剧创作工作流',
      description: '从文本描述到人物、场景、视频的完整创作流程',
      nodes: defaultConfig.nodes,
      edges: defaultConfig.edges,
      isTemplate: false,
      version: '2.0',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'system',
      },
    }
  }

  /**
   * 获取所有模板
   */
  getTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * 根据类别获取模板
   */
  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category)
  }

  /**
   * 添加自定义模板
   */
  addTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.id, template)
  }

  /**
   * 移除模板
   */
  removeTemplate(templateId: string): void {
    this.templates.delete(templateId)
  }
}
