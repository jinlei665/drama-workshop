import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils, S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryCharacters, memoryProjects } from "@/lib/memory-storage"
import { getCharacterStylePrompt } from "@/lib/styles"
import { generateImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/character-views - 生成人物三视图（短剧角色设定）
export async function POST(request: NextRequest) {
  const { characterId, appearance } = await request.json()

  if (!characterId || !appearance) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Character Views] Starting generation for:', characterId)

  try {
    // 获取项目风格
    let style = 'realistic_cinema'
    
    // 从内存获取
    const charIndex = memoryCharacters.findIndex(c => c.id === characterId)
    if (charIndex !== -1) {
      const projectId = memoryCharacters[charIndex].projectId
      const project = memoryProjects.find(p => p.id === projectId)
      if (project?.style) {
        style = project.style
      }
    }
    
    // 从数据库获取
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      
      const { data: charData } = await supabase
        .from('characters')
        .select('project_id')
        .eq('id', characterId)
        .single()
      
      if (charData?.project_id) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('style')
          .eq('id', charData.project_id)
          .single()
        
        if (projectData?.style) {
          style = projectData.style
        }
      }
    }

    // 获取角色风格提示词
    const stylePrompt = getCharacterStylePrompt(style)

    // 生成角色设定图
    const basePrompt = `${stylePrompt}，${appearance}，角色三视图包含正面、侧面、背面三个角度，白色背景，用于角色设定参考`

    console.log(`Generating character views for ${characterId} with style ${style}:`, basePrompt.substring(0, 100))

    // 使用统一的图像生成接口（使用沙箱环境内置凭证）
    let imageUrl: string
    try {
      const result = await generateImage(basePrompt, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)
      
      imageUrl = result.urls[0]
      console.log('[Character Views] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Character Views] Generate error:', genError)
      return NextResponse.json(
        { error: genError instanceof Error ? genError.message : '图像生成失败' },
        { status: 500 }
      )
    }

    // 下载图片（禁用代理）
    const imageBuffer = await downloadFile(imageUrl)

    // 尝试上传到对象存储（使用 S3Storage）
    let fileKey: string | null = null
    let viewUrl: string = imageUrl // 默认使用原始 URL

    try {
      const storage = new S3Storage({
        endpointUrl: process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
        bucketName: process.env.S3_BUCKET || process.env.COZE_BUCKET_NAME,
        region: process.env.S3_REGION || 'us-east-1',
      })

      // 上传到 OSS
      fileKey = `characters/${characterId}/views_${Date.now()}.png`
      await storage.uploadFile(fileKey, imageBuffer, 'image/png')

      // 生成公网 URL
      viewUrl = storage.getPublicUrl(fileKey)

      console.log("Image uploaded to OSS:", fileKey)
    } catch (ossError) {
      console.warn("Failed to upload to OSS, saving to local:", ossError)
      
      // 对象存储不可用，保存到本地 public 目录
      try {
        const fs = await import('fs')
        const path = await import('path')
        
        // 确保目录存在
        const publicDir = path.join(process.cwd(), 'public', 'characters', characterId)
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }
        
        // 保存图片
        const localFileName = `views_${Date.now()}.png`
        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, imageBuffer)
        
        // 使用本地相对路径作为 URL
        fileKey = `${characterId}/${localFileName}`
        viewUrl = `/characters/${fileKey}`
        
        console.log("Image saved to local:", localFilePath)
      } catch (localError) {
        console.warn("Failed to save to local:", localError)
      }
    }

    // 更新数据库
    if (isDatabaseConfigured()) {
      try {
        const supabase = getSupabaseClient()
        // 存储相对路径或文件 key
        const { error } = await supabase
          .from("characters")
          .update({
            front_view_key: fileKey,  // 存储相对路径，更短
            updated_at: new Date().toISOString(),
          })
          .eq("id", characterId)
        
        if (error) {
          console.warn("Database update error:", error.message)
        } else {
          console.log("Database updated with front_view_key:", fileKey)
        }
      } catch (dbError) {
        console.warn("Failed to update database:", dbError)
      }
    }

    // 更新内存存储
    if (charIndex !== -1) {
      memoryCharacters[charIndex].frontViewKey = fileKey || undefined
      memoryCharacters[charIndex].imageUrl = viewUrl
    }

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
      style,
    })
  } catch (error) {
    console.error("Generate character views error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成人物视图失败" },
      { status: 500 }
    )
  }
}
