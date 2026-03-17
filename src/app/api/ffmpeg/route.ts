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
 * 检测 FFmpeg 是否可用
 */
async function checkFfmpegAvailable(customPath?: string | null): Promise<{
  available: boolean
  version?: string
  path?: string
  error?: string
}> {
  const ffmpegCmd = customPath ? `"${customPath}"` : 'ffmpeg'
  
  try {
    const { stdout } = await execAsync(`${ffmpegCmd} -version`, {
      timeout: 5000,
      windowsHide: true
    })
    
    // 解析版本信息
    const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/)
    const version = versionMatch ? versionMatch[1] : 'unknown'
    
    // 获取实际路径
    let actualPath = customPath || 'system'
    if (!customPath) {
      try {
        const { stdout: whichOutput } = await execAsync(
          process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg',
          { timeout: 3000 }
        )
        actualPath = whichOutput.split('\n')[0].trim()
      } catch {
        // 无法获取路径，使用默认值
      }
    }
    
    return {
      available: true,
      version,
      path: actualPath
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'FFmpeg 不可用'
    }
  }
}

/**
 * GET /api/ffmpeg
 * 获取 FFmpeg 配置状态
 */
export async function GET() {
  try {
    // 尝试从数据库获取配置
    let ffmpegPath: string | null = null
    
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
          memoryFfmpegConfig = {
            ffmpegPath: data.ffmpeg_path,
            ffprobePath: data.ffprobe_path
          }
        }
      }
    } catch (dbError) {
      // 数据库不可用，使用内存配置
      ffmpegPath = memoryFfmpegConfig?.ffmpegPath || null
    }
    
    // 检测 FFmpeg 是否可用
    const checkResult = await checkFfmpegAvailable(ffmpegPath)
    
    return successResponse({
      configured: checkResult.available,
      ffmpegPath: checkResult.path,
      version: checkResult.version,
      customPath: ffmpegPath,
      error: checkResult.error,
      // 是否使用用户自定义路径
      useCustomPath: !!ffmpegPath && checkResult.available
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
    
    // 验证路径是否有效
    if (ffmpegPath) {
      const checkResult = await checkFfmpegAvailable(ffmpegPath)
      if (!checkResult.available) {
        return successResponse({
          saved: false,
          error: `FFmpeg 路径无效: ${checkResult.error}`,
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
      console.warn('Database not available, saving to memory:', dbError)
    }
    
    // 更新内存配置
    memoryFfmpegConfig = { ffmpegPath, ffprobePath }
    
    // 返回检测结果
    const checkResult = await checkFfmpegAvailable(ffmpegPath)
    
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
      console.warn('Database update failed:', dbError)
    }
    
    // 清除内存配置
    memoryFfmpegConfig = null
    
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
