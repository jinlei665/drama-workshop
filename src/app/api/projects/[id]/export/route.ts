import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { S3Storage } from "coze-coding-dev-sdk"
import axios from "axios"
import archiver from "archiver"
import { Readable } from "stream"

/**
 * GET /api/projects/[id]/export
 * 导出项目所有内容为压缩包
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  // 获取项目信息
  const { data: project, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 })
  }

  // 获取人物
  const { data: characters } = await client
    .from("characters")
    .select("*")
    .eq("project_id", id)

  // 获取剧集
  const { data: episodes } = await client
    .from("episodes")
    .select("*")
    .eq("project_id", id)
    .order("season_number", { ascending: true })
    .order("episode_number", { ascending: true })

  // 获取分镜
  const { data: scenes } = await client
    .from("scenes")
    .select("*")
    .eq("project_id", id)
    .order("scene_number", { ascending: true })

  try {
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    })

    // 创建压缩流
    const archive = archiver("zip", { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    archive.on("data", (chunk) => chunks.push(chunk))
    
    const archiveEnd = new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve())
      archive.on("error", (err) => reject(err))
    })

    // 添加项目信息
    archive.append(
      JSON.stringify({
        project: {
          name: project.name,
          description: project.description,
          status: project.status,
          createdAt: project.created_at,
        },
        characters: characters?.map(c => ({
          name: c.name,
          description: c.description,
          appearance: c.appearance,
          personality: c.personality,
          voiceStyle: c.voice_style,
        })),
        episodes: episodes?.map(e => ({
          season: e.season_number,
          episode: e.episode_number,
          title: e.title,
          description: e.description,
        })),
        scenes: scenes?.map(s => ({
          sceneNumber: s.scene_number,
          title: s.title,
          description: s.description,
          dialogue: s.dialogue,
          action: s.action,
          emotion: s.emotion,
        })),
        exportedAt: new Date().toISOString(),
      }, null, 2),
      { name: "project_info.json" }
    )

    // 下载并添加人物图片
    if (characters && characters.length > 0) {
      for (const char of characters) {
        // 正面图
        if (char.front_view_key) {
          try {
            const url = await storage.generatePresignedUrl({ key: char.front_view_key, expireTime: 3600 })
            const response = await axios.get(url as string, { responseType: "arraybuffer" })
            archive.append(Buffer.from(response.data), { name: `characters/${char.name}/front_view.png` })
          } catch (e) {
            console.log(`跳过人物 ${char.name} 正面图`)
          }
        }
        
        // 侧面图
        if (char.side_view_key) {
          try {
            const url = await storage.generatePresignedUrl({ key: char.side_view_key, expireTime: 3600 })
            const response = await axios.get(url as string, { responseType: "arraybuffer" })
            archive.append(Buffer.from(response.data), { name: `characters/${char.name}/side_view.png` })
          } catch (e) {
            console.log(`跳过人物 ${char.name} 侧面图`)
          }
        }
        
        // 背面图
        if (char.back_view_key) {
          try {
            const url = await storage.generatePresignedUrl({ key: char.back_view_key, expireTime: 3600 })
            const response = await axios.get(url as string, { responseType: "arraybuffer" })
            archive.append(Buffer.from(response.data), { name: `characters/${char.name}/back_view.png` })
          } catch (e) {
            console.log(`跳过人物 ${char.name} 背面图`)
          }
        }

        // 配音
        if (char.voice_url) {
          try {
            const response = await axios.get(char.voice_url, { responseType: "arraybuffer" })
            archive.append(Buffer.from(response.data), { name: `characters/${char.name}/voice.mp3` })
          } catch (e) {
            console.log(`跳过人物 ${char.name} 配音`)
          }
        }
      }
    }

    // 下载并添加分镜图片和视频
    if (scenes && scenes.length > 0) {
      for (const scene of scenes) {
        const sceneFolder = `scenes/scene_${String(scene.scene_number).padStart(3, '0')}`
        
        // 分镜图片
        if (scene.image_url) {
          try {
            const response = await axios.get(scene.image_url, { responseType: "arraybuffer" })
            archive.append(Buffer.from(response.data), { name: `${sceneFolder}/image.png` })
          } catch (e) {
            console.log(`跳过分镜 ${scene.scene_number} 图片`)
          }
        }

        // 分镜视频
        if (scene.video_url) {
          try {
            const response = await axios.get(scene.video_url, { responseType: "arraybuffer" })
            archive.append(Buffer.from(response.data), { name: `${sceneFolder}/video.mp4` })
          } catch (e) {
            console.log(`跳过分镜 ${scene.scene_number} 视频`)
          }
        }
      }
    }

    // 下载并添加剧集合成视频
    if (episodes && episodes.length > 0) {
      for (const episode of episodes) {
        if (episode.merged_video_url) {
          const fileName = `episodes/S${episode.season_number}E${episode.episode_number}_${episode.title || 'episode'}.mp4`
          try {
            const response = await axios.get(episode.merged_video_url, { responseType: "arraybuffer" })
            archive.append(Buffer.from(response.data), { name: fileName })
          } catch (e) {
            console.log(`跳过剧集 S${episode.season_number}E${episode.episode_number} 视频`)
          }
        }
      }
    }

    // 完成压缩
    archive.finalize()
    await archiveEnd

    const zipBuffer = Buffer.concat(chunks)

    // 返回压缩文件
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(project.name)}_export.zip`,
        "Content-Length": zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("导出项目失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出项目失败" },
      { status: 500 }
    )
  }
}
