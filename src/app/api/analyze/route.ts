import { NextRequest, NextResponse } from "next/server"
import { LLMClient, Config, HeaderUtils, APIError } from "coze-coding-dev-sdk"
import { getSupabaseClient } from "@/storage/database/supabase-client"

// 增加超时配置 - Next.js API 路由最大执行时间
export const maxDuration = 300 // 5分钟

// POST /api/analyze - 分析文本内容，提取人物和视频分镜
export async function POST(request: NextRequest) {
  const { projectId, content } = await request.json()

  if (!content) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 })
  }

  // 获取用户配置
  let settings: any = null
  try {
    const supabase = getSupabaseClient()
    const result = await supabase
      .from('user_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    settings = result.data
  } catch (dbError) {
    console.warn("Failed to fetch user settings:", dbError)
    // 继续使用环境变量
  }

  // 检查 API 配置
  const apiKey = settings?.llm_api_key || process.env.LLM_API_KEY
  const baseUrl = settings?.llm_base_url || process.env.LLM_BASE_URL

  if (!apiKey) {
    return NextResponse.json(
      { error: "LLM API Key 未配置。请在设置页面或 .env 文件中配置 LLM_API_KEY" },
      { status: 500 }
    )
  }

  console.log("LLM Config:", {
    hasApiKey: !!apiKey,
    baseUrl: baseUrl || 'default',
    model: settings?.llm_model || 'doubao-seed-2-0-pro'
  })

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  // 使用用户配置的 API Key 和 Base URL，增加超时时间和重试配置
  const config = new Config({
    apiKey,
    baseUrl,
    timeout: 300000, // 300 秒超时（5分钟）
    retryTimes: 3,   // 重试3次
    retryDelay: 5000, // 重试间隔5秒
  })

  const client = new LLMClient(config, customHeaders)

  // 使用用户配置的模型，如果没有配置则使用默认模型
  // 对于长文本分析，推荐使用 doubao-seed-2-0-pro
  const modelName = settings?.llm_model || process.env.LLM_MODEL || 'doubao-seed-2-0-pro'

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

    // 带重试的调用
    let response
    let lastError: any = null
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`LLM invoke attempt ${attempt}/${maxRetries}`)
        response = await client.invoke(messages, {
          model: modelName,
          temperature: 0.3,
        })
        break // 成功则退出循环
      } catch (err: any) {
        lastError = err
        console.error(`LLM invoke attempt ${attempt} failed:`, err.message)

        // 如果是超时错误，等待后重试
        if (err?.name === 'TimeoutError' || err?.message?.includes('timed out')) {
          if (attempt < maxRetries) {
            const waitTime = attempt * 10000 // 10秒、20秒、30秒
            console.log(`Waiting ${waitTime/1000}s before retry...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        } else {
          // 其他错误直接抛出
          throw err
        }
      }
    }

    if (!response) {
      throw lastError || new Error('LLM response is empty')
    }

    // 解析 JSON 响应
    let result
    try {
      // 提取 JSON 内容（处理可能存在的 markdown 代码块）
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        response.content.match(/```\s*([\s\S]*?)\s*```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : response.content
      result = JSON.parse(jsonStr)
    } catch {
      console.error("Failed to parse LLM response:", response.content)
      return NextResponse.json(
        { error: "解析结果失败，请重试" },
        { status: 500 }
      )
    }

    // 如果有 projectId，保存到数据库
    if (projectId) {
      const supabase = getSupabaseClient()

      // 保存人物
      if (result.characters && result.characters.length > 0) {
        const charactersData = result.characters.map((char: any) => ({
          project_id: projectId,
          name: char.name,
          description: char.description,
          appearance: char.appearance,
          personality: char.personality,
          tags: char.tags || [],
        }))

        await supabase.from("characters").insert(charactersData)
      }

      // 保存分镜
      if (result.scenes && result.scenes.length > 0) {
        // 获取项目中的人物名称映射
        const { data: existingChars } = await supabase
          .from("characters")
          .select("id, name")
          .eq("project_id", projectId)

        const nameToId = new Map(
          (existingChars || []).map((c: any) => [c.name, c.id])
        )

        const scenesData = result.scenes.map((scene: any) => ({
          project_id: projectId,
          scene_number: scene.sceneNumber,
          title: scene.title,
          description: scene.description,
          dialogue: scene.dialogue,
          action: scene.action,
          emotion: scene.emotion,
          character_ids: (scene.characterNames || [])
            .map((name: string) => nameToId.get(name))
            .filter(Boolean),
          metadata: {
            shotType: scene.shotType,
            cameraMovement: scene.cameraMovement,
          },
        }))

        await supabase.from("scenes").insert(scenesData)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Analyze error:", error)

    // 检查是否是超时错误
    if (error?.name === 'TimeoutError' || error?.message?.includes('timed out')) {
      return NextResponse.json(
        { error: "请求超时，请检查网络连接或稍后重试。如果问题持续，请检查 API Base URL 是否正确。" },
        { status: 504 }
      )
    }

    // 检查是否是 API 错误
    if (error instanceof APIError) {
      console.error("API Error:", error.message, error.statusCode)
      return NextResponse.json(
        { error: `API 错误: ${error.message}` },
        { status: error.statusCode || 500 }
      )
    }

    // 其他错误
    const errorMessage = error?.message || "分析失败，请重试"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
