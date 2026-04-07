import { ReadableStreamDefaultController } from 'stream/web'

// 存储活跃的 SSE 连接
const connections = new Map<string, ReadableStreamDefaultController>()

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

/**
 * 获取连接存储
 */
export function getConnections() {
  return connections
}
