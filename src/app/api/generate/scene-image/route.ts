import { NextRequest, NextResponse } from "next/server"
import { ImageGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk"
import { S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import axios from "axios"

// POST /api/generate/scene-image - 生成分镜图片（短剧视频分镜）
export async function POST(request: NextRequest) {
  const { sceneId, description, emotion, characterDescriptions } = await request.json()

  if (!sceneId || !description) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    )
  }

  // 获取用户配置
  const supabase = getSupabaseClient()
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .limit(1)
    .single()

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

  // 使用用户配置的模型，如果没有配置则使用默认模型
  const modelName = settings?.image_model || undefined

  try {
    // 构建真人实拍风格分镜提示词
    let prompt = `真人实拍风格，短剧视频分镜画面，${description}`

    if (emotion) {
      prompt += `，${emotion}的氛围`
    }

    // 添加人物描述
    if (characterDescriptions && characterDescriptions.length > 0) {
      prompt += `，画面中的角色：${characterDescriptions.join("、")}`
    }

    prompt += "，专业影视剧画面，电影级构图，高清摄影，4K画质，细节丰富"

    // 更新状态为生成中
    const supabase = getSupabaseClient()
    await supabase
      .from("scenes")
      .update({ status: "generating" })
      .eq("id", sceneId)

    // 生成图片
    const response = await imageClient.generate({
      prompt,
      size: "2K",
      watermark: false,
      ...(modelName && { model: modelName }),
    })

    const helper = imageClient.getResponseHelper(response)

    if (!helper.success) {
      await supabase
        .from("scenes")
        .update({ status: "failed" })
        .eq("id", sceneId)

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
      fileName: `scenes/${sceneId}/image_${Date.now()}.png`,
      contentType: "image/png",
    })

    // 生成访问 URL
    const viewUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 7, // 7天有效
    })

    // 更新数据库
    const { data, error } = await supabase
      .from("scenes")
      .update({
        image_key: fileKey,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sceneId)
      .select()
      .single()

    if (error) {
      console.error("Database update error:", error)
    }

    return NextResponse.json({
      success: true,
      imageUrl: viewUrl,
      fileKey,
      scene: data,
    })
  } catch (error) {
    console.error("Generate scene image error:", error)

    // 更新状态为失败
    const supabase = getSupabaseClient()
    await supabase
      .from("scenes")
      .update({ status: "failed" })
      .eq("id", sceneId)

    return NextResponse.json(
      { error: "生成分镜图片失败" },
      { status: 500 }
    )
  }
}
