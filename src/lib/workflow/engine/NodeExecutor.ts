/**
 * 节点执行器
 * 负责单个节点的执行逻辑
 */

import { BaseNode } from '../node/BaseNode'
import { ExecutionContext } from '../types'

export interface NodeExecutionResult {
  nodeId: string
  status: 'success' | 'error' | 'skipped'
  data?: any
  error?: string
  startTime: number
  endTime: number
  duration: number
}

export class NodeExecutor {
  private context: ExecutionContext

  constructor(context: ExecutionContext) {
    this.context = context
  }

  /**
   * 执行节点
   */
  async execute(node: BaseNode): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const result: NodeExecutionResult = {
      nodeId: node.id,
      status: 'success',
      startTime,
      endTime: 0,
      duration: 0
    }

    try {
      // 验证节点参数
      const validation = node.validate()
      if (!validation.valid) {
        throw new Error(`节点参数验证失败: ${validation.errors.join(', ')}`)
      }

      // 检查节点是否应该跳过（条件执行）
      if (this.shouldSkip(node)) {
        result.status = 'skipped'
        result.endTime = Date.now()
        result.duration = result.endTime - startTime
        return result
      }

      // 执行节点逻辑
      const data = await node.execute(this.context)
      result.data = data

    } catch (error) {
      result.status = 'error'
      result.error = error instanceof Error ? error.message : '未知错误'

      // 重试逻辑
      if (node.config?.retry && node.config.retry > 0) {
        return await this.retry(node, node.config.retry)
      }
    } finally {
      result.endTime = Date.now()
      result.duration = result.endTime - startTime
    }

    return result
  }

  /**
   * 重试节点执行
   */
  private async retry(node: BaseNode, maxRetries: number): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const result: NodeExecutionResult = {
      nodeId: node.id,
      status: 'success',
      startTime,
      endTime: 0,
      duration: 0
    }

    let lastError: string = ''

    for (let i = 0; i <= maxRetries; i++) {
      try {
        const delay = this.calculateRetryDelay(i)
        if (delay > 0) {
          await this.sleep(delay)
        }

        const data = await node.execute(this.context)
        result.data = data
        result.endTime = Date.now()
        result.duration = result.endTime - startTime
        return result
      } catch (error) {
        lastError = error instanceof Error ? error.message : '未知错误'
      }
    }

    result.status = 'error'
    result.error = lastError
    result.endTime = Date.now()
    result.duration = result.endTime - startTime
    return result
  }

  /**
   * 计算重试延迟（指数退避）
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000) // 最大10秒
  }

  /**
   * 检查节点是否应该跳过
   */
  private shouldSkip(node: BaseNode): boolean {
    // 检查条件表达式
    if (node.config?.condition) {
      try {
        const conditionResult = this.evaluateCondition(node.config.condition)
        return !conditionResult
      } catch (error) {
        console.error(`条件表达式解析失败: ${error}`)
        return false
      }
    }

    return false
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(expression: string): boolean {
    // 简单的条件表达式解析
    // 支持语法: ${variables.key} == value, ${variables.key} > 5, etc.
    try {
      const context = {
        variables: this.context.variables,
        assets: this.context.assets
      }

      // 替换变量
      let evalExpr = expression.replace(/\$\{([^}]+)\}/g, (_, path) => {
        const parts = path.split('.')
        let value: any = context
        for (const part of parts) {
          value = value[part]
        }
        return JSON.stringify(value)
      })

      return Function(`"use strict"; return (${evalExpr})`)()
    } catch (error) {
      throw new Error(`条件表达式评估失败: ${error}`)
    }
  }

  /**
   * 延迟执行
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 更新执行上下文
   */
  updateContext(updates: Partial<ExecutionContext>): void {
    Object.assign(this.context, updates)
  }

  /**
   * 获取上下文
   */
  getContext(): ExecutionContext {
    return this.context
  }
}

/**
 * 依赖处理器
 * 负责解析和管理节点之间的依赖关系
 */

export interface DependencyGraph {
  nodes: string[]
  edges: Map<string, string[]>
  inDegree: Map<string, number>
  outDegree: Map<string, number>
}

