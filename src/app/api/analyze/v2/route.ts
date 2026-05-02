/**
 * 两阶段剧本解析 API (V2)
 *
 * 第一阶段：全局扫描 - 快速提取角色、场景、预估分镜数等
 * 第二阶段：分段详解 - 基于第一阶段结果进行详细分镜生成
 */

import { NextRequest, NextResponse } from "next/server"
import { twoPhaseAnalyze, AnalyzeResult, GlobalScanResult } from "@/lib/script-analyzer"
import { generateId } from "@/lib/memory-storage"
import { ShotSegment, generateSeedancePrompt, calculateSceneDuration } from "@/lib/types"

// 增加超时配置 - Next.js API 路由最大执行时间
export const maxDuration = 300 // 5分钟

/**
 * POST /api/analyze/v2
 *
 * 请求体:
 * {
 *   "content": "剧本内容",
 *   "projectId": "项目ID",
 *   "style": "风格",
 *   "customStylePrompt": "自定义风格",
 *   "skipPreview": false,  // 是否跳过预览直接生成
 *   "previewConfirmed": false  // 预览确认后为true
 * }
 *
 * 响应:
 * - 首次请求: 返回预览信息 (previewInfo)
 * - 确认预览后: 返回完整分析结果 (characters, scenes)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      content,
      projectId,
      style,
      customStylePrompt,
      skipPreview = false,
      previewConfirmed = false,
      // 第一阶段结果（预览确认后传递）
      globalScanResult,
    } = body

    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 })
    }

    // 打印配置信息
    console.log("[AnalyzeV2] Request:", {
      contentLength: content.length,
      projectId,
      style,
      skipPreview,
      previewConfirmed,
      hasGlobalScanResult: !!globalScanResult,
    })

    // 预览确认后，直接进入第二阶段
    if (previewConfirmed && globalScanResult) {
      console.log("[AnalyzeV2] Preview confirmed, starting Phase 2...")

      const result = await executePhase2WithContext(
        content,
        globalScanResult,
        { style, customStylePrompt },
        projectId
      )

      return NextResponse.json({
        success: true,
        phase: 'phase2_complete',
        ...result,
      })
    }

    // 默认：执行两阶段解析
    console.log("[AnalyzeV2] Starting two-phase analysis...")

    const { globalScanResult: scanResult, previewInfo, finalResult } = await twoPhaseAnalyze(
      content,
      {
        style,
        customStylePrompt,
        onPhase1Progress: (stage) => console.log(`[AnalyzeV2] Phase1: ${stage}`),
        onPhase2Progress: (stage) => console.log(`[AnalyzeV2] Phase2: ${stage}`),
        skipPreview: skipPreview, // 如果 skipPreview 为 true，直接执行完整两阶段
      }
    )

    // 如果跳过了预览（skipPreview=true），直接返回完整结果
    if (skipPreview || finalResult) {
      console.log("[AnalyzeV2] Analysis complete, saving results...")

      // 保存到数据库/内存
      const { savedCharacterIds, savedSceneIds } = await saveResults(
        projectId,
        finalResult!,
        style
      )

      return NextResponse.json({
        success: true,
        phase: 'complete',
        characters: finalResult!.characters,
        scenes: finalResult!.scenes,
        globalScanResult: scanResult,
        stats: {
          charactersCount: savedCharacterIds.length,
          scenesCount: savedSceneIds.length,
          totalScenes: finalResult!.scenes.length,
        },
      })
    }

    // 返回预览信息，让用户确认
    console.log("[AnalyzeV2] Returning preview info for user confirmation")
    return NextResponse.json({
      success: true,
      phase: 'preview',
      previewInfo,
      globalScanResult: scanResult,
    })

  } catch (error: unknown) {
    console.error("[AnalyzeV2] Error:", error)

    const errorMessage = error instanceof Error ? error.message : "分析失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 执行第二阶段（预览确认后）
 */
async function executePhase2WithContext(
  content: string,
  globalScanResult: GlobalScanResult,
  options: { style?: string; customStylePrompt?: string },
  projectId?: string
): Promise<{
  characters: AnalyzeResult['characters']
  scenes: AnalyzeResult['scenes']
}> {
  // 重新执行第二阶段分析
  const { smartChunkByScenes } = await import('@/lib/script-analyzer/phase1-scanner')
  const { analyzeChunk, mergeChunkResults, getRecentScenesSummary } = await import('@/lib/script-analyzer/phase2-analyzer')

  const { style, customStylePrompt } = options

  // 构建风格上下文
  const styleDescriptions: Record<string, string> = {
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

  let styleDescription = ''
  if (customStylePrompt) {
    styleDescription = customStylePrompt
  } else if (style && style !== 'custom') {
    styleDescription = styleDescriptions[style] || ''
  }

  const styleContext = styleDescription
    ? `\n\n## 画面风格要求\n你生成的所有画面描述必须严格遵循以下风格：\n**${styleDescription}**\n\n请在描述场景、人物外貌、动作时，都融入这种风格特征。`
    : ''

  // 智能分块
  const chunks = smartChunkByScenes(content, globalScanResult.sceneBoundaries, 6000)
  console.log(`[AnalyzeV2] Split into ${chunks.length} chunks`)

  // 逐块分析
  const chunkResults: Array<AnalyzeResult['scenes']> = []
  let allScenes: AnalyzeResult['scenes'] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const recentScenesSummary = getRecentScenesSummary(allScenes, 5)

    const scenes = await analyzeChunk(
      chunk.content,
      i,
      chunks.length,
      globalScanResult,
      recentScenesSummary,
      styleContext
    )

    chunkResults.push(scenes)
    allScenes.push(...scenes)
  }

  // 合并结果
  const finalResult = mergeChunkResults(chunkResults, globalScanResult)

  // 保存结果
  if (projectId) {
    await saveResults(projectId, finalResult, style)
  }

  return {
    characters: finalResult.characters,
    scenes: finalResult.scenes,
  }
}

