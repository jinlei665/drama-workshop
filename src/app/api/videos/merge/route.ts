/**
 * 视频合并 API
 * 使用 FFmpeg 合并多个视频片段
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

// 增加超时配置
export const maxDuration = 300 // 5分钟

// 跨平台临时目录
function getTmpDir(): string {
  const baseDir = tmpdir()
  const videoMergeDir = join(baseDir, 'drama-video-merge')
  if (!existsSync(videoMergeDir)) {
    mkdirSync(videoMergeDir, { recursive: true })
  }
  return videoMergeDir
}

/**
 * 获取 FFmpeg 路径
 * 优先使用用户配置的路径，如果路径无效则 fallback 到系统 PATH
 */
async function getFfmpegPath(): Promise<{ ffmpeg: string; ffprobe: string }> {
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
  
  // 如果配置了路径，验证该路径在当前系统是否有效
  if (ffmpegPath) {
    try {
      await execAsync(`"${ffmpegPath}" -version`, { timeout: 5000 })
      console.log('[VideoMerge] 使用用户配置的 FFmpeg:', ffmpegPath)
      return {
        ffmpeg: ffmpegPath,
        ffprobe: ffprobePath || ffmpegPath
      }
    } catch (error) {
      console.warn(`[VideoMerge] 用户配置的 FFmpeg 路径 "${ffmpegPath}" 无效，尝试系统 FFmpeg`)
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
        console.log('[VideoMerge] 使用系统 FFmpeg:', systemPath)
        return {
          ffmpeg: systemPath,
          ffprobe: systemPath.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')
        }
      } catch {
        console.warn('[VideoMerge] 系统 FFmpeg 无效')
      }
    }
  } catch {
    console.warn('[VideoMerge] 无法从系统 PATH 检测 FFmpeg')
  }
  
  // 最后 fallback 到 'ffmpeg'（依赖系统 PATH）
  return {
    ffmpeg: 'ffmpeg',
    ffprobe: 'ffprobe'
  }
}

/**
 * 下载视频到临时目录
 * 支持本地路径和远程 URL
 */
