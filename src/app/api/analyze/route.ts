import { NextRequest, NextResponse } from "next/server"
import { invokeLLM, parseLLMJson, extractHeaders, DEFAULT_LLM_MODEL } from "@/lib/ai"
import { memoryCharacters, memoryScenes, generateId } from "@/lib/memory-storage"
import { getUserAIServiceConfig } from "@/lib/model-config"

// 增加超时配置 - Next.js API 路由最大执行时间
export const maxDuration = 300 // 5分钟

// POST /api/analyze - 分析文本内容，提取人物和视频分镜
export async function POST(request: NextRequest) {
  const { projectId, content } = await request.json()

  if (!content) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 })
  }

  // 使用统一配置获取用户设置
  const aiConfig = await getUserAIServiceConfig(request.headers)
  
  // 获取用户配置（可选，用于日志）
  let userSettings: {
    llm_model?: string
    llm_api_key?: string | null
    llm_base_url?: string | null
  } | null = null

  if (aiConfig.apiKey) {
    userSettings = {
      llm_model: aiConfig.model,
      llm_api_key: aiConfig.apiKey,
      llm_base_url: aiConfig.baseUrl,
    }
  }

  // 提取请求头用于转发
  const customHeaders = extractHeaders(request.headers)

  // 使用统一配置（支持用户配置回退到系统模型）
  const model = aiConfig.model || DEFAULT_LLM_MODEL
  const apiKey = aiConfig.apiKey
  const baseUrl = aiConfig.baseUrl

  console.log("LLM Config:", {
    model,
    hasApiKey: !!apiKey,
    baseUrl: baseUrl || 'default (system)',
    useSystemDefault: aiConfig.useSystemDefault,
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

    // 调用 LLM（使用统一配置，支持用户配置回退到系统模型）
    let usedFallback = false
    let responseContent: string
    
    try {
      responseContent = await invokeLLM(
        messages,
        {
          model,
          temperature: 0.3,
        },
        apiKey ? { apiKey, baseUrl, model } : undefined,
        customHeaders
      )
    } catch (err) {
      // 如果是回退错误，尝试用系统模型
      if (err instanceof Error && (err as any).fallbackAttempted) {
        console.warn("User model failed, already attempted fallback, using error message")
        throw err
      }
      throw err
    }

    // 解析 JSON 响应
    let result
    try {
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
    } catch (parseError) {
      console.error("Failed to parse LLM response:", responseContent)
      return NextResponse.json(
        { error: "解析结果失败，请重试" },
        { status: 500 }
      )
    }

    // 如果有 projectId，保存数据
    if (projectId) {
      const savedCharacters: string[] = []
      
      // 保存人物
      if (result.characters && result.characters.length > 0) {
        for (const char of result.characters) {
          const characterId = generateId('char')
          
          // 尝试保存到数据库
          let savedToDb = false
          try {
            const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
            
            if (isDatabaseConfigured()) {
              const supabase = getSupabaseClient()
              const { data, error } = await supabase
                .from("characters")
                .insert({
                  id: characterId,
                  project_id: projectId,
                  name: char.name,
                  description: char.description,
                  appearance: char.appearance,
                  personality: char.personality,
                  tags: char.tags || [],
                  status: 'pending',
                })
                .select()
                .single()
              
              if (!error && data) {
                savedToDb = true
                savedCharacters.push(data.id)
              }
            }
          } catch (dbError) {
            console.warn("Failed to save character to database:", dbError)
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
            savedCharacters.push(characterId)
          }
        }
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
            const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
            
            if (isDatabaseConfigured()) {
              const supabase = getSupabaseClient()
              const { error } = await supabase
                .from("scenes")
                .insert({
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
                })
              
              if (!error) {
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
