import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { S3Storage } from "coze-coding-dev-sdk"
import { downloadFile } from "@/lib/utils"
import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"

const execAsync = promisify(exec)

/**
 * 获取 FFmpeg 路径
 * 优先使用用户配置的路径，如果路径无效则 fallback 到系统 PATH
 */
async function getFfmpegPath(): Promise<string> {
  let ffmpegPath: string | null = null
  
  try {
    const client = getSupabaseClient()
    const { data } = await client
      .from("settings")
      .select("ffmpeg_path")
      .single()
    
    if (data?.ffmpeg_path) {
      ffmpegPath = data.ffmpeg_path
    }
  } catch (error) {
    console.warn("[MergeVideos] 无法从数据库获取 FFmpeg 配置:", error)
  }
  
  // 如果配置了路径，验证该路径在当前系统是否有效
  if (ffmpegPath) {
    try {
      await execAsync(`"${ffmpegPath}" -version`, { timeout: 5000 })
      console.log('[MergeVideos] 使用用户配置的 FFmpeg:', ffmpegPath)
      return ffmpegPath
    } catch (error) {
      console.warn(`[MergeVideos] 用户配置的 FFmpeg 路径 "${ffmpegPath}" 无效，尝试系统 FFmpeg`)
    }
  }
  
  // 尝试从系统 PATH 检测
  try {
    const checkCmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'
    const { stdout } = await execAsync(checkCmd)
    const lines = stdout.trim().split('\n')
    if (lines.length > 0) {
      const systemPath = lines[0].trim()
      // 验证系统 FFmpeg 是否有效
      try {
        await execAsync(`"${systemPath}" -version`, { timeout: 5000 })
        console.log('[MergeVideos] 使用系统 FFmpeg:', systemPath)
        return systemPath
      } catch {
        console.warn('[MergeVideos] 系统 FFmpeg 无效')
      }
    }
  } catch {
    console.warn('[MergeVideos] 无法从系统 PATH 检测 FFmpeg')
  }
  
  // 最后 fallback 到 'ffmpeg'（依赖系统 PATH）
  return 'ffmpeg'
}

