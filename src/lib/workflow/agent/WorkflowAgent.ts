/**
 * Agent API
 * 整合意图解析和工作流构建，提供智能共创功能
 */

import { IntentParser, ParsedRequest } from './IntentParser'
import { WorkflowBuilder, WorkflowTemplate } from './WorkflowBuilder'
import { Workflow } from '../types'

export interface AgentRequest {
  userInput: string
  projectId: string
  context?: {
    projectAssets?: any[]
    previousWorkflows?: any[]
    userPreferences?: any
  }
}

export interface AgentResponse {
  parsedIntent: ParsedRequest
  workflow: Workflow
  recommendations: string[]
  alternativeWorkflows?: Workflow[]
}

export interface OptimizationSuggestion {
  type: 'performance' | 'quality' | 'cost' | 'usability'
  title: string
  description: string
  action: () => Promise<void>
  impact: 'high' | 'medium' | 'low'
}

export class WorkflowAgent {
  private intentParser: IntentParser
  private workflowBuilder: WorkflowBuilder

  constructor() {
    this.intentParser = new IntentParser()
    this.workflowBuilder = new WorkflowBuilder()
  }

  /**
   * 处理用户请求，自动生成工作流
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    // 1. 解析用户意图
    let parsedRequest = await this.intentParser.parse(request.userInput)

    // 2. 增强意图（结合上下文）
    if (request.context) {
      parsedRequest = await this.intentParser.enhanceIntent(parsedRequest, request.context)
    }

    // 3. 构建工作流
    const workflow = this.workflowBuilder.buildFromIntent(parsedRequest, request.projectId)

    // 4. 生成替代方案
    const alternativeWorkflows = this.generateAlternatives(parsedRequest, request.projectId)

    return {
      parsedIntent: parsedRequest,
      workflow,
      recommendations: parsedRequest.recommendations,
      alternativeWorkflows
    }
  }

  /**
   * 生成替代方案
   */
  private generateAlternatives(parsedRequest: ParsedRequest, projectId: string): Workflow[] {
    const alternatives: Workflow[] = []

    // 根据意图类型提供不同的替代方案
    switch (parsedRequest.intent.type) {
      case 'generate_video':
        // 视频生成可以提供多种方案
        const templates = this.workflowBuilder.getTemplatesByCategory('视频生成')
        templates.forEach(template => {
          if (template.id !== 'image-to-video') { // 跳过主要方案
            alternatives.push({
              id: `alt_${template.id}`,
              name: `替代方案: ${template.name}`,
              description: template.description,
              projectId,
              status: 'draft',
              version: '1',
              nodes: template.nodes,
              edges: template.edges,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          }
        })
        break

      case 'generate_image':
        // 图像生成可以提供不同风格
        const imageTemplates = this.workflowBuilder.getTemplatesByCategory('图像生成')
        imageTemplates.forEach(template => {
          alternatives.push({
            id: `alt_${template.id}`,
            name: `替代方案: ${template.name}`,
            description: template.description,
            projectId,
            status: 'draft',
            version: 1,
            nodes: template.nodes,
            edges: template.edges,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        })
        break
    }

    return alternatives
  }

  /**
   * 优化工作流
   */
  async optimizeWorkflow(workflow: Workflow): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = []

    // 1. 检查节点数量，建议合并
    if (workflow.nodes.length > 20) {
      suggestions.push({
        type: 'usability',
        title: '节点数量过多',
        description: '当前工作流包含过多节点，建议将部分节点合并为子工作流以提高可维护性。',
        action: async () => {
          // 实现节点合并逻辑
          console.log('执行节点合并优化')
        },
        impact: 'medium'
      })
    }

    // 2. 检查是否有可以并行执行的节点
    const parallelNodes = this.findParallelizableNodes(workflow)
    if (parallelNodes.length > 0) {
      suggestions.push({
        type: 'performance',
        title: '优化并行执行',
        description: `发现 ${parallelNodes.length} 个节点可以并行执行，可以显著提升执行效率。`,
        action: async () => {
          // 实现并行优化逻辑
          console.log('执行并行优化')
        },
        impact: 'high'
      })
    }

    // 3. 检查是否有重复节点
    const duplicateNodes = this.findDuplicateNodes(workflow)
    if (duplicateNodes.length > 0) {
      suggestions.push({
        type: 'cost',
        title: '移除重复节点',
        description: `发现 ${duplicateNodes.length} 个重复节点，移除它们可以节省资源。`,
        action: async () => {
          // 实现移除重复节点逻辑
          console.log('移除重复节点')
        },
        impact: 'medium'
      })
    }

    // 4. 检查是否缺少错误处理
    const nodesWithErrorHandling = workflow.nodes.filter(n => n.params?.errorHandling)
    if (nodesWithErrorHandling.length < workflow.nodes.length * 0.5) {
      suggestions.push({
        type: 'usability',
        title: '添加错误处理',
        description: '建议为关键节点添加错误处理机制，提高工作流的健壮性。',
        action: async () => {
          // 实现添加错误处理逻辑
          console.log('添加错误处理')
        },
        impact: 'high'
      })
    }

    return suggestions
  }

  /**
   * 查找可以并行执行的节点
   */
  private findParallelizableNodes(workflow: Workflow): string[] {
    const nodeDependencies = new Map<string, string[]>()

    // 构建依赖关系
    workflow.edges.forEach(edge => {
      if (!nodeDependencies.has(edge.to)) {
        nodeDependencies.set(edge.to, [])
      }
      nodeDependencies.get(edge.to)!.push(edge.from)
    })

    // 找出没有依赖或依赖相同的节点
    const parallelizable: string[] = []
    const dependencyGroups = new Map<string, string[]>()

    workflow.nodes.forEach(node => {
      const deps = nodeDependencies.get(node.id) || []
      const depsKey = deps.sort().join(',')
      if (!dependencyGroups.has(depsKey)) {
        dependencyGroups.set(depsKey, [])
      }
      dependencyGroups.get(depsKey)!.push(node.id)
    })

    // 找出组内节点数 > 1 的组
    dependencyGroups.forEach(nodes => {
      if (nodes.length > 1) {
        parallelizable.push(...nodes)
      }
    })

    return parallelizable
  }

  /**
   * 查找重复节点
   */
  private findDuplicateNodes(workflow: Workflow): string[] {
    const nodeMap = new Map<string, string[]>()

    workflow.nodes.forEach(node => {
      const key = `${node.type}-${JSON.stringify(node.params)}`
      if (!nodeMap.has(key)) {
        nodeMap.set(key, [])
      }
      nodeMap.get(key)!.push(node.id)
    })

    const duplicates: string[] = []
    nodeMap.forEach(nodes => {
      if (nodes.length > 1) {
        duplicates.push(...nodes)
      }
    })

    return duplicates
  }

  /**
   * 智能补全工作流
   */
  async autocompleteWorkflow(workflow: Workflow, context: any): Promise<Workflow> {
    const updatedWorkflow = { ...workflow }

    // 1. 检查是否有未连接的节点
    const connectedNodes = new Set<string>()
    workflow.edges.forEach(edge => {
      connectedNodes.add(edge.from)
      connectedNodes.add(edge.to)
    })

    const unconnectedNodes = workflow.nodes.filter(n => !connectedNodes.has(n.id))

    // 2. 为未连接的节点寻找合适的连接
    unconnectedNodes.forEach(node => {
      const suggestions = this.suggestConnections(node, workflow)
      if (suggestions.length > 0) {
        updatedWorkflow.edges.push(suggestions[0])
      }
    })

    // 3. 检查是否缺少必要的输入节点
    const requiredInputs = this.detectRequiredInputs(workflow)
    requiredInputs.forEach(input => {
      if (!workflow.nodes.find(n => n.id === input)) {
        updatedWorkflow.nodes.push({
          id: `auto_${input}`,
          type: 'text-input',
          name: '自动生成的输入',
          inputs: [],
          outputs: [{ id: 'output', name: 'Output', type: 'text', required: false, connected: false }],
          params: { label: input },
          position: { x: 0, y: 0 }
        })
      }
    })

    return updatedWorkflow
  }

  /**
   * 为节点建议连接
   */
  private suggestConnections(node: any, workflow: Workflow): any[] {
    const suggestions: any[] = []

    // 简单逻辑：找到类型兼容的上游节点
    workflow.nodes.forEach(otherNode => {
      if (otherNode.id !== node.id && this.areNodesCompatible(otherNode, node)) {
        suggestions.push({
          id: `suggested_${otherNode.id}_${node.id}`,
          from: otherNode.id,
          to: node.id,
          fromPort: 'output',
          toPort: 'input'
        })
      }
    })

    return suggestions
  }

  /**
   * 检查节点是否兼容（可以连接）
   */
  private areNodesCompatible(fromNode: any, toNode: any): boolean {
    // 简化版：检查类型是否匹配
    const compatibleTypes: Record<string, string[]> = {
      text_input: ['llm_analyze', 'text_to_image', 'text_to_video'],
      image_input: ['image_to_image', 'image_to_video', 'llm_analyze'],
      text_to_image: ['image_to_video', 'asset_output'],
      image_to_video: ['video_merge', 'asset_output']
    }

    const outputs = compatibleTypes[fromNode.type] || []
    return outputs.includes(toNode.type)
  }

  /**
   * 检测必需的输入
   */
  private detectRequiredInputs(workflow: Workflow): string[] {
    const requiredInputs: string[] = []

    // 检查每个节点的输入需求
    workflow.nodes.forEach(node => {
      if (node.type === 'text-to-image' || node.type === 'llm-process') {
        const hasTextInput = workflow.edges.some(
          e => e.to === node.id && e.toPort === 'prompt'
        )
        if (!hasTextInput) {
          requiredInputs.push(`${node.id}_prompt`)
        }
      }

      if (node.type === 'image-to-image' || node.type === 'image-to-video') {
        const hasImageInput = workflow.edges.some(
          e => e.to === node.id && e.toPort === 'reference_image'
        )
        if (!hasImageInput) {
          requiredInputs.push(`${node.id}_image`)
        }
      }
    })

    return requiredInputs
  }

  /**
   * 获取工作流模板
   */
  getTemplates(): WorkflowTemplate[] {
    return this.workflowBuilder.getTemplates()
  }

  /**
   * 根据类别获取模板
   */
  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return this.workflowBuilder.getTemplatesByCategory(category)
  }
}
