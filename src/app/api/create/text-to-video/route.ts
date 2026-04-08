/**
 * 文生视频 API
 * 根据文本提示词生成视频
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateVideo, DEFAULT_VIDEO_MODEL } from '@/lib/ai'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 验证视频文件是否有效
 */
function isValidVideoBuffer(buffer: Buffer): { valid: boolean; reason?: string } {
  if (buffer.length < 10 * 1024) {
    return { valid: false, reason: '文件太小' }
  }
  
  const header = buffer.slice(0, 12).toString('ascii').toLowerCase()
  const isMP4 = header.includes('ftyp')
  const isWebM = header.includes('webm')
  
  if (!isMP4 && !isWebM) {
    if (buffer.toString('utf-8').slice(0, 100).toLowerCase().includes('<!doctype') ||
        buffer.toString('utf-8').slice(0, 100).toLowerCase().includes('<html')) {
      return { valid: false, reason: '下载的是 HTML 页面' }
    }
    return { valid: false, reason: '未知视频格式' }
  }
  
  return { valid: true }
}

/**
 * 上传视频到 OSS
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

    const fileKey = `ai-create/text-to-video/${Date.now()}_${filename}`
    await ossClient.put(fileKey, buffer)
    await ossClient.putACL(fileKey, 'public-read')

    const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
    return `${endpoint}/${fileKey}`
  } catch (error) {
    console.error('[Text-to-Video] OSS upload failed:', error)
    return null
  }
}

/**
 * 保存视频到本地
 */
async function saveToLocal(buffer: Buffer, filename: string): Promise<string> {
  const publicDir = path.join(process.cwd(), 'public', 'ai-create', 'text-to-video')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }
  
  const filePath = path.join(publicDir, filename)
  fs.writeFileSync(filePath, buffer)
  
  return `/ai-create/text-to-video/${filename}`
}

/**
 * 下载视频并重新上传
 */
async function rehostVideo(videoUrl: string): Promise<string> {
  console.log('[Text-to-Video] Downloading video:', videoUrl.substring(0, 100))
  
  const headerStrategies = [
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'video/webm,video/*;q=0.9,*/*;q=0.5',
      'Referer': 'https://www.coze.cn/',
    },
    { 'User-Agent': 'Mozilla/5.0 (compatible; VideoBot/1.0)' },
    { 'User-Agent': '*' },
  ]
  
  for (const headers of headerStrategies) {
    try {
      const response = await fetch(videoUrl, { headers: headers as Record<string, string>, redirect: 'follow' })
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        const validation = isValidVideoBuffer(buffer)
        if (!validation.valid) {
          console.warn('[Text-to-Video] Invalid video:', validation.reason)
          continue
        }
        
        const filename = `video_${Date.now()}.mp4`
        let finalUrl = await uploadToOSS(buffer, filename)
        
        if (!finalUrl) {
          finalUrl = await saveToLocal(buffer, filename)
        }
        
        return finalUrl
      }
    } catch (err) {
      console.warn('[Text-to-Video] Download attempt failed:', err)
    }
  }
  
  // 所有策略都失败，返回原始 URL
  return videoUrl
}

/**
 * POST /api/create/text-to-video
 * 生成视频
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      prompt,
      duration = 5,
      aspectRatio = '16:9',
      resolution = '720p',
      generateAudio = true,
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: '请输入视频描述' },
        { status: 400 }
      )
    }

    console.log('[Text-to-Video] Generating video with prompt:', prompt.substring(0, 100))

    // 生成视频
    const result = await generateVideo(prompt, {
      duration,
      ratio: aspectRatio,
      resolution,
      generateAudio,
    })

    const videoUrl = result.videoUrl
    console.log('[Text-to-Video] Generated video URL:', videoUrl)

    // 重新托管视频
    const finalUrl = await rehostVideo(videoUrl)
    console.log('[Text-to-Video] Final video URL:', finalUrl)

    return NextResponse.json({
      success: true,
      data: {
        url: finalUrl,
        originalUrl: videoUrl,
        prompt,
        duration,
        aspectRatio,
        resolution,
        generateAudio,
      }
    })

  } catch (error) {
    console.error('[Text-to-Video] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    )
  }
}
