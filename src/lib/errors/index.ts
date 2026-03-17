/**
 * 统一错误处理
 * 提供一致的错误处理机制
 */

import { ApiError, ApiResponse } from '@/lib/types'

/** 错误类型 */
export type ErrorType = 'validation' | 'auth' | 'database' | 'ai' | 'storage' | 'workflow' | 'internal'

/** 错误代码 */
export type ErrorCode = 
  | 'UNKNOWN_ERROR'
  | 'INVALID_INPUT'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'DATABASE_ERROR'
  | 'AI_CONFIG_MISSING'
  | 'AI_REQUEST_FAILED'
  | 'AI_RESPONSE_INVALID'
  | 'AI_TIMEOUT'
  | 'STORAGE_ERROR'
  | 'FILE_NOT_FOUND'
  | 'WORKFLOW_ERROR'
  | 'DEPENDENCY_ERROR'

/** 自定义应用错误 */
export class AppError extends Error {
  code: ErrorCode
  statusCode: number
  details?: Record<string, unknown>
  type: ErrorType

  constructor(message: string, code: ErrorCode = 'UNKNOWN_ERROR', statusCode: number = 500, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.type = getErrorType(code)
  }
}

/** 获取错误类型 */
function getErrorType(code: ErrorCode): ErrorType {
  if (code.startsWith('AI_')) return 'ai'
  if (code === 'DATABASE_ERROR') return 'database'
  if (code.startsWith('STORAGE_') || code === 'FILE_NOT_FOUND') return 'storage'
  if (code.startsWith('WORKFLOW_') || code === 'DEPENDENCY_ERROR') return 'workflow'
  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return 'auth'
  if (code === 'INVALID_INPUT' || code === 'VALIDATION_ERROR') return 'validation'
  return 'internal'
}

/** 预定义错误 */
export const Errors = {
  // 通用错误
  Unknown: (message = '未知错误') => new AppError(message, 'UNKNOWN_ERROR', 500),
  InvalidInput: (message = '输入参数无效', details?: Record<string, unknown>) => 
    new AppError(message, 'INVALID_INPUT', 400, details),
  ValidationError: (message = '数据验证失败', details?: Record<string, unknown>) => 
    new AppError(message, 'VALIDATION_ERROR', 400, details),
  NotFound: (resource = '资源') => new AppError(`${resource}不存在`, 'NOT_FOUND', 404),
  Unauthorized: () => new AppError('未授权访问', 'UNAUTHORIZED', 401),
  Forbidden: () => new AppError('禁止访问', 'FORBIDDEN', 403),
  
  // 数据库错误
  DatabaseError: (message = '数据库操作失败', details?: Record<string, unknown>) => 
    new AppError(message, 'DATABASE_ERROR', 500, details),
  
  // AI 服务错误
  AIConfigMissing: (service: string) => 
    new AppError(`${service} API 未配置`, 'AI_CONFIG_MISSING', 500),
  AIRequestFailed: (service: string, reason?: string) => 
    new AppError(`${service} API 请求失败: ${reason || '未知原因'}`, 'AI_REQUEST_FAILED', 502),
  AIResponseInvalid: (service: string) => 
    new AppError(`${service} API 返回数据无效`, 'AI_RESPONSE_INVALID', 502),
  AITimeout: (service: string) => 
    new AppError(`${service} API 请求超时`, 'AI_TIMEOUT', 504),
  
  // 存储错误
  StorageError: (message = '存储操作失败') => new AppError(message, 'STORAGE_ERROR', 500),
  FileNotFound: (file: string) => new AppError(`文件不存在: ${file}`, 'FILE_NOT_FOUND', 404),
  
  // 工作流错误
  WorkflowError: (node: string, reason: string) => 
    new AppError(`工作流节点 ${node} 执行失败: ${reason}`, 'WORKFLOW_ERROR', 500),
  DependencyError: (node: string, dependency: string) => 
    new AppError(`节点 ${node} 依赖 ${dependency} 未完成`, 'DEPENDENCY_ERROR', 400),
} as const

/** 判断是否为 AppError */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/** 转换错误为 ApiError */
export function toApiError(error: unknown): ApiError {
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    }
  }
  
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
    }
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
  }
}

/** 创建成功响应 */
export function success<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  }
}

/** 创建错误响应 */
export function error(err: unknown): ApiResponse {
  return {
    success: false,
    error: toApiError(err),
  }
}

/** 安全执行函数，捕获异常 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const data = await fn()
    return { data }
  } catch (err) {
    return { error: toApiError(err) }
  }
}

/** 带重试的执行 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    delay?: number
    backoff?: boolean
    shouldRetry?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    shouldRetry = (err) => {
      // 超时和网络错误自动重试
      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        return msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset')
      }
      return false
    }
  } = options

  let lastError: unknown
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      
      if (attempt < maxRetries && shouldRetry(err)) {
        const waitTime = backoff ? delay * attempt : delay
        console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed, waiting ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        throw err
      }
    }
  }
  
  throw lastError
}

/** 日志工具 */
export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, data || '')
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, data || '')
  },
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, error || '')
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} ${message}`, data || '')
    }
  }
}
