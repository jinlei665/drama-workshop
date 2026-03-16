import { NextRequest } from "next/server"
import { VideoGenerationClient, Config, HeaderUtils, S3Storage, Content } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export const maxDuration = 300 // 5分钟超时

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

  const supabase = getSupabaseClient()

  // 获取分镜列表
  let query = supabase
    .from('scenes')
    .select('*')
    .eq('project_id', projectId)
    .order('scene_number', 'asc')

  if (sceneIds && sceneIds.length > 0) {
    query = query.in('id', sceneIds)
  }
  
  if (episodeId) {
    query = query.eq('episode_id', episodeId)
  }

  const { data: scenesList, error: scenesError } = await query

  if (scenesError || !scenesList || scenesList.length === 0) {
    return new Response(JSON.stringify({ error: '没有可用的分镜' }), { status: 400 })
  }

  // 过滤有图片的分镜
  const scenesWithImages = scenesList.filter((s: any) => s.image_key || s.image_url)

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
        scenes: scenesWithImages.map((s: any) => ({
          id: s.id,
          sceneNumber: s.scene_number,
          title: s.title,
        }))
      })

      // 获取用户配置
      let settings: any = null
      try {
        const result = await supabase
          .from('user_settings')
          .select('*')
          .limit(1)
          .maybeSingle()
        settings = result.data
      } catch (dbError) {
        console.warn("Failed to fetch user settings:", dbError)
      }

      // 检查 API 配置
      const apiKey = settings?.video_api_key || process.env.VIDEO_API_KEY
      const baseUrl = settings?.video_base_url || process.env.VIDEO_BASE_URL

      if (!apiKey) {
        sendEvent('error', { error: '视频 API Key 未配置。请在设置页面或 .env 文件中配置 VIDEO_API_KEY' })
        controller.close()
        return
      }

      // 初始化客户端，增加超时时间
      const config = new Config({
        apiKey,
        baseUrl,
        timeout: 300000, // 300 秒超时
      })
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
      const client = new VideoGenerationClient(config, customHeaders)

      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: '',
        secretKey: '',
        bucketName: process.env.COZE_BUCKET_NAME,
        region: 'cn-beijing',
      })

      const videoModel = settings?.video_model || 'doubao-seedance-1-5-pro-251215'

      // 延迟函数
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

      // 生成单个视频
      const generateSingleVideo = async (scene: any, index: number) => {
        if (isAborted) {
          sendEvent('skipped', { sceneId: scene.id, sceneNumber: scene.scene_number })
          return null
        }

        sendEvent('progress', {
          current: index + 1,
          total: scenesWithImages.length,
          sceneId: scene.id,
          sceneNumber: scene.scene_number,
          title: scene.title,
          status: 'generating'
        })

        try {
          // 更新数据库状态
          await supabase
            .from('scenes')
            .update({ video_status: 'generating', updated_at: new Date().toISOString() })
            .eq('id', scene.id)

          // 获取图片URL
          const imageUrl = scene.image_url || await getImageUrl(scene, storage)
          if (!imageUrl) {
            throw new Error('无法获取分镜图片URL')
          }

          const contentItems: Content[] = [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
              role: 'first_frame',
            },
            {
              type: 'text',
              text: buildVideoPrompt(scene),
            },
          ]

          const duration = calculateDuration(scene)

          // 生成视频
          const response = await client.videoGeneration(contentItems, {
            model: videoModel,
            duration: duration,
            ratio: '16:9',
            resolution: '720p',
            returnLastFrame: mode === 'continuous',
            generateAudio: true,
          })

          if (response.videoUrl) {
            // 更新数据库
            await supabase
              .from('scenes')
              .update({
                video_url: response.videoUrl,
                last_frame_url: response.lastFrameUrl,
                video_status: 'completed',
                updated_at: new Date().toISOString(),
              })
              .eq('id', scene.id)

            sendEvent('completed', {
              sceneId: scene.id,
              sceneNumber: scene.scene_number,
              videoUrl: response.videoUrl,
              duration: duration,
            })

            return { success: true, lastFrameUrl: response.lastFrameUrl }
          } else {
            throw new Error('视频生成失败：未返回视频URL')
          }
        } catch (error: any) {
          // 更新失败状态
          await supabase
            .from('scenes')
            .update({ video_status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', scene.id)

          sendEvent('error', {
            sceneId: scene.id,
            sceneNumber: scene.scene_number,
            error: error.message || '未知错误',
          })

          return { success: false, error: error.message }
        }
      }

      // 顺序生成
      for (let i = 0; i < scenesWithImages.length; i++) {
        if (isAborted) break

        if (i > 0) {
          sendEvent('waiting', { message: '等待5秒后继续...', nextScene: i + 1 })
          await delay(5000)
        }

        await generateSingleVideo(scenesWithImages[i], i)
      }

      // 完成
      const completedCount = scenesWithImages.filter((s: any) => s.video_status === 'completed').length
      sendEvent('done', {
        total: scenesWithImages.length,
        completed: completedCount,
        failed: scenesWithImages.length - completedCount,
      })

      controller.close()
    },
    cancel() {
      isAborted = true
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
async function getImageUrl(scene: any, storage: S3Storage): Promise<string | null> {
  if (scene.image_url) return scene.image_url
  
  if (scene.image_key) {
    try {
      const signedUrl = await storage.generatePresignedUrl({
        key: scene.image_key,
        expireTime: 3600,
      })
      return typeof signedUrl === 'string' ? signedUrl : (signedUrl as any).url
    } catch {
      return null
    }
  }
  
  return null
}

function calculateDuration(scene: any): number {
  let duration = 6
  
  if (scene.dialogue) {
    const len = scene.dialogue.length
    if (len > 50) duration += 4
    else if (len > 30) duration += 3
    else if (len > 15) duration += 2
    else if (len > 0) duration += 1
  }
  
  if (scene.action && scene.action.length > 20) duration += 2
  else if (scene.action && scene.action.length > 0) duration += 1
  
  if (scene.description && scene.description.length > 100) duration += 1
  
  return Math.min(Math.max(duration, 6), 12)
}

function buildVideoPrompt(scene: any): string {
  const parts: string[] = []
  
  if (scene.description) parts.push(scene.description)
  if (scene.action) parts.push(scene.action)
  if (scene.dialogue) parts.push(`角色说道："${scene.dialogue}"`)
  if (scene.emotion) parts.push(`氛围：${scene.emotion}`)
  
  if (scene.metadata) {
    if (scene.metadata.shotType) parts.push(`景别：${scene.metadata.shotType}`)
    if (scene.metadata.cameraMovement) {
      const movementMap: Record<string, string> = {
        '固定': 'static camera',
        '推镜': 'slow zoom in',
        '拉镜': 'slow zoom out',
        '摇镜': 'panning shot',
        '跟拍': 'tracking shot',
      }
      parts.push(`镜头运动：${movementMap[scene.metadata.cameraMovement] || scene.metadata.cameraMovement}`)
    }
  }
  
  return parts.length > 0 ? parts.join('，') : '流畅的电影镜头，自然的光线变化，细腻的情感表达'
}
