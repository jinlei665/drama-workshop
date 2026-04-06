/**
 * 图片上传 API
 * 支持上传人物形象图片
 */

import { NextRequest } from 'next/server'
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
      // 使用阿里云 OSS 上传
      const ossClient = await import('@/lib/oss').then(m => m.default)

      // 生成唯一的文件名
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const ext = file.name.split('.').pop() || 'png'
      const key = `character-images/${timestamp}-${randomStr}.${ext}`

      // 将文件转换为 Buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 上传到 OSS
      await ossClient.put(key, buffer)

      // 设置为公开读取
      await ossClient.putACL(key, 'public-read')

      // 获取公网 URL
      const url = ossClient.signatureUrl(key, { expires: 86400 * 365 }) // 1年有效期

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
