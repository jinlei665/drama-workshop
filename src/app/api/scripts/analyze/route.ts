import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/storage/database/pg-client"
import { getStylePrompt } from "@/lib/styles"
import { invokeLLM } from "@/lib/ai"

// POST /api/scripts/analyze - 分析脚本并生成分镜
export async function POST(request: NextRequest) {
  try {
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

    // 获取风格提示词
    const style = project?.style || "realistic_drama"
    const customStylePrompt = project?.custom_style_prompt || project?.customStylePrompt || ''
    const stylePrompt = getStylePrompt(style)

    // 构建风格说明
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
    let styleDescription = style && style !== 'custom' ? styleDescriptions[style] || '' : ''
    if (customStylePrompt) {
      styleDescription = customStylePrompt
    }
    const styleContext = styleDescription
      ? `\n\n## 画面风格要求\n你生成的所有画面描述必须严格遵循以下风格：\n**${styleDescription}**\n\n请在描述场景、人物外貌、动作时，都融入这种风格特征。\n例如：如果是水墨风格，场景描述应该包含山水、留白、墨色等元素；如果是动漫风格，应该包含大眼睛、日系配色等特征。`
      : ''

    // 构建分析提示词
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
      "emotion": "情绪氛围（如：紧张、温馨、悲伤）",
      "shotType": "景别（如：远景、全景、中景、近景、特写）",
      "cameraMovement": "镜头运动（如：固定、推镜、拉镜、摇镜、跟拍）",
      "characterNames": ["出场人物名称"]
    }
  ]
}

## 分镜拆分核心原则（必须遵守）

### 1. 基于内容适配的分镜策略
- **内容决定数量**：完全摒弃一般的固定范围。分镜数量应由**剧情密度、情感层次和场景转换频率**自然决定。对于氛围浓厚、细节丰富的文学性故事，分镜数量应**大幅增加**，可能达到25-40个或更多，以确保每一处重要的情感、环境和细节都有其呈现空间。
- **时长服务于情绪**：单个分镜时长（3-8秒）是参考，**不是铁律**。对于需要营造氛围的空镜（如晨曦、晚霞）、复杂的动作序列、或包含深度情绪的特写，时长可延长至**8-12秒甚至更长**。关键是为"情绪"和"信息"留出足够的消化时间。

### 2. 针对本文本类型的特殊处理规则

#### 环境与氛围独立成镜
- 开篇定调的环境描写（如"青溪镇的春天，鸟鸣晨光"）**必须单独设立分镜**，时长可适当放长（5-8秒），用于建立故事基调。
- 重要的时间节点画面（如"晨曦"、"夜幕降临"）应作为独立分镜。

#### 心理活动视觉化与时间分配
- 人物的关键回忆（如师父去世、临终教诲）和深度思考，**不应简单合并**。
- 应转化为闪回片段或通过人物表演（长时间沉默、特定表情）来体现，给予单独分镜或显著延长所在分镜的时长。

#### 日常动作的分解
- 为了建立真实的生活感和人物节奏，连续的日常动作（如"醒来-发呆-洗漱-检查货柜"）**可以拆分为多个分镜**，而不是合并为一个。
- 这能避免"流水账"式的仓促感，展现人物的细腻特质。

#### 每个"叙事相遇"独立呈现
- 与配角的每一次相遇（如郑老爷子、阿绒、茶棚婆婆、小禾等），都是展示世界观和人物关系的关键。
- **每个相遇都应视为一个独立的叙事单元**，包含2-4个分镜（如：接近、互动、反应、离开），而不是压缩成一个。

### 3. 分镜数量与时长指导

#### 放弃硬性数量限制
请根据文本的实际内容，拆分出足够多的分镜，以确保故事连贯、氛围饱满、细节不丢失。预计分镜数量可能在**30个以上**。