export class DependencyProcessor {
  /**
   * 构建依赖图
   */
  buildGraph(nodes: BaseNode[], edges: any[]): DependencyGraph {
    const nodeIds = new Set(nodes.map(n => n.id))
    const adjList = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()

    nodes.forEach(node => {
      adjList.set(node.id, [])
      inDegree.set(node.id, 0)
      outDegree.set(node.id, 0)
    })

    edges.forEach(edge => {
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        const list = adjList.get(edge.from) || []
        list.push(edge.to)
        adjList.set(edge.from, list)

        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
        outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1)
      }
    })

    return {
      nodes: nodes.map(n => n.id),
      edges: adjList,
      inDegree,
      outDegree
    }
  }

  /**
   * 拓扑排序
   * 返回可以并行执行的层级
   */
  topologicalSort(graph: DependencyGraph): string[][] {
    const levels: string[][] = []
    const queue: string[] = []
    const inDegree = new Map(graph.inDegree)

    // 找到所有入度为0的节点
    graph.nodes.forEach(nodeId => {
      if ((inDegree.get(nodeId) || 0) === 0) {
        queue.push(nodeId)
      }
    })

    while (queue.length > 0) {
      const level = [...queue]
      levels.push(level)
      queue.length = 0

      level.forEach(nodeId => {
        const neighbors = graph.edges.get(nodeId) || []
        neighbors.forEach(neighborId => {
          inDegree.set(neighborId, (inDegree.get(neighborId) || 0) - 1)
          if ((inDegree.get(neighborId) || 0) === 0) {
            queue.push(neighborId)
          }
        })
      })
    }

    // 检查是否有循环依赖
    if (levels.flat().length !== graph.nodes.length) {
      throw new Error('工作流存在循环依赖')
    }

    return levels
  }

  /**
   * 获取节点的依赖节点
   */
  getDependencies(nodeId: string, edges: any[]): string[] {
    return edges
      .filter(edge => edge.to === nodeId)
      .map(edge => edge.from)
  }

  /**
   * 获取节点的下游节点
   */
  getDownstream(nodeId: string, edges: any[]): string[] {
    return edges
      .filter(edge => edge.from === nodeId)
      .map(edge => edge.to)
  }

  /**
   * 检测关键路径
   */
  findCriticalPath(nodes: BaseNode[], edges: any[]): string[] {
    // 简化版本：返回最长路径
    const graph = this.buildGraph(nodes, edges)
    const levels = this.topologicalSort(graph)

    // 从最后一个层级往前回溯，找到最长路径
    const longestPath: string[] = []
    const pathLengths = new Map<string, number>()

    // 初始化
    graph.nodes.forEach(nodeId => {
      pathLengths.set(nodeId, 0)
    })

    // 按拓扑顺序更新路径长度
    levels.forEach(level => {
      level.forEach(nodeId => {
        const dependencies = this.getDependencies(nodeId, edges)
        if (dependencies.length === 0) {
          pathLengths.set(nodeId, 0)
        } else {
          const maxLength = Math.max(...dependencies.map(dep => pathLengths.get(dep) || 0))
          pathLengths.set(nodeId, maxLength + 1)
        }
      })
    })

    // 找到最长路径
    const maxLength = Math.max(...pathLengths.values())
    const endNodes = [...pathLengths.entries()].filter(([_, length]) => length === maxLength)

    if (endNodes.length > 0) {
      const endNode = endNodes[0][0]
      this.buildPath(endNode, edges, pathLengths, longestPath)
    }

    return longestPath.reverse()
  }

  /**
   * 构建路径
   */
  private buildPath(
    currentNodeId: string,
    edges: any[],
    pathLengths: Map<string, number>,
    path: string[]
  ): void {
    path.push(currentNodeId)

    const dependencies = this.getDependencies(currentNodeId, edges)
    if (dependencies.length > 0) {
      const maxLength = Math.max(...dependencies.map(dep => pathLengths.get(dep) || 0))
      const prevNode = dependencies.find(dep => (pathLengths.get(dep) || 0) === maxLength)
      if (prevNode) {
        this.buildPath(prevNode, edges, pathLengths, path)
      }
    }
  }

  /**
   * 并行度分析
   */
  analyzeParallelism(levels: string[][]): {
    maxParallelNodes: number
    avgParallelNodes: number
    totalLevels: number
  } {
    const maxParallelNodes = Math.max(...levels.map(level => level.length))
    const avgParallelNodes =
      levels.reduce((sum, level) => sum + level.length, 0) / levels.length

    return {
      maxParallelNodes,
      avgParallelNodes: Math.round(avgParallelNodes * 100) / 100,
      totalLevels: levels.length
    }
  }
}
