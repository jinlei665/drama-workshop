/**
 * 视频流代理 API
 * 前端通过此代理访问 OSS 视频，解决 CORS 和 Content-Type 问题
 * 支持浏览器 Range 请求（视频拖拽进度条）
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')

  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
  }

  try {
    // 使用 ali-oss SDK 获取签名 URL
    const OSS = await import('ali-oss')
    const ossClient = new OSS.default({
      region: process.env.S3_REGION || 'oss-cn-chengdu',
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      accessKeySecret: process.env.S3_SECRET_KEY || '',
      bucket: process.env.S3_BUCKET || 'drama-studio',
      secure: true,
    })

    // 生成签名 URL（不带 response 参数，避免 InvalidRequest）
    const signedUrl = ossClient.signatureUrl(key, {
      expires: 3600, // 1小时有效期
    })

    // 获取浏览器的 Range 请求头
    const rangeHeader = request.headers.get('range')

    // 构建代理请求头
    const proxyHeaders: Record<string, string> = {}
    if (rangeHeader) {
      proxyHeaders['Range'] = rangeHeader
    }

    // 从 OSS 获取视频
    const response = await fetch(signedUrl, { headers: proxyHeaders })

    if (!response.ok && response.status !== 206) {
      console.error('[VideoProxy] OSS 返回错误:', response.status, key)
      return NextResponse.json({ error: '视频获取失败' }, { status: response.status })
    }

    // 构建响应头
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    }

    // 传递 Content-Length
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    // 传递 Content-Range（用于 Range 请求）
    const contentRange = response.headers.get('content-range')
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    // 206 Partial Content（Range 请求成功）或 200 OK
    const status = response.status === 206 ? 206 : 200

    return new NextResponse(response.body, {
      status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[VideoProxy] 代理失败:', error)
    return NextResponse.json({ error: '视频代理失败' }, { status: 500 })
  }
}
