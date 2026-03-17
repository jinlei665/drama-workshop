/**
 * 核心类型定义
 * 统一的类型系统，确保类型安全
 */

// ============================================
// 项目状态
// ============================================

/** 项目状态 */
export type ProjectStatus = 'draft' | 'analyzing' | 'ready' | 'generating' | 'completed' | 'error'

/** 节点状态 */
export type NodeStatus = 'idle' | 'pending' | 'running' | 'completed' | 'error' | 'skipped'

/** 生成状态 */
export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'error'

// ============================================
// 项目
// ============================================

export interface Project {
  id: string
  name: string
  description?: string
  sourceContent: string
  sourceType: 'novel' | 'script'
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  /** 项目统计 */
  stats?: ProjectStats
  /** 项目元数据 */
  metadata?: Record<string, unknown>
}

export interface ProjectStats {
  characterCount: number
  sceneCount: number
  generatedImages: number
  generatedVideos: number
}

export interface CreateProjectInput {
  name: string
  description?: string
  sourceContent: string
  sourceType?: 'novel' | 'script'
}

// ============================================
// 人物
// ============================================

export interface Character {
  id: string
  projectId?: string
  name: string
  description?: string
  appearance?: string
  personality?: string
  gender?: string
  age?: string
  style?: string
  imageUrl?: string
  tags?: string[]
  /** 角色造型图 */
  views?: CharacterViews
  /** 配音配置 */
  voice?: CharacterVoice
  status?: GenerationStatus
  createdAt: string
  updatedAt: string
}

export interface CharacterViews {
  front?: string  // 正面图 URL
  side?: string   // 侧面图 URL
  back?: string   // 背面图 URL
  reference?: string // 参考图 URL
}

export interface CharacterVoice {
  id?: string
  style?: string
  sampleUrl?: string
}

// ============================================
// 分镜
// ============================================

export interface Scene {
  id: string
  projectId: string
  episodeId?: string
  sceneNumber: number
  title?: string
  description: string
  dialogue?: string
  action?: string
  emotion?: string
  characterIds: string[]
  /** 生成的媒体 */
  media: SceneMedia
  /** 元数据 */
  metadata: SceneMetadata
  status: GenerationStatus
  createdAt: string
  updatedAt: string
}

export interface SceneMedia {
  imageUrl?: string
  imageKey?: string
  videoUrl?: string
  videoKey?: string
  lastFrameUrl?: string
}

export interface SceneMetadata {
  shotType?: ShotType
  cameraMovement?: CameraMovement
  duration?: number
  transition?: Transition
}

/** 景别 */
export type ShotType = 
  | 'extreme-long'   // 大远景
  | 'long'           // 远景
  | 'full'           // 全景
  | 'medium'         // 中景
  | 'medium-close'   // 中近景
  | 'close-up'       // 近景
  | 'extreme-close'  // 特写

/** 镜头运动 */
export type CameraMovement = 
  | 'static'         // 固定
  | 'push'           // 推镜
  | 'pull'           // 拉镜
  | 'pan'            // 摇镜
  | 'tilt'           // 倾斜
  | 'track'          // 跟拍
  | 'crane'          // 升降
  | 'dolly'          // 移动

/** 转场效果 */
export type Transition = 
  | 'cut'            // 直切
  | 'fade'           // 淡入淡出
  | 'dissolve'       // 叠化
  | 'wipe'           // 擦除
  | 'zoom'           // 缩放

// ============================================
// 剧集
// ============================================

export interface Episode {
  id: string
  projectId: string
  seasonNumber: number
  episodeNumber: number
  title: string
  description?: string
  mergedVideoUrl?: string
  mergedVideoKey?: string
  status: GenerationStatus
  createdAt: string
  updatedAt: string
}

// ============================================
// 工作流节点
// ============================================

export type NodeType = 
  | 'input'          // 输入节点
  | 'analyze'        // 分析节点
  | 'character'      // 人物生成节点
  | 'scene'          // 分镜生成节点
  | 'video'          // 视频生成节点
  | 'merge'          // 合并节点
  | 'output'         // 输出节点

export interface WorkflowNode {
  id: string
  type: string
  label?: string
  status?: NodeStatus
  progress?: number  // 0-100
  error?: string
  data?: Record<string, unknown>
  inputs?: string[]   // 输入节点 ID
  outputs?: string[]  // 输出节点 ID
  position?: { x: number; y: number }
}

export interface Workflow {
  id: string
  projectId: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  status: NodeStatus
  createdAt: string
  updatedAt: string
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
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
// API 响应
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  message?: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ============================================
// AI 分析结果
// ============================================

export interface AnalysisResult {
  characters: ExtractedCharacter[]
  scenes: ExtractedScene[]
  summary?: string
}

export interface ExtractedCharacter {
  name: string
  description: string
  appearance: string
  personality: string
  tags: string[]
}

export interface ExtractedScene {
  sceneNumber: number
  title: string
  description: string
  dialogue?: string
  action?: string
  emotion?: string
  shotType?: ShotType
  cameraMovement?: CameraMovement
  characterNames: string[]
}

// ============================================
// 设置
// ============================================

export interface UserSettings {
  llm: AIModelConfig
  image: AIModelConfig
  video: AIModelConfig
  voice: AIModelConfig
}

export interface AIModelConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  options?: Record<string, unknown>
}

// ============================================
// 事件和通知
// ============================================

export type EventType = 
  | 'project:created'
  | 'project:updated'
  | 'project:deleted'
  | 'analyze:started'
  | 'analyze:completed'
  | 'analyze:error'
  | 'generate:started'
  | 'generate:progress'
  | 'generate:completed'
  | 'generate:error'

export interface WorkflowEvent {
  type: EventType
  nodeId?: string
  data?: Record<string, unknown>
  timestamp: string
}
