/**
 * 内存存储模块
 * 用于开发环境，当数据库不可用时
 */

// 项目存储
export const memoryProjects: Array<{
  id: string
  name: string
  description?: string
  sourceContent: string
  sourceType: string
  style?: string
  status: string
  createdAt: string
  updatedAt: string
}> = []

// 人物存储
export const memoryCharacters: Array<{
  id: string
  projectId: string
  name: string
  description?: string
  appearance?: string
  personality?: string
  gender?: string
  age?: string
  style?: string
  imageUrl?: string
  tags: string[]
  status: string
  frontViewKey?: string
  sideViewKey?: string
  backViewKey?: string
  createdAt: string
}> = []

// 分镜存储
export const memoryScenes: Array<{
  id: string
  projectId: string
  sceneNumber: number
  title?: string
  description: string
  dialogue?: string
  action?: string
  emotion?: string
  characterIds: string[]
  status: string
  imageUrl?: string
  videoUrl?: string
  videoStatus?: string
  imageKey?: string
  lastFrameUrl?: string
  createdAt: string
}> = []

// 剧集存储
export const memoryEpisodes: Array<{
  id: string
  projectId: string
  episodeNumber: number
  title: string
  description?: string
  status: string
  createdAt: string
}> = []

// ID 计数器
let idCounter = 1

/**
 * 生成唯一 ID
 */
/**
 * 生成 UUID v4 格式的 ID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 生成唯一 ID
 * @param prefix 可选前缀，用于内存存储模式
 * @returns 内存存储模式返回带前缀的 ID，数据库模式返回 UUID
 */
export function generateId(prefix: string = ''): string {
  return prefix ? `${prefix}_${Date.now()}_${idCounter++}` : `${Date.now()}_${idCounter++}`
}

/**
 * 清空所有内存存储
 */
export function clearMemoryStorage(): void {
  memoryProjects.length = 0
  memoryCharacters.length = 0
  memoryScenes.length = 0
  memoryEpisodes.length = 0
}
