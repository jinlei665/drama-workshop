/**
 * 两阶段剧本解析主入口
 */

import { GlobalScanResult, PreviewInfo, AnalyzeResult, ParsedScene } from './types'
import { performGlobalScan, smartChunkByScenes } from './phase1-scanner'
import { analyzeChunk, mergeChunkResults, getRecentScenesSummary } from './phase2-analyzer'

/** 风格描述映射 */
const STYLE_DESCRIPTIONS: Record<string, string> = {
  realistic_cinema: '电影级写实风格，专业影视剧质感，电影级光影',
  realistic_drama: '短剧写实风格，现代短剧风格，自然光线',
  realistic_period: '古装写实风格，古风影视质感，唯美画面',
  realistic_idol: '偶像剧风格，韩剧/偶像剧风格，柔美滤镜',
  anime_3d_cn: '国漫3D动画风格，国产3D动画如斗罗大陆',
  anime_2d_cn: '国风2D动画风格，如魔道祖师',
  anime_jp: '日本动漫风格，如鬼灭之刃',
  anime_chibi: 'Q版萌系风格，可爱大头小身',
  art_watercolor: '水彩插画风格，柔和淡雅',
  art_ink: '中国传统水墨画风格',
  art_oil: '油画风格，厚重笔触',
  art_comic: '美式漫画风格，强对比',
}

/**
 * 构建风格上下文
 */
function buildStyleContext(style?: string, customStylePrompt?: string): string {
  let styleDescription = ''

  if (customStylePrompt) {
    styleDescription = customStylePrompt
  } else if (style && style !== 'custom') {
    styleDescription = STYLE_DESCRIPTIONS[style] || ''
  }

  if (!styleDescription) return ''

  return `\n\n## 画面风格要求\n你生成的所有画面描述必须严格遵循以下风格：\n**${styleDescription}**\n\n请在描述场景、人物外貌、动作时，都融入这种风格特征。`
}

/**
 * 执行两阶段解析
 */
export async function twoPhaseAnalyze(
  content: string,
  options: {
    style?: string
    customStylePrompt?: string
    onPhase1Progress?: (stage: string) => void
    onPhase2Progress?: (stage: string) => void
    skipPreview?: boolean // 是否跳过预览直接进入第二阶段
  } = {}
): Promise<{
  globalScanResult: GlobalScanResult
  previewInfo: PreviewInfo
  finalResult?: AnalyzeResult
}> {
  const { style, customStylePrompt, onPhase1Progress, onPhase2Progress, skipPreview = false } = options

  // ========== 第一阶段：全局扫描 ==========
  onPhase1Progress?.('正在分析剧本结构...')

  const globalScanResult = await performGlobalScan(content, {
    onProgress: onPhase1Progress,
  })

  // 计算分块信息
  const chunks = smartChunkByScenes(
    content,
    globalScanResult.sceneBoundaries,
    6000 // 减小单块大小，确保输出完整
  )

  // 构建预览信息
  const previewInfo: PreviewInfo = {
    charactersCount: globalScanResult.characters.length,
    characters: globalScanResult.characters.map(c => ({
      name: c.name,
      role: c.role,
      brief: c.briefDescription,
    })),
    scenesEstimate: globalScanResult.totalScenesEstimate,
    sceneOutlines: globalScanResult.sceneOutlines.map(o => ({
      name: o.sceneName,
      summary: o.summary,
      characters: o.characters,
    })),
    scriptType: globalScanResult.scriptType,
    overallTone: globalScanResult.overallTone,
    totalChunks: chunks.length,
  }

  console.log('[TwoPhaseAnalyze] Phase 1 completed:', {
    charactersCount: previewInfo.charactersCount,
    scenesEstimate: previewInfo.scenesEstimate,
    chunksCount: chunks.length,
  })

  // 如果需要预览，先返回预览信息
  if (!skipPreview) {
    return {
      globalScanResult,
      previewInfo,
      finalResult: undefined,
    }
  }

  // ========== 第二阶段：分段详解 ==========
  onPhase2Progress?.('开始生成分镜...')

  const styleContext = buildStyleContext(style, customStylePrompt)
  const chunkResults: Array<ParsedScene[]> = []
  let allScenes: Array<ParsedScene> = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    // 获取最近的分镜摘要用于上下文
    const recentScenesSummary = getRecentScenesSummary(allScenes, 5)

    const scenes = await analyzeChunk(
      chunk.content,
      i,
      chunks.length,
      globalScanResult,
      recentScenesSummary,
      styleContext,
      {
        onProgress: onPhase2Progress,
      }
    )

    chunkResults.push(scenes)
    allScenes.push(...scenes)
  }

  // 合并结果
  const finalResult = mergeChunkResults(chunkResults, globalScanResult)

  console.log('[TwoPhaseAnalyze] Phase 2 completed:', {
    totalCharacters: finalResult.characters.length,
    totalScenes: finalResult.scenes.length,
  })

  return {
    globalScanResult,
    previewInfo,
    finalResult,
  }
}

/**
 * 单阶段解析（备用，当两阶段失败时使用）
 */
export async function simpleAnalyze(
  content: string,
  options: {
    style?: string
    customStylePrompt?: string
    maxChunkLength?: number
  } = {}
): Promise<AnalyzeResult> {
  const { style, customStylePrompt, maxChunkLength = 8000 } = options

  // 使用简化版单阶段解析
  const { parseLLMJson, invokeLLM, getServerAIConfig, getUserLLMConfig } = await import('@/lib/ai')
  const { buildSimpleSystemPrompt } = await import('./prompts')
  const { splitContentIntoSimpleChunks } = await import('./utils')

  const styleContext = buildStyleContext(style, customStylePrompt)
  const systemPrompt = buildSimpleSystemPrompt(styleContext)

  const chunks = splitContentIntoSimpleChunks(content, maxChunkLength)

  const allCharacters: Map<string, any> = new Map()
  const allScenes: any[] = []
  let sceneOffset = 0

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1
    const chunkContext = chunks.length > 1
      ? `【这是故事的第${i + 1}/${chunks.length}段】\n\n${chunks[i]}${isLast ? '\n\n（这是最后一段）' : '\n\n（后面还有内容）'}`
      : chunks[i]

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请分析以下内容：\n\n${chunkContext}` },
    ]

    const aiConfig = await getServerAIConfig()
    const llmConfig = await getUserLLMConfig()

    let responseContent = await invokeLLM(
      messages,
      { model: aiConfig.model, temperature: 0.3 },
      {
        apiKey: aiConfig.apiKey,
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
      }
    )

    const result = parseLLMJson<AnalyzeResult>(responseContent || '{}')

    if (result?.characters) {
      for (const char of result.characters) {
        if (!allCharacters.has(char.name)) {
          allCharacters.set(char.name, char)
        }
      }
    }

    if (result?.scenes) {
      for (const scene of result.scenes) {
        allScenes.push({
          ...scene,
          sceneNumber: (scene.sceneNumber || 1) + sceneOffset,
        })
      }
      sceneOffset += result.scenes.length
    }
  }

  return {
    characters: Array.from(allCharacters.values()),
    scenes: allScenes,
  }
}

// 重新导出类型
export * from './types'