/**
 * POST /api/episodes/[id]/merge-videos
 * 将剧集下的所有分镜视频合成为一个完整视频
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  // 获取剧集信息
  const { data: episode, error: episodeError } = await client
    .from("episodes")
    .select("*")
    .eq("id", id)
    .single()

  if (episodeError || !episode) {
    return NextResponse.json({ error: "剧集不存在" }, { status: 404 })
  }

  // 获取该剧集下所有已生成视频的分镜，按序号排序
  const { data: scenes, error: scenesError } = await client
    .from("scenes")
    .select("id, scene_number, title, video_url")
    .eq("episode_id", id)
    .eq("video_status", "completed")
    .order("scene_number", { ascending: true })

  if (scenesError) {
    return NextResponse.json({ error: "获取分镜失败" }, { status: 500 })
  }

  if (!scenes || scenes.length === 0) {
    return NextResponse.json({ error: "没有可合成的视频分镜" }, { status: 400 })
  }

  // 更新状态为合成中
  await client
    .from("episodes")
    .update({ merged_video_status: "merging", updated_at: new Date().toISOString() })
    .eq("id", id)

  try {
    // 创建临时目录
    const tempDir = `/tmp/merge_${id}_${Date.now()}`
    await fs.mkdir(tempDir, { recursive: true })

    // 下载所有视频文件（禁用代理）
    const videoFiles: string[] = []
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const videoPath = path.join(tempDir, `video_${i}.mp4`)
      
      const videoBuffer = await downloadFile(scene.video_url)
      await fs.writeFile(videoPath, videoBuffer)
      videoFiles.push(videoPath)
    }

    // 创建文件列表用于 FFmpeg concat
    const listPath = path.join(tempDir, "filelist.txt")
    // 使用绝对路径（Windows 兼容）
    const fileListContent = videoFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join("\n")
    await fs.writeFile(listPath, fileListContent)

    // 获取 FFmpeg 路径
    const ffmpegPath = await getFfmpegPath()
    console.log('[MergeVideos] FFmpeg 路径:', ffmpegPath)

    // 验证 FFmpeg 可用
    try {
      await execAsync(`"${ffmpegPath}" -version`, { timeout: 5000 })
    } catch (ffmpegError) {
      console.error('[MergeVideos] FFmpeg 检测失败:', ffmpegError)
      return NextResponse.json({ 
        error: 'FFmpeg 不可用，请检查安装或配置',
        details: ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError)
      }, { status: 500 })
    }

    // 使用 FFmpeg 合并视频
    const outputPath = path.join(tempDir, "merged.mp4")
    // 使用绝对路径并指定工作目录
    const ffmpegCmd = `"${ffmpegPath}" -f concat -safe 0 -i "${listPath.replace(/\\/g, '/')}" -c copy "${outputPath.replace(/\\/g, '/')}"`
    console.log('[MergeVideos] 执行命令:', ffmpegCmd)
    await execAsync(ffmpegCmd, {
      cwd: tempDir, // 指定工作目录
    })

    // 读取合并后的视频
    const mergedVideo = await fs.readFile(outputPath)

    // 上传视频
    let viewUrl: string
    let fileKey: string | null = null
    
    // 获取 OSS 配置
    const ossEndpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
    const ossBucket = process.env.S3_BUCKET || process.env.COZE_BUCKET_NAME
    const ossAccessKey = process.env.S3_ACCESS_KEY || ''
    const ossSecretKey = process.env.S3_SECRET_KEY || ''
    
    try {
      // 优先尝试对象存储
      if (ossEndpoint && ossBucket) {
        const storage = new S3Storage({
          endpointUrl: ossEndpoint,
          accessKey: ossAccessKey,
          secretKey: ossSecretKey,
          bucketName: ossBucket,
          region: "cn-beijing",
        })

        const storageKey = `episodes/${id}/merged_${Date.now()}.mp4`
        await storage.uploadFile({
          fileContent: mergedVideo,
          fileName: storageKey,
          contentType: "video/mp4",
        })

        // 使用 generatePresignedUrl 生成可公开访问的 URL
        const signedUrl = await storage.generatePresignedUrl({
          key: storageKey,
          expireTime: 3600 * 24 * 7, // 7天有效期
        })
        
        // 处理返回值，可能是 string 或 object
        viewUrl = typeof signedUrl === 'string' ? signedUrl : (signedUrl as { url: string }).url
        fileKey = storageKey
        console.log('[MergeVideos] 上传成功:', viewUrl)
      } else {
        // 对象存储未配置，保存到本地 public 目录
        const publicDir = path.join(process.cwd(), 'public', 'episodes')
        await fs.mkdir(publicDir, { recursive: true })
        const localPath = path.join(publicDir, `${id}_merged_${Date.now()}.mp4`)
        await fs.writeFile(localPath, mergedVideo)
        viewUrl = `/episodes/${path.basename(localPath)}`
        fileKey = null
      }
    } catch (uploadError) {
      console.error("上传视频失败:", uploadError)
      throw new Error("视频上传失败")
    }

    // 更新数据库
    const { error: updateError } = await client
      .from("episodes")
      .update({
        merged_video_url: viewUrl,
        merged_video_key: fileKey,
        merged_video_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      throw new Error("更新数据库失败")
    }

    // 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true })

    return NextResponse.json({
      success: true,
      videoUrl: viewUrl,
      sceneCount: scenes.length,
    })
  } catch (error) {
    console.error("视频合成失败:", error)
    
    // 更新状态为失败
    await client
      .from("episodes")
      .update({ merged_video_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", id)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "视频合成失败" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/episodes/[id]/merge-videos
 * 下载合成后的剧集视频
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  // 获取剧集信息
  const { data: episode, error } = await client
    .from("episodes")
    .select("id, title, season_number, episode_number, merged_video_url, merged_video_status")
    .eq("id", id)
    .single()

  if (error || !episode) {
    return NextResponse.json({ error: "剧集不存在" }, { status: 404 })
  }

  if (episode.merged_video_status !== "completed" || !episode.merged_video_url) {
    return NextResponse.json({ error: "该剧集尚未合成视频" }, { status: 400 })
  }

  try {
    // 下载视频文件（禁用代理）
    const videoBuffer = await downloadFile(episode.merged_video_url)
    
    // 生成文件名
    const fileName = `S${episode.season_number}E${episode.episode_number}_${episode.title || 'episode'}.mp4`

    // 返回视频文件
    return new NextResponse(new Uint8Array(videoBuffer), {
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
