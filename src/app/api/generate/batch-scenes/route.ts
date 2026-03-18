import { NextRequest, NextResponse } from "next/server"
import { S3Storage, HeaderUtils } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryScenes, memoryCharacters, memoryProjects } from "@/lib/memory-storage"
import { getStylePrompt } from "@/lib/styles"
import { getCozeConfigFromMemory } from "@/lib/memory-store"
import { generateImage } from "@/lib/ai"
import axios from "axios"

// POST /api/generate/batch-scenes - 批量生成分镜图片
export async function POST(request: NextRequest) {
  const { projectId } = await request.json()

  if (!projectId) {
    return NextResponse.json(
      { error: "缺少项目ID" },
      { status: 400 }
    )
  }

  // 获取用户配置
  const userConfig = getCozeConfigFromMemory()
  
  // 检查是否有 API Key
  if (!userConfig?.apiKey) {
    return NextResponse.json(
      { error: "请先在设置页面配置 Coze API Key" },
      { status: 400 }
    )
  }

  // 获取项目风格
  let style = 'realistic_cinema'
  
  // 从内存获取
  const project = memoryProjects.find(p => p.id === projectId)
  if (project?.style) {
    style = project.style
  }
  
  // 从数据库获取
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseClient()
    const { data: projectData } = await supabase
      .from('projects')
      .select('style')
      .eq('id', projectId)
      .single()
    
    if (projectData?.style) {
      style = projectData.style
    }
  }

  // 获取风格提示词
  const stylePrompt = getStylePrompt(style)

  // 获取分镜数据
  let scenes: any[] = []
  let characterMap = new Map()

  if (isDatabaseConfigured()) {
    const supabase = getSupabaseClient()

    const { data: dbScenes, error: scenesError } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", projectId)
      .order("scene_number", { ascending: true })

    if (scenesError || !dbScenes || dbScenes.length === 0) {
      return NextResponse.json(
        { error: "未找到分镜数据" },
        { status: 404 }
      )
    }
    scenes = dbScenes

    // 获取人物数据
    const { data: characters } = await supabase
      .from("characters")
      .select("*")
      .eq("project_id", projectId)

    characterMap = new Map(
      (characters || []).map((c: any) => [c.id, c])
    )
  } else {
    // 使用内存存储
    scenes = memoryScenes.filter(s => s.projectId === projectId)
      .sort((a, b) => a.sceneNumber - b.sceneNumber)

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "未找到分镜数据" },
        { status: 404 }
      )
    }

    memoryCharacters
      .filter(c => c.projectId === projectId)
      .forEach(c => characterMap.set(c.id, c))
  }

  // 使用统一的图像生成接口
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
  const imageConfig = {
    apiKey: userConfig.apiKey,
    baseUrl: userConfig.baseUrl,
  }

  // 初始化对象存储（可选）
  let storage: S3Storage | null = null
  try {
    storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    })
  } catch (e) {
    console.warn("Storage not available:", e)
  }

  const results = []
  const supabase = isDatabaseConfigured() ? getSupabaseClient() : null

  for (const scene of scenes) {
    const sceneId = scene.id

    // 跳过已完成的
    if (scene.status === "completed") {
      results.push({ sceneId, status: "skipped", message: "已完成" })
      continue
    }

    try {
      // 更新状态为生成中
      if (supabase) {
        await supabase
          .from("scenes")
          .update({ status: "generating" })
          .eq("id", sceneId)
      }

      // 更新内存
      const idx = memoryScenes.findIndex(s => s.id === sceneId)
      if (idx !== -1) {
        memoryScenes[idx].status = "generating"
      }

      // 获取出场人物描述
      const charIds = scene.character_ids || scene.characterIds || []
      const charDescriptions = charIds
        .map((id: string) => {
          const char = characterMap.get(id) as { id: string; appearance?: string } | undefined
          return char?.appearance
        })
        .filter(Boolean)

      // 构建真人实拍风格提示词
      const description = scene.description
      const emotion = scene.emotion

      let prompt = `${stylePrompt}，${description}`

      if (emotion) {
        prompt += `，${emotion}的氛围`
      }

      if (charDescriptions.length > 0) {
        prompt += `，画面中的角色：${charDescriptions.join("、")}`
      }

      prompt += "，4K画质，细节丰富"

      console.log(`Generating scene ${sceneId} with style ${style}:`, prompt.substring(0, 100))

      // 生成图片（使用统一的图像生成接口，已修复 SDK 内部错误处理）
      const imageResult = await generateImage(prompt, {
        size: '2K',
        watermark: false,
      }, imageConfig, customHeaders)

      // 下载图片
      const imageUrl = imageResult.urls[0]
      let fileKey: string | null = null
      let viewUrl: string = imageUrl

      // 尝试上传到存储
      if (storage) {
        try {
          const imageResponse = await axios.get(imageUrl, {
            responseType: "arraybuffer",
          })
          const imageBuffer = Buffer.from(imageResponse.data)

          fileKey = await storage.uploadFile({
            fileContent: imageBuffer,
            fileName: `scenes/${sceneId}/image_${Date.now()}.png`,
            contentType: "image/png",
          })

          viewUrl = await storage.generatePresignedUrl({
            key: fileKey,
            expireTime: 86400 * 7,
          })
        } catch (e) {
          console.warn("Failed to upload to storage:", e)
        }
      }

      // 更新数据库
      if (supabase) {
        await supabase
          .from("scenes")
          .update({
            image_key: fileKey,
            image_url: viewUrl,
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sceneId)
      }

      // 更新内存
      const completeIdx = memoryScenes.findIndex(s => s.id === sceneId)
      if (completeIdx !== -1) {
        memoryScenes[completeIdx].imageKey = fileKey || undefined
        memoryScenes[completeIdx].imageUrl = viewUrl
        memoryScenes[completeIdx].status = "completed"
      }

      results.push({
        sceneId,
        status: "completed",
        imageKey: fileKey,
        imageUrl: viewUrl,
      })
    } catch (error) {
      console.error(`Scene ${sceneId} generation error:`, error)

      // 更新状态为失败
      if (supabase) {
        await supabase
          .from("scenes")
          .update({ status: "failed" })
          .eq("id", sceneId)
      }

      const failedIdx = memoryScenes.findIndex(s => s.id === sceneId)
      if (failedIdx !== -1) {
        memoryScenes[failedIdx].status = "failed"
      }

      results.push({
        sceneId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return NextResponse.json({
    success: true,
    total: scenes.length,
    style,
    results,
  })
}
