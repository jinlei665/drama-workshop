import { NextRequest, NextResponse } from "next/server"
import { S3Storage, HeaderUtils } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryScenes, memoryCharacters, memoryProjects } from "@/lib/memory-storage"
import { getStylePrompt } from "@/lib/styles"
import { generateImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/batch-scenes - 批量生成分镜图片
export async function POST(request: NextRequest) {
  const { projectId } = await request.json()

  if (!projectId) {
    return NextResponse.json(
      { error: "缺少项目ID" },
      { status: 400 }
    )
  }

  // 获取项目风格
  let style = 'realistic_cinema'
  let customStylePrompt = ''
  
  // 从内存获取
  const project = memoryProjects.find(p => p.id === projectId)
  if (project?.style) {
    style = project.style
  }
  if (project?.customStylePrompt) {
    customStylePrompt = project.customStylePrompt
  }
  
  // 从数据库获取
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseClient()
    const { data: projectData } = await supabase
      .from('projects')
      .select('style, custom_style_prompt')
      .eq('id', projectId)
      .single()
    
    if (projectData?.style) {
      style = projectData.style
    }
    if (projectData?.custom_style_prompt) {
      customStylePrompt = projectData.custom_style_prompt
    }
  }

  // 获取风格提示词
  // 如果是自定义风格，使用用户输入的自定义提示词
  let stylePrompt: string
  if (style === 'custom' && customStylePrompt) {
    stylePrompt = customStylePrompt
  } else {
    stylePrompt = getStylePrompt(style)
  }

  // 获取分镜数据
  let scenes: any[] = []
  // 人物数据结构，包含参考图信息
  let characterMap = new Map<string, { 
    id: string
    name: string
    appearance?: string
    frontViewKey?: string
    imageUrl?: string
  }>()

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

    // 获取人物数据（包含参考图）
    const { data: characters } = await supabase
      .from("characters")
      .select("id, name, appearance, front_view_key, image_url")
      .eq("project_id", projectId)

    characterMap = new Map(
      (characters || []).map((c: any) => [c.id, {
        id: c.id,
        name: c.name,
        appearance: c.appearance,
        frontViewKey: c.front_view_key,
        imageUrl: c.image_url,
      }])
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
      .forEach(c => characterMap.set(c.id, {
        id: c.id,
        name: c.name,
        appearance: c.appearance,
        frontViewKey: c.frontViewKey,
        imageUrl: c.imageUrl,
      }))
  }

  // 使用统一的图像生成接口（沙箱环境内置凭证）
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

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

      // 获取出场人物信息（包含参考图）
      const charIds = scene.character_ids || scene.characterIds || []
      const sceneCharacters = charIds
        .map((id: string) => characterMap.get(id))
        .filter(Boolean)
      
      // 获取人物描述文本
      const charDescriptions = sceneCharacters
        .map((c: { appearance?: string } | undefined) => c?.appearance)
        .filter(Boolean)
      
      // 获取人物参考图URL（用于保持人物一致性）
      // 优先使用 frontViewKey（三视图），其次是 imageUrl
      const characterReferenceImages = sceneCharacters
        .map((c: { frontViewKey?: string; imageUrl?: string; name?: string } | undefined) => {
          if (c?.frontViewKey) {
            // 如果是完整 URL 直接使用
            if (c.frontViewKey.startsWith('http')) {
              console.log(`[Scene ${sceneId}] Using frontViewKey (HTTP) for ${c.name}:`, c.frontViewKey)
              return c.frontViewKey
            }
            // 如果是本地路径，构造完整 URL（AI API 需要完整 URL）
            const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
            const url = `${domain}/characters/${c.frontViewKey}`
            console.log(`[Scene ${sceneId}] Using frontViewKey (local) for ${c.name}:`, url)
            return url
          }
          if (c?.imageUrl) {
            console.log(`[Scene ${sceneId}] Using imageUrl for ${c.name}:`, c.imageUrl)
            return c.imageUrl
          }
          console.log(`[Scene ${sceneId}] Character ${c?.name} has no reference image (no frontViewKey or imageUrl)`)
          return undefined
        })
        .filter(Boolean) as string[]

      if (sceneCharacters.length > 0 && characterReferenceImages.length === 0) {
        console.warn(`[Scene ${sceneId}] Found ${sceneCharacters.length} characters but no reference images. Characters:`,
          sceneCharacters.map((c: any) => c?.name).join(', '))
      }

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
      if (characterReferenceImages.length > 0) {
        console.log(`  Using ${characterReferenceImages.length} character reference images for consistency`)
      }

      // 生成图片（使用沙箱环境内置凭证）
      // 关键改进：传入人物参考图以保持一致性
      const imageResult = await generateImage(prompt, {
        size: '2K',
        watermark: false,
        image: characterReferenceImages.length > 0 ? characterReferenceImages : undefined,
      }, undefined, customHeaders)

      // 下载图片
      const imageUrl = imageResult.urls[0]
      let fileKey: string | null = null
      let viewUrl: string = imageUrl

      // 尝试下载并上传到存储
      try {
        const imageBuffer = await downloadFile(imageUrl)
        
        // 尝试上传到对象存储
        if (storage) {
          try {
            fileKey = await storage.uploadFile({
              fileContent: imageBuffer,
              fileName: `scenes/${sceneId}/image_${Date.now()}.png`,
              contentType: "image/png",
            })

            viewUrl = await storage.generatePresignedUrl({
              key: fileKey,
              expireTime: 86400 * 7,
            })
            console.log(`Scene ${sceneId} image uploaded to storage:`, fileKey)
          } catch (storageErr) {
            console.warn(`Scene ${sceneId} storage upload failed, saving to local:`, storageErr)
            
            // 对象存储不可用，保存到本地 public 目录
            const fs = await import('fs')
            const path = await import('path')
            
            const publicDir = path.join(process.cwd(), 'public', 'scenes', sceneId)
            if (!fs.existsSync(publicDir)) {
              fs.mkdirSync(publicDir, { recursive: true })
            }
            
            const localFileName = `image_${Date.now()}.png`
            const localFilePath = path.join(publicDir, localFileName)
            fs.writeFileSync(localFilePath, imageBuffer)
            
            fileKey = `${sceneId}/${localFileName}`
            viewUrl = `/scenes/${fileKey}`
            console.log(`Scene ${sceneId} image saved to local:`, localFilePath)
          }
        } else {
          // 没有对象存储配置，直接保存到本地
          const fs = await import('fs')
          const path = await import('path')
          
          const publicDir = path.join(process.cwd(), 'public', 'scenes', sceneId)
          if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true })
          }
          
          const localFileName = `image_${Date.now()}.png`
          const localFilePath = path.join(publicDir, localFileName)
          fs.writeFileSync(localFilePath, imageBuffer)
          
          fileKey = `${sceneId}/${localFileName}`
          viewUrl = `/scenes/${fileKey}`
          console.log(`Scene ${sceneId} image saved to local:`, localFilePath)
        }
      } catch (downloadErr) {
        console.warn(`Scene ${sceneId} image download failed, using original URL:`, downloadErr)
        // 下载失败，使用原始 URL
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
