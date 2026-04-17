/**
 * 视频预览组件
 * 支持本地路径、代理路径和 OSS URL 的视频预览
 */

'use client'

import { useState, useRef } from 'react'
import { AlertCircle, Download, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface VideoPreviewProps {
  url: string
  title?: string
  onError?: () => void
}

export function VideoPreview({ url, title, onError }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    console.error('[VideoPreview] 视频加载失败:', url)
    setHasError(true)
    setIsLoading(false)
    onError?.()
  }

  const handleCanPlay = () => {
    setHasError(false)
    setIsLoading(false)
  }

  const handleRetry = () => {
    setHasError(false)
    setIsLoading(true)
    if (videoRef.current) {
      videoRef.current.load()
    }
  }

  // 下载视频
  const handleDownload = () => {
    if (!url) return
    // 代理路径直接在新窗口打开，浏览器会下载
    // OSS 直链也在新窗口打开
    window.open(url, '_blank')
  }

  // 复制视频链接
  const handleCopyLink = async () => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
    await navigator.clipboard.writeText(fullUrl)
    toast.success('链接已复制到剪贴板')
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-lg">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-muted-foreground mb-2">视频播放失败</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RefreshCw className="w-4 h-4 mr-1" />
            重试
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            下载
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <ExternalLink className="w-4 h-4 mr-1" />
            复制链接
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        src={url}
        controls
        autoPlay
        className="w-full h-full object-contain"
        onError={handleError}
        onCanPlay={handleCanPlay}
        onLoadStart={() => setIsLoading(true)}
      />
      {title && (
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
          <span className="bg-black/50 text-white text-xs px-2 py-1 rounded">
            {title}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
              onClick={handleCopyLink}
              title="复制链接"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
              onClick={handleDownload}
              title="下载"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