async function downloadVideo(url: string, filename: string): Promise<string> {
  const tmpDir = getTmpDir()
  const filePath = join(tmpDir, filename)
  
  // 如果已存在，直接返回
  if (existsSync(filePath)) {
    console.log(`[VideoMerge] 文件已存在: ${filePath}`)
    return filePath
  }
  
  console.log(`[VideoMerge] 获取视频: ${url.substring(0, 60)}...`)
  
  // 判断是本地路径还是远程 URL
  if (url.startsWith('/')) {
    // 本地路径，从 public 目录读取
    const localPath = join(process.cwd(), 'public', url)
    
    if (!existsSync(localPath)) {
      throw new Error(`本地文件不存在: ${localPath}`)
    }
    
    // 复制到临时目录
    const buffer = readFileSync(localPath)
    writeFileSync(filePath, buffer)
    console.log(`[VideoMerge] 本地文件复制完成: ${filePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
    
    return filePath
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    // 远程 URL，下载视频
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载视频失败: HTTP ${response.status} ${response.statusText}`)
    }
    
    const buffer = await response.arrayBuffer()
    writeFileSync(filePath, Buffer.from(buffer))
    console.log(`[VideoMerge] 下载完成: ${filePath} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)
    
    return filePath
  } else {
    throw new Error(`无效的视频 URL: ${url}`)
  }
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
    
    console.log('[VideoMerge] 收到请求:', { projectId, sceneIds, outputName })
    
    if (!projectId || !sceneIds || sceneIds.length === 0) {
      return errorResponse({ message: '缺少必要参数' }, 400)
    }
    
    // 获取 FFmpeg 路径
    const ffmpegPaths = await getFfmpegPath()
    console.log('[VideoMerge] FFmpeg 路径:', ffmpegPaths)
    
    // 验证 FFmpeg 是否可用
    try {
      const { stdout } = await execAsync(`"${ffmpegPaths.ffmpeg}" -version`, { timeout: 5000 })
      console.log('[VideoMerge] FFmpeg 版本:', stdout.split('\n')[0])
    } catch (ffmpegError) {
      console.error('[VideoMerge] FFmpeg 检测失败:', ffmpegError)
      return successResponse({
        success: false,
        error: 'FFmpeg 不可用，请检查配置或安装 FFmpeg',
        needConfig: true,
        details: ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError)
      })
    }
    
    // 获取项目分镜数据
    type SceneData = {
      id: string
      sceneNumber: number
      videoUrl: string | null
    }
    
    let scenes: SceneData[] = []
    
    // 先尝试数据库
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        // 使用 snake_case 字段名查询数据库
        const { data, error } = await db
          .from('scenes')
          .select('id, scene_number, video_url')
          .eq('project_id', projectId)
          .in('id', sceneIds)
          .order('scene_number', { ascending: true })
        
        if (!error && data && data.length > 0) {
          scenes = data.map((s: { id: string; scene_number: number; video_url?: string }) => ({
            id: s.id,
            sceneNumber: s.scene_number,
            videoUrl: s.video_url || null
          }))
          console.log(`[VideoMerge] 从数据库获取 ${scenes.length} 个场景`)
        } else if (error) {
          console.warn('[VideoMerge] 数据库查询失败:', error.message)
        }
      }
    } catch (dbError) {
      console.warn('[VideoMerge] 数据库查询异常:', dbError)
    }
    
    // 如果数据库没有数据，尝试内存存储
    if (scenes.length === 0) {
      try {
        const { memoryScenes } = await import('@/lib/memory-storage')
        scenes = memoryScenes
          .filter((s) => s.projectId === projectId && sceneIds.includes(s.id))
          .sort((a, b) => a.sceneNumber - b.sceneNumber)
          .map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            videoUrl: s.videoUrl ?? null
          }))
        console.log(`[VideoMerge] 从内存获取 ${scenes.length} 个场景`)
      } catch (memError) {
        console.error('[VideoMerge] 内存存储获取失败:', memError)
      }
    }
    
    console.log('[VideoMerge] 场景数据:', scenes.map(s => ({ id: s.id, sceneNumber: s.sceneNumber, hasVideo: !!s.videoUrl })))
    
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
    const tmpDir = getTmpDir()
    
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
    // 使用绝对路径（Windows 兼容）
    const listContent = videoPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n')
    writeFileSync(listFilePath, listContent)

    // 输出文件名
    const outputFilename = outputName || `merged_${projectId}_${Date.now()}.mp4`
    const outputPath = join(tmpDir, outputFilename)

    // 构建 FFmpeg 命令
    // 使用 concat demuxer 合并视频
    // 使用绝对路径并指定工作目录
    let ffmpegCmd = `"${ffmpegPaths.ffmpeg}" -y -f concat -safe 0 -i "${listFilePath.replace(/\\/g, '/')}" -c copy "${outputPath.replace(/\\/g, '/')}"`

    console.log(`[VideoMerge] 执行命令: ${ffmpegCmd}`)

    // 执行合并
    try {
      const { stdout, stderr } = await execAsync(ffmpegCmd, {
        cwd: tmpDir, // 指定工作目录
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
    
    // 上传到对象存储或保存到本地
    let downloadUrl: string
    
    // 获取 OSS 配置
    const ossEndpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
    const ossBucket = process.env.S3_BUCKET || process.env.COZE_BUCKET_NAME
    
    // 首先尝试对象存储
    if (ossEndpoint && ossBucket) {
      try {
        const { S3Storage } = await import('coze-coding-dev-sdk')
        console.log('[VideoMerge] 使用对象存储:', ossEndpoint, ossBucket)
        
        const storage = new S3Storage({
          endpointUrl: ossEndpoint,
          accessKey: '',
          secretKey: '',
          bucketName: ossBucket,
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
      console.warn('[VideoMerge] 对象存储上传失败，尝试保存到本地:', uploadError)
      
      // 保存到本地 public 目录
      try {
        const publicDir = join(process.cwd(), 'public', 'merged')
        if (!existsSync(publicDir)) {
          mkdirSync(publicDir, { recursive: true })
        }
        
        const localPath = join(publicDir, outputFilename)
        const fileBuffer = readFileSync(outputPath)
        writeFileSync(localPath, fileBuffer)
        
        downloadUrl = `/merged/${outputFilename}`
        console.log('[VideoMerge] 保存到本地成功:', downloadUrl)
      } catch (localError) {
        console.error('[VideoMerge] 本地保存失败:', localError)
        return errorResponse({ message: '视频保存失败，请检查磁盘空间' }, 500)
      }
    }
  } else {
    // OSS 未配置，保存到本地
    console.log('[VideoMerge] 对象存储未配置，保存到本地')
    
    const publicDir = join(process.cwd(), 'public', 'merged')
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true })
    }
    
    const localPath = join(publicDir, outputFilename)
    const fileBuffer = readFileSync(outputPath)
    writeFileSync(localPath, fileBuffer)
    
    downloadUrl = `/merged/${outputFilename}`
    console.log('[VideoMerge] 保存到本地成功:', downloadUrl)
  }
    
    // 清理临时文件
    try {
      if (existsSync(listFilePath)) unlinkSync(listFilePath)
      for (const path of videoPaths) {
        if (existsSync(path)) unlinkSync(path)
      }
      // 不删除合并后的文件，用户可能需要下载
    } catch (cleanupError) {
      console.warn('[VideoMerge] 清理临时文件失败:', cleanupError)
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
