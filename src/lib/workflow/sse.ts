import { ReadableStreamDefaultController } from 'stream/web'

// 使用全局变量存储 SSE 连接（确保跨请求共享）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = global as any
if (!g.workflowSseConnections) {
  g.workflowSseConnections = new Map<string, ReadableStreamDefaultController>()
}
const connections = g.workflowSseConnections

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
      console.log(`[SSE] 事件已发送: ${event.type} -> ${executionId}`)
    } catch (error) {
      console.error('[SSE] Error sending event:', error)
      connections.delete(executionId)
    }
  } else {
    console.warn(`[SSE] 连接不存在: ${executionId}, 当前连接:`, Array.from(connections.keys()))
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

/**
 * 获取连接存储
 */
export function getConnections() {
  return connections
}
