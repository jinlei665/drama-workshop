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

### 1. 连贯性第一原则：解决内容跳跃问题
**核心问题**：避免分镜间内容跨度大、不连贯、情感断层、时空跳跃。

**解决方案**：
- **时间流检查**：每个分镜结束时，人物的状态、位置、情绪必须能**自然过渡**到下一个分镜的开始。在脑海中模拟播放，检查是否有"卡顿"或"跳跃"感。
- **空间锚点**：当场景变化时，在\`description\`中明确描述空间关系。例如，从"陈念屋内"切到"镇口榕树下"，描述中应包含"走出家门，来到镇口"。
- **情绪流控制**：同一情绪单元尽量合并。情绪转折点（如平静→震惊）是合理的分镜点，但需在\`action\`中体现过渡动作（如"愣住2秒"）。

### 2. 特殊内容防跳跃处理规则

#### 对话处理（最易跳跃点）
- **短对话**（3秒内）：如问候、简短应答，应与**关联动作**合并，不单独成镜。
  - ✅ 正确：镜1：王婶敲门递粥 + 对话"趁热吃" 
  - ❌ 错误：镜1：王婶敲门，镜2：说"趁热吃"
- **中长对话拆分规则**：
  1. **在动作介入点拆分**：当说话者或倾听者有**显著动作变化**时（如起身、转头、递东西）。
  2. **在话题自然转换点拆分**：对话从一个话题转向另一个话题。
  3. **在情绪转折点拆分**：语气、情绪发生变化时。
  4. **禁止"一句一镜"**：避免机械地将每句台词都拆成独立分镜。

#### 心理描写/回忆处理
- **瞬间心理**（1-2句）：必须转化为**可视化的微表情或小动作**，融入当前分镜的\`action\`字段。
  - 原文："他忽然觉得，这世上的事，大概都是这样"
  - 转化：\`action\`："他望着窗外的月亮，眼神放空，嘴角泛起一丝若有若无的苦笑"
- **完整回忆段落**（有明显起止）：
  - 作为独立分镜，在\`description\`开头添加**视觉标记**，如"[回忆画面，色调偏黄]"或"[闪回]"
  - 回忆结束的分镜，\`action\`中应包含**回到现实的过渡动作**，如"他摇摇头，从回忆中回过神来"

#### 环境描写处理
- **定场描写**：作为分镜开头的\`description\`部分。
- **氛围描写**：融入人物动作或对话中，在\`description\`中体现"人景互动"。
  - 原文："窗外，夜风轻轻吹过，带来远山竹林的清香"
  - 优化：\`description\`："深夜，陈念站在窗边。月光透过窗纸，夜风吹动他的发梢，带来远山竹林的清香"

### 3. 分镜时长与内容量控制（防信息过载）
- **单镜内容量标准**：
  - 简单动作 + 0-1句对话 = 3-5秒
  - 复杂动作 + 1-2句对话 = 5-7秒  
  - 纯对话（无大动作）= 每2-3句对话一个分镜（约6-8秒）
- **内容过载检查**：如果一个分镜的\`action\`和\`dialogue\`描述加起来超过4句话，考虑拆分。
- **内容不足检查**：如果一个分镜只有一句简短对话或无实质动作，考虑与相邻分镜合并。

### 4. 分镜间衔接技巧（在现有字段中实现）
1. **动作衔接**：上一个分镜的\`action\`结尾与下一个分镜的\`action\`开头应有连续性。
   - 镜N结尾：\`action\`："他挑起担子，转身走出门"
   - 镜N+1开头：\`description\`："门外街道，晨光中，陈念挑着担子走在青石板路上"
2. **视线/焦点衔接**：
   - 镜N结尾：\`action\`："他抬起头，望向窗外"
   - 镜N+1开头：\`description\`："窗外夜景，月亮高悬"
3. **声音衔接**：
   - 镜N结尾：\`dialogue\`："我明天再来找你！"
   - 镜N+1开头：\`description\`："次日清晨，陈念如约而至"

### 5. 连贯性自检流程（生成时执行）
在确定每个分镜的拆分点时，问自己以下问题：
1. **时间流**：从上一镜结束到这一镜开始，中间缺失的动作或时间会让观众困惑吗？
2. **空间逻辑**：人物的位置移动合理吗？是否有"瞬移"？
3. **情绪连贯**：情绪变化有铺垫吗？是否突兀？
4. **对话流**：对话拆分后，每部分是否仍有完整语义？会不会断在奇怪的地方？
5. **视觉流畅**：如果这是视频，这个剪辑点会让观众觉得"跳"吗？

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
