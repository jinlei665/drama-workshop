import { NextRequest, NextResponse } from "next/server"
import { generateImage } from "@/lib/ai"
import { S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryScenes, memoryProjects, memoryCharacters } from "@/lib/memory-storage"
import { getStylePrompt } from "@/lib/styles"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/scene-image - 生成分镜图片（短剧视频分镜）
export async function POST(request: NextRequest) {
  const { sceneId, description, emotion, characterAppearances, characterIds } = await request.json()

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

    // 如果传入了 characterAppearances，使用选中的形象
    if (characterAppearances && characterAppearances.length > 0) {
      console.log(`[Scene Image] Getting reference images for ${characterAppearances.length} characters using selected appearances`)

      // 使用 Promise.all 等待所有异步操作完成
      const appearancePromises = characterAppearances.map(async (charApp: any) => {
        // 如果有选中的形象，优先使用它的 imageKey 构造公网 URL
        if (charApp.selectedAppearance && charApp.selectedAppearance.imageKey) {
          console.log(`[Scene Image] Character ${charApp.characterName}: using selected appearance imageKey`)
          const imageKey = charApp.selectedAppearance.imageKey
          // 构造完整的公网 URL
          const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
          if (endpoint) {
            return `${endpoint}/${imageKey}`
          } else {
            // 降级：使用域名 + /api/images
            const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
            return `${domain}/api/images?key=${imageKey}`
          }
        } else if (charApp.selectedAppearance && charApp.selectedAppearance.imageUrl && charApp.selectedAppearance.imageUrl.startsWith('http')) {
          // 如果 imageUrl 已经是完整的公网 URL，直接使用
          console.log(`[Scene Image] Character ${charApp.characterName}: using selected appearance imageUrl (HTTP)`)
          return charApp.selectedAppearance.imageUrl
        } else if (charApp.appearanceDescription) {
          console.log(`[Scene Image] Character ${charApp.characterName}: using character front view`)
          // 如果没有选中的形象，使用角色的正面视图
          if (isDatabaseConfigured()) {
            // 从数据库获取角色的正面视图
            const { data } = await getSupabaseClient()
              .from('characters')
              .select('front_view_key, image_url')
              .eq('id', charApp.characterId)
              .single()

            if (data) {
              const key = (data as any).front_view_key || (data as any).image_url
              if (key) {
                // 构造完整的公网 URL
                const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
                if (endpoint && !key.startsWith('http')) {
                  return `${endpoint}/${key}`
                } else if (key.startsWith('http')) {
                  return key
                } else {
                  // 降级：使用域名 + /api/images
                  const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
                  return `${domain}/api/images?key=${key}`
                }
              }
            }
          }
        }
        return null
      })

      const results = await Promise.all(appearancePromises)
      characterReferenceImages = results.filter(Boolean) as string[]
    } else if (characterIds && characterIds.length > 0) {
      // 兼容旧的逻辑：使用 characterIds
      console.log(`[Scene Image] Getting reference images for ${characterIds.length} characters using characterIds (legacy)`)

      if (isDatabaseConfigured()) {
        const supabase = getSupabaseClient()
        const { data: chars } = await supabase
          .from('characters')
          .select('id, name, front_view_key, image_url')
          .in('id', characterIds)

        console.log(`[Scene Image] Query result:`, chars?.map((c: any) => ({
          id: c.id,
          name: c.name,
          hasFrontView: !!c.front_view_key,
          hasImageUrl: !!c.image_url
        })))

        if (chars) {
          characterReferenceImages = chars
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
              // 构造完整的公网 URL
              const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
              if (endpoint) {
                const url = `${endpoint}/${key}`
                console.log(`[Scene Image] Character ${c.name}: using public URL ${url}`)
                return url
              } else {
                // 降级：使用域名 + /api/images
                const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
                const url = `${domain}/api/images?key=${key}`
                console.log(`[Scene Image] Character ${c.name}: using API URL ${url}`)
                return url
              }
            })
            .filter(Boolean)
        }
      } else {
        // 从内存获取
        console.log(`[Scene Image] Getting characters from memory`)
        characterReferenceImages = characterIds
          .map((id: string) => {
            const char = memoryCharacters.find((c: any) => c.id === id)
            console.log(`[Scene Image] Character ${char?.name} (${id}):`, {
              hasFrontView: !!char?.frontViewKey,
              hasImageUrl: !!char?.imageUrl
            })
            const key = char?.frontViewKey || char?.imageUrl
            if (!key) return null
            // 如果是完整 URL 直接使用
            if (key.startsWith('http')) return key
            // 构造完整的公网 URL
            const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
            if (endpoint) {
              return `${endpoint}/${key}`
            } else {
              // 降级：使用域名 + /api/images
              const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
              return `${domain}/api/images?key=${key}`
            }
          })
          .filter(Boolean) as string[]
      }

      console.log(`[Scene Image] Final reference images:`, characterReferenceImages)
    } else {
      console.log(`[Scene Image] No character information provided`)
    }

    // 构建分镜提示词
    let prompt = `${stylePrompt}，${description}`

    if (emotion) {
      prompt += `，${emotion}的氛围`
    }

    // 添加人物描述（兼容旧逻辑）
    if (characterAppearances && characterAppearances.length > 0) {
      const charDescriptions = characterAppearances
        .map((c: any) => c.appearanceDescription)
        .filter(Boolean)
      if (charDescriptions.length > 0) {
        prompt += `，画面中的角色：${charDescriptions.join("、")}`
      }
    } else if (characterIds && characterIds.length > 0) {
      // 旧逻辑
      const charDescriptions = characterIds
        .map((id: string) => memoryCharacters.find((c: any) => c.id === id)?.appearance)
        .filter(Boolean)
      if (charDescriptions.length > 0) {
        prompt += `，画面中的角色：${charDescriptions.join("、")}`
      }
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

    // 尝试上传到对象存储（使用 S3Storage）
    let fileKey: string | null = null
    let viewUrl: string = imageUrl // 默认使用原始 URL

    try {
      // 使用 ali-oss SDK 上传（支持设置 ACL）
      const OSS = await import('ali-oss')
      const ossClient = new OSS.default({
        region: process.env.S3_REGION || 'oss-cn-chengdu',
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        accessKeySecret: process.env.S3_SECRET_KEY || '',
        bucket: process.env.S3_BUCKET || 'drama-studio',
        secure: true,
      })

      // 上传到 OSS
      fileKey = `scenes/${sceneId}/image_${Date.now()}.png`
      await ossClient.put(fileKey, imageBuffer)

      // 设置为公开读取
      await ossClient.putACL(fileKey, 'public-read')

      // 生成公网 URL
      const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
      viewUrl = `${endpoint}/${fileKey}`

      console.log("Image uploaded to OSS:", fileKey)
    } catch (ossError) {
      console.warn("Failed to upload to OSS, saving to local:", ossError)
      
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
