/**
 * 图片存储服务
 * 负责将外部图片 URL 下载并上传到对象存储
 */

import { uploadFile, getStorageConfig } from '@/lib/storage'
import { logger } from '@/lib/errors'

/**
 * 从 URL 下载图片
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  logger.info('Downloading image from URL', { url })

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const contentType = response.headers.get('content-type') || 'image/png'

  logger.info('Image downloaded successfully', {
    size: `${(buffer.length / 1024).toFixed(2)} KB`,
    contentType,
  })

  return { buffer, contentType }
}

/**
 * 上传图片到对象存储
 * @param imageUrl 原始图片 URL
 * @param key 存储路径（如 workflow/text-to-image/1234567890.png）
 * @returns 存储后的公开 URL，如果上传失败返回 null
 */
export async function uploadImageToStorage(imageUrl: string, key: string): Promise<string | null> {
  try {
    // 检查是否配置了对象存储
    const config = getStorageConfig()
    if (!config.endpoint) {
      logger.warn('S3_ENDPOINT not configured, skipping image upload')
      return null
    }

    // 下载图片
    const { buffer, contentType } = await downloadImage(imageUrl)

    // 使用统一的 uploadFile 函数上传
    const publicUrl = await uploadFile(key, buffer, contentType)

    logger.info('Image uploaded successfully', { key, url: publicUrl.substring(0, 80) + '...' })

    return publicUrl
  } catch (error) {
    logger.error('Failed to upload image to storage', error)
    return null
  }
}
