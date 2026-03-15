import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import axios from "axios"

// GET /api/scenes/[id]/download - 下载单个分镜视频
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  // 获取分镜信息
  const { data: scene, error } = await client
    .from("scenes")
    .select("id, title, scene_number, video_url, image_key, image_url")
    .eq("id", id)
    .single()

  if (error || !scene) {
    return NextResponse.json({ error: "分镜不存在" }, { status: 404 })
  }

  // 检查视频URL
  if (!scene.video_url) {
    return NextResponse.json({ error: "该分镜尚未生成视频" }, { status: 400 })
  }

  try {
    // 下载视频文件
    const response = await axios.get(scene.video_url, {
      responseType: "arraybuffer",
    })

    const videoBuffer = Buffer.from(response.data)
    
    // 生成文件名
    const fileName = `scene_${scene.scene_number}_${scene.title || 'untitled'}.mp4`

    // 返回视频文件
    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": videoBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("下载视频失败:", error)
    return NextResponse.json({ error: "下载视频失败" }, { status: 500 })
  }
}
