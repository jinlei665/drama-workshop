/**
 * 项目人物 - 根据参考图生成新形象
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils } from "coze-coding-dev-sdk"
import { generateImageFromImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/appearance-from-image - 根据参考图生成新形象
export async function POST(request: NextRequest) {
  const { referenceImageUrl, characterId, characterName, appearance, changeDescription } = await request.json()

  if (!referenceImageUrl || !characterId) {
    return NextResponse.json(
      { error: "缺少必要参数：referenceImageUrl 和 characterId" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Generate Appearance] Starting generation for:', characterId, 'from reference image:', referenceImageUrl)

  try {
    // 构建生成新形象的提示词
    const name = characterName || '角色'
    const desc = appearance || '角色形象'
    const change = changeDescription || '保持原风格'

    // 提示词：请根据所提供图片来变更生成一张新图片，图中的人形象变成...
    const basePrompt = `请根据所提供图片来变更生成一张新图片，图中的人形象变成${change}。${name}，${desc}，保持人物面部特征一致，高质量，细节丰富`

    console.log('Generating new appearance with prompt:', basePrompt.substring(0, 100))

    // 使用图生图功能生成新形象
    let imageUrl: string
    try {
      const result = await generateImageFromImage(basePrompt, referenceImageUrl, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)

      imageUrl = result.urls[0]
      console.log('[Generate Appearance] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Generate Appearance] Generate error:', genError)
      return NextResponse.json(
        { error: genError instanceof Error ? genError.message : '图像生成失败' },
        { status: 500 }
      )
    }

    // 下载图片
    const imageBuffer = await downloadFile(imageUrl)

    // 尝试上传到对象存储
    let fileKey: string | null = null
    let viewUrl: string = imageUrl

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
        fileName: `character-appearances/${characterId}/appearance_${Date.now()}.png`,
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

        // 确保目录存在
        const publicDir = path.join(process.cwd(), 'public', 'character-appearances', characterId)
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }

        // 保存图片
        const localFileName = `appearance_${Date.now()}.png`
        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, imageBuffer)

        // 使用本地相对路径作为 URL
        fileKey = `${characterId}/${localFileName}`
        viewUrl = `/character-appearances/${fileKey}`

        console.log("Image saved to local:", localFilePath)
      } catch (localError) {
        console.warn("Failed to save to local:", localError)
      }
    }

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
    })
  } catch (error) {
    console.error("Generate new appearance error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成新形象失败" },
      { status: 500 }
    )
  }
}
