/**
 * FFmpeg 配置和检测 API
 * 
 * 支持用户自定义 FFmpeg 路径
 * 检测系统环境变量中的 FFmpeg
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, getJSON } from '@/lib/api/response'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// 内存存储 FFmpeg 路径配置
let memoryFfmpegConfig: { ffmpegPath: string | null; ffprobePath: string | null } | null = null

/**
 * Windows 常见 FFmpeg 安装路径
 */
const WINDOWS_COMMON_PATHS = [
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\ffmpeg\\bin\\ffmpeg.exe` : null,
  process.env.USERPROFILE ? `${process.env.USERPROFILE}\\ffmpeg\\bin\\ffmpeg.exe` : null,
].filter((p): p is string => p !== null)

/**
 * 验证 FFmpeg/ffprobe 路径是否可用
 */
async function validateFfmpegPath(ffmpegPath: string): Promise<{ valid: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(`"${ffmpegPath}" -version`, {
      timeout: 5000,
      windowsHide: true
    })
    const versionMatch = stdout.match(/ffmpeg version ([^\s\n]+)/)
    return { valid: true, version: versionMatch ? versionMatch[1] : 'unknown' }
  } catch {
    return { valid: false }
  }
}

/**
 * 检测 FFmpeg 是否可用
 * 优先级：自定义路径 > 内存配置 > 系统 PATH > Windows 常见路径 > ffprobe 推断
 */
async function checkFfmpegAvailable(): Promise<{
  available: boolean
  version?: string
  path?: string
  error?: string
}> {
  // 1. 如果有内存配置（用户刚配置过），优先使用
  if (memoryFfmpegConfig?.ffmpegPath) {
    const result = await validateFfmpegPath(memoryFfmpegConfig.ffmpegPath)
    if (result.valid) {
      console.log('[FFmpeg] 使用内存配置:', memoryFfmpegConfig.ffmpegPath)
      return {
        available: true,
        version: result.version,
        path: memoryFfmpegConfig.ffmpegPath
      }
    }
    console.warn('[FFmpeg] 内存配置路径无效:', memoryFfmpegConfig.ffmpegPath)
  }

  // 2. 尝试从系统 PATH 获取
  try {
    const whichCmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'
    const { stdout: whichOutput } = await execAsync(whichCmd, { timeout: 5000, windowsHide: true })
    const lines = whichOutput.trim().split('\n')

    for (const line of lines) {
      const systemPath = line.trim()
      if (!systemPath || systemPath.includes('not found')) continue

      const result = await validateFfmpegPath(systemPath)
      if (result.valid) {
        console.log('[FFmpeg] 使用系统 PATH:', systemPath)
        return {
          available: true,
          version: result.version,
          path: systemPath
        }
      }
    }
  } catch {
    // 系统 PATH 检测失败，继续尝试常见路径
    console.warn('[FFmpeg] 系统 PATH 检测失败')
  }

  // 3. Windows 常见安装路径
  if (process.platform === 'win32') {
    for (const commonPath of WINDOWS_COMMON_PATHS) {
      const result = await validateFfmpegPath(commonPath)
      if (result.valid) {
        console.log('[FFmpeg] 使用常见安装路径:', commonPath)
        return {
          available: true,
          version: result.version,
          path: commonPath
        }
      }
    }
  }

  // 4. 最后尝试直接执行 ffmpeg（依赖系统 PATH）
  try {
    const { stdout } = await execAsync('ffmpeg -version', {
      timeout: 5000,
      windowsHide: true
    })
    const versionMatch = stdout.match(/ffmpeg version ([^\s\n]+)/)
    return {
      available: true,
      version: versionMatch ? versionMatch[1] : 'unknown',
      path: 'ffmpeg' // 表示使用 PATH 中的 ffmpeg
    }
  } catch {
    // 完全无法找到
  }

  return {
    available: false,
    error: '未找到 FFmpeg，请安装 FFmpeg 或在设置中配置路径'
  }
}

/**
 * GET /api/ffmpeg
 * 获取 FFmpeg 配置状态
 */
export async function GET() {
  try {
    // 尝试从数据库加载配置到内存
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data } = await db
          .from('user_settings')
          .select('ffmpeg_path, ffprobe_path')
          .maybeSingle()

        if (data) {
          memoryFfmpegConfig = {
            ffmpegPath: data.ffmpeg_path,
            ffprobePath: data.ffprobe_path
          }
        }
      }
    } catch (dbError) {
      // 数据库不可用，使用已有内存配置
      console.warn('[FFmpeg] 数据库加载失败，使用内存配置:', dbError)
    }

    // 检测 FFmpeg 是否可用（现在内部处理所有检测逻辑）
    const checkResult = await checkFfmpegAvailable()

    return successResponse({
      available: checkResult.available,
      ffmpegPath: checkResult.path,
      version: checkResult.version,
      customPath: memoryFfmpegConfig?.ffmpegPath || null,
      error: checkResult.error
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PUT /api/ffmpeg
 * 更新 FFmpeg 配置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await getJSON<{
      ffmpegPath?: string
      ffprobePath?: string
    }>(request)

    const ffmpegPath = body.ffmpegPath?.trim() || null
    const ffprobePath = body.ffprobePath?.trim() || null

    // 先验证路径是否有效（更新内存配置前先验证）
    if (ffmpegPath) {
      const validation = await validateFfmpegPath(ffmpegPath)
      if (!validation.valid) {
        return successResponse({
          saved: false,
          error: `FFmpeg 路径无效，请检查路径是否正确`,
          available: false
        })
      }
    }

    // 保存到数据库
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()

        // 检查是否存在设置
        const { data: existing } = await db
          .from('user_settings')
          .select('id')
          .maybeSingle()

        const updateData = {
          ffmpeg_path: ffmpegPath,
          ffprobe_path: ffprobePath,
          updated_at: new Date().toISOString()
        }

        if (existing?.id) {
          await db
            .from('user_settings')
            .update(updateData)
            .eq('id', existing.id)
        } else {
          await db
            .from('user_settings')
            .insert({ id: 'default', ...updateData })
        }
      }
    } catch (dbError) {
      console.warn('[FFmpeg] 数据库保存失败，仅保存到内存:', dbError)
    }

    // 更新内存配置
    memoryFfmpegConfig = { ffmpegPath, ffprobePath }
    console.log('[FFmpeg] 配置已更新:', { ffmpegPath, ffprobePath })

    // 返回检测结果
    const checkResult = await checkFfmpegAvailable()

    return successResponse({
      saved: true,
      available: checkResult.available,
      version: checkResult.version,
      path: checkResult.path
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * DELETE /api/ffmpeg
 * 清除自定义 FFmpeg 配置，使用系统默认
 */
export async function DELETE() {
  try {
    // 清除数据库配置
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')

      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        const { data: existing } = await db
          .from('user_settings')
          .select('id')
          .maybeSingle()

        if (existing?.id) {
          await db
            .from('user_settings')
            .update({
              ffmpeg_path: null,
              ffprobe_path: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
        }
      }
    } catch (dbError) {
      console.warn('[FFmpeg] 数据库清除失败:', dbError)
    }

    // 清除内存配置
    memoryFfmpegConfig = null
    console.log('[FFmpeg] 配置已清除')

    // 检测系统默认 FFmpeg
    const checkResult = await checkFfmpegAvailable()

    return successResponse({
      cleared: true,
      systemAvailable: checkResult.available,
      systemVersion: checkResult.version,
      systemPath: checkResult.path
    })
  } catch (error) {
    return errorResponse(error)
  }
}
