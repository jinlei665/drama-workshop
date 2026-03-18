import { NextRequest, NextResponse } from "next/server"
import { ImageGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryCharacters, memoryProjects } from "@/lib/memory-storage"
import { getCharacterStylePrompt } from "@/lib/styles"
import { getCozeConfigFromMemory } from "@/lib/memory-store"
import axios from "axios"

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

  // 获取用户配置
  const userConfig = getCozeConfigFromMemory()
  const defaultBaseUrl = process.env.COZE_BASE_URL || 'https://api.coze.cn'
  
  // 检查是否有 API Key
  if (!userConfig?.apiKey) {
    return NextResponse.json(
      { error: "请先在设置页面配置 Coze API Key" },
      { status: 400 }
    )
  }
  
  // 禁用代理（避免本地代理干扰）
  const originalProxy = {
    http: process.env.HTTP_PROXY,
    https: process.env.HTTPS_PROXY,
  }
  delete process.env.HTTP_PROXY
  delete process.env.HTTPS_PROXY
  
  // 使用用户配置或默认配置
  const config = new Config({
    apiKey: userConfig.apiKey,
    baseUrl: userConfig.baseUrl || defaultBaseUrl,
    timeout: 180000, // 3分钟
  })
  
  console.log('[Character Views] Config:', {
    hasApiKey: !!userConfig?.apiKey,
    baseUrl: userConfig?.baseUrl || defaultBaseUrl,
  })
  
  const imageClient = new ImageGenerationClient(config, customHeaders)

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

    // 生成三视图
    const response = await imageClient.generate({
      prompt: basePrompt,
      size: "2K",
      watermark: false,
    })

    const helper = imageClient.getResponseHelper(response)

    if (!helper.success) {
      console.error("Image generation failed:", helper.errorMessages)
      return NextResponse.json(
        { error: helper.errorMessages.join(", ") || "生成失败" },
        { status: 500 }
      )
    }

    const imageUrl = helper.imageUrls[0]
    console.log("Image generated successfully:", imageUrl)

    // 下载图片
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    })
    const imageBuffer = Buffer.from(imageResponse.data)

    // 尝试上传到对象存储
    let fileKey: string | null = null
    let viewUrl: string = imageUrl // 默认使用原始 URL

    try {
      const { S3Storage } = await import("coze-coding-dev-sdk")
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
        fileName: `characters/${characterId}/views_${Date.now()}.png`,
        contentType: "image/png",
      })

      // 生成访问 URL
      viewUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400 * 7, // 7天有效
      })

      console.log("Image uploaded to storage:", fileKey)
    } catch (storageError) {
      console.warn("Failed to upload to storage, using original URL:", storageError)
    }

    // 更新数据库
    if (isDatabaseConfigured()) {
      try {
        const supabase = getSupabaseClient()
        await supabase
          .from("characters")
          .update({
            front_view_key: fileKey,
            updated_at: new Date().toISOString(),
          })
          .eq("id", characterId)
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
  } finally {
    // 恢复代理设置
    if (originalProxy.http) process.env.HTTP_PROXY = originalProxy.http
    if (originalProxy.https) process.env.HTTPS_PROXY = originalProxy.https
  }
}
