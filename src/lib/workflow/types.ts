/**
 * 工作流系统核心类型定义
 */

// ============ 节点类型 ============

export type NodeType =
  | 'text-input'
  | 'image-input'
  | 'video-input'
  | 'audio-input'
  | 'script-input'
  | 'text-to-image'
  | 'image-to-image'
  | 'image-to-video'
  | 'text-to-video'
  | 'text-to-audio'
  | 'llm-process'
  | 'text-to-character'
  | 'character-triple-views'
  | 'text-to-voice'
  | 'script-to-scenes'
  | 'inpaint'
  | 'outpaint'
  | 'upscale'
  | 'remove-bg'
  | 'image-blend'
  | 'layer-merge'
  | 'video-compose'
  | 'export-image'
  | 'export-video'
  | 'export-audio'

export interface NodePort {
  id: string
  name: string
  type: 'text' | 'image' | 'video' | 'audio' | 'any'
  required: boolean
  connected: boolean
}

export interface NodeInput extends NodePort {
  defaultValue?: any
}

export interface NodeOutput extends NodePort {
  value?: any
}

export interface BaseNode {
  id: string
  type: NodeType
  name: string
  description?: string
  position: { x: number; y: number }
  inputs: NodeInput[]
  outputs: NodeOutput[]
  params: Record<string, any>
  status?: 'idle' | 'running' | 'completed' | 'failed'
  progress?: number  // 执行进度（0-100）
  result?: any
  error?: string
}

// ============ 连接类型 ============

export interface Edge {
  id: string
  from: string // 节点 ID
  to: string // 节点 ID
  fromPort: string // 输出端口 ID
  toPort: string // 输入端口 ID
  animated?: boolean
}

// ============ 工作流类型 ============

export interface Workflow {
  id: string
  projectId: string
  name: string
  description?: string
  nodes: BaseNode[]
  edges: Edge[]
  isTemplate?: boolean
  templateCategory?: string
  version: string
  system?: boolean  // 是否为系统工作流（只读）
  readonly?: boolean  // 是否只读
  status?: 'draft' | 'active' | 'archived'  // 工作流状态
  metadata?: {
    createdAt: string
    updatedAt: string
    author: string
    thumbnail?: string
  }
}

// ============ 执行上下文 ============

export interface ExecutionContext {
  workflowId: string
  executionId: string
  projectId: string
  startTime: number
  variables: Record<string, any>
  assets: Record<string, Asset>
  config: {
    maxRetries: number
    timeout: number
  }
}

// ============ 执行结果 ============

export interface NodeResult {
  nodeId: string
  status: 'success' | 'error'
  data?: any
  error?: string
  duration: number
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  projectId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  results?: NodeResult[]
  error?: string
  progress: number
  currentStep?: string
}

// ============ 资产类型 ============

export type AssetType = 'image' | 'video' | 'audio' | 'text'

export interface Asset {
  id: string
  projectId: string
  name: string
  type: AssetType
  storageKey: string
  storageUrl: string
  metadata?: Record<string, any>
  tags: string[]
  createdAt: string
  updatedAt: string
}

// ============ Agent 类型 ============

export interface AgentIntent {
  type: 'create-short-drama' | 'create-comic' | 'create-poster' | 'design-character' | 'enhance-image' | 'custom'
  confidence: number
  entities: {
    characters?: string[]
    scenes?: string[]
    style?: string
    duration?: number
    format?: string
  }
}

export interface AgentSuggestion {
  type: 'add-node' | 'remove-node' | 'adjust-param' | 'reorder'
  description: string
  nodeId?: string
  nodeName?: string
  param?: string
  currentValue?: any
  suggestedValue?: any
  reason: string
}

// ============ 模板类型 ============

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'quick-start' | 'character-design' | 'comic' | 'poster' | 'enhancement'
  icon?: string
  thumbnail?: string
  workflow: Workflow
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}
