import { NextRequest, NextResponse } from "next/server"
import { S3Storage } from "coze-coding-dev-sdk"

// GET /api/images - 获取图片签名 URL
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")

  if (!key) {
    return NextResponse.json({ error: "缺少 key 参数" }, { status: 400 })
  }

  try {
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    })

    const url = await storage.generatePresignedUrl({
      key,
      expireTime: 86400 * 7, // 7天有效
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error("获取图片 URL 失败:", error)
    return NextResponse.json({ error: "获取图片 URL 失败" }, { status: 500 })
  }
}
