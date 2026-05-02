/**
 * 两阶段剧本解析类型定义
 */

/** 角色概要（第一阶段输出） */
export interface CharacterSummary {
  name: string
  role: 'protagonist' | 'supporting' | 'antagonist'
  briefDescription: string
  firstAppearance: string
}

/** 场景边界（用于智能分块） */
export interface SceneBoundary {
  sceneName: string
  startIndex: number
  endIndex: number
}

/** 场景大纲（第一阶段输出） */
export interface SceneOutline {
  sceneName: string
  summary: string
  characters: string[]
  estimatedScenes: number
}

/** 剧本类型 */
export type ScriptType = 'dialogue' | 'narration' | 'mixed'

/** 全局扫描结果（第一阶段输出） */
export interface GlobalScanResult {
  characters: CharacterSummary[]
  sceneOutlines: SceneOutline[]
  sceneBoundaries: SceneBoundary[]
  totalScenesEstimate: number
  scriptType: ScriptType
  overallTone: string
}

/** 分镜摘要（用于上下文传递） */
export interface SceneSummary {
  sceneNumber: number
  title: string
  characters: string[]
  emotion: string
}

/** 第二阶段上下文 */
export interface ChunkContext {
  phase: 'phase2'
  globalScanResult: GlobalScanResult
  currentSceneName: string
  currentChunkIndex: number
  totalChunks: number
  recentScenesSummary: SceneSummary[]
}

/** 解析后的角色 */
export interface ParsedCharacter {
  name: string
  description: string
  appearance: string
  personality: string
  signatureDetail?: string
  tags: string[]
}

/** 解析后的分镜 */
export interface ParsedScene {
  sceneNumber: number
  shotId?: number
  title: string
  durationMs?: number
  description: string
  videoPrompt?: string
  dialogue?: string
  action?: string
  emotion?: string
  emotionNote?: string
  characters?: string[]
  characterNames?: string[]
  firstFrameDescription?: string
  lastFrameDescription?: string
  continuity?: string
  transition?: string
  shotSegments?: ShotSegmentSimple[]
}

export interface ShotSegmentSimple {
  startTimeMs: number
  endTimeMs: number
  shotType: string
  description: string
}

/** 分析结果 */
export interface AnalyzeResult {
  characters: ParsedCharacter[]
  scenes: ParsedScene[]
}

/** 预估信息（返回给用户预览） */
export interface PreviewInfo {
  charactersCount: number
  characters: Array<{
    name: string
    role: string
    brief: string
  }>
  scenesEstimate: number
  sceneOutlines: Array<{
    name: string
    summary: string
    characters: string[]
  }>
  scriptType: ScriptType
  overallTone: string
  totalChunks: number
}
