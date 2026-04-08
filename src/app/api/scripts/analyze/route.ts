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
- characterNames: 出现的角色名称列表（从上方角色列表中选择，使用角色名）

## 分镜拆分核心原则（必须遵守）

### 1. 适度的场景过渡
- **重要的环境/氛围描写**：如果环境变化对剧情有重要影响（如"镜头切换到豪华宴会厅"），可以单独作为一个分镜
- **简短的环境描写**：可以融入相邻分镜中，不需要单独成镜
- **心理描写**：简短的内心活动可以融入动作或对话中，长篇幅的内心独白可以单独成镜

### 2. 控制分镜内容跨度
- **避免内容跨度太大**：每个分镜应聚焦一个核心事件或情绪，避免把太多情节塞进一个分镜
- **保持故事连贯**：相邻分镜之间要有自然的过渡，避免跳跃太大
- **节奏把控**：高潮部分可以多拆分，铺垫部分可以适当合并

### 3. 对话分镜规则（关键！）
- **单句/短对话**：3-5秒可讲完的简短对话，可合并到动作分镜中
- **中等对话**：6-10秒的对话，单独一个分镜
- **长对话**：超过10秒的对话，必须拆分成多个分镜，避免单个视频分镜过长
- **避免重复**：拆分对话时，不要简单重复上一句的内容，而是让对话自然推进剧情

### 4. 分镜时长参考
- 单个分镜视频时长建议：3-8秒
- 最长不超过12秒
- 如果对话或动作内容超过12秒，必须拆分

### 5. 整体连贯性原则
- **首尾呼应**：开头的场景和结尾的场景可以形成呼应
- **情绪连贯**：同一情绪下的多个动作/对话可以合并为一个分镜
- **自然过渡**：相邻分镜之间应该有逻辑关联，不要强行切分
- **适度拆分**：分镜是为了让视频更流畅，不是为了拆分而拆分

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
      "emotion": "情绪氛围",
      "characterNames": ["角色名1", "角色名2"]
    }
  ]
}

分镜数量建议：10-20个，具体根据对话量和场景复杂度调整。`

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
