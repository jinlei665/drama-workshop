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

// 人物库存储（通用人物模板）
export const memoryCharacterLibrary: Array<{
  id: string
  name: string
  description?: string
  appearance?: string
  personality?: string
  tags: string[]
  imageUrl?: string
  frontViewKey?: string
  style?: string
  createdAt: string
}> = []

// ID 计数器
let idCounter = 1

/**
 * 生成唯一 ID
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
