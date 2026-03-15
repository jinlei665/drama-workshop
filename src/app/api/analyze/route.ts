import { NextRequest, NextResponse } from "next/server"
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk"
import { getSupabaseClient } from "@/storage/database/supabase-client"

// POST /api/analyze - 分析文本内容，提取人物和视频分镜
export async function POST(request: NextRequest) {
  const { projectId, content } = await request.json()

  if (!content) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 })
  }

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
  const config = new Config()
  const client = new LLMClient(config, customHeaders)

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
      { role: "user" as const, content: `请分析以下内容：\n\n${content}` },
    ]

    const response = await client.invoke(messages, {
      model: "doubao-seed-2-0-pro-260215",
      temperature: 0.3,
    })

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
  } catch (error) {
    console.error("Analyze error:", error)
    return NextResponse.json(
      { error: "分析失败，请重试" },
      { status: 500 }
    )
  }
}
