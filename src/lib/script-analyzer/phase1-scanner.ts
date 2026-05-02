/**
 * 第一阶段：全局扫描
 * 快速提取角色列表、场景列表、预估分镜数等
 */

import { GlobalScanResult } from './types'
import { PHASE1_SYSTEM_PROMPT, buildPhase1UserPrompt } from './prompts'
import { invokeLLM, parseLLMJson, getServerAIConfig, getUserLLMConfig } from '@/lib/ai'
import { invokeCozeDirect, getCozeDirectConfig } from '@/lib/ai/coze-direct'
import { OpenAICompatibleClient } from '@/lib/ai/openai-compatible'

/**
 * 执行全局扫描
 */
export async function performGlobalScan(
  content: string,
  options?: {
    onProgress?: (stage: string) => void
  }
): Promise<GlobalScanResult> {
  const aiConfig = await getServerAIConfig()
  const llmConfig = await getUserLLMConfig()

  options?.onProgress?.('正在调用AI进行全局扫描...')

  const messages = [
    { role: 'system' as const, content: PHASE1_SYSTEM_PROMPT },
    { role: 'user' as const, content: buildPhase1UserPrompt(content) },
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
      console.warn('[Phase1Scanner] Custom LLM failed, falling back to Coze')
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
  const result = parseLLMJson<GlobalScanResult>(responseContent || '{}')

  if (!result) {
    throw new Error('全局扫描解析失败')
  }

  // 验证必要字段
  if (!result.characters) result.characters = []
  if (!result.sceneOutlines) result.sceneOutlines = []
  if (!result.sceneBoundaries) result.sceneBoundaries = []
  if (!result.totalScenesEstimate) result.totalScenesEstimate = result.sceneOutlines.length * 2
  if (!result.scriptType) result.scriptType = 'mixed'
  if (!result.overallTone) result.overallTone = '待确定'

  console.log('[Phase1Scanner] Global scan completed:', {
    charactersCount: result.characters.length,
    scenesCount: result.sceneOutlines.length,
    estimatedTotalScenes: result.totalScenesEstimate,
  })

  return result
}

/**
 * 智能分块：基于场景边界进行分块
 * 如果单个场景过长，再按段落分割
 */
export function smartChunkByScenes(
  content: string,
  sceneBoundaries: Array<{ sceneName: string; startIndex: number; endIndex: number }>,
  maxChunkLength: number = 6000
): Array<{ content: string; sceneName: string; startIndex: number; endIndex: number }> {
  const chunks: Array<{ content: string; sceneName: string; startIndex: number; endIndex: number }> = []

  if (!sceneBoundaries || sceneBoundaries.length === 0) {
    // 没有场景边界信息，按固定长度分块
    return splitByFixedLength(content, maxChunkLength)
  }

  for (const boundary of sceneBoundaries) {
    const sceneContent = content.substring(boundary.startIndex, boundary.endIndex)

    // 如果单个场景超过最大长度，再拆分
    if (sceneContent.length > maxChunkLength) {
      const subChunks = splitByFixedLengthWithContext(
        sceneContent,
        maxChunkLength,
        boundary.sceneName,
        boundary.startIndex
      )
      chunks.push(...subChunks)
    } else {
      chunks.push({
        content: sceneContent,
        sceneName: boundary.sceneName,
        startIndex: boundary.startIndex,
        endIndex: boundary.endIndex,
      })
    }
  }

  return chunks
}

/**
 * 固定长度分块（带场景名）
 */
function splitByFixedLength(
  content: string,
  maxChunkLength: number
): Array<{ content: string; sceneName: string; startIndex: number; endIndex: number }> {
  const chunks: Array<{ content: string; sceneName: string; startIndex: number; endIndex: number }> = []
  let startIdx = 0
  let chunkNum = 1

  while (startIdx < content.length) {
    let endIdx = Math.min(startIdx + maxChunkLength, content.length)

    // 尝试在自然断点分割
    if (endIdx < content.length) {
      const chunk = content.substring(startIdx, endIdx)
      const lastNewline = chunk.lastIndexOf('\n')
      const lastPeriod = chunk.lastIndexOf('。')
      const lastPunctuation = Math.max(lastNewline, lastPeriod)

      if (lastPunctuation > maxChunkLength * 0.6) {
        endIdx = startIdx + lastPunctuation + 1
      }
    }

    const chunkContent = content.substring(startIdx, endIdx)
    chunks.push({
      content: chunkContent,
      sceneName: `段落${chunkNum}`,
      startIndex: startIdx,
      endIndex: endIdx,
    })

    startIdx = endIdx
    chunkNum++
  }

  return chunks
}

/**
 * 带上下文的固定长度分块
 */
function splitByFixedLengthWithContext(
  content: string,
  maxChunkLength: number,
  sceneName: string,
  baseOffset: number
): Array<{ content: string; sceneName: string; startIndex: number; endIndex: number }> {
  const chunks: Array<{ content: string; sceneName: string; startIndex: number; endIndex: number }> = []
  let startIdx = 0
  let chunkNum = 1

  while (startIdx < content.length) {
    let endIdx = Math.min(startIdx + maxChunkLength, content.length)

    if (endIdx < content.length) {
      const chunk = content.substring(startIdx, endIdx)
      const lastNewline = chunk.lastIndexOf('\n')
      const lastPeriod = chunk.lastIndexOf('。')
      const lastPunctuation = Math.max(lastNewline, lastPeriod)

      if (lastPunctuation > maxChunkLength * 0.6) {
        endIdx = startIdx + lastPunctuation + 1
      }
    }

    const chunkContent = content.substring(startIdx, endIdx)
    chunks.push({
      content: chunkContent,
      sceneName: `${sceneName}（${chunkNum}）`,
      startIndex: baseOffset + startIdx,
      endIndex: baseOffset + endIdx,
    })

    startIdx = endIdx
    chunkNum++
  }

  return chunks
}