/**
 * 保存结果到数据库/内存
 */
async function saveResults(
  projectId: string,
  result: AnalyzeResult,
  style?: string
): Promise<{ savedCharacterIds: string[]; savedSceneIds: string[] }> {
  const { memoryCharacters, memoryScenes, generateId } = await import('@/lib/memory-storage')
  const { generateSeedancePrompt, calculateSceneDuration, ShotSegment } = await import('@/lib/types')

  const savedCharacterIds: string[] = []
  const savedSceneIds: string[] = []

  // 检查或创建"默认脚本"
  let defaultScriptId = `script_default_${projectId}`

  try {
    const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')

    if (isDatabaseConfigured()) {
      const supabase = getAdminClient()

      // 检查"默认脚本"是否已存在
      const { data: existingScript } = await supabase
        .from("scripts")
        .select("id")
        .eq("id", defaultScriptId)
        .single()

      if (!existingScript) {
        await supabase.from("scripts").insert({
          id: defaultScriptId,
          project_id: projectId,
          title: "默认脚本",
          content: "自动生成的默认脚本",
          status: "active",
        })
      }
    }
  } catch (dbError) {
    console.warn("[AnalyzeV2] Failed to check/create default script:", dbError)
  }

  // 保存人物
  for (const char of result.characters) {
    const characterId = generateId('char')
    let savedToDb = false

    try {
      const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const supabase = getAdminClient()
        const { error } = await supabase
          .from("characters")
          .insert({
            id: characterId,
            project_id: projectId,
            name: char.name,
            description: char.description || "",
            appearance: char.appearance || char.description || "",
            personality: char.personality || "",
            tags: char.tags || [],
            status: 'pending',
          })

        if (!error) {
          savedToDb = true
          savedCharacterIds.push(characterId)
        }
      }
    } catch (dbError) {
      console.warn("[AnalyzeV2] Failed to save character to database:", dbError)
    }

    // 保存到内存
    if (!savedToDb) {
      memoryCharacters.push({
        id: characterId,
        projectId,
        name: char.name,
        description: char.description || "",
        appearance: char.appearance || char.description || "",
        personality: char.personality || "",
        tags: char.tags || [],
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
      savedCharacterIds.push(characterId)
    }
  }

  // 获取人物名称到ID的映射
  const characterNameToId = new Map<string, string>()
  memoryCharacters
    .filter(c => c.projectId === projectId)
    .forEach(c => characterNameToId.set(c.name, c.id))

  // 保存分镜
  for (const scene of result.scenes) {
    const sceneId = generateId('scene')
    const characterNames = scene.characters || scene.characterNames || []
    const characterIds: string[] = characterNames
      .map((name: string) => characterNameToId.get(name))
      .filter((id): id is string => id !== undefined)

    // 生成 videoPrompt
    let videoPrompt = scene.videoPrompt
    if (!videoPrompt) {
      videoPrompt = generateSeedancePrompt(scene.description, style || 'default', characterNames)
    }

    // 创建默认 shotSegments
    let shotSegments = scene.shotSegments
    if (!shotSegments || shotSegments.length === 0) {
      const duration = scene.durationMs || calculateSceneDuration({ dialogue: scene.dialogue })
      shotSegments = [
        {
          startTimeMs: 0,
          endTimeMs: duration,
          shotType: 'medium',
          description: scene.description,
        } as ShotSegment,
      ]
    }

    let savedToDb = false

    try {
      const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const supabase = getAdminClient()
        const { error } = await supabase.from("scenes").insert({
          id: sceneId,
          project_id: projectId,
          script_id: defaultScriptId,
          scene_number: scene.sceneNumber,
          title: scene.title,
          description: scene.description,
          dialogue: scene.dialogue || "",
          action: scene.action || "",
          emotion: scene.emotion || "",
          character_ids: characterIds,
          metadata: {
            shotType: 'medium',
            videoPrompt,
            shotSegments,
            firstFrameNeeded: true,
            lastFrameNeeded: true,
            firstFrameDescription: scene.firstFrameDescription,
            lastFrameDescription: scene.lastFrameDescription,
            transition: scene.transition,
            shotId: scene.shotId || scene.sceneNumber,
            durationMs: scene.durationMs,
            emotionNote: scene.emotionNote,
            continuity: scene.continuity,
          },
          status: 'pending',
        })

        if (!error) {
          savedToDb = true
          savedSceneIds.push(sceneId)
        }
      }
    } catch (dbError) {
      console.warn("[AnalyzeV2] Failed to save scene to database:", dbError)
    }

    // 保存到内存
    if (!savedToDb) {
      memoryScenes.push({
        id: sceneId,
        projectId,
        scriptId: defaultScriptId,
        sceneNumber: scene.sceneNumber,
        title: scene.title,
        description: scene.description,
        dialogue: scene.dialogue || "",
        action: scene.action || "",
        emotion: scene.emotion || "",
        characterIds,
        status: 'pending',
        createdAt: new Date().toISOString(),
        metadata: {
          videoPrompt,
          shotSegments,
          firstFrameNeeded: true,
          lastFrameNeeded: true,
          durationMs: scene.durationMs,
        },
      })
      savedSceneIds.push(sceneId)
    }
  }

  console.log(`[AnalyzeV2] Saved ${savedCharacterIds.length} characters and ${savedSceneIds.length} scenes`)

  return { savedCharacterIds, savedSceneIds }
}
