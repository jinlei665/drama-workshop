import { NextRequest, NextResponse } from "next/server"

// GET /api/images - 获取图片（重定向到公网 URL）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")

  console.log('[API Images] Received request, key:', key)

  if (!key) {
    console.log('[API Images] Missing key parameter')
    return NextResponse.json({ error: "缺少 key 参数" }, { status: 400 })
  }

  try {
    const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL

    console.log('[API Images] S3_ENDPOINT:', endpoint)
    console.log('[API Images] Constructing URL:', `${endpoint}/${key}`)

    // 直接构建公网 URL（不需要签名，因为 OSS 已设置为公开读取）
    const url = `${endpoint}/${key}`

    console.log('[API Images] Generated URL:', url)

    // 返回重定向到公网 URL
    return NextResponse.redirect(url, 302)
  } catch (error) {
    console.error("获取图片失败:", error)
    return NextResponse.json({ error: "获取图片失败" }, { status: 500 })
  }
}
