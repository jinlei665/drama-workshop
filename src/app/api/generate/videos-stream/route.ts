import { NextRequest } from "next/server"
import { S3Storage, HeaderUtils } from 'coze-coding-dev-sdk'
import { getSupabaseClient, isDatabaseConfigured } from '@/storage/database/supabase-client'
import { memoryScenes, memoryProjects } from '@/lib/memory-storage'
import { getCozeConfigFromMemory } from '@/lib/memory-store'
import { getVideoStylePrompt } from '@/lib/styles'
import { generateVideoFromImage } from '@/lib/ai'

export const maxDuration = 300 // 5分钟超时

// 禁用代理工具函数
function disableProxy(): { http?: string; https?: string } | null {
  const proxy = {
    http: process.env.HTTP_PROXY,
    https: process.env.HTTPS_PROXY,
  }
  if (proxy.http || proxy.https) {
    delete process.env.HTTP_PROXY
    delete process.env.HTTPS_PROXY
    delete process.env.http_proxy
    delete process.env.https_proxy
    return proxy
  }
  return null
}

function restoreProxy(proxy: { http?: string; https?: string } | null): void {
  if (!proxy) return
  if (proxy.http) process.env.HTTP_PROXY = proxy.http
  if (proxy.https) process.env.HTTPS_PROXY = proxy.https
}

