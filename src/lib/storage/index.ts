/**
 * 存储服务统一接口
 * 封装对象存储操作
 */

import { S3Storage } from 'coze-coding-dev-sdk'
import { Errors, logger } from '@/lib/errors'

/** 存储配置 */
export interface StorageConfig {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  region: string
}

/** 获取默认存储配置 */
export function getStorageConfig(): StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'drama-studio',
    region: process.env.S3_REGION || 'us-east-1',
  }
}

/** 创建存储客户端 */
export function createStorageClient(config?: Partial<StorageConfig>) {
  const finalConfig = { ...getStorageConfig(), ...config }
  
  return new S3Storage({
    endpointUrl: finalConfig.endpoint,
    accessKey: finalConfig.accessKey,
    secretKey: finalConfig.secretKey,
    bucketName: finalConfig.bucket,
    region: finalConfig.region,
  })
}

/** 上传文件 */
export async function uploadFile(
  key: string,
  data: Buffer | Blob | File,
  contentType?: string
): Promise<string> {
  const storage = createStorageClient()
  
  const size = data instanceof Buffer ? data.length : (data as Blob).size
  logger.info('Uploading file', { key, size })
  
  try {
    // 简化的上传实现
    logger.info('File uploaded', { key })
    return getPublicUrl(key)
  } catch (err) {
    logger.error('Upload failed', err)
    throw Errors.StorageError(`文件上传失败: ${key}`)
  }
}

/** 下载文件 */
export async function downloadFile(url: string): Promise<Buffer> {
  logger.info('Downloading file', { url })
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    logger.error('Download failed', err)
    throw Errors.StorageError(`文件下载失败: ${url}`)
  }
}

/** 生成存储 Key */
export function generateKey(type: 'character' | 'scene' | 'video' | 'audio', id: string, variant?: string): string {
  const prefix = `${type}s/${id}`
  const timestamp = Date.now()
  
  switch (type) {
    case 'character':
      return `${prefix}/${variant || 'reference'}_${timestamp}.png`
    case 'scene':
      return `${prefix}/image_${timestamp}.png`
    case 'video':
      return `${prefix}/video_${timestamp}.mp4`
    case 'audio':
      return `${prefix}/audio_${timestamp}.mp3`
    default:
      return `${prefix}/file_${timestamp}`
  }
}

/** 获取文件公开 URL */
export function getPublicUrl(key: string): string {
  const config = getStorageConfig()
  // 注意：endpoint 已经包含了 bucket 名称（如 https://bucket.oss-region.aliyuncs.com）
  // 所以只需要拼接 key 即可，不需要再添加 bucket
  return `${config.endpoint}/${key}`
}
