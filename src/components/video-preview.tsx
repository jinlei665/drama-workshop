/**
 * 视频预览组件
 * 支持本地路径和 OSS URL 的视频预览
 * 对于跨域资源，直接使用 video 标签播放，依赖 video.error 事件处理错误
 */

'use client'

import { useState, useRef, useEffect } from 'react'
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

  // 处理视频加载错误
  const handleError = () => {
    console.error('[VideoPreview] 视频加载失败:', url)
    setHasError(true)
    setIsLoading(false)
    onError?.()
  }

  // 处理视频加载成功
  const handleCanPlay = () => {
    setHasError(false)
    setIsLoading(false)
  }

  // 重新尝试播放
  const handleRetry = () => {
    setHasError(false)
    setIsLoading(true)
    if (videoRef.current) {
      videoRef.current.load()
    }
  }

  // 下载视频
  const handleDownload = async () => {
    if (!url) return
    
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = url.split('/').pop() || 'video.mp4'
      link.click()
      window.URL.revokeObjectURL(blobUrl)
      toast.success('视频下载成功')
    } catch (error) {
      console.error('[VideoPreview] 下载失败:', error)
      toast.error('视频下载失败，请尝试直接点击链接下载')
    }
  }

  // 复制视频链接
  const handleCopyLink = async () => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
    await navigator.clipboard.writeText(fullUrl)
    toast.success('链接已复制到剪贴板')
  }

  // 视频不可用或加载中
  if (hasError || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-lg">
        {isLoading && !hasError ? (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">正在加载视频...</p>
          </>
        ) : (
          <>
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-muted-foreground mb-2">视频播放失败</p>
            <p className="text-xs text-muted-foreground mb-4 text-center px-4">
              可能是跨域问题或视频文件不存在
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-1" />
                重新播放
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                下载视频
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <ExternalLink className="w-4 h-4 mr-1" />
                复制链接
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <video
        ref={videoRef}
        src={url}
        controls
        autoPlay
        crossOrigin="anonymous"
        className="w-full h-full object-contain"
        onError={handleError}
        onCanPlay={handleCanPlay}
        onLoadStart={() => setIsLoading(true)}
      />
      {/* 工具栏 */}
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
              title="下载视频"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
