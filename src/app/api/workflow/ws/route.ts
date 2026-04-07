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
