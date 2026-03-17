import { NextRequest, NextResponse } from "next/server"
import { generateImage } from "@/lib/ai"
import { S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
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

  // 检查数据库是否可用
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "数据库未配置，无法保存图片" },
      { status: 500 }
    )
  }

  const supabase = getSupabaseClient()

  // 获取用户配置（可选）
  let imageSize = '2K'
  try {
    const result = await supabase
      .from('user_settings')
      .select('image_size, image_model')
      .limit(1)
      .maybeSingle()
    if (result.data?.image_size) {
      imageSize = result.data.image_size
    }
  } catch {
    // 使用默认值
  }

  // 初始化对象存储
  const storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: "",
    secretKey: "",
    bucketName: process.env.COZE_BUCKET_NAME,
    region: "cn-beijing",
  })

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
    await supabase
      .from("scenes")
      .update({ status: "generating" })
      .eq("id", sceneId)

    // 使用系统自带的图像生成服务
    const result = await generateImage(prompt, {
      size: imageSize as '2K' | '4K',
      watermark: false,
    })

    // 下载并上传图片到对象存储
    const imageUrl = result.urls[0]
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
    await supabase
      .from("scenes")
      .update({ status: "failed" })
      .eq("id", sceneId)

    const errorMessage = error instanceof Error ? error.message : "生成分镜图片失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
