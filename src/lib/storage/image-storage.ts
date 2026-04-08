/**
 * 图片存储服务
 * 负责将外部图片 URL 下载并上传到对象存储
 * 参考 scene-image 的实现方式，使用 ali-oss SDK
 */

import { logger } from '@/lib/errors'
import { downloadFile } from '@/lib/utils'

/**
 * 上传图片到对象存储
 * @param imageUrl 原始图片 URL
 * @param key 存储路径（如 workflow/text-to-image/1234567890.png）
 * @returns 存储后的公开 URL，如果上传失败返回 null
 */
export async function uploadImageToStorage(imageUrl: string, key: string): Promise<string | null> {
  let fileKey: string | null = null
  let viewUrl: string = imageUrl // 默认使用原始 URL

  try {
    // 下载图片
    const imageBuffer = await downloadFile(imageUrl)
    console.log('[Image Storage] Image downloaded, size:', imageBuffer.length)

    // 尝试上传到对象存储（使用 ali-oss SDK）
    try {
      const OSS = await import('ali-oss')
      const ossClient = new OSS.default({
        region: process.env.S3_REGION || 'oss-cn-chengdu',
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        accessKeySecret: process.env.S3_SECRET_KEY || '',
        bucket: process.env.S3_BUCKET || 'drama-studio',
        secure: true,
      })

      // 确保 key 格式正确（使用正斜杠）
      const normalizedKey = key.replace(/\\/g, '/')
      fileKey = normalizedKey

      // 上传到 OSS
      await ossClient.put(fileKey, imageBuffer)

      // 设置为公开读取
      await ossClient.putACL(fileKey, 'public-read')

      // 生成公网 URL
      const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
      viewUrl = `${endpoint}/${fileKey}`

      console.log('[Image Storage] Image uploaded to OSS:', fileKey)
      console.log('[Image Storage] Public URL:', viewUrl)

      return viewUrl
    } catch (ossError) {
      console.warn('[Image Storage] Failed to upload to OSS:', ossError)

      // 对象存储不可用，保存到本地 public 目录
      try {
        const fs = await import('fs')
        const path = await import('path')

        // 从 key 中提取文件名
        const fileName = path.basename(key)
        const timestamp = Date.now()
        const localFileName = `${fileName.replace(/\.[^.]+$/, '')}_${timestamp}.png`

        const publicDir = path.join(process.cwd(), 'public', 'workflow', path.dirname(key))
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }

        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, imageBuffer)

        viewUrl = `/workflow/${path.dirname(key)}/${localFileName}`
        console.log('[Image Storage] Image saved to local:', localFilePath)

        return viewUrl
      } catch (localError) {
        console.warn('[Image Storage] Failed to save to local:', localError)
        // 两个都失败，返回 null 使用原始 URL
        return null
      }
    }
  } catch (error) {
    logger.error('Failed to process image for storage', error)
    return null
  }
}

/**
 * 上传视频到对象存储
 * @param videoUrl 原始视频 URL
 * @param key 存储路径（如 workflow/image-to-video/1234567890.mp4）
 * @returns 存储后的公开 URL，如果上传失败返回 null
 */
export async function uploadVideoToStorage(videoUrl: string, key: string): Promise<string | null> {
  let fileKey: string | null = null
  let viewUrl: string = videoUrl // 默认使用原始 URL

  try {
    // 下载视频
    console.log('[Video Storage] Downloading video from:', videoUrl)
    const videoBuffer = await downloadFile(videoUrl)
    console.log('[Video Storage] Video downloaded, size:', videoBuffer.length)

    // 尝试上传到对象存储（使用 ali-oss SDK）
    try {
      const OSS = await import('ali-oss')
      const ossClient = new OSS.default({
        region: process.env.S3_REGION || 'oss-cn-chengdu',
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        accessKeySecret: process.env.S3_SECRET_KEY || '',
        bucket: process.env.S3_BUCKET || 'drama-studio',
        secure: true,
      })

      // 确保 key 格式正确（使用正斜杠）
      const normalizedKey = key.replace(/\\/g, '/')
      fileKey = normalizedKey

      // 上传到 OSS
      await ossClient.put(fileKey, videoBuffer)

      // 设置为公开读取
      await ossClient.putACL(fileKey, 'public-read')

      // 生成公网 URL
      const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
      viewUrl = `${endpoint}/${fileKey}`

      console.log('[Video Storage] Video uploaded to OSS:', fileKey)
      console.log('[Video Storage] Public URL:', viewUrl)

      return viewUrl
    } catch (ossError) {
      console.warn('[Video Storage] Failed to upload to OSS:', ossError)

      // 对象存储不可用，保存到本地 public 目录
      try {
        const fs = await import('fs')
        const path = await import('path')

        // 从 key 中提取文件名
        const fileName = path.basename(key)
        const timestamp = Date.now()
        const localFileName = `${fileName.replace(/\.[^.]+$/, '')}_${timestamp}.mp4`

        const publicDir = path.join(process.cwd(), 'public', 'workflow', path.dirname(key))
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }

        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, videoBuffer)

        viewUrl = `/workflow/${path.dirname(key)}/${localFileName}`
        console.log('[Video Storage] Video saved to local:', localFilePath)

        return viewUrl
      } catch (localError) {
        console.warn('[Video Storage] Failed to save to local:', localError)
        // 两个都失败，返回 null 使用原始 URL
        return null
      }
    }
  } catch (error) {
    logger.error('Failed to process video for storage', error)
    return null
  }
}
