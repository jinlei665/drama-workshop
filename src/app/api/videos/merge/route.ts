/**
 * 视频合并 API
 * 使用 FFmpeg 合并多个视频片段
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

// 增加超时配置
export const maxDuration = 300 // 5分钟

/**
 * 获取 FFmpeg 路径
 */
async function getFfmpegPath(): Promise<{ ffmpeg: string; ffprobe: string } | null> {
  let ffmpegPath: string | null = null
  let ffprobePath: string | null = null
  
  // 尝试从数据库获取
  try {
    const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      const db = getSupabaseClient()
      const { data } = await db
        .from('user_settings')
        .select('ffmpeg_path, ffprobe_path')
        .maybeSingle()
      
      if (data) {
        ffmpegPath = data.ffmpeg_path
        ffprobePath = data.ffprobe_path
      }
    }
  } catch {
    // 忽略错误
  }
  
  // 返回路径
  return {
    ffmpeg: ffmpegPath || 'ffmpeg',
    ffprobe: ffprobePath || 'ffprobe'
  }
}

/**
 * 下载视频到临时目录
 */
async function downloadVideo(url: string, filename: string): Promise<string> {
  const tmpDir = '/tmp/video-merge'
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }
  
  const filePath = join(tmpDir, filename)
  
  // 如果已存在，直接返回
  if (existsSync(filePath)) {
    return filePath
  }
  
  // 下载视频
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`下载视频失败: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  writeFileSync(filePath, Buffer.from(buffer))
  
  return filePath
}

/**
 * 获取视频时长
 */
async function getVideoDuration(
  videoPath: string,
  ffprobePath: string
): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { timeout: 10000 }
    )
    return parseFloat(stdout.trim())
  } catch {
    return 0
  }
}

/**
 * POST /api/videos/merge
 * 合并多个视频
 */
export async function POST(request: NextRequest) {
  try {
    const body = await getJSON<{
      projectId: string
      sceneIds: string[]
      outputName?: string
    }>(request)
    
    const { projectId, sceneIds, outputName } = body
    
    if (!projectId || !sceneIds || sceneIds.length === 0) {
      return errorResponse({ message: '缺少必要参数' }, 400)
    }
    
    // 获取 FFmpeg 路径
    const ffmpegPaths = await getFfmpegPath()
    if (!ffmpegPaths) {
      return successResponse({
        success: false,
        error: 'FFmpeg 未配置，请先在设置中配置 FFmpeg 路径',
        needConfig: true
      })
    }
    
    // 验证 FFmpeg 是否可用
    try {
      await execAsync(`"${ffmpegPaths.ffmpeg}" -version`, { timeout: 5000 })
    } catch {
      return successResponse({
        success: false,
        error: 'FFmpeg 不可用，请检查配置或安装 FFmpeg',
        needConfig: true
      })
    }
    
    // 获取项目分镜数据
    type SceneData = {
      id: string
      sceneNumber: number
      videoUrl: string | null
    }
    
    let scenes: SceneData[] = []
    
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data } = await db
          .from('scenes')
          .select('id, sceneNumber, videoUrl')
          .eq('project_id', projectId)
          .in('id', sceneIds)
          .order('sceneNumber', { ascending: true })
        
        scenes = (data || []).map((s: { id: string; sceneNumber: number; videoUrl?: string }) => ({
          id: s.id,
          sceneNumber: s.sceneNumber,
          videoUrl: s.videoUrl || null
        }))
      }
    } catch {
      // 尝试从内存获取
      const { memoryScenes } = await import('@/lib/memory-storage')
      scenes = memoryScenes
        .filter((s) => s.projectId === projectId && sceneIds.includes(s.id))
        .sort((a, b) => a.sceneNumber - b.sceneNumber)
        .map((s) => ({
          id: s.id,
          sceneNumber: s.sceneNumber,
          videoUrl: s.videoUrl ?? null
        }))
    }
    
    if (scenes.length === 0) {
      return errorResponse({ message: '未找到视频数据' }, 404)
    }
    
    // 过滤有视频的分镜
    const validScenes = scenes.filter(s => s.videoUrl)
    if (validScenes.length === 0) {
      return errorResponse({ message: '没有可合并的视频' }, 400)
    }
    
    console.log(`[VideoMerge] 开始合并 ${validScenes.length} 个视频`)
    
    // 下载视频到临时目录
    const videoPaths: string[] = []
    const tmpDir = '/tmp/video-merge'
    
    for (let i = 0; i < validScenes.length; i++) {
      const scene = validScenes[i]
      const videoUrl = scene.videoUrl
      
      if (!videoUrl) continue
      
      try {
        const filename = `scene_${scene.sceneNumber}_${i}.mp4`
        const path = await downloadVideo(videoUrl, filename)
        videoPaths.push(path)
        console.log(`[VideoMerge] 下载完成: ${filename}`)
      } catch (err) {
        console.error(`[VideoMerge] 下载失败: scene_${scene.sceneNumber}`, err)
      }
    }
    
    if (videoPaths.length === 0) {
      return errorResponse({ message: '所有视频下载失败' }, 500)
    }
    
    // 创建合并列表文件
    const listFilePath = join(tmpDir, `list_${Date.now()}.txt`)
    const listContent = videoPaths.map(p => `file '${p}'`).join('\n')
    writeFileSync(listFilePath, listContent)
    
    // 输出文件名
    const outputFilename = outputName || `merged_${projectId}_${Date.now()}.mp4`
    const outputPath = join(tmpDir, outputFilename)
    
    // 构建 FFmpeg 命令
    // 使用 concat demuxer 合并视频
    let ffmpegCmd = `"${ffmpegPaths.ffmpeg}" -y -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`
    
    console.log(`[VideoMerge] 执行命令: ${ffmpegCmd}`)
    
    // 执行合并
    try {
      const { stdout, stderr } = await execAsync(ffmpegCmd, {
        timeout: 300000, // 5分钟超时
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
      })
      
      console.log('[VideoMerge] FFmpeg stdout:', stdout)
      if (stderr) console.log('[VideoMerge] FFmpeg stderr:', stderr)
    } catch (execError) {
      console.error('[VideoMerge] FFmpeg 执行失败:', execError)
      return errorResponse({ message: `合并失败: ${execError instanceof Error ? execError.message : '未知错误'}` }, 500)
    }
    
    // 检查输出文件
    if (!existsSync(outputPath)) {
      return errorResponse({ message: '合并失败：输出文件未生成' }, 500)
    }
    
    // 获取输出文件信息
    const duration = await getVideoDuration(outputPath, ffmpegPaths.ffprobe)
    
    // 上传到对象存储
    let downloadUrl: string
    try {
      const { S3Storage } = await import('coze-coding-dev-sdk')
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: '',
        secretKey: '',
        bucketName: process.env.COZE_BUCKET_NAME,
        region: 'cn-beijing',
      })
      
      const fileBuffer = readFileSync(outputPath)
      const storageKey = await storage.uploadFile({
        fileContent: fileBuffer,
        fileName: `merged/${projectId}/${outputFilename}`,
        contentType: 'video/mp4'
      })
      
      // 生成签名 URL
      downloadUrl = await storage.generatePresignedUrl({
        key: storageKey,
        expireTime: 86400 * 7 // 7 天有效期
      })
      
      console.log('[VideoMerge] 上传成功:', downloadUrl)
    } catch (uploadError) {
      console.error('[VideoMerge] 上传失败:', uploadError)
      // 如果上传失败，返回本地路径（用于开发测试）
      downloadUrl = `/api/videos/download?path=${encodeURIComponent(outputPath)}`
    }
    
    // 清理临时文件
    try {
      unlinkSync(listFilePath)
      for (const path of videoPaths) {
        if (existsSync(path)) unlinkSync(path)
      }
    } catch {
      // 忽略清理错误
    }
    
    return successResponse({
      success: true,
      url: downloadUrl,
      filename: outputFilename,
      duration,
      sceneCount: videoPaths.length
    })
  } catch (error) {
    console.error('[VideoMerge] 合并失败:', error)
    return errorResponse(error)
  }
}
