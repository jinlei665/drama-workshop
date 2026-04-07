/**
 * 图片上传 API
 * 支持上传人物形象图片
 */

import { NextRequest } from 'next/server'
import { S3Storage } from 'coze-coding-dev-sdk'
import { successResponse, errorResponse } from '@/lib/api/response'

/**
 * POST /api/upload/character-image
 * 上传人物形象图片到 OSS
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return errorResponse('请选择要上传的文件', 400)
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return errorResponse('只支持图片文件', 400)
    }

    // 验证文件大小（限制为 5MB）
    if (file.size > 5 * 1024 * 1024) {
      return errorResponse('图片大小不能超过 5MB', 400)
    }

    try {
      // 使用 S3Storage 上传
      const storage = new S3Storage({
        endpointUrl: process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
        bucketName: process.env.S3_BUCKET || process.env.COZE_BUCKET_NAME,
        region: process.env.S3_REGION || 'us-east-1',
      })

      // 生成唯一的文件名
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const ext = file.name.split('.').pop() || 'png'
      const key = `character-images/${timestamp}-${randomStr}.${ext}`

      // 将文件转换为 Buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 上传到 OSS
      await storage.uploadFile(key, buffer, file.type)

      // 生成公网 URL
      const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
      const url = `${endpoint}/${key}`

      return successResponse({
        key,
        url,
        fileName: file.name,
        size: file.size,
        mimeType: file.type,
      })
    } catch (ossError) {
      console.error('OSS upload error:', ossError)
      return errorResponse('上传失败，请检查 OSS 配置', 500)
    }
  } catch (error) {
    console.error('Upload error:', error)
    return errorResponse(error)
  }
}
