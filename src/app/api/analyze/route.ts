import { NextRequest, NextResponse } from "next/server"
import { invokeLLM, invokeLLMWithStream, parseLLMJson, extractHeaders, DEFAULT_LLM_MODEL, getServerAIConfig, getUserLLMConfig } from "@/lib/ai"
import { invokeCozeDirect, getCozeDirectConfig } from "@/lib/ai/coze-direct"
import { memoryCharacters, memoryScenes, generateId } from "@/lib/memory-storage"

// 增加超时配置 - Next.js API 路由最大执行时间
export const maxDuration = 300 // 5分钟

// POST /api/analyze - 分析文本内容，提取人物和视频分镜
export async function POST(request: NextRequest) {
  const { projectId, content, style, customStylePrompt } = await request.json()

  if (!content) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 })
  }

  // 获取完整的 AI 配置
  const aiConfig = await getServerAIConfig()
  const llmConfig = await getUserLLMConfig()
  
  // 提取请求头用于转发
  const customHeaders = extractHeaders(request.headers)

  // 打印配置信息
  console.log("[Analyze] LLM Config:", {
    cozeProvider: {
      hasApiKey: !!aiConfig.apiKey,
      baseUrl: aiConfig.baseUrl,
      model: aiConfig.model,
      useSystemDefault: aiConfig.useSystemDefault,
    },
    llmProvider: {
      provider: llmConfig.provider,
      hasApiKey: !!llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      model: llmConfig.model,
    },
  })

  // 检查内容长度，如果太长则截断
  const maxContentLength = 10000 // 约 1 万字
  let processedContent = content
  if (content.length > maxContentLength) {
    console.log(`Content too long (${content.length} chars), truncating to ${maxContentLength}`)
    processedContent = content.substring(0, maxContentLength) + '\n\n...（内容已截断，请分段上传完整内容）'
  }

  // 风格提示词映射
  const styleDescriptions: Record<string, string> = {
    // 真人类
    realistic_cinema: '电影级写实风格，专业影视剧质感，电影级光影',
    realistic_drama: '短剧写实风格，现代短剧风格，自然光线',
    realistic_period: '古装写实风格，古风影视质感，唯美画面',
    realistic_idol: '偶像剧风格，韩剧/偶像剧风格，柔美滤镜',
    // 动漫类
    anime_3d_cn: '国漫3D动画风格，国产3D动画如斗罗大陆',
    anime_2d_cn: '国风2D动画风格，如魔道祖师',
    anime_jp: '日本动漫风格，如鬼灭之刃',
    anime_chibi: 'Q版萌系风格，可爱大头小身',
    // 艺术类
    art_watercolor: '水彩插画风格，柔和淡雅',
    art_ink: '中国传统水墨画风格',
    art_oil: '油画风格，厚重笔触',
    art_comic: '美式漫画风格，强对比',
  }

  // 构建风格说明
  let styleDescription = ''
  if (style && style !== 'custom') {
    styleDescription = styleDescriptions[style] || ''
  }
  if (customStylePrompt) {
    styleDescription = customStylePrompt
  }
  
  // 构建带风格的 systemPrompt
  const styleContext = styleDescription 
    ? `\n\n## 画面风格要求\n你生成的所有画面描述必须严格遵循以下风格：\n**${styleDescription}**\n\n请在描述场景、人物外貌、动作时，都融入这种风格特征。\n例如：如果是水墨风格，场景描述应该包含山水、留白、墨色等元素；如果是动漫风格，应该包含大眼睛、日系配色等特征。` 
    : ''

  const systemPrompt = `你是一个专业的短剧视频创作助手。你的任务是分析小说或脚本内容，提取出人物信息和视频分镜信息。

请严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "characters": [
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
      "description": "场景画面描述（详细描述环境、光线、构图，用于生成视频分镜参考图）",
      "dialogue": "对白内容",   // 某人物："..."  或  旁白（画外音）："..."
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
3. 场景描述要详细，包含视觉元素、光影效果
4. 人物外貌描述要具体，便于生成角色造型图
5. 景别和镜头运动要符合影视剧拍摄规范
6. 这是短剧视频分镜，不是漫画${styleContext}`

  try {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: `请分析以下内容：\n\n${processedContent}` },
    ]

    // 调用 LLM - 根据用户配置的 llm_provider 选择
    let responseContent: string | undefined = undefined

    // 判断是否使用用户配置的 LLM Provider
    // 逻辑：
    // 1. 如果 provider 不是 doubao（如 deepseek、kimi、openai 等），使用自定义 LLM Provider
    // 2. 如果 provider 是 doubao，但是模型名是火山引擎模型（以 doubao-seed- 开头），也应该使用自定义 LLM Provider
    // 3. 如果 provider 是 doubao 且没有配置 API Key，使用 Coze SDK 或 Coze Direct
    const isVolcengineModel = llmConfig.model?.startsWith('doubao-seed-')
    const useCustomLLMProvider = llmConfig.provider &&
      (llmConfig.provider !== 'doubao' || isVolcengineModel)

    if (useCustomLLMProvider) {
      // 使用用户配置的自定义 LLM Provider（DeepSeek、Kimi、火山引擎等）
      console.log('[Analyze] Using custom LLM provider:', llmConfig.provider, 'model:', llmConfig.model)

      // 如果选择了自定义 Provider 但是没有配置 API Key，回退到 Coze SDK 或 Coze Direct
      if (!llmConfig.apiKey && !isVolcengineModel) {
        console.warn('[Analyze] Custom LLM provider selected but no API key configured, falling back to Coze SDK')
      } else {
        try {
          // 导入 OpenAI 兼容客户端和模型名称映射
          const { OpenAICompatibleClient, getActualModelName } = await import('@/lib/ai/openai-compatible')

          // 获取实际的模型名称（将 Coze 平台的模型名映射到各 Provider 的实际模型名）
          const actualModelName = getActualModelName(llmConfig.provider, llmConfig.model)
          console.log('[Analyze] Model name mapping:', {
            original: llmConfig.model,
            actual: actualModelName
          })

          const client = new OpenAICompatibleClient({
            apiKey: llmConfig.apiKey || '',
            baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
            model: actualModelName,
          })

          responseContent = await client.invoke(messages, { temperature: 0.3 })
        } catch (error) {
          console.warn('[Analyze] Custom LLM provider failed, falling back to Coze SDK:', error)
          // 继续到下面的回退逻辑
        }
      }
    }

    // 如果自定义 LLM Provider 调用失败或没有配置，回退到 Coze SDK 或 Coze Direct
    if (!responseContent) {
      // 使用 Coze/豆包模型
      // 获取 Coze Direct 配置（用于 Bot 调用）
      const cozeDirectConfig = await getCozeDirectConfig()
      
      // 只有当 llm_provider 是 doubao 且配置了 botId 时才使用 Coze Direct API
      const shouldUseCozeDirect = (llmConfig.provider === 'doubao' || !llmConfig.provider) && 
        cozeDirectConfig?.botId && 
        cozeDirectConfig?.apiKey
      
      if (shouldUseCozeDirect) {
        console.log('[Analyze] Using direct Coze API with bot_id:', cozeDirectConfig!.botId)
        responseContent = await invokeCozeDirect(messages, cozeDirectConfig!)
      } else if (aiConfig.apiKey) {
        // 使用 Coze SDK - 使用流式输出监听完整响应
        console.log('[Analyze] Using Coze SDK with user API key (stream mode)')
        try {
          responseContent = await invokeLLMWithStream(
            messages,
            {
              model: aiConfig.model,
              temperature: 0.3,
            },
            { apiKey: aiConfig.apiKey, baseUrl: aiConfig.baseUrl, model: aiConfig.model },
            customHeaders
          )
        } catch (err) {
          if (err instanceof Error && (err as any).fallbackAttempted) {
            console.warn("User model failed, already attempted fallback")
            throw err
          }
          throw err
        }
      } else {
        // 使用系统默认模型 - 使用流式输出监听完整响应
        console.log('[Analyze] Using system default model (stream mode)')
        responseContent = await invokeLLMWithStream(
          messages,
          { model: aiConfig.model, temperature: 0.3 },
          undefined,
          customHeaders
        )
      }
    }

    // 解析 JSON 响应
    let result
    try {
      console.log(`[Analyze] Raw response length: ${responseContent.length}`)
      console.log(`[Analyze] Raw response (first 1000 chars): ${responseContent.substring(0, 1000)}`)
      if (responseContent.length > 1000) {
        console.log(`[Analyze] Raw response (last 500 chars): ${responseContent.substring(responseContent.length - 500)}`)
      }
      
      result = parseLLMJson<{
        characters: Array<{
          name: string
          description: string
          appearance: string
          personality: string
          tags: string[]
        }>
        scenes: Array<{
          sceneNumber: number
          title: string
          description: string
          dialogue: string
          action: string
          emotion: string
          shotType: string
          cameraMovement: string
          characterNames: string[]
        }>
      }>(responseContent)
      
      console.log(`[Analyze] Parsed result: characters=${result.characters?.length || 0}, scenes=${result.scenes?.length || 0}`)
      if (result.characters && result.characters.length > 0) {
        console.log(`[Analyze] Character names:`, result.characters.map(c => c.name).join(', '))
      }
    } catch (parseError) {
      console.error("[Analyze] Failed to parse LLM response:")
      console.error(`[Analyze] Response length: ${responseContent.length}`)
      console.error(`[Analyze] Response preview (first 500 chars): ${responseContent.substring(0, 500)}`)
      console.error(`[Analyze] Response preview (last 200 chars): ${responseContent.substring(Math.max(0, responseContent.length - 200))}`)
      console.error(`[Analyze] Parse error:`, parseError instanceof Error ? parseError.message : String(parseError))
      
      // 检查是否有更详细的错误信息
      const detailedError = parseError as any
      const debugInfo: Record<string, unknown> = {
        responseLength: responseContent.length,
        responsePreview: responseContent.substring(0, 500),
      }
      
      // 如果错误包含原始内容，添加到调试信息
      if (detailedError.originalContent) {
        debugInfo.extractedJson = detailedError.originalContent.substring(0, 500)
      }
      
      return NextResponse.json(
        { 
          error: "解析结果失败，请重试",
          message: parseError instanceof Error ? parseError.message : "未知错误",
          debug: debugInfo
        },
        { status: 500 }
      )
    }

    // 如果有 projectId，保存数据
    if (projectId) {
      console.log(`[Analyze] Saving data for project: ${projectId}`)
      console.log(`[Analyze] Characters to save: ${result.characters?.length || 0}`)
      console.log(`[Analyze] Scenes to save: ${result.scenes?.length || 0}`)

      // 检查或创建"默认脚本"
      let defaultScriptId = `script_default_${projectId}`
      let defaultScriptInMemory = false

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
            // 创建"默认脚本"
            const { error: insertError } = await supabase
              .from("scripts")
              .insert({
                id: defaultScriptId,
                project_id: projectId,
                title: "默认脚本",
                content: "自动生成的默认脚本，用于存放未关联脚本的分镜",
                description: "项目创建时自动生成",
                status: "active",
              })

            if (insertError) {
              console.error(`[Analyze] Failed to create default script:`, insertError.message)
            } else {
              console.log(`[Analyze] Created default script: ${defaultScriptId}`)
            }
          } else {
            console.log(`[Analyze] Default script already exists: ${defaultScriptId}`)
          }
        }
      } catch (dbError) {
        console.warn(`[Analyze] Failed to check/create default script:`, dbError)
      }

      // 检查内存中是否有"默认脚本"
      const { memoryScripts } = await import('@/lib/memory-storage')
      if (!memoryScripts.some(s => s.id === defaultScriptId)) {
        memoryScripts.push({
          id: defaultScriptId,
          projectId,
          title: "默认脚本",
          content: "自动生成的默认脚本，用于存放未关联脚本的分镜",
          description: "项目创建时自动生成",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        console.log(`[Analyze] Added default script to memory: ${defaultScriptId}`)
      }

      const savedCharacters: string[] = []
      
      // 保存人物
      if (result.characters && result.characters.length > 0) {
        for (const char of result.characters) {
          const characterId = generateId('char')
          
          // 尝试保存到数据库
          let savedToDb = false
          try {
            const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
            
            console.log(`[Analyze] Checking database config for character "${char.name}": isConfigured=${isDatabaseConfigured()}`)
            
            if (isDatabaseConfigured()) {
              // 优先使用 service_role 客户端（绕过 RLS）
              let supabase = getAdminClient()
              let usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY
              console.log(`[Analyze] Using ${usingServiceRole ? 'service_role' : 'anon'} client for character "${char.name}"`)
              
              const insertData = {
                id: characterId,
                project_id: projectId,
                name: char.name,
                description: char.description,
                appearance: char.appearance,
                personality: char.personality,
                tags: char.tags || [],
                status: 'pending',
              }
              
              console.log(`[Analyze] Inserting character "${char.name}" with data:`, JSON.stringify(insertData))
              
              const { data, error } = await supabase
                .from("characters")
                .insert(insertData)
                .select()
                .single()
              
              if (error) {
                console.error(`[Analyze] Failed to save character "${char.name}" to database:`, JSON.stringify(error))
                console.error(`[Analyze] Error details: code=${error.code}, message=${error.message}, details=${error.details}, hint=${error.hint}`)
              } else if (data) {
                console.log(`[Analyze] Saved character "${char.name}" to database: ${data.id}`)
                savedToDb = true
                savedCharacters.push(data.id)
              }
            } else {
              console.log(`[Analyze] Database not configured, using memory storage`)
            }
          } catch (dbError) {
            console.error(`[Analyze] Exception saving character "${char.name}" to database:`, dbError)
          }
          
          // 如果数据库保存失败，保存到内存
          if (!savedToDb) {
            memoryCharacters.push({
              id: characterId,
              projectId,
              name: char.name,
              description: char.description,
              appearance: char.appearance,
              personality: char.personality,
              tags: char.tags || [],
              status: 'pending',
              createdAt: new Date().toISOString(),
            })
            console.log(`[Analyze] Saved character "${char.name}" to memory: ${characterId}`)
            savedCharacters.push(characterId)
          }
        }
        console.log(`[Analyze] Total characters saved: ${savedCharacters.length}`)
      }

      // 保存分镜
      if (result.scenes && result.scenes.length > 0) {
        // 获取项目中的人物名称映射
        const characterNameToId = new Map<string, string>()
        
        // 从内存获取
        memoryCharacters
          .filter(c => c.projectId === projectId)
          .forEach(c => characterNameToId.set(c.name, c.id))
        
        // 尝试从数据库获取
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

        for (const scene of result.scenes) {
          const sceneId = generateId('scene')
          
          // 获取人物 ID
          const characterIds: string[] = (scene.characterNames || [])
            .map((name: string) => characterNameToId.get(name))
            .filter((id): id is string => id !== undefined)
          
          // 尝试保存到数据库
          let savedToDb = false
          try {
            const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
            
            if (isDatabaseConfigured()) {
              // 优先使用 service_role 客户端
              const supabase = getAdminClient()
              const insertData = {
                id: sceneId,
                project_id: projectId,
                script_id: defaultScriptId,
                scene_number: scene.sceneNumber,
                title: scene.title,
                description: scene.description,
                dialogue: scene.dialogue,
                action: scene.action,
                emotion: scene.emotion,
                character_ids: characterIds,
                metadata: {
                  shotType: scene.shotType,
                  cameraMovement: scene.cameraMovement,
                },
                status: 'pending',
              }
              
              const { error } = await supabase
                .from("scenes")
                .insert(insertData)
              
              if (error) {
                console.error(`[Analyze] Failed to save scene ${scene.sceneNumber} to database:`, error.message)
              } else {
                savedToDb = true
              }
            }
          } catch (dbError) {
            console.warn("Failed to save scene to database:", dbError)
          }
          
          // 如果数据库保存失败，保存到内存
          if (!savedToDb) {
            memoryScenes.push({
              id: sceneId,
              projectId,
              scriptId: defaultScriptId,
              sceneNumber: scene.sceneNumber,
              title: scene.title,
              description: scene.description,
              dialogue: scene.dialogue,
              action: scene.action,
              emotion: scene.emotion,
              characterIds,
              status: 'pending',
              createdAt: new Date().toISOString(),
            })
          }
        }
      }
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("Analyze error:", error)

    const errorMessage = error instanceof Error ? error.message : "分析失败，请重试"

    // 检查是否是超时错误
    if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
      return NextResponse.json(
        { error: "请求超时，请稍后重试" },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
