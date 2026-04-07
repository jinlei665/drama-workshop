/**
 * 工作流引擎
 * 负责工作流的执行、调度和状态管理
 */

import { Workflow, WorkflowExecution, ExecutionContext, Edge, BaseNode } from '../types'
import { NodeFactory } from '../node/BaseNode'

export interface WorkflowEngineConfig {
  maxRetries: number
  timeout: number
  maxParallelNodes: number
}

export class WorkflowEngine {
  private config: WorkflowEngineConfig
  private executions: Map<string, WorkflowExecution> = new Map()
  private eventHandlers: Map<string, Function[]> = new Map()

  constructor(config: Partial<WorkflowEngineConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 300000, // 5分钟
      maxParallelNodes: config.maxParallelNodes || 5
    }
  }

  /**
   * 执行工作流
   */
  async execute(workflow: Workflow, context: Partial<ExecutionContext> = {}): Promise<WorkflowExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 创建执行上下文
    const fullContext: ExecutionContext = {
      workflowId: workflow.id,
      executionId,
      projectId: context.projectId || workflow.projectId,
      startTime: Date.now(),
      variables: context.variables || {},
      assets: context.assets || {},
      config: context.config || this.config
    }

    // 创建执行记录
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      projectId: workflow.projectId,
      status: 'running',
      startTime: new Date().toISOString(),
      progress: 0,
      results: []
    }

    this.executions.set(executionId, execution)

    // 触发开始事件
    this.emit('execution:started', { executionId, workflow })

    try {
      // 构建节点依赖图
      const dependencyGraph = this.buildDependencyGraph(workflow)

      // 按依赖关系执行节点
      await this.executeNodes(workflow, dependencyGraph, fullContext, execution)

      // 更新执行状态
      execution.status = 'completed'
      execution.endTime = new Date().toISOString()
      execution.progress = 100

      this.emit('execution:completed', { executionId, workflow, execution })
    } catch (error) {
      execution.status = 'failed'
      execution.endTime = new Date().toISOString()
      execution.error = error instanceof Error ? error.message : '未知错误'

      this.emit('execution:failed', { executionId, workflow, execution, error })
    }

    return execution
  }

  /**
   * 构建节点依赖图
   * 返回可以并行执行的节点组
   */
  private buildDependencyGraph(workflow: Workflow): string[][] {
    const nodeMap = new Map<string, BaseNode>()
    workflow.nodes.forEach(node => nodeMap.set(node.id, node))

    // 计算每个节点的入度（依赖数量）
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>()

    workflow.nodes.forEach(node => {
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    })

    workflow.edges.forEach(edge => {
      const fromList = adjList.get(edge.from) || []
      fromList.push(edge.to)
      adjList.set(edge.from, fromList)
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
    })

    // 拓扑排序，返回可以并行执行的层级
    const levels: string[][] = []
    const queue: string[] = []

    // 找到所有入度为0的节点（无依赖）
    workflow.nodes.forEach(node => {
      if ((inDegree.get(node.id) || 0) === 0) {
        queue.push(node.id)
      }
    })

    while (queue.length > 0) {
      const level = [...queue]
      levels.push(level)
      queue.length = 0

      level.forEach(nodeId => {
        const neighbors = adjList.get(nodeId) || []
        neighbors.forEach(neighborId => {
          inDegree.set(neighborId, (inDegree.get(neighborId) || 0) - 1)
          if ((inDegree.get(neighborId) || 0) === 0) {
            queue.push(neighborId)
          }
        })
      })
    }

    return levels
  }

  /**
   * 按依赖关系执行节点
   */
  private async executeNodes(
    workflow: Workflow,
    levels: string[][],
    context: ExecutionContext,
    execution: WorkflowExecution
  ): Promise<void> {
    const totalLevels = levels.length
    const nodeResults = new Map<string, any>()

    for (let i = 0; i < levels.length; i++) {
      const levelNodes = levels[i]
      const currentLevel = i + 1

      this.emit('level:started', { level: currentLevel, totalLevels, nodes: levelNodes })

      // 并行执行当前层级的节点
      const promises = levelNodes.map(async (nodeId) => {
        return this.executeNode(workflow, nodeId, context, nodeResults)
      })

      const results = await Promise.all(promises)

      // 保存结果
      results.forEach(result => {
        nodeResults.set(result.nodeId, result)
        if (execution.results) {
          execution.results.push(result)
        }
      })

      // 更新进度
      execution.progress = Math.round((currentLevel / totalLevels) * 100)
      this.emit('level:completed', { level: currentLevel, totalLevels })

      // 检查是否有失败的节点
      const failedResults = results.filter(r => r.status === 'error')
      if (failedResults.length > 0) {
        throw new Error(`节点执行失败: ${failedResults.map(r => r.error).join(', ')}`)
      }
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    workflow: Workflow,
    nodeId: string,
    context: ExecutionContext,
    nodeResults: Map<string, any>
  ): Promise<any> {
    const node = workflow.nodes.find(n => n.id === nodeId)
    if (!node) {
      throw new Error(`节点 ${nodeId} 不存在`)
    }

    this.emit('node:started', { nodeId, nodeName: node.name })

    try {
      // 获取节点的输入值
      const nodeInstance = NodeFactory.createNode(node.type, node)

      // 将上游节点的结果作为输入
      workflow.edges
        .filter(edge => edge.to === nodeId)
        .forEach(edge => {
          const upstreamResult = nodeResults.get(edge.from)
          if (upstreamResult && upstreamResult.data) {
            // 设置节点的输入参数
            const inputPort = nodeInstance.inputs.find((inp: any) => inp.id === edge.toPort)
            if (inputPort) {
              inputPort.value = upstreamResult.data
            }
          }
        })

      // 执行节点
      const result = await nodeInstance.execute(context)

      this.emit('node:completed', { nodeId, nodeName: node.name, result })

      return result
    } catch (error) {
      this.emit('node:failed', { nodeId, nodeName: node.name, error })
      throw error
    }
  }

  /**
   * 取消执行
   */
  cancel(executionId: string): void {
    const execution = this.executions.get(executionId)
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled'
      execution.endTime = new Date().toISOString()
      this.emit('execution:cancelled', { executionId })
    }
  }

  /**
   * 获取执行状态
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId)
  }

  /**
   * 获取所有执行记录
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values())
  }

  /**
   * 事件监听
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  /**
   * 移除事件监听
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }

  /**
   * 验证工作流
   */
  validate(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查节点是否存在
    const nodeIds = new Set(workflow.nodes.map(n => n.id))
    workflow.nodes.forEach(node => {
      if (!node.id) {
        errors.push(`节点缺少 ID`)
      }
    })

    // 检查连接是否有效
    workflow.edges.forEach(edge => {
      if (!nodeIds.has(edge.from)) {
        errors.push(`连接的源节点 ${edge.from} 不存在`)
      }
      if (!nodeIds.has(edge.to)) {
        errors.push(`连接的目标节点 ${edge.to} 不存在`)
      }
    })

    // 检查是否有循环依赖
    const hasCycle = this.detectCycle(workflow)
    if (hasCycle) {
      errors.push('工作流存在循环依赖')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 检测循环依赖
   */
  private detectCycle(workflow: Workflow): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const adjList = new Map<string, string[]>()

    workflow.nodes.forEach(node => {
      adjList.set(node.id, [])
    })

    workflow.edges.forEach(edge => {
      const list = adjList.get(edge.from) || []
      list.push(edge.to)
      adjList.set(edge.from, list)
    })

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId)
      recursionStack.add(nodeId)

      const neighbors = adjList.get(nodeId) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) {
            return true
          }
        } else if (recursionStack.has(neighbor)) {
          return true
        }
      }

      recursionStack.delete(nodeId)
      return false
    }

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) {
          return true
        }
      }
    }

    return false
  }
}
