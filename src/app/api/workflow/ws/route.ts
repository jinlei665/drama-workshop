import { NextRequest } from 'next/server'
import { sendExecutionEvent, getConnections } from '@/lib/workflow/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * WebSocket 路由
 * 用于实时推送工作流执行状态
 */

/**
 * GET /api/workflow/ws
 * 升级为 WebSocket 连接
 */
export async function GET(request: NextRequest) {
  // Next.js App Router 不直接支持 WebSocket
  // 需要使用自定义服务器或 server-sent-events (SSE)
  // 这里我们改用 SSE 实现

  const url = new URL(request.url)
  const executionId = url.searchParams.get('executionId')

  if (!executionId) {
    return new Response('Missing executionId parameter', { status: 400 })
  }

  const connections = getConnections()

  // 创建 SSE 响应
  const encoder = new TextEncoder()

  let heartbeatInterval: NodeJS.Timeout

  const stream = new ReadableStream({
    start(controller) {
      // 保存 controller 以便后续发送事件
      connections.set(executionId, controller)

      // 发送连接成功事件
      const event = `data: ${JSON.stringify({ type: 'connected', executionId })}\n\n`
      controller.enqueue(encoder.encode(event))

      // 设置心跳
      heartbeatInterval = setInterval(() => {
        const event = `: heartbeat\n\n`
        try {
          controller.enqueue(encoder.encode(event))
        } catch (error) {
          clearInterval(heartbeatInterval)
          connections.delete(executionId)
        }
      }, 30000)
    },

    cancel() {
      // 清理资源
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
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
    },
  })
}
