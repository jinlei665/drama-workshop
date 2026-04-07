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
    // 处理 key：如果是角色视图（char_xxx），添加 characters/ 前缀
    let s3Key = key
    if (key.match(/^char_\d+\/|^lib_\d+\/|^proj_\d+\//)) {
      // 判断是否需要添加 characters/ 前缀
      if (!key.startsWith('characters/') && !key.startsWith('character-library/') && !key.startsWith('scenes/')) {
        s3Key = `characters/${key}`
      }
    }

    // 使用 S3 配置（阿里云 OSS）
    const storage = new S3Storage({
      endpointUrl: process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
      bucketName: process.env.S3_BUCKET || process.env.COZE_BUCKET_NAME,
      region: process.env.S3_REGION || 'us-east-1',
    })

    const url = await storage.generatePresignedUrl({
      key: s3Key,
      expireTime: 86400 * 7, // 7天有效
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error("获取图片 URL 失败:", error)
    return NextResponse.json({ error: "获取图片 URL 失败" }, { status: 500 })
  }
}
