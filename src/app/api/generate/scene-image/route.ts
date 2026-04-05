import { NextRequest, NextResponse } from "next/server"
import { generateImage } from "@/lib/ai"
import { S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryScenes, memoryProjects, memoryCharacters } from "@/lib/memory-storage"
import { getStylePrompt } from "@/lib/styles"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/scene-image - 生成分镜图片（短剧视频分镜）
export async function POST(request: NextRequest) {
  const { sceneId, description, emotion, characterDescriptions, characterIds } = await request.json()

  if (!sceneId || !description) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    )
  }

  try {
    // 获取项目风格
    let style = 'realistic_cinema'
    let projectId = ''
    
    // 从内存获取
    const sceneIndex = memoryScenes.findIndex(s => s.id === sceneId)
    if (sceneIndex !== -1) {
      projectId = memoryScenes[sceneIndex].projectId
      const project = memoryProjects.find(p => p.id === projectId)
      if (project?.style) {
        style = project.style
      }
    }
    
    // 从数据库获取
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      
      // 获取分镜所属项目
      const { data: sceneData } = await supabase
        .from('scenes')
        .select('project_id')
        .eq('id', sceneId)
        .single()
      
      if (sceneData?.project_id) {
        projectId = sceneData.project_id
        const { data: projectData } = await supabase
          .from('projects')
          .select('style')
          .eq('id', sceneData.project_id)
          .single()
        
        if (projectData?.style) {
          style = projectData.style
        }
      }
    }

    // 获取风格提示词
    const stylePrompt = getStylePrompt(style)

    // 获取人物参考图（用于保持人物一致性）
    let characterReferenceImages: string[] = []

    // 如果传入了 characterIds，获取人物的参考图
    if (characterIds && characterIds.length > 0) {
      console.log(`[Scene Image] Getting reference images for ${characterIds.length} characters:`, characterIds)

      if (isDatabaseConfigured()) {
        const supabase = getSupabaseClient()
        const { data: characters } = await supabase
          .from('characters')
          .select('id, name, front_view_key, image_url')
          .in('id', characterIds)

        console.log(`[Scene Image] Query result:`, characters?.map((c: any) => ({
          id: c.id,
          name: c.name,
          hasFrontView: !!c.front_view_key,
          hasImageUrl: !!c.image_url
        })))

        if (characters) {
          characterReferenceImages = characters
            .map((c: any) => {
              const key = c.front_view_key || c.image_url
              if (!key) {
                console.log(`[Scene Image] Character ${c.name} (${c.id}) has no reference image`)
                return null
              }
              // 如果是完整 URL 直接使用
              if (key.startsWith('http')) {
                console.log(`[Scene Image] Character ${c.name}: using HTTP URL ${key}`)
                return key
              }
              // 如果是本地路径，构造完整 URL
              const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
              const url = `${domain}/characters/${key}`
              console.log(`[Scene Image] Character ${c.name}: using local path ${url}`)
              return url
            })
            .filter(Boolean)
        }
      } else {
        // 从内存获取
        console.log(`[Scene Image] Getting characters from memory`)
        characterReferenceImages = characterIds
          .map((id: string) => {
            const char = memoryCharacters.find(c => c.id === id)
            console.log(`[Scene Image] Character ${char?.name} (${id}):`, {
              hasFrontView: !!char?.frontViewKey,
              hasImageUrl: !!char?.imageUrl
            })
            const key = char?.frontViewKey || char?.imageUrl
            if (!key) return null
            // 如果是完整 URL 直接使用
            if (key.startsWith('http')) return key
            // 如果是本地路径，构造完整 URL
            const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
            return `${domain}/characters/${key}`
          })
          .filter(Boolean) as string[]
      }

      console.log(`[Scene Image] Final reference images:`, characterReferenceImages)
    } else {
      console.log(`[Scene Image] No character IDs provided`)
    }

    // 构建分镜提示词
    let prompt = `${stylePrompt}，${description}`

    if (emotion) {
      prompt += `，${emotion}的氛围`
    }

    // 添加人物描述
    if (characterDescriptions && characterDescriptions.length > 0) {
      prompt += `，画面中的角色：${characterDescriptions.join("、")}`
    }

    prompt += "，4K画质，细节丰富"

    console.log(`Generating scene image for ${sceneId} with style ${style}:`, prompt.substring(0, 100))
    if (characterReferenceImages.length > 0) {
      console.log(`  Using ${characterReferenceImages.length} character reference images for consistency`)
    }

    // 更新状态为生成中
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      await supabase
        .from("scenes")
        .update({ status: "generating" })
        .eq("id", sceneId)
    }

    // 更新内存中的状态
    if (sceneIndex !== -1) {
      memoryScenes[sceneIndex].status = "generating"
    }

    // 使用系统自带的图像生成服务
    // 关键改进：传入人物参考图以保持一致性
    const result = await generateImage(prompt, {
      size: '2K',
      watermark: false,
      image: characterReferenceImages.length > 0 ? characterReferenceImages : undefined,
    })

    const imageUrl = result.urls[0]
    console.log("Image generated successfully:", imageUrl)

    // 下载图片（禁用代理）
    const imageBuffer = await downloadFile(imageUrl)

    // 尝试上传到对象存储
    let fileKey: string | null = null
    let viewUrl: string = imageUrl // 默认使用原始 URL

    try {
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: "",
        secretKey: "",
        bucketName: process.env.COZE_BUCKET_NAME,
        region: "cn-beijing",
      })

      // 上传到对象存储
      fileKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: `scenes/${sceneId}/image_${Date.now()}.png`,
        contentType: "image/png",
      })

      // 生成访问 URL
      viewUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400 * 7, // 7天有效
      })

      console.log("Image uploaded to storage:", fileKey)
    } catch (storageError) {
      console.warn("Failed to upload to storage, saving to local:", storageError)
      
      // 对象存储不可用，保存到本地 public 目录
      try {
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
        console.log("Image saved to local:", localFilePath)
      } catch (localError) {
        console.warn("Failed to save to local:", localError)
      }
    }

    // 更新数据库
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
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

    // 更新内存存储
    if (sceneIndex !== -1) {
      memoryScenes[sceneIndex].imageKey = fileKey || undefined
      memoryScenes[sceneIndex].imageUrl = viewUrl
      memoryScenes[sceneIndex].status = "completed"
    }

    return NextResponse.json({
      success: true,
      imageUrl: viewUrl,
      fileKey,
      style,
      usedCharacterReferences: characterReferenceImages.length,
    })
  } catch (error) {
    console.error("Generate scene image error:", error)

    // 更新状态为失败
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      await supabase
        .from("scenes")
        .update({ status: "failed" })
        .eq("id", sceneId)
    }

    // 更新内存中的状态
    const sceneIndex = memoryScenes.findIndex(s => s.id === sceneId)
    if (sceneIndex !== -1) {
      memoryScenes[sceneIndex].status = "failed"
    }

    const errorMessage = error instanceof Error ? error.message : "生成分镜图片失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
