/**
 * 模型配置状态指示器
 * 显示当前使用的模型配置状态
 */

'use client'

import { CheckCircle, AlertCircle } from 'lucide-react'
import { useModelConfig } from '@/lib/model-config'

export function ModelConfigStatus() {
  const { loading, isConfigured, hasCustomConfig } = useModelConfig()

  if (loading) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {hasCustomConfig ? (
        <span className="flex items-center gap-1 text-green-400">
          <CheckCircle className="w-3.5 h-3.5" />
          自定义配置
        </span>
      ) : isConfigured ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <CheckCircle className="w-3.5 h-3.5" />
          系统模型
        </span>
      ) : (
        <span className="flex items-center gap-1 text-amber-400">
          <AlertCircle className="w-3.5 h-3.5" />
          未配置
        </span>
      )}
    </div>
  )
}
