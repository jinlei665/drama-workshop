import { NextRequest } from 'next/server'
import { sendExecutionEvent, getConnections } from '@/lib/workflow/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SSE/WebSocket 路由
 * 用于实时推送工作流执行状态
 * 支持 GET (SSE 连接) 和 POST (保持兼容性)
 */

/**
 * GET /api/workflow/ws
 * 建立 SSE 连接
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const executionId = url.searchParams.get('executionId')

  if (!executionId) {
    return new Response('Missing executionId parameter', { status: 400 })
  }

  const connections = getConnections()

  // 创建 SSE 响应
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // 保存 controller 以便后续发送事件
      connections.set(executionId, controller)

      // 发送连接成功事件
      const event = `data: ${JSON.stringify({ type: 'connected', executionId })}\n\n`
      controller.enqueue(encoder.encode(event))
      console.log('🔌 SSE 连接已建立:', executionId)

      // 设置心跳
      const heartbeatInterval = setInterval(() => {
        const event = `: heartbeat\n\n`
        try {
          controller.enqueue(encoder.encode(event))
        } catch (error) {
          console.error('心跳发送失败:', error)
          clearInterval(heartbeatInterval)
          connections.delete(executionId)
        }
      }, 30000)

      // 将 interval 保存到 controller，以便 cancel 时清理
      ;(controller as any)._heartbeatInterval = heartbeatInterval
    },

    cancel(reason) {
      console.log('🔌 SSE 连接已关闭:', executionId, reason)
      // 清理心跳
      const interval = (this as any)?._heartbeatInterval
      if (interval) {
        clearInterval(interval)
      }
      connections.delete(executionId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    },
  })
}

/**
 * POST /api/workflow/ws
 * 兼容某些客户端可能发送 POST 请求
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const executionId = url.searchParams.get('executionId')

  if (!executionId) {
    return new Response('Missing executionId parameter', { status: 400 })
  }

  // 返回提示信息，建议使用 GET 方法
  return new Response(JSON.stringify({
    error: 'Use GET method for SSE connection',
    executionId,
    message: 'Please establish SSE connection using GET request with EventSource'
  }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Allow': 'GET',
    },
  })
}
