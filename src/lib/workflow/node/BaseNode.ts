/**
 * 节点基类和节点系统
 */

import { BaseNode, NodeType, ExecutionContext, NodeResult } from '../types'

/**
 * 节点基类
 * 所有节点都应继承此类
 */
export abstract class BaseNodeClass {
  id: string
  type: NodeType
  name: string
  description?: string
  position: { x: number; y: number }
  inputs: any[]
  outputs: any[]
  params: Record<string, any>
  status: 'idle' | 'running' | 'completed' | 'failed' = 'idle'
  result?: any
  error?: string

  constructor(config: Partial<BaseNode>) {
    this.id = config.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.type = config.type!
    this.name = config.name!
    this.description = config.description
    this.position = config.position || { x: 0, y: 0 }
    this.inputs = config.inputs || []
    this.outputs = config.outputs || []
    this.params = config.params || {}
  }

  /**
   * 获取节点的参数 Schema
   */
  abstract getParamSchema(): Record<string, any>

  /**
   * 验证节点参数
   */
  validateParams(): { valid: boolean; errors: string[] } {
    const schema = this.getParamSchema()
    const errors: string[] = []

    for (const [key, spec] of Object.entries(schema)) {
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
      if (spec.enum && value !== undefined && !spec.enum.includes(value)) {
        errors.push(`参数 "${key}" 的值 "${value}" 不在允许的选项中: ${spec.enum.join(', ')}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取输入值
   */
  getInputValue(portId: string, context: ExecutionContext): any {
    const input = this.inputs.find((i: any) => i.id === portId)
    if (!input) {
      throw new Error(`输入端口 "${portId}" 不存在`)
    }

    // 如果有默认值且没有连接，返回默认值
    if (!input.connected && 'defaultValue' in input) {
      return input.defaultValue
    }

    // TODO: 从工作流引擎获取连接的节点输出
    // 这里需要工作流引擎的上下文来查找上游节点的输出
    return null
  }

  /**
   * 执行节点
   */
  async execute(context: ExecutionContext): Promise<NodeResult> {
    const startTime = Date.now()

    try {
      this.status = 'running'

      // 验证参数
      const validation = this.validateParams()
      if (!validation.valid) {
        throw new Error(`参数验证失败: ${validation.errors.join(', ')}`)
      }

      // 执行节点的核心逻辑
      const result = await this.process(context)

      this.status = 'completed'
      this.result = result

      return {
        nodeId: this.id,
        status: 'success',
        data: result,
        duration: Date.now() - startTime
      }
    } catch (error) {
      this.status = 'failed'
      this.error = error instanceof Error ? error.message : '未知错误'

      return {
        nodeId: this.id,
        status: 'error',
        error: this.error,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 节点的核心处理逻辑，由子类实现
   */
  protected abstract process(context: ExecutionContext): Promise<any>

  /**
   * 序列化为 JSON
   */
  toJSON(): BaseNode {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      description: this.description,
      position: this.position,
      inputs: this.inputs,
      outputs: this.outputs,
      params: this.params,
      status: this.status,
      result: this.result,
      error: this.error
    }
  }
}

/**
 * 节点构造函数类型
 */
type NodeConstructor = new (config: Partial<BaseNode>) => BaseNodeClass

/**
 * 节点工厂
 * 用于创建和管理节点实例
 */
export class NodeFactory {
  private static nodeClasses: Map<NodeType, NodeConstructor> = new Map()

  /**
   * 注册节点类型
   */
  static registerNode(type: NodeType, nodeClass: NodeConstructor) {
    this.nodeClasses.set(type, nodeClass)
  }

  /**
   * 创建节点实例
   */
  static createNode(type: NodeType, config: Partial<BaseNode>): BaseNodeClass {
    const NodeClass = this.nodeClasses.get(type)
    if (!NodeClass) {
      throw new Error(`未知的节点类型: ${type}`)
    }
    return new NodeClass(config)
  }

  /**
   * 获取所有已注册的节点类型
   */
  static getNodeTypes(): NodeType[] {
    return Array.from(this.nodeClasses.keys())
  }

  /**
   * 获取节点类型的参数 Schema
   */
  static getNodeSchema(type: NodeType): Record<string, any> {
    const NodeClass = this.nodeClasses.get(type)
    if (!NodeClass) {
      throw new Error(`未知的节点类型: ${type}`)
    }
    // 创建一个临时实例来获取 schema
    const tempInstance = new NodeClass({ type, name: 'temp' } as any)
    return tempInstance.getParamSchema()
  }
}
