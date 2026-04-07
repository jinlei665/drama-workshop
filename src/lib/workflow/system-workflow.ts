/**
 * 系统工作流生成器
 * 为新建项目自动生成系统级工作流
 */

import { getDefaultWorkflow } from './default-workflow'
import type { BaseNode, Workflow } from './types'

/**
 * 生成系统工作流
 * 为项目创建一个只读的系统工作流，项目内容自动填充到节点参数
 *
 * @param projectId 项目 ID
 * @param projectName 项目名称
 * @param sourceContent 项目源内容（脚本/小说）
 * @param style 风格
 * @returns 系统工作流
 */
export function createSystemWorkflow(
  projectId: string,
  projectName: string,
  sourceContent: string,
  style?: string
): Workflow {
  const defaultConfig = getDefaultWorkflow()

  // 创建节点的副本，并填充项目内容
  const nodes: BaseNode[] = defaultConfig.nodes.map((node) => {
    const newNode = { ...node }

    // 根据节点类型填充内容
    switch (node.type) {
      case 'text-input':
        // 文本输入节点：填充项目源内容
        newNode.params = {
          text: sourceContent.substring(0, 500) + (sourceContent.length > 500 ? '...' : ''),
        }
        newNode.name = '项目脚本'
        newNode.description = `项目《${projectName}》的原始脚本内容`
        break

      case 'text-to-character':
        // 文生人物节点：使用项目内容生成人物描述
        newNode.params = {
          description: '根据项目脚本自动生成角色形象',
          style: style || 'realistic',
        }
        newNode.name = '角色生成'
        newNode.description = '基于脚本自动生成角色形象'
        break

      case 'text-to-image':
        // 文生图节点：使用项目内容生成场景描述
        newNode.params = {
          prompt: `${projectName} 的场景画面，${style || '写实风格'}，电影质感`,
          negativePrompt: '低质量，模糊，扭曲',
          width: '1024',
          height: '1024',
          style: style || 'realistic',
          seed: -1,
          steps: 30,
          guidance: 7.5,
        }
        newNode.name = '场景生成'
        newNode.description = '基于脚本自动生成场景画面'
        break

      case 'character-triple-views':
        // 人物三视图节点
        newNode.params = {
          style: style || 'realistic',
        }
        newNode.name = '角色三视图'
        newNode.description = '生成角色的正面、侧面、背面视图'
        break

      case 'image-to-video':
        // 图生视频节点
        newNode.params = {
          motionPrompt: '根据场景自动生成视频动作',
          duration: 5,
          aspectRatio: '16:9',
          motionStrength: 5,
        }
        newNode.name = '视频生成'
        newNode.description = '基于场景图片生成视频片段'
        break

      default:
        // 保持原有参数
        break
    }

    return newNode
  })

  // 创建系统工作流
  const workflow: Workflow = {
    id: `sys_workflow_${projectId}`,
    projectId,
    name: '系统工作流',
    description: `项目《${projectName}》的自动生成工作流，展示内容如何转换为视频`,
    nodes,
    edges: defaultConfig.edges,
    isTemplate: false,
    version: '2.0',
    system: true,  // 标记为系统工作流
    readonly: true,  // 标记为只读
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'system',
      thumbnail: '',
    },
  }

  return workflow
}

/**
 * 创建自定义工作流
 * 允许用户创建可编辑的自定义工作流
 *
 * @param projectId 项目 ID
 * @param name 工作流名称
 * @param description 工作流描述
 * @param templateId 模板 ID（可选）
 * @returns 自定义工作流
 */
export function createCustomWorkflow(
  projectId: string,
  name: string,
  description: string,
  templateId?: string
): Workflow {
  // 如果指定了模板，使用模板配置
  let nodes: BaseNode[] = []
  let edges: any[] = []

  if (templateId) {
    // TODO: 从模板系统加载模板配置
    // 暂时使用默认配置
    const defaultConfig = getDefaultWorkflow()
    nodes = defaultConfig.nodes
    edges = defaultConfig.edges
  }

  // 创建自定义工作流
  const workflow: Workflow = {
    id: `custom_workflow_${Date.now()}_${projectId}`,
    projectId,
    name,
    description,
    nodes,
    edges,
    isTemplate: false,
    version: '1.0',
    system: false,  // 标记为自定义工作流
    readonly: false,  // 标记为可编辑
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'user',
      thumbnail: '',
    },
  }

  return workflow
}

/**
 * 检查工作流是否为系统工作流
 */
export function isSystemWorkflow(workflow: Workflow): boolean {
  return workflow.system === true
}

/**
 * 检查工作流是否只读
 */
export function isReadonlyWorkflow(workflow: Workflow): boolean {
  return workflow.readonly === true
}

/**
 * 验证工作流是否可以被修改
 */
export function canModifyWorkflow(workflow: Workflow): boolean {
  return !isSystemWorkflow(workflow) && !isReadonlyWorkflow(workflow)
}
