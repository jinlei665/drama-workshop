/**
 * 阶段二：分段详解
 * 输入单个 chunk + 上下文 → 输出详细分镜列表
 */

import { invokeLLM, parseLLMJson } from '@/lib/ai'
import { buildPhase2Prompt, type Phase1Character, type Phase2Scene, type Phase2Result } from './prompts'
import type { Chunk } from './chunker'

export interface Phase2Context {
  styleDescription: string
  characters: Phase1Character[]
  currentSceneIndex: number
  currentSceneLocation: string
  previousShotSummary: string | null
  maxDurationPerShotSec: number
}

export interface Phase2Output {
  success: boolean
  scenes?: Phase2Scene[]
  lastShotSummary?: string
  error?: string
}

/**
 * 执行单个 chunk 的阶段二解析
 */
export async function runPhase2Chunk(
  chunk: Chunk,
  totalChunks: number,
  context: Phase2Context
): Promise<Phase2Output> {
  const prompt = buildPhase2Prompt({
    chunkContent: chunk.text,
    chunkId: chunk.chunkId,
    totalChunks,
    characters: context.characters,
    currentSceneIndex: context.currentSceneIndex,
    currentSceneLocation: context.currentSceneLocation,
    maxDurationPerShotSec: context.maxDurationPerShotSec,
    previousShotSummary: context.previousShotSummary,
    styleDescription: context.styleDescription,
  })

  let result: Phase2Result
  try {
    const response = await invokeLLM(
      [{ role: 'user', content: prompt }],
      { thinking: 'disabled' }
    )
    result = parseLLMJson<Phase2Result>(response)
  } catch (err) {
    console.error(`[Phase2] Chunk ${chunk.chunkId} LLM call failed:`, err)
    return {
      success: false,
      error: `第 ${chunk.chunkId} 块解析失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!result.scenes || !Array.isArray(result.scenes) || result.scenes.length === 0) {
    return {
      success: false,
      error: `第 ${chunk.chunkId} 块解析返回了空的分镜列表`,
    }
  }

  // 过滤无效分镜（缺少 sceneNumber 或 title）
  const validScenes = result.scenes.filter(s => s && typeof s.sceneNumber === 'number' && s.title)
  if (validScenes.length === 0) {
    return {
      success: false,
      error: `第 ${chunk.chunkId} 块所有分镜数据无效`,
    }
  }

  // 生成最后一个分镜的摘要，用于传递到下一个 chunk
  const lastScene = validScenes[validScenes.length - 1]
  const lastShotSummary =
    `[分镜${lastScene.sceneNumber}] ${lastScene.title}：${lastScene.location || '未知地点'}，` +
    `${lastScene.timeOfDay || ''}，${lastScene.shotType || '中景'}，` +
    `${lastScene.action || lastScene.description?.slice(0, 50) || ''}，情绪：${lastScene.emotion || '中性'}`

  return {
    success: true,
    scenes: validScenes,
    lastShotSummary,
  }
}

/**
 * 批量执行阶段二：逐个处理所有 chunks
 *
 * @param chunks 分块列表
 * @param context 上下文信息（不含动态字段）
 * @param onProgress 进度回调
 */
export async function runPhase2All(
  chunks: Chunk[],
  context: {
    styleDescription: string
    characters: Phase1Character[]
    sceneLocations: Array<{ index: number; location: string }>
    maxDurationPerShotSec: number
  },
  onProgress?: (current: number, total: number, chunkResult: Phase2Output) => void
): Promise<{ allScenes: Phase2Scene[]; errors: string[] }> {
  const allScenes: Phase2Scene[] = []
  const errors: string[] = []
  let previousSummary: string | null = null
  const totalChunks = chunks.length

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const firstSceneIdx = chunk.sceneIndices[0]
    const locationInfo = context.sceneLocations.find(l => l.index === firstSceneIdx)
    const currentLocation = locationInfo?.location || '未知场景'

    // 计算当前chunk的起始分镜编号（已生成的分镜数 + 1）
    const currentSceneIndex = allScenes.length + 1

    const result = await runPhase2Chunk(chunk, totalChunks, {
      styleDescription: context.styleDescription,
      characters: context.characters,
      currentSceneIndex,
      currentSceneLocation: currentLocation,
      previousShotSummary: previousSummary,
      maxDurationPerShotSec: context.maxDurationPerShotSec,
    })

    if (result.success && result.scenes) {
      // 重新编号分镜，确保全局连续
      for (const scene of result.scenes) {
        scene.sceneNumber = allScenes.length + 1
        allScenes.push(scene)
      }
      previousSummary = result.lastShotSummary || null
    } else {
      errors.push(`Chunk ${chunk.chunkId}: ${result.error || '未知错误'}`)
    }

    onProgress?.(i + 1, totalChunks, result)
  }

  return { allScenes, errors }
}
