import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/storage/database/pg-client"
import { getStylePrompt } from "@/lib/styles"
import { runPhase1 } from "@/lib/script-parser"
import { chunkScript } from "@/lib/script-parser"
import type { Phase1Character } from "@/lib/script-parser"

// 风格描述映射
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

const MAX_DURATION_PER_SHOT_SEC = 12 // Seedance 1.5 Pro 限制

function getStyleDescription(project: any): string {
  const style = project?.style || "realistic_drama"
  const customStylePrompt = project?.custom_style_prompt || project?.customStylePrompt || ''
  if (customStylePrompt) return customStylePrompt
  return style !== 'custom' ? (styleDescriptions[style] || '') : ''
}

// POST /api/scripts/analyze
// ?phase=1  → 第一阶段：全局扫描（返回角色概要 + 场景大纲 + 分块方案）
// ?phase=2  → 第二阶段：分段详解（传入 chunk 和 context，返回详细分镜）
// 无参数    → 兼容旧版：单次全量解析
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phase = searchParams.get('phase')

    const body = await request.json()
    const { scriptId, projectId, scriptContent, existingCharacters } = body

    if (!scriptId && !scriptContent) {
      return NextResponse.json(
        { error: "缺少脚本ID或脚本内容" },
        { status: 400 }
      )
    }

    // 获取项目信息
    let project = null
    if (projectId) {
      try {
        const pool = await getPool()
        const result = await pool.query(
          `SELECT * FROM projects WHERE id = $1`,
          [projectId]
        )
        if (result.rows.length > 0) {
          project = result.rows[0]
        }
      } catch (dbErr) {
        console.warn("获取项目信息失败，使用默认风格:", dbErr)
      }
    }

    const style = project?.style || "realistic_drama"
    const stylePrompt = getStylePrompt(style)
    const styleDescription = getStyleDescription(project)

    // ==================== 阶段一：全局扫描 ====================
    if (phase === '1') {
      console.log('[Analyze] Phase 1: 全局扫描开始, 剧本长度:', scriptContent?.length)

      const result = await runPhase1(scriptContent, styleDescription)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      console.log('[Analyze] Phase 1 完成:', {
        characters: result.preview?.characters.length,
        scenes: result.preview?.sceneOutline.length,
        estimated: result.preview?.totalEstimatedScenes,
        chunks: result.chunkPlan?.length,
      })

      return NextResponse.json({
        phase: 1,
        success: true,
        preview: result.preview,
        chunkPlan: result.chunkPlan,
      })
    }

    // ==================== 阶段二：分段详解 ====================
    if (phase === '2') {
      const { chunkId, chunkContent, context } = body

      if (!chunkContent) {
        return NextResponse.json({ error: "缺少 chunkContent" }, { status: 400 })
      }

      console.log(`[Analyze] Phase 2: chunk ${chunkId} 解析开始, 长度:`, chunkContent?.length)

      // 获取分块信息
      const chunks = chunkScript(scriptContent)
      const totalChunks = chunks.length

      const { runPhase2Chunk } = await import('@/lib/script-parser/phase2-detail')

      // Build a proper Chunk object
      const chunk = {
        chunkId: chunkId || 1,
        text: chunkContent,
        sceneIndices: context?.sceneIndices || [chunkId || 1],
        charCount: chunkContent.length,
        startCharIndex: 0,
        endCharIndex: chunkContent.length,
      }

      const result = await runPhase2Chunk(chunk, totalChunks, {
        styleDescription: styleDescription || '',
        characters: (context?.characters || []) as Phase1Character[],
        currentSceneIndex: context?.currentSceneIndex || 1,
        currentSceneLocation: context?.currentSceneLocation || '未知',
        previousShotSummary: context?.previousShotSummary || null,
        maxDurationPerShotSec: MAX_DURATION_PER_SHOT_SEC,
      })

      if (!result.success) {
        return NextResponse.json({
          phase: 2,
          chunkId,
          success: false,
          error: result.error,
        }, { status: 500 })
      }

      console.log(`[Analyze] Phase 2 chunk ${chunkId} 完成, 分镜数:`, result.scenes?.length)

      return NextResponse.json({
        phase: 2,
        chunkId,
        totalChunks,
        success: true,
        scenes: result.scenes,
        lastShotSummary: result.lastShotSummary,
      })
    }

    // ==================== 兼容旧版：单次全量解析 ====================
    console.log('[Analyze] 使用兼容模式（单次全量解析）')

    const { invokeLLM } = await import('@/lib/ai')

    const styleContext = styleDescription
      ? `\n\n## 画面风格要求\n你生成的所有画面描述必须严格遵循以下风格：\n**${styleDescription}**\n\n请在描述场景、人物外貌、动作时，都融入这种风格特征。`
      : ''

    const analyzePrompt = `你是一个专业的短剧视频创作助手。你的任务是分析小说或脚本内容，提取出人物信息和视频分镜信息。

## 项目风格
${stylePrompt}

## 脚本内容
${scriptContent}

## 已有角色（如果有）
${existingCharacters?.length > 0
  ? existingCharacters.map((c: any) => `- ${c.name}: ${c.description || c.appearance || '无描述'}`).join('\n')
  : '暂无已有角色'
}

请严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "newCharacters": [
    {
      "name": "人物名称",
      "description": "人物简介（50字以内）",
      "appearance": "外貌特征描述（包括发型、眼睛、体型、服装风格等，用于生成角色造型参考图）",
      "personality": "性格特点",
      "tags": ["主角", "配角", "反派"]
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "分镜标题",
      "description": "场景画面描述（详细描述环境，光线、构图，用于生成视频分镜参考图）",
      "dialogue": "对白内容",
      "action": "动作/表演描述",
      "emotion": "情绪氛围",
      "shotType": "景别（远景、全景、中景、近景、特写）",
      "cameraMovement": "镜头运动（固定、推镜、拉镜、摇镜、跟拍）",
      "characterNames": ["出场人物名称"]
    }
  ]
}

## 分镜拆分核心原则

### 1. 基于内容适配的分镜策略
- 内容决定数量，分镜数量由剧情密度、情感层次和场景转换频率决定
- 单个分镜时长3-12秒，视频模型限制单分镜≤12秒

### 2. 环境与氛围独立成镜
- 开篇环境描写必须单独设立分镜，建立故事基调
- 重要时间节点画面应作为独立分镜

### 3. 心理活动视觉化
- 人物关键回忆和深度思考应转化为闪回片段或通过表演体现

### 4. 日常动作合理分解
- 连续日常动作可拆分为多个分镜，避免流水账仓促感

### 5. 每个叙事相遇独立呈现
- 与每个配角的关键互动应视为独立叙事单元

### 6. 优先保障叙事连贯性
- 为氛围镜头、情感高潮和复杂对话允许延长单镜时长（不超过12秒）

注意：
1. 分镜数量根据内容合理拆分
2. 每个场景应该是一个独立的视频分镜
3. 场景描述要详细，包含视觉元素、光影效果
4. 人物外貌描述要具体，便于生成角色造型图
5. 景别和镜头运动要符合影视剧拍摄规范${styleContext}`

    const aiResult = await invokeLLM(
      [{ role: "user", content: analyzePrompt }],
      { thinking: "disabled" }
    )

    let analysisResult: any = null
    try {
      const text = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      }
    } catch (parseErr) {
      console.error("解析 AI 返回结果失败:", parseErr)
      return NextResponse.json({
        error: "AI 返回格式解析失败",
        rawResult: aiResult,
      }, { status: 500 })
    }

    if (!analysisResult) {
      return NextResponse.json({
        error: "AI 分析失败，未返回有效结果",
      }, { status: 500 })
    }

    // 保存角色和分镜到数据库
    const characterNameToId = new Map<string, string>()
    const savedCharacterIds: string[] = []

    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      if (isDatabaseConfigured()) {
        const supabase = getSupabaseClient()
        const { data: existingChars } = await supabase
          .from("characters")
          .select("id, name")
          .eq("project_id", projectId)
        if (existingChars) {
          existingChars.forEach((c: { id: string; name: string }) =>
            characterNameToId.set(c.name, c.id)
          )
        }
      }
    } catch (dbError) {
      console.warn("Failed to fetch characters from database:", dbError)
    }

    if (analysisResult.newCharacters?.length > 0) {
      for (const char of analysisResult.newCharacters) {
        const characterId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        try {
          const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
          if (isDatabaseConfigured()) {
            const supabase = getAdminClient()
            const insertData = {
              id: characterId,
              project_id: projectId,
              name: char.name,
              description: char.description || "",
              appearance: char.description || "",
              personality: char.personality || "",
              tags: char.tags || [],
              status: 'pending',
            }
            const { error } = await supabase.from("characters").insert(insertData)
            if (error) {
              console.error(`Failed to save character "${char.name}":`, error.message)
            } else {
              savedCharacterIds.push(characterId)
              characterNameToId.set(char.name, characterId)
            }
          }
        } catch (dbError) {
          console.error(`Exception saving character "${char.name}":`, dbError)
        }
      }
    }

    if (analysisResult.scenes?.length > 0) {
      for (let index = 0; index < analysisResult.scenes.length; index++) {
        const scene = analysisResult.scenes[index]
        const sceneId = `scene_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`
        const characterIds: string[] = (scene.characterNames || [])
          .map((name: string) => characterNameToId.get(name))
          .filter((id: string | undefined): id is string => id !== undefined)
        try {
          const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
          if (isDatabaseConfigured()) {
            const supabase = getAdminClient()
            const insertData = {
              id: sceneId,
              project_id: projectId,
              script_id: scriptId,
              scene_number: index + 1,
              title: scene.title,
              description: scene.description,
              dialogue: scene.dialogue || "",
              action: scene.action || "",
              emotion: scene.emotion,
              character_ids: characterIds,
              metadata: {
                shotType: scene.shotType || "",
                cameraMovement: scene.cameraMovement || "",
              },
              status: 'pending',
            }
            const { error } = await supabase.from("scenes").insert(insertData)
            if (error) {
              console.error(`Failed to save scene "${scene.title}":`, error.message)
            }
          }
        } catch (dbError) {
          console.error(`Exception saving scene "${scene.title}":`, dbError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'legacy',
      charactersCount: savedCharacterIds.length,
      scenesCount: analysisResult.scenes?.length || 0,
    })
  } catch (err: any) {
    console.error("脚本分析异常:", err)
    return NextResponse.json({
      error: err.message || "脚本分析失败"
    }, { status: 500 })
  }
}

