import { NextRequest, NextResponse } from "next/server"
import { generateImage } from "@/lib/ai"
import { S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryScenes } from "@/lib/memory-storage"
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

    console.log(`Generating scene image for ${sceneId}:`, prompt.substring(0, 100))

    // 更新状态为生成中
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      await supabase
        .from("scenes")
        .update({ status: "generating" })
        .eq("id", sceneId)
    }

    // 更新内存中的状态
    const sceneIndex = memoryScenes.findIndex(s => s.id === sceneId)
    if (sceneIndex !== -1) {
      memoryScenes[sceneIndex].status = "generating"
    }

    // 使用系统自带的图像生成服务
    const result = await generateImage(prompt, {
      size: '2K',
      watermark: false,
    })

    const imageUrl = result.urls[0]
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
      console.warn("Failed to upload to storage, using original URL:", storageError)
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
