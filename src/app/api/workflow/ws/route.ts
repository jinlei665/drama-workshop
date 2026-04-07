import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * WebSocket 路由
 * 用于实时推送工作流执行状态
 */

// 存储活跃的 WebSocket 连接
const connections = new Map<string, WebSocket>()

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

  // 创建 SSE 响应
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // 保存 controller 以便后续发送事件
      connections.set(executionId, controller as any)

      // 发送连接成功事件
      const event = `data: ${JSON.stringify({ type: 'connected', executionId })}\n\n`
      controller.enqueue(encoder.encode(event))

      // 设置心跳
      const heartbeat = setInterval(() => {
        const event = `: heartbeat\n\n`
        try {
          controller.enqueue(encoder.encode(event))
        } catch (error) {
          clearInterval(heartbeat)
        }
      }, 30000)

      // 清理函数
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        connections.delete(executionId)
        try {
          controller.close()
        } catch (error) {
          console.error('Error closing stream:', error)
        }
      })
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

/**
 * 发送执行事件到客户端
 */
export function sendExecutionEvent(executionId: string, event: any) {
  const controller = connections.get(executionId)
  if (controller) {
    const encoder = new TextEncoder()
    const data = `data: ${JSON.stringify(event)}\n\n`
    try {
      controller.enqueue(encoder.encode(data))
    } catch (error) {
      console.error('Error sending event:', error)
      connections.delete(executionId)
    }
  }
}

/**
 * 关闭执行连接
 */
export function closeExecutionConnection(executionId: string) {
  const controller = connections.get(executionId)
  if (controller) {
    try {
      controller.close()
    } catch (error) {
      console.error('Error closing connection:', error)
    }
    connections.delete(executionId)
  }
}