// GET /api/scripts/analyze - 返回 API 用法说明
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phase = searchParams.get('phase')
  const scriptId = searchParams.get('scriptId')
  const projectId = searchParams.get('projectId')

  // 如果 GET 带 phase=1，尝试从数据库获取脚本内容后执行阶段一
  if (phase === '1' && (scriptId || projectId)) {
    try {
      let scriptContent = ''
      if (scriptId) {
        const pool = await getPool()
        const result = await pool.query(
          `SELECT * FROM scripts WHERE id = $1`,
          [scriptId]
        )
        if (result.rows.length > 0) {
          scriptContent = result.rows[0].content
        } else {
          return NextResponse.json({ error: "脚本不存在" }, { status: 404 })
        }
      }

      // 获取项目风格
      let project = null
      if (projectId) {
        try {
          const pool = await getPool()
          const result = await pool.query(
            `SELECT * FROM projects WHERE id = $1`,
            [projectId]
          )
          if (result.rows.length > 0) {
            project = result.rows[0]
          }
        } catch (dbErr) {
          console.warn("获取项目信息失败:", dbErr)
        }
      }

      const styleDescription = getStyleDescription(project)
      const result = await runPhase1(scriptContent, styleDescription)

      return NextResponse.json({
        phase: 1,
        success: result.success,
        preview: result.preview,
        chunkPlan: result.chunkPlan,
        error: result.error,
      })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    message: "剧本分析 API",
    usage: {
      phase1: "POST /api/scripts/analyze?phase=1  (body: {scriptContent, projectId})",
      phase2: "POST /api/scripts/analyze?phase=2  (body: {chunkId, chunkContent, context})",
      legacy: "POST /api/scripts/analyze  (body: {scriptContent, projectId, scriptId, existingCharacters})",
    }
  })
}
