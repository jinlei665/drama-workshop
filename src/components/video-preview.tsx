/**
 * 视频预览组件
 * 支持本地路径和 OSS URL 的视频预览，带文件存在性检查
 */

'use client'

import { useState } from 'react'
import { Play, AlertCircle, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface VideoPreviewProps {
  url: string
  title?: string
  onError?: () => void
}

export function VideoPreview({ url, title, onError }: VideoPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [videoAvailable, setVideoAvailable] = useState(false)

  // 检查视频是否可用
  const checkVideoAvailability = async () => {
    setIsLoading(true)
    setHasError(false)
    
    try {
      // 使用 HEAD 请求检查文件是否存在
      const response = await fetch(url, { 
        method: 'HEAD',
        cache: 'no-cache'
      })
      
      if (response.ok) {
        setVideoAvailable(true)
        setHasError(false)
      } else {
        setVideoAvailable(false)
        setHasError(true)
        onError?.()
      }
    } catch (error) {
      console.error('[VideoPreview] 检查视频可用性失败:', error)
      setVideoAvailable(false)
      setHasError(true)
      onError?.()
    } finally {
      setIsLoading(false)
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
      toast.error('视频下载失败')
    }
  }

  // 复制视频链接
  const handleCopyLink = async () => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
    await navigator.clipboard.writeText(fullUrl)
    toast.success('链接已复制到剪贴板')
  }

  // 初始检查
  if (isLoading && !videoAvailable && !hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-lg">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>检查视频可用性...</span>
        </div>
      </div>
    )
  }

  // 视频不可用
  if (hasError || !videoAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-lg">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-muted-foreground mb-4">视频不可用</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={checkVideoAvailability}>
            重新检查
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            下载视频
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          视频可能未正确生成，请尝试重新合成
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <video
        src={url}
        controls
        autoPlay
        className="w-full h-full object-contain"
        onError={() => {
          setHasError(true)
          setVideoAvailable(false)
          onError?.()
        }}
        onCanPlay={() => {
          setIsLoading(false)
          setHasError(false)
        }}
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
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
