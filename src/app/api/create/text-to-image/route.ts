/**
 * 文生图 API
 * 根据文本提示词生成图像
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/ai'
import { downloadFile } from '@/lib/utils'
import { getSettingsFromMemory } from '@/lib/memory-store'

/**
 * 上传图片到 OSS
 */
async function uploadToOSS(buffer: Buffer, filename: string): Promise<string | null> {
  try {
    const OSS = await import('ali-oss')
    const ossClient = new OSS.default({
      region: process.env.S3_REGION || 'oss-cn-chengdu',
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      accessKeySecret: process.env.S3_SECRET_KEY || '',
      bucket: process.env.S3_BUCKET || 'drama-studio',
      secure: true,
    })

    const fileKey = `ai-create/text-to-image/${Date.now()}_${filename}`
    await ossClient.put(fileKey, buffer)
    await ossClient.putACL(fileKey, 'public-read')

    const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
    return `${endpoint}/${fileKey}`
  } catch (error) {
    console.error('[Text-to-Image] OSS upload failed:', error)
    return null
  }
}

/**
 * 保存图片到本地
 */
async function saveToLocal(buffer: Buffer, filename: string): Promise<string> {
  const fs = await import('fs')
  const path = await import('path')
  
  const publicDir = path.join(process.cwd(), 'public', 'ai-create', 'text-to-image')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }
  
  const filePath = path.join(publicDir, filename)
  fs.writeFileSync(filePath, buffer)
  
  return `/ai-create/text-to-image/${filename}`
}

/**
 * POST /api/create/text-to-image
 * 生成图像
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      prompt,
      negativePrompt,
      style = 'realistic',
      size = '1024x1024',
      seed = -1,
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: '请输入图像描述' },
        { status: 400 }
      )
    }

    console.log('[Text-to-Image] Generating image with prompt:', prompt.substring(0, 100))

    // 生成图像
    const result = await generateImage(prompt, {
      size,
      watermark: false,
      style,
      seed: seed === -1 ? undefined : seed,
      negativePrompt,
    })

    const imageUrl = result.urls[0]
    console.log('[Text-to-Image] Generated image URL:', imageUrl)

    // 下载图片
    const imageBuffer = await downloadFile(imageUrl)

    // 生成文件名
    const filename = `image_${Date.now()}.png`

    // 优先上传到 OSS
    let finalUrl = await uploadToOSS(imageBuffer, filename)
    
    // 如果 OSS 失败，保存到本地
    if (!finalUrl) {
      finalUrl = await saveToLocal(imageBuffer, filename)
      console.log('[Text-to-Image] Saved to local:', finalUrl)
    } else {
      console.log('[Text-to-Image] Uploaded to OSS:', finalUrl)
    }

    return NextResponse.json({
      success: true,
      data: {
        url: finalUrl,
        originalUrl: imageUrl,
        prompt,
        style,
        size,
      }
    })

  } catch (error) {
    console.error('[Text-to-Image] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    )
  }
}
