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
