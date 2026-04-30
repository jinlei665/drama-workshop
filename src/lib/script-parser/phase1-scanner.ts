/**
 * 阶段一：全局扫描
 * 输入完整剧本 → 输出角色概要 + 场景列表 + 预估分镜数 + 分块方案
 */

import { invokeLLM, parseLLMJson } from '@/lib/ai'
import { buildPhase1Prompt, type Phase1Result, type ChunkPlan } from './prompts'
import { chunkScript, generateChunkPlan } from './chunker'

export interface Phase1Output {
  success: boolean
  preview?: {
    scriptType: string
    tone: string
    estimatedTotalDurationSec: number
    totalEstimatedScenes: number
    characters: Phase1Result['characters']
    sceneOutline: Phase1Result['sceneOutline']
  }
  chunkPlan?: ChunkPlan[]
  rawPhase1Result?: Phase1Result
  error?: string
}

/**
 * 执行阶段一：全局扫描
 *
 * 用完整剧本调用 LLM，提取角色概要、场景大纲和预估信息。
 * 返回的结果数据量小（仅限于大纲级），不会超出 LLM 输出限制。
 */
export async function runPhase1(
  scriptContent: string,
  styleDescription: string
): Promise<Phase1Output> {
  // 1. 构建 prompt 并调用 LLM
  const prompt = buildPhase1Prompt(scriptContent, styleDescription)

  let result: Phase1Result
  try {
    const response = await invokeLLM(
      [{ role: 'user', content: prompt }],
      { thinking: 'disabled' }
    )
    result = parseLLMJson<Phase1Result>(response)
  } catch (err) {
    console.error('[Phase1] LLM call failed:', err)
    return {
      success: false,
      error: `第一阶段扫描失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // 2. 验证必要字段
  if (!result.characters || !Array.isArray(result.characters)) {
    return {
      success: false,
      error: '第一阶段返回数据缺少必要字段（characters）',
      rawPhase1Result: result,
    }
  }

  if (!result.sceneOutline || !Array.isArray(result.sceneOutline)) {
    return {
      success: false,
      error: '第一阶段返回数据缺少必要字段（sceneOutline）',
      rawPhase1Result: result,
    }
  }

  // 3. 用分块器对剧本做智能分块
  const chunks = chunkScript(scriptContent)
  const chunkPlan = generateChunkPlan(chunks)

  // 4. 计算总预估分镜数
  const totalEstimatedScenes = result.sceneOutline.reduce(
    (sum, s) => sum + (s.estimatedShots || 1),
    0
  )

  return {
    success: true,
    preview: {
      scriptType: result.scriptType || '未知',
      tone: result.tone || '未知',
      estimatedTotalDurationSec: result.estimatedTotalDurationSec || 0,
      totalEstimatedScenes,
      characters: result.characters,
      sceneOutline: result.sceneOutline,
    },
    chunkPlan,
    rawPhase1Result: result,
  }
}
