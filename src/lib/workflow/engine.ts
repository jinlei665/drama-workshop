/**
 * 工作流引擎
 * 参考 ComfyUI 的节点式工作流设计
 */

import { Errors, logger } from '@/lib/errors'
import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

// ============================================
// 节点类型定义
// ============================================

/** 节点输入定义 */
export interface NodeInput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
  required?: boolean
  default?: unknown
  description?: string
}

/** 节点输出定义 */
export interface NodeOutput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
  description?: string
}

/** 节点定义 */
export interface NodeDefinition {
  type: string
  category: string
  displayName: string
  description: string
  inputs: NodeInput[]
  outputs: NodeOutput[]
  execute: (inputs: Record<string, unknown>, context: ExecutionContext) => Promise<Record<string, unknown>>
}

/** 执行上下文 */
export interface ExecutionContext {
  projectId: string
  abortSignal?: AbortSignal
  onProgress?: (nodeId: string, progress: number, message?: string) => void
  onError?: (nodeId: string, error: Error) => void
  onComplete?: (nodeId: string, outputs: Record<string, unknown>) => void
}

/** 工作流执行状态 */
export interface WorkflowExecution {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: Date
  endTime?: Date
  error?: string
  nodeStatuses: Map<string, {
    status: 'pending' | 'running' | 'completed' | 'error'
    outputs?: Record<string, unknown>
    error?: string
  }>
}

// ============================================
// 工作流引擎类
// ============================================

export class WorkflowEngine {
  private nodeDefinitions = new Map<string, NodeDefinition>()
  private executions = new Map<string, WorkflowExecution>()

  constructor() {
    this.registerBuiltinNodes()
  }

  /** 注册节点 */
  registerNode(definition: NodeDefinition): void {
    this.nodeDefinitions.set(definition.type, definition)
    logger.info('Node registered', { type: definition.type })
  }

  /** 获取节点定义 */
  getNodeDefinition(type: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(type)
  }

  /** 获取所有节点定义 */
  getAllNodeDefinitions(): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values())
  }

  /** 验证工作流 */
  validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 验证节点
    for (const node of nodes) {
      const definition = this.nodeDefinitions.get(node.type)
      if (!definition) {
        errors.push(`节点 ${node.id}: 未知的节点类型 ${node.type}`)
        continue
      }

      // 验证必需输入
      for (const input of definition.inputs) {
        if (input.required) {
          const value = node.data?.[input.name]
          if (value === undefined) {
            // 检查是否有连接
            const hasConnection = edges.some(e => e.target === node.id && e.targetHandle === input.name)
            if (!hasConnection) {
              errors.push(`节点 ${node.id}: 缺少必需输入 ${input.name}`)
            }
          }
        }
      }
    }

    // 验证边
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      
      if (!sourceNode) {
        errors.push(`边 ${edge.id}: 源节点 ${edge.source} 不存在`)
      }
      if (!targetNode) {
        errors.push(`边 ${edge.id}: 目标节点 ${edge.target} 不存在`)
      }
    }

    // 检测循环依赖
    if (this.hasCycle(nodes, edges)) {
      errors.push('工作流中存在循环依赖')
    }

    return { valid: errors.length === 0, errors }
  }

  /** 检测循环依赖 */
  private hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const graph = new Map<string, string[]>()
    for (const node of nodes) {
      graph.set(node.id, [])
    }
    for (const edge of edges) {
      graph.get(edge.source)?.push(edge.target)
    }

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId)
      recursionStack.add(nodeId)

      const neighbors = graph.get(nodeId) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true
        } else if (recursionStack.has(neighbor)) {
          return true
        }
      }

      recursionStack.delete(nodeId)
      return false
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true
      }
    }

    return false
  }

  /** 执行工作流 */
  async execute(
    executionId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: ExecutionContext
  ): Promise<Map<string, Record<string, unknown>>> {
    const results = new Map<string, Record<string, unknown>>()

    // 初始化执行状态
    const execution: WorkflowExecution = {
      id: executionId,
      status: 'running',
      startTime: new Date(),
      nodeStatuses: new Map(nodes.map(n => [n.id, { status: 'pending', outputs: {} }])),
    }
    this.executions.set(executionId, execution)

    try {
      // 计算执行顺序（拓扑排序）
      const sortedNodes = this.topologicalSort(nodes, edges)

      // 依次执行节点
      for (const node of sortedNodes) {
        // 检查是否中止
        if (context.abortSignal?.aborted) {
          execution.status = 'cancelled'
          break
        }

        // 更新节点状态
        execution.nodeStatuses.get(node.id)!.status = 'running'
        logger.info('Executing node', { nodeId: node.id, type: node.type })

        try {
          // 收集输入
          const inputs = this.collectInputs(node, edges, results)

          // 执行节点
          const definition = this.nodeDefinitions.get(node.type)
          if (!definition) {
            throw Errors.NotFound(`节点类型 ${node.type}`)
          }

          const outputs = await definition.execute(
            { ...inputs, ...node.data },
            context
          )

          // 保存结果
          results.set(node.id, outputs)
          execution.nodeStatuses.get(node.id)!.status = 'completed'
          execution.nodeStatuses.get(node.id)!.outputs = outputs

          context.onComplete?.(node.id, outputs)
          logger.info('Node completed', { nodeId: node.id })
        } catch (err) {
          execution.nodeStatuses.get(node.id)!.status = 'error'
          execution.nodeStatuses.get(node.id)!.error = err instanceof Error ? err.message : String(err)
          context.onError?.(node.id, err instanceof Error ? err : new Error(String(err)))
          throw err
        }
      }

      execution.status = 'completed'
      execution.endTime = new Date()
      logger.info('Workflow completed', { executionId })
    } catch (err) {
      execution.status = 'failed'
      execution.endTime = new Date()
      execution.error = err instanceof Error ? err.message : String(err)
      logger.error('Workflow failed', err)
      throw err
    }

    return results
  }

  /** 拓扑排序 */
  private topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const inDegree = new Map<string, number>()
    const graph = new Map<string, string[]>()

    // 初始化
    for (const node of nodes) {
      inDegree.set(node.id, 0)
      graph.set(node.id, [])
    }

    // 构建图
    for (const edge of edges) {
      graph.get(edge.source)?.push(edge.target)
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }

    // 查找入度为 0 的节点
    const queue: string[] = []
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId)
      }
    }

    // BFS 拓扑排序
    const sorted: string[] = []
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      sorted.push(nodeId)

      for (const neighbor of graph.get(nodeId) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }

    // 返回排序后的节点
    return sorted.map(id => nodes.find(n => n.id === id)!).filter(Boolean)
  }

  /** 收集节点输入 */
  private collectInputs(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    results: Map<string, Record<string, unknown>>
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {}

    for (const edge of edges) {
      if (edge.target === node.id) {
        const sourceOutputs = results.get(edge.source)
        if (sourceOutputs && edge.sourceHandle && edge.targetHandle) {
          inputs[edge.targetHandle] = sourceOutputs[edge.sourceHandle]
        }
      }
    }

    return inputs
  }

  /** 获取执行状态 */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId)
  }

  /** 注册内置节点 */
  private registerBuiltinNodes(): void {
    // 这些节点将在后续文件中定义
    // 这里只是声明引擎支持节点注册机制
  }
}

// 全局引擎实例
export const workflowEngine = new WorkflowEngine()
