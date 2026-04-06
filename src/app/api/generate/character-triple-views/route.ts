/**
 * 人物库 - 根据参考图片生成三视图
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils } from "coze-coding-dev-sdk"
import { generateImageFromImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"
import { Pool } from 'pg'

// PostgreSQL 连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// POST /api/generate/character-triple-views - 根据参考图片生成三视图
export async function POST(request: NextRequest) {
  const { referenceImageUrl, characterId, characterName, appearance } = await request.json()

  if (!referenceImageUrl || !characterId) {
    return NextResponse.json(
      { error: "缺少必要参数：referenceImageUrl 和 characterId" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Character Triple Views] Starting generation for:', characterId, 'from reference image:', referenceImageUrl)

  try {
    // 构建三视图生成提示词
    const name = characterName || '角色'
    const desc = appearance || '角色形象'
    const basePrompt = `根据提供的参考图片，生成${name}的三视图（正面、侧面、背面），保持人物形象一致，${desc}，白色背景，用于角色设定参考，高质量，细节丰富`

    console.log('Generating triple views with prompt:', basePrompt.substring(0, 100))

    // 使用图生图功能生成三视图
    let imageUrl: string
    try {
      const result = await generateImageFromImage(basePrompt, referenceImageUrl, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)

      imageUrl = result.urls[0]
      console.log('[Character Triple Views] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Character Triple Views] Generate error:', genError)
      return NextResponse.json(
        { error: genError instanceof Error ? genError.message : '图像生成失败' },
        { status: 500 }
      )
    }

    // 下载图片
    const imageBuffer = await downloadFile(imageUrl)

    // 尝试上传到对象存储（使用阿里云 OSS）
    let fileKey: string | null = null
    let viewUrl: string = imageUrl

    try {
      const OSS = await import('ali-oss')
      const ossClient = new OSS.default({
        region: process.env.ALIYUN_OSS_REGION!,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID!,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET!,
        bucket: process.env.ALIYUN_OSS_BUCKET!,
      })

      // 上传到 OSS
      fileKey = `character-library/${characterId}/triple-views_${Date.now()}.png`
      await ossClient.put(fileKey, imageBuffer)

      // 设置为公开读取
      await ossClient.putACL(fileKey, 'public-read')

      // 生成公网 URL
      viewUrl = ossClient.signatureUrl(fileKey, { expires: 86400 * 7 }) // 7天有效

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
        const localFileName = `triple-views_${Date.now()}.png`
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

    // 更新数据库（使用 pg 直连）
    try {
      await pool.query(
        `UPDATE character_library
         SET front_view_key = $1, updated_at = NOW()
         WHERE id = $2`,
        [fileKey, characterId]
      )
      console.log("Database updated with front_view_key:", fileKey)
    } catch (dbError) {
      console.warn("Failed to update database:", dbError)
    }

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
    })
  } catch (error) {
    console.error("Generate character triple views error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成人物三视图失败" },
      { status: 500 }
    )
  }
}