/**
 * POST /api/generate/videos-stream
 * 流式生成视频，实时返回进度
 * 
 * 支持 SSE (Server-Sent Events) 实时推送进度
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { projectId, sceneIds, mode = 'continuous', episodeId } = body

  if (!projectId) {
    return new Response(JSON.stringify({ error: '缺少项目ID' }), { status: 400 })
  }

  // 获取项目风格
  let style = 'realistic_cinema'
  
  // 从内存获取
  const project = memoryProjects.find(p => p.id === projectId)
  if (project?.style) {
    style = project.style
  }
  
  // 从数据库获取风格
  let actuallyUseDatabase = false
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseClient()
    const { data: projectData, error } = await supabase
      .from('projects')
      .select('style')
      .eq('id', projectId)
      .maybeSingle()
    
    if (!error && projectData) {
      actuallyUseDatabase = true
      if (projectData.style) {
        style = projectData.style
      }
    }
  }

  // 获取视频风格提示词
  const stylePrompt = getVideoStylePrompt(style)

  // 获取分镜列表
  let scenesList: any[] = []

  if (actuallyUseDatabase && isDatabaseConfigured()) {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true })

    if (sceneIds && sceneIds.length > 0) {
      query = query.in('id', sceneIds)
    }
    
    if (episodeId) {
      query = query.eq('episode_id', episodeId)
    }

    const { data, error } = await query

    if (error) {
      console.warn('数据库查询分镜失败，回退到内存存储:', error.message)
    }
    if (data && data.length > 0) {
      scenesList = data
    } else {
      // 数据库没有数据，回退到内存
      actuallyUseDatabase = false
    }
  }
  
  // 如果不使用数据库或数据库没有数据，使用内存存储
  if (!actuallyUseDatabase || scenesList.length === 0) {
    scenesList = memoryScenes.filter(s => s.projectId === projectId)
      .sort((a, b) => a.sceneNumber - b.sceneNumber)

    if (sceneIds && sceneIds.length > 0) {
      scenesList = scenesList.filter(s => sceneIds.includes(s.id))
    }

    if (scenesList.length === 0) {
      return new Response(JSON.stringify({ error: '没有可用的分镜' }), { status: 400 })
    }
  }

  // 过滤有图片的分镜
  const scenesWithImages = scenesList.filter((s: any) => 
    s.image_key || s.image_url || s.imageUrl
  )

  // 禁用代理，避免本地代理干扰
  const savedProxy = disableProxy()

  // 创建可读流
  const encoder = new TextEncoder()
  let isAborted = false

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始状态
      const sendEvent = (event: string, data: any) => {
        if (!isAborted) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        }
      }

      sendEvent('start', {
        total: scenesWithImages.length,
        style,
        scenes: scenesWithImages.map((s: any) => ({
          id: s.id,
          sceneNumber: s.scene_number || s.sceneNumber,
          title: s.title,
        }))
      })

      // 获取用户配置
      const userConfig = getCozeConfigFromMemory()
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

      // 初始化对象存储（可选）
      let storage: S3Storage | null = null
      try {
        storage = new S3Storage({
          endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
          accessKey: '',
          secretKey: '',
          bucketName: process.env.COZE_BUCKET_NAME,
          region: 'cn-beijing',
        })
      } catch (e) {
        console.warn("Storage not available:", e)
      }

      // 只在数据库真正有数据时使用数据库
      const supabase = actuallyUseDatabase ? getSupabaseClient() : null

      // 延迟函数
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

      // 生成单个视频
      const generateSingleVideo = async (scene: any, index: number) => {
        if (isAborted) {
          sendEvent('skipped', { 
            sceneId: scene.id, 
            sceneNumber: scene.scene_number || scene.sceneNumber 
          })
          return null
        }

        sendEvent('progress', {
          current: index + 1,
          total: scenesWithImages.length,
          sceneId: scene.id,
          sceneNumber: scene.scene_number || scene.sceneNumber,
          title: scene.title,
          status: 'generating'
        })

        const sceneId = scene.id
        const sceneNumber = scene.scene_number || scene.sceneNumber

        try {
          // 更新数据库状态
          if (supabase) {
            await supabase
              .from('scenes')
              .update({ video_status: 'generating', updated_at: new Date().toISOString() })
              .eq('id', sceneId)
          }

          // 更新内存状态
          const memIndex = memoryScenes.findIndex(s => s.id === sceneId)
          if (memIndex !== -1) {
            memoryScenes[memIndex].videoStatus = 'generating'
          }

          // 获取图片URL
          const imageUrl = await getImageUrl(scene, storage)
          if (!imageUrl) {
            throw new Error('无法获取分镜图片URL')
          }

          // 构建视频提示词，包含风格
          const videoPrompt = `${stylePrompt}，${buildVideoPrompt(scene)}`

          const duration = calculateDuration(scene)

          console.log(`Generating video for scene ${sceneId} with style ${style}:`, videoPrompt.substring(0, 100))

          // 使用统一的视频生成接口（支持 Bot Skills 回退）
          const userConfig = getCozeConfigFromMemory()
          const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
          
          const response = await generateVideoFromImage(
            videoPrompt,
            imageUrl,
            {
              duration: duration,
              ratio: '16:9',
              resolution: '720p',
            },
            userConfig?.apiKey ? {
              apiKey: userConfig.apiKey,
              baseUrl: userConfig.baseUrl,
            } : undefined,
            customHeaders
          )

          if (response.videoUrl) {
            // 更新数据库
            if (supabase) {
              // 先尝试完整更新
              const { error: updateError } = await supabase
                .from('scenes')
                .update({
                  video_url: response.videoUrl,
                  last_frame_url: response.lastFrameUrl,
                  video_status: 'completed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sceneId)
              
              // 如果是列不存在的错误，尝试不包含 last_frame_url 的更新
              if (updateError && updateError.message.includes('last_frame_url')) {
                await supabase
                  .from('scenes')
                  .update({
                    video_url: response.videoUrl,
                    video_status: 'completed',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', sceneId)
              }
            }

            // 更新内存
            if (memIndex !== -1) {
              memoryScenes[memIndex].videoUrl = response.videoUrl
              memoryScenes[memIndex].videoStatus = 'completed'
            }

            sendEvent('completed', {
              sceneId,
              sceneNumber,
              videoUrl: response.videoUrl,
              duration: duration,
            })

            return { success: true, lastFrameUrl: response.lastFrameUrl }
          } else {
            throw new Error('视频生成失败：未返回视频URL')
          }
        } catch (error: any) {
          console.error(`Video generation error for scene ${sceneId}:`, error)

          // 更新失败状态
          if (supabase) {
            await supabase
              .from('scenes')
              .update({ video_status: 'failed', updated_at: new Date().toISOString() })
              .eq('id', sceneId)
          }

          // 更新内存
          const memIndex = memoryScenes.findIndex(s => s.id === sceneId)
          if (memIndex !== -1) {
            memoryScenes[memIndex].videoStatus = 'failed'
          }

          sendEvent('error', {
            sceneId,
            sceneNumber,
            error: error.message || '未知错误',
          })

          return { success: false, error: error.message }
        }
      }

      // 顺序生成
      const results: { success: boolean }[] = []
      for (let i = 0; i < scenesWithImages.length; i++) {
        if (isAborted) break

        if (i > 0) {
          sendEvent('waiting', { message: '等待5秒后继续...', nextScene: i + 1 })
          await delay(5000)
        }

        const result = await generateSingleVideo(scenesWithImages[i], i)
        results.push(result || { success: false })
      }

      // 完成
      const completedCount = results.filter(r => r.success).length
      sendEvent('done', {
        total: scenesWithImages.length,
        completed: completedCount,
        failed: scenesWithImages.length - completedCount,
        style,
      })

      // 恢复代理设置
      restoreProxy(savedProxy)
      controller.close()
    },
    cancel() {
      isAborted = true
      // 恢复代理设置
      restoreProxy(savedProxy)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// 辅助函数
async function getImageUrl(scene: any, storage: S3Storage | null): Promise<string | null> {
  if (scene.image_url || scene.imageUrl) {
    return scene.image_url || scene.imageUrl
  }
  
  if (scene.image_key || scene.imageKey) {
    const key = scene.image_key || scene.imageKey
    if (storage) {
      try {
        const signedUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 3600,
        })
        return typeof signedUrl === 'string' ? signedUrl : (signedUrl as any).url
      } catch {
        return null
      }
    }
  }
  
  return null
}

function calculateDuration(scene: any): number {
  let duration = 6
  
  const dialogue = scene.dialogue
  const action = scene.action
  const description = scene.description
  
  if (dialogue) {
    const len = dialogue.length
    if (len > 50) duration += 4
    else if (len > 30) duration += 3
    else if (len > 15) duration += 2
    else if (len > 0) duration += 1
  }
  
  if (action && action.length > 20) duration += 2
  else if (action && action.length > 0) duration += 1
  
  if (description && description.length > 100) duration += 1
  
  return Math.min(Math.max(duration, 6), 12)
}

function buildVideoPrompt(scene: any): string {
  const parts: string[] = []
  
  if (scene.description) parts.push(scene.description)
  if (scene.action) parts.push(scene.action)
  if (scene.dialogue) parts.push(`角色说道："${scene.dialogue}"`)
  if (scene.emotion) parts.push(`氛围：${scene.emotion}`)
  
  const metadata = scene.metadata
  if (metadata) {
    if (metadata.shotType) parts.push(`景别：${metadata.shotType}`)
    if (metadata.cameraMovement) {
      const movementMap: Record<string, string> = {
        '固定': 'static camera',
        '推镜': 'slow zoom in',
        '拉镜': 'slow zoom out',
        '摇镜': 'panning shot',
        '跟拍': 'tracking shot',
      }
      parts.push(`镜头运动：${movementMap[metadata.cameraMovement] || metadata.cameraMovement}`)
    }
  }
  
  return parts.length > 0 ? parts.join('，') : '流畅的镜头，自然的光线变化'
}