#### 优先保障叙事连贯性
- 不必拘泥于每个分镜3-8秒的硬性约束。
- 对于氛围镜头、情感高潮和复杂对话，允许延长单镜时长。

#### 完整呈现关键段落
必须为以下内容分配足够的分镜和时间：
1. 角色的清晨日常（如：醒来、洗漱、查货、与邻居对话）
2. 对人物的关键回忆（如去世场景、临终教诲）
3. 与每一位配角的相遇（如老者、商人、孩童等）
4. 结尾的沉思/独处场景

### 4. 核心目标
你的目标是生成一个**连贯、细腻、不赶时间**的视觉化分镜脚本，而不是一个高度压缩的提要。每个分镜都应该是故事叙述的有机组成部分，让观众能够沉浸在故事世界中。

注意：
1. 分镜数量根据内容合理拆分，具体根据对话量和场景复杂度调整
2. 每个场景应该是一个独立的视频分镜
3. 场景描述要详细，包含视觉元素，光影效果
4. 人物外貌描述要具体，便于生成角色造型图
5. 景别和镜头运动要符合影视剧拍摄规范
6. 这是短剧视频分镜，不是漫画${styleContext}`

    // 调用 AI 生成分析结果
    const result = await invokeLLM(
      [{ role: "user", content: analyzePrompt }],
      { thinking: "disabled" }
    )

    // 解析 AI 返回的结果
    let analysisResult = null
    try {
      // 尝试从返回结果中提取 JSON
      const text = typeof result === 'string' ? result : JSON.stringify(result)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      }
    } catch (parseErr) {
      console.error("解析 AI 返回结果失败:", parseErr)
      // 如果解析失败，尝试直接返回文本
      return NextResponse.json({ 
        error: "AI 返回格式解析失败",
        rawResult: result,
      }, { status: 500 })
    }

    if (!analysisResult) {
      return NextResponse.json({ 
        error: "AI 分析失败，未返回有效结果",
      }, { status: 500 })
    }

    // 获取人物名称到ID的映射（用于关联分镜）
    const characterNameToId = new Map<string, string>()
    
    // 从数据库获取已有角色
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

    const savedCharacterIds: string[] = []
    
    // 直接插入新角色到数据库（按照项目创建时的逻辑）
    if (analysisResult.newCharacters && analysisResult.newCharacters.length > 0) {
      for (const char of analysisResult.newCharacters) {
        const characterId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        
        // 保存到数据库
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
            
            const { error } = await supabase
              .from("characters")
              .insert(insertData)
            
            if (error) {
              console.error(`Failed to save character "${char.name}" to database:`, error.message)
            } else {
              console.log(`Saved character "${char.name}" to database: ${characterId}`)
              savedCharacterIds.push(characterId)
              characterNameToId.set(char.name, characterId)
            }
          }
        } catch (dbError) {
          console.error(`Exception saving character "${char.name}" to database:`, dbError)
        }
      }
    }

    // 直接插入分镜到数据库（按照项目创建时的逻辑）
    if (analysisResult.scenes && analysisResult.scenes.length > 0) {
      for (let index = 0; index < analysisResult.scenes.length; index++) {
        const scene = analysisResult.scenes[index]
        const sceneId = `scene_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`
        
        // 获取人物ID
        const characterIds: string[] = (scene.characterNames || [])
          .map((name: string) => characterNameToId.get(name))
          .filter((id: string | undefined): id is string => id !== undefined)
        
        // 保存到数据库
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
            
            const { error } = await supabase
              .from("scenes")
              .insert(insertData)
            
            if (error) {
              console.error(`Failed to save scene "${scene.title}" to database:`, error.message)
            } else {
              console.log(`Saved scene "${scene.title}" to database: ${sceneId}`)
            }
          }
        } catch (dbError) {
          console.error(`Exception saving scene "${scene.title}" to database:`, dbError)
        }
      }
    }

    return NextResponse.json({
      success: true,
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
