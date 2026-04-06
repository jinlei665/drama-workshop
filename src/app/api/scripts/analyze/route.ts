import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
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
    const client = getSupabaseClient()
    
    if (projectId) {
      const { data } = await client
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single()
      project = data
    }

    // 获取风格提示词
    const style = project?.style || "realistic_drama"
    const stylePrompt = getStylePrompt(style)

    // 构建分析提示词
    const analyzePrompt = `你是一个专业的短剧分镜师。根据以下脚本内容，分析并生成详细的分镜信息。

## 项目风格
${stylePrompt}

## 脚本内容
${scriptContent}

## 已有角色（如果有）
${existingCharacters?.length > 0 
  ? existingCharacters.map((c: any) => `- ${c.name}: ${c.description || c.appearance || '无描述'}`).join('\n')
  : '暂无已有角色'
}

## 输出要求
请生成以下内容：

### 1. 新角色列表（本次脚本中出现的新角色，不包括已有角色）
每个角色包含：
- name: 角色名称
- description: 角色描述（外貌、性格、身份等）
- gender: 性别（male/female/other）
- age: 年龄描述（如：25-30岁）

### 2. 分镜列表
每个分镜包含：
- title: 分镜标题（简短有力）
- description: 分镜描述（具体场景、动作、画面）
- dialogue: 对话内容（如有）
- emotion: 情绪氛围（如：紧张、温馨、悲伤）

请用 JSON 格式输出：
{
  "newCharacters": [
    {
      "name": "角色名",
      "description": "角色描述",
      "gender": "male/female/other",
      "age": "年龄描述"
    }
  ],
  "scenes": [
    {
      "title": "分镜标题",
      "description": "分镜描述",
      "dialogue": "对话（可选）",
      "emotion": "情绪氛围"
    }
  ]
}

请确保分镜数量适中（5-15个），每个分镜描述详细具体。`

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

    // 生成角色和分镜 ID
    const timestamp = Date.now()
    const characters = (analysisResult.newCharacters || []).map((c: any, index: number) => ({
      id: `char_${timestamp}_${index}_${Math.random().toString(36).substr(2, 6)}`,
      name: c.name,
      description: c.description || "",
      gender: c.gender || "other",
      age: c.age || "",
      appearance: c.description || "",
      projectId,
      tags: [],
      status: "pending",
    }))

    const scenes = (analysisResult.scenes || []).map((s: any, index: number) => ({
      id: `scene_${timestamp}_${index}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      scriptId,
      sceneNumber: index + 1,
      title: s.title,
      description: s.description || "",
      dialogue: s.dialogue || "",
      emotion: s.emotion || "",
      status: "pending",
    }))

    return NextResponse.json({
      characters,
      scenes,
      analysisText: analysisResult,
    })
  } catch (err: any) {
    console.error("脚本分析异常:", err)
    return NextResponse.json({ 
      error: err.message || "脚本分析失败" 
    }, { status: 500 })
  }
}
