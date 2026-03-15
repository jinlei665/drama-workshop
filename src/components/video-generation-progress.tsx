"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Loader2, 
  Pause, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Film,
  Image,
  Video,
  Sparkles
} from "lucide-react"

interface VideoGenerationProgressProps {
  total: number
  completed: number
  currentScene: number | null
  isPaused: boolean
  canPause: boolean
  onPause: () => void
  onCancel: () => void
}

interface SceneProgress {
  sceneId: string
  sceneNumber: number
  title: string | null
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'skipped'
  duration?: number
  error?: string
}

export function VideoGenerationProgress({
  total,
  completed,
  currentScene,
  isPaused,
  canPause,
  onPause,
  onCancel,
}: VideoGenerationProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  // 计时器
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (!isPaused && completed < total) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isPaused, completed, total])

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 计算进度百分比
  const progressPercent = total > 0 
    ? Math.round((completed / total) * 100) 
    : 0

  // 统计状态
  const pendingCount = total - completed

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'generating':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'skipped':
        return <Pause className="w-4 h-4 text-amber-500" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const isGenerating = completed < total

  return (
    <Card className="overflow-hidden border-2 border-primary/20 shadow-lg">
      {/* 顶部进度条 */}
      <div className="h-1 bg-secondary">
        <div 
          className="h-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">视频合成进度</CardTitle>
              <CardDescription>
                {isGenerating 
                  ? isPaused 
                    ? "已暂停" 
                    : "正在生成中..."
                  : progressPercent === 100 
                    ? "已完成" 
                    : "准备就绪"}
              </CardDescription>
            </div>
          </div>
          
          {/* 控制按钮 */}
          {isGenerating && (
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onPause} 
                className="gap-2"
                disabled={!canPause}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4" />
                    继续
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    暂停
                  </>
                )}
              </Button>
              <Button size="sm" variant="destructive" onClick={onCancel}>
                取消
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 统计信息 */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="text-2xl font-bold text-green-600">{completed}</div>
            <div className="text-xs text-muted-foreground">已完成</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">待生成</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-600">{currentScene || '-'}</div>
            <div className="text-xs text-muted-foreground">当前</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary border border-border">
            <div className="text-2xl font-bold text-foreground">{formatTime(elapsedTime)}</div>
            <div className="text-xs text-muted-foreground">耗时</div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">整体进度</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* 当前生成动画 */}
        {isGenerating && !isPaused && (
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-muted-foreground" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
              <Video className="w-5 h-5 text-primary" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
