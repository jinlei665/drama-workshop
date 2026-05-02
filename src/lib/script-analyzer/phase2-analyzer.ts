/**
 * 第二阶段：分段详解
 * 基于第一阶段结果进行详细的分镜解析
 */

import { ParsedScene, ParsedCharacter, AnalyzeResult, SceneSummary, GlobalScanResult } from './types'
import { buildPhase2SystemPrompt, buildPhase2UserPrompt } from './prompts'
import { invokeLLM, parseLLMJson, getServerAIConfig, getUserLLMConfig } from '@/lib/ai'
import { invokeCozeDirect, getCozeDirectConfig } from '@/lib/ai/coze-direct'
import { OpenAICompatibleClient } from '@/lib/ai/openai-compatible'

/**
 * 分析单个段落
 */
export async function analyzeChunk(
  chunkContent: string,
  chunkIndex: number,
  totalChunks: number,
  globalScanResult: GlobalScanResult,
  recentScenesSummary: SceneSummary[],
  styleContext: string,
  options?: {
    onProgress?: (stage: string) => void
  }
): Promise<ParsedScene[]> {
  const aiConfig = await getServerAIConfig()
  const llmConfig = await getUserLLMConfig()

  options?.onProgress?.(`正在分析第 ${chunkIndex + 1}/${totalChunks} 段...`)

  // 构建当前场景名称（尝试从上下文推断）
  const currentScene = inferCurrentScene(chunkContent, globalScanResult)
  const isLastChunk = chunkIndex === totalChunks - 1

  const systemPrompt = buildPhase2SystemPrompt({
    globalScanResult,
    currentSceneName: currentScene,
    currentChunkIndex: chunkIndex,
    totalChunks,
    recentScenesSummary,
    styleContext,
  })

  const userPrompt = buildPhase2UserPrompt(chunkContent, currentScene, isLastChunk)

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ]

  let responseContent: string | undefined

  // 优先使用用户配置的 LLM Provider
  const isVolcengineModel = llmConfig.model?.startsWith('doubao-seed-')
  const useCustomLLMProvider =
    llmConfig.provider && (llmConfig.provider !== 'doubao' || isVolcengineModel)

  if (useCustomLLMProvider && llmConfig.apiKey) {
    try {
      const client = new OpenAICompatibleClient({
        apiKey: llmConfig.apiKey || '',
        baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
        model: llmConfig.model || 'gpt-3.5-turbo',
      })
      responseContent = await client.invoke(messages, { temperature: 0.3 })
    } catch (err) {
      console.warn('[Phase2Analyzer] Custom LLM failed, falling back to Coze')
    }
  }

  // 回退到 Coze
  if (!responseContent) {
    const cozeDirectConfig = await getCozeDirectConfig()
    const shouldUseCozeDirect =
      (llmConfig.provider === 'doubao' || !llmConfig.provider) &&
      cozeDirectConfig?.botId &&
      cozeDirectConfig?.apiKey

    if (shouldUseCozeDirect) {
      responseContent = await invokeCozeDirect(messages, cozeDirectConfig)
    } else if (aiConfig.apiKey) {
      responseContent = await invokeLLM(
        messages,
        { model: aiConfig.model, temperature: 0.3 },
        {
          apiKey: aiConfig.apiKey,
          baseUrl: aiConfig.baseUrl,
          model: aiConfig.model,
        }
      )
    } else {
      responseContent = await invokeLLM(messages, { model: aiConfig.model, temperature: 0.3 })
    }
  }

  // 解析结果
  const result = parseLLMJson<{ scenes: ParsedScene[] }>(responseContent || '{}')

  if (!result || !result.scenes) {
    console.warn(`[Phase2Analyzer] Chunk ${chunkIndex + 1} returned empty scenes`)
    return []
  }

  console.log(`[Phase2Analyzer] Chunk ${chunkIndex + 1}: ${result.scenes.length} scenes parsed`)

  return result.scenes
}

/**
 * 推断当前段落所属的场景
 */
function inferCurrentScene(
  chunkContent: string,
  globalScanResult: GlobalScanResult
): string {
  // 从场景大纲中找匹配
  const chunkStart = chunkContent.substring(0, 100).toLowerCase()

  for (const outline of globalScanResult.sceneOutlines) {
    // 检查场景名中的关键词是否在开头出现
    const sceneKeywords = outline.sceneName.replace(/[，。、\s]/g, '').toLowerCase()
    if (sceneKeywords.length > 2 && chunkStart.includes(sceneKeywords.substring(0, 4))) {
      return outline.sceneName
    }
  }

  // 返回第一个匹配场景的名称（如果没找到精确匹配）
  if (globalScanResult.sceneOutlines.length > 0) {
    return globalScanResult.sceneOutlines[0].sceneName
  }

  return '未识别场景'
}

/**
 * 合并多个段落的结果
 */
export function mergeChunkResults(
  chunkResults: ParsedScene[][],
  globalScanResult: GlobalScanResult
): AnalyzeResult {
  const allCharacters: Map<string, ParsedCharacter> = new Map()
  const allScenes: ParsedScene[] = []

  let sceneOffset = 0

  for (let i = 0; i < chunkResults.length; i++) {
    const scenes = chunkResults[i]

    // 从场景中提取人物
    for (const scene of scenes) {
      const characterNames = scene.characters || scene.characterNames || []

      for (const name of characterNames) {
        if (!allCharacters.has(name)) {
          // 尝试从全局扫描结果中找到该人物
          const globalChar = globalScanResult.characters.find(
            c => c.name === name || c.briefDescription.includes(name)
          )

          allCharacters.set(name, {
            name,
            description: globalChar?.briefDescription || `${name}是一个角色`,
            appearance: '', // 会在详细分析时补充
            personality: '',
            tags: globalChar?.role ? [globalChar.role] : [],
          })
        }
      }
    }

    // 合并场景，重新编号
    for (const scene of scenes) {
      allScenes.push({
        ...scene,
        sceneNumber: scene.sceneNumber + sceneOffset,
      })
    }

    // 计算下一段的场景偏移（累加当前段的场景数量）
    sceneOffset += scenes.length
  }

  return {
    characters: Array.from(allCharacters.values()),
    scenes: allScenes,
  }
}

/**
 * 获取最近N个分镜的摘要
 */
export function getRecentScenesSummary(
  scenes: ParsedScene[],
  count: number = 5
): SceneSummary[] {
  if (scenes.length === 0) return []

  const recentScenes = scenes.slice(-count)
  return recentScenes.map(s => ({
    sceneNumber: s.sceneNumber,
    title: s.title,
    characters: s.characters || s.characterNames || [],
    emotion: s.emotion || '',
  }))
}
