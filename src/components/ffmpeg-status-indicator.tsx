/**
 * FFmpeg 状态指示器
 * 显示 FFmpeg 配置状态
 */

'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface FFmpegStatus {
  available: boolean
  ffmpegPath?: string
  version?: string
  customPath?: string | null
  error?: string
}

export function FFmpegStatusIndicator() {
  const [status, setStatus] = useState<FFmpegStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/ffmpeg')
        const data = await res.json()
        setStatus(data.data || data)
      } catch {
        setStatus({ available: false, error: '检测失败' })
      } finally {
        setLoading(false)
      }
    }
    checkStatus()
  }, [])

  if (loading) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        FFmpeg...
      </span>
    )
  }

  if (status?.available) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle className="w-3.5 h-3.5" />
        FFmpeg {status.version || ''}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <AlertCircle className="w-3.5 h-3.5" />
      {status?.error || 'FFmpeg 未配置'}
    </span>
  )
}
