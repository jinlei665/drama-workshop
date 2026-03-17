import { NextRequest, NextResponse } from "next/server"
import { ImageGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk"
import { S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient } from "@/storage/database/supabase-client"
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

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
  const config = new Config()
  const imageClient = new ImageGenerationClient(config, customHeaders)

  // 初始化对象存储
  const storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: "",
    secretKey: "",
    bucketName: process.env.COZE_BUCKET_NAME,
    region: "cn-beijing",
  })

  try {
    // 生成真人风格角色设定图（用于短剧拍摄参考）
    const basePrompt = `真人实拍风格，短剧角色设定图，${appearance}，专业影视造型，三视图包含正面、侧面、背面三个角度，白色摄影棚背景，高清人像摄影，电影级光影，4K画质，用于影视剧造型参考`

    // 生成三视图
    const response = await imageClient.generate({
      prompt: basePrompt,
      size: "2K",
      watermark: false,
    })

    const helper = imageClient.getResponseHelper(response)

    if (!helper.success) {
      return NextResponse.json(
        { error: helper.errorMessages.join(", ") || "生成失败" },
        { status: 500 }
      )
    }

    // 下载并上传图片到对象存储
    const imageUrl = helper.imageUrls[0]
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    })
    const imageBuffer = Buffer.from(imageResponse.data)

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName: `characters/${characterId}/views_${Date.now()}.png`,
      contentType: "image/png",
    })

    // 更新数据库
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("characters")
      .update({
        front_view_key: fileKey, // 三视图合成图
        updated_at: new Date().toISOString(),
      })
      .eq("id", characterId)
      .select()
      .single()

    if (error) {
      console.error("Database update error:", error)
    }

    // 生成访问 URL
    const viewUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 7, // 7天有效
    })

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
      character: data,
    })
  } catch (error) {
    console.error("Generate character views error:", error)
    return NextResponse.json(
      { error: "生成人物视图失败" },
      { status: 500 }
    )
  }
}
