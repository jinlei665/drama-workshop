import { NextRequest, NextResponse } from "next/server"
import { invokeLLM, invokeLLMWithStream, parseLLMJson, extractHeaders, DEFAULT_LLM_MODEL, getServerAIConfig, getUserLLMConfig } from "@/lib/ai"
import { invokeCozeDirect, getCozeDirectConfig } from "@/lib/ai/coze-direct"
import { memoryCharacters, memoryScenes, generateId } from "@/lib/memory-storage"

// 增加超时配置 - Next.js API 路由最大执行时间
export const maxDuration = 300 // 5分钟

// POST /api/analyze - 分析文本内容，提取人物和视频分镜
export async function POST(request: NextRequest) {
  const { projectId, content } = await request.json()

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
      "dialogue": "对白内容",
      "action": "动作/表演描述",
      "emotion": "情绪氛围（如：紧张、温馨、悲伤）",
      "shotType": "景别（如：远景、全景、中景、近景、特写）",
      "cameraMovement": "镜头运动（如：固定、推镜、拉镜、摇镜、跟拍）",
      "characterNames": ["出场人物名称"]
    }
  ]
}

注意：
1. 每个场景应该是一个独立的视频分镜
2. 场景描述要详细，包含视觉元素、光影效果
3. 人物外貌描述要具体，便于生成真人风格的角色造型图
4. 分镜数量根据内容合理拆分，一般每个场景2-5个分镜
5. 景别和镜头运动要符合影视剧拍摄规范
6. 这是短剧视频分镜，不是漫画`

  try {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: `请分析以下内容：\n\n${processedContent}` },
    ]

    // 调用 LLM - 根据用户配置的 llm_provider 选择
    let responseContent: string
    
    // 判断是否使用用户配置的 LLM Provider
    const useCustomLLMProvider = llmConfig.provider && 
      llmConfig.provider !== 'doubao' && 
      llmConfig.apiKey
    
    if (useCustomLLMProvider) {
      // 使用用户配置的自定义 LLM Provider（DeepSeek、Kimi 等）
      console.log('[Analyze] Using custom LLM provider:', llmConfig.provider)
      
      // 导入 OpenAI 兼容客户端和模型名称映射
      const { OpenAICompatibleClient, getActualModelName } = await import('@/lib/ai/openai-compatible')
      
      // 获取实际的模型名称（将 Coze 平台的模型名映射到各 Provider 的实际模型名）
      const actualModelName = getActualModelName(llmConfig.provider, llmConfig.model)
      console.log('[Analyze] Model name mapping:', { 
        original: llmConfig.model, 
        actual: actualModelName 
      })
      
      const client = new OpenAICompatibleClient({
        apiKey: llmConfig.apiKey!,
        baseUrl: llmConfig.baseUrl || 'https://api.deepseek.com',
        model: actualModelName,
      })
      
      responseContent = await client.invoke(messages, { temperature: 0.3 })
    } else {
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
