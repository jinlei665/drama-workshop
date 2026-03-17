import { NextRequest, NextResponse } from "next/server"
import { ImageGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryCharacters } from "@/lib/memory-storage"
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

  // 使用系统默认配置（无需 API Key）
  const config = new Config()
  const imageClient = new ImageGenerationClient(config, customHeaders)

  try {
    // 生成真人风格角色设定图（用于短剧拍摄参考）
    const basePrompt = `真人实拍风格，短剧角色设定图，${appearance}，专业影视造型，三视图包含正面、侧面、背面三个角度，白色摄影棚背景，高清人像摄影，电影级光影，4K画质，用于影视剧造型参考`

    console.log(`Generating character views for ${characterId}:`, basePrompt.substring(0, 100))

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
    const charIndex = memoryCharacters.findIndex(c => c.id === characterId)
    if (charIndex !== -1) {
      memoryCharacters[charIndex].frontViewKey = fileKey || undefined
      memoryCharacters[charIndex].imageUrl = viewUrl
    }

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
    })
  } catch (error) {
    console.error("Generate character views error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成人物视图失败" },
      { status: 500 }
    )
  }
}
