/**
 * API 响应工具函数
 * 统一 API 响应格式和错误处理
 */

import { NextResponse } from 'next/server'
import { AppError, Errors, logger, type ErrorType, type ErrorCode } from '@/lib/errors'

/** API 响应格式 */
interface APIResponse<T> {
  success: boolean
  data?: T
  error?: {
    type: ErrorType
    code: ErrorCode
    message: string
    details?: unknown
  }
}

/** 成功响应 */
export function successResponse<T>(data: T, status = 200): NextResponse<APIResponse<T>> {
  return NextResponse.json(
    { success: true, data },
    { status }
  )
}

/** 错误响应 */
export function errorResponse(error: unknown, status?: number): NextResponse<APIResponse<never>> {
  // 已知的 AppError
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          type: error.type,
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: status || error.statusCode }
    )
  }

  // 未知错误
  logger.error('Unhandled API error', error)
  
  return NextResponse.json(
    {
      success: false,
      error: {
        type: 'internal' as ErrorType,
        code: 'UNKNOWN_ERROR' as ErrorCode,
        message: '服务器内部错误',
      },
    },
    { status: status || 500 }
  )
}

/** 包装 API 处理函数 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): () => Promise<NextResponse<T | APIResponse<never>>> {
  return async () => {
    try {
      return await handler()
    } catch (error) {
      return errorResponse(error)
    }
  }
}

/** 验证请求参数 */
export function validateRequired(params: Record<string, unknown>, fields: string[]): void {
  const missing = fields.filter(field => params[field] === undefined || params[field] === null || params[field] === '')
  if (missing.length > 0) {
    throw Errors.ValidationError(`缺少必需参数: ${missing.join(', ')}`)
  }
}

/** 从请求中获取 JSON 参数 */
export async function getJSON<T>(request: Request): Promise<T> {
  try {
    return await request.json()
  } catch {
    throw Errors.ValidationError('无效的 JSON 格式')
  }
}

/** 从请求中获取查询参数 */
export function getQueryParams(request: Request): URLSearchParams {
  const url = new URL(request.url)
  return url.searchParams
}

/** 分页参数 */
export interface PaginationParams {
  page: number
  pageSize: number
  offset: number
}

/** 解析分页参数 */
export function parsePagination(params: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(params.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '20', 10)))
  const offset = (page - 1) * pageSize

  return { page, pageSize, offset }
}
