/**
 * 视频合并面板组件
 * 允许用户选择多个视频片段并合并成一个完整视频
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Film,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Settings,
  ChevronDown,
  ChevronUp,
  Play,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'

interface Scene {
  id: string
  sceneNumber: number
  title: string | null
  videoUrl: string | null
  videoStatus?: string | null
}

interface Episode {
  id: string
  season_number: number
  episode_number: number
  title: string
  description: string | null
  merged_video_url: string | null
  sceneCount?: number
}

interface FFmpegStatus {
  configured: boolean
  version?: string
  path?: string
  error?: string
}

interface VideoMergePanelProps {
  projectId: string
  scenes: Scene[]
  onVideoAddedToEpisode?: () => void
}

export function VideoMergePanel({ projectId, scenes, onVideoAddedToEpisode }: VideoMergePanelProps) {
  const [ffmpegStatus, setFfmpegStatus] = useState<FFmpegStatus | null>(null)
  const [checkingFfmpeg, setCheckingFfmpeg] = useState(true)
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    url: string
    filename: string
    duration: number
  } | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [addToEpisodeOpen, setAddToEpisodeOpen] = useState(false)
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [addingToEpisode, setAddingToEpisode] = useState(false)

  // 获取有视频的分镜
  const videoScenes = scenes.filter(s => s.videoStatus === 'completed' && s.videoUrl)

  // 获取剧集列表
  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        const res = await fetch(`/api/episodes?projectId=${projectId}`)
        const data = await res.json()
        if (data.episodes) {
          setEpisodes(data.episodes)
        }
      } catch (error) {
        console.error('获取剧集列表失败:', error)
      }
    }
    if (projectId) {
      fetchEpisodes()
    }
  }, [projectId])
  
  // 检测 FFmpeg
  useEffect(() => {
    const checkFfmpeg = async () => {
      try {
        const res = await fetch('/api/ffmpeg')
        const data = await res.json()
        setFfmpegStatus(data.data || data)
      } catch {
        setFfmpegStatus({ configured: false, error: '检测失败' })
      } finally {
        setCheckingFfmpeg(false)
      }
    }
    checkFfmpeg()
  }, [])

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedScenes.size === videoScenes.length) {
      setSelectedScenes(new Set())
    } else {
      setSelectedScenes(new Set(videoScenes.map(s => s.id)))
    }
  }

  // 切换单个选择
  const handleToggleScene = (sceneId: string) => {
    const newSelected = new Set(selectedScenes)
    if (newSelected.has(sceneId)) {
      newSelected.delete(sceneId)
    } else {
      newSelected.add(sceneId)
    }
    setSelectedScenes(newSelected)
  }

  // 合并视频
  const handleMerge = async () => {
    if (selectedScenes.size === 0) {
      toast.error('请选择要合并的视频')
      return
    }

    if (!ffmpegStatus?.configured) {
      toast.error('FFmpeg 未配置，请先在设置中配置')
      setSettingsOpen(true)
      return
    }

    setMerging(true)
    setProgress(0)
    setResult(null)

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90))
      }, 500)

      const res = await fetch('/api/videos/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sceneIds: Array.from(selectedScenes),
          outputName: `merged_${projectId}_${Date.now()}.mp4`
        })
      })

      clearInterval(progressInterval)
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.needConfig) {
          toast.error('FFmpeg 未配置，请先在设置中配置')
          setSettingsOpen(true)
        } else {
          throw new Error(data.error || '合并失败')
        }
        return
      }

      setProgress(100)
      setResult(data.data || data)
      toast.success(`合并完成！共 ${data.sceneCount} 个视频，时长 ${data.duration?.toFixed(1) || 0} 秒`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '合并失败')
    } finally {
      setMerging(false)
    }
  }

  // 下载合并后的视频
  const handleDownload = async () => {
    if (!result?.url) return

    try {
      const response = await fetch(result.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('下载失败')
    }
  }

  // 添加至剧集
  const handleAddToEpisode = async () => {
    if (!selectedEpisodeId || !result?.url) return

    setAddingToEpisode(true)
    try {
      const res = await fetch(`/api/episodes/${selectedEpisodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mergedVideoUrl: result.url,
          mergedVideoStatus: 'completed'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '添加失败')
      }

      toast.success('已添加到剧集')
      setAddToEpisodeOpen(false)
      setSelectedEpisodeId(null)
      // 刷新剧集列表
      const episodesRes = await fetch(`/api/episodes?projectId=${projectId}`)
      const episodesData = await episodesRes.json()
      if (episodesData.episodes) {
        setEpisodes(episodesData.episodes)
      }
      onVideoAddedToEpisode?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败')
    } finally {
      setAddingToEpisode(false)
    }
  }

  if (videoScenes.length === 0) {
    return null
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Film className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">视频合并</CardTitle>
                <CardDescription>
                  选择多个视频片段，合并成一个完整视频
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* FFmpeg 状态 */}
              {checkingFfmpeg ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  检测中
                </Badge>
              ) : ffmpegStatus?.configured ? (
                <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                  <CheckCircle className="w-3 h-3" />
                  FFmpeg 可用
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/30">
                  <AlertCircle className="w-3 h-3" />
                  FFmpeg 未配置
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-4">
            {/* FFmpeg 未配置提示 */}
            {!checkingFfmpeg && !ffmpegStatus?.configured && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">FFmpeg 未配置</p>
                  <p className="text-xs text-muted-foreground">
                    视频合并功能需要 FFmpeg，请先在设置中配置
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  配置
                </Button>
              </div>
            )}

            {/* 视频选择 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">选择视频片段</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedScenes.size === videoScenes.length ? '取消全选' : '全选'}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {videoScenes.map((scene) => (
                  <div
                    key={scene.id}
                    onClick={() => handleToggleScene(scene.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleToggleScene(scene.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left cursor-pointer ${
                      selectedScenes.has(scene.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedScenes.has(scene.id)}
                      onChange={() => {}}
                      className="pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        分镜 {scene.sceneNumber}
                      </p>
                      {scene.title && (
                        <p className="text-xs text-muted-foreground truncate">
                          {scene.title}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                已选择 {selectedScenes.size} / {videoScenes.length} 个视频
              </p>
            </div>

            {/* 合并进度 */}
            {merging && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>合并中...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {/* 合并结果 */}
            {result && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">合并完成</p>
                    <p className="text-xs text-muted-foreground">
                      文件: {result.filename} | 时长: {result.duration?.toFixed(1) || 0}s
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    预览
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                onClick={handleMerge}
                disabled={merging || selectedScenes.size === 0 || !ffmpegStatus?.configured}
                className="flex-1"
              >
                {merging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    合并中...
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4 mr-2" />
                    合并视频 ({selectedScenes.size})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 设置对话框 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>FFmpeg 配置</DialogTitle>
            <DialogDescription>
              配置 FFmpeg 路径以启用视频合并功能
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              请在「设置」页面中配置 FFmpeg 路径，或确保系统环境变量中已安装 FFmpeg。
            </p>
            <Button
              onClick={() => {
                setSettingsOpen(false)
                // 导航到设置页面
                window.location.href = '/settings'
              }}
            >
              前往设置
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 视频预览对话框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>视频预览</DialogTitle>
            <DialogDescription>
              {result?.filename} | 时长: {result?.duration?.toFixed(1) || 0}s
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {result?.url && (
              <video
                src={result.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error('Merged video playback error:', result?.url?.substring(0, 50))
                }}
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setAddToEpisodeOpen(true)
              }}
              disabled={episodes.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加至剧集
            </Button>
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              下载视频
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 添加至剧集对话框 */}
      <Dialog open={addToEpisodeOpen} onOpenChange={setAddToEpisodeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加至剧集</DialogTitle>
            <DialogDescription>
              选择要将视频添加到的剧集
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-64 overflow-y-auto">
            {episodes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无剧集，请先创建剧集
              </p>
            ) : (
              episodes.map((episode) => (
                <button
                  key={episode.id}
                  onClick={() => setSelectedEpisodeId(episode.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedEpisodeId === episode.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        第 {episode.season_number} 季 第 {episode.episode_number} 集
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {episode.title || '未命名剧集'}
                      </p>
                    </div>
                    {episode.merged_video_url && (
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        已有视频
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddToEpisodeOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleAddToEpisode} 
              disabled={!selectedEpisodeId || addingToEpisode}
            >
              {addingToEpisode ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  添加中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  确认添加
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
