"use client"

import { useState, useEffect, use, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Users,
  Image,
  Play,
  Loader2,
  Sparkles,
  Video,
  ZoomIn,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Film,
  Pause,
  SkipBack,
  SkipForward,
  Package,
  FolderOpen,
  Settings,
  Info,
  Upload
} from "lucide-react"
import { toast } from "sonner"
import { CharactersPanel } from "./characters-panel"
import { ScenesPanel } from "./scenes-panel"
import { EpisodesPanel } from "./episodes-panel-new"
import { VideoGenerationProgress } from "@/components/video-generation-progress"
import { VideoMergePanel } from "@/components/video-merge-panel"
import { ModelConfigProvider } from "@/lib/model-config"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Project {
  id: string
  name: string
  description: string | null
  sourceContent: string
  sourceType: string
  status: string
  createdAt: string
  updatedAt?: string
}

interface Character {
  id: string
  name: string
  description: string | null
  appearance: string | null
  personality: string | null
  frontViewKey?: string | null
  sideViewKey?: string | null
  backViewKey?: string | null
  tags: string[]
  status?: string
  imageUrl?: string
}

interface Scene {
  id: string
  sceneNumber: number
  title: string | null
  description: string
  dialogue: string | null
  action: string | null
  emotion: string | null
  characterIds: string[]
  scriptId: string | null
  imageKey?: string | null
  imageUrl: string | null
  videoUrl: string | null
  videoStatus?: string
  status: string
  metadata: {
    shotType?: string
    cameraMovement?: string
  } | null
}

interface Episode {
  id: string
  season_number: number
  episode_number: number
  title: string
  description: string | null
  merged_video_url: string | null
  merged_video_status: string
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [scripts, setScripts] = useState<any[]>([])
  const [selectedPreviewScriptId, setSelectedPreviewScriptId] = useState<string | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatingVideos, setGeneratingVideos] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoMode, setVideoMode] = useState<'fast' | 'continuous'>('continuous')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [videoGenerationSession, setVideoGenerationSession] = useState<{
    isGenerating: boolean
    total: number
    completed: number
    currentScene: number | null
    canPause: boolean
    isPaused: boolean
  }>({
    isGenerating: false,
    total: 0,
    completed: 0,
    currentScene: null,
    canPause: false,
    isPaused: false
  })
  const [videoGenerateConfirmDialogOpen, setVideoGenerateConfirmDialogOpen] = useState(false)
  const [pendingVideoMode, setPendingVideoMode] = useState<'fast' | 'continuous'>('continuous')
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      const data = await res.json()

      if (!res.ok) {
        // 正确处理错误对象
        const errorMsg = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || "获取项目失败")
        throw new Error(errorMsg)
      }

      // API 返回 { success: true, data: { project, characters, scenes } }
      const responseData = data.success ? data.data : data
      setProject(responseData.project)
      setCharacters(responseData.characters || [])
      setScenes(responseData.scenes || [])

      // 获取剧集列表
      try {
        const episodesRes = await fetch(`/api/episodes?projectId=${id}`)
        if (episodesRes.ok) {
          const episodesData = await episodesRes.json()
          setEpisodes(episodesData.episodes || [])
        }
      } catch (err) {
        console.error("获取剧集列表失败:", err)
      }

      // 获取脚本列表
      try {
        const scriptsRes = await fetch(`/api/scripts?projectId=${id}`)
        if (scriptsRes.ok) {
          const scriptsData = await scriptsRes.json()
          setScripts(scriptsData.scripts || [])

          // 默认选择"默认脚本"
          if (!selectedPreviewScriptId && scriptsData.scripts && scriptsData.scripts.length > 0) {
            const defaultScript = scriptsData.scripts.find((s: any) => s.title === '默认脚本')
            if (defaultScript) {
              setSelectedPreviewScriptId(defaultScript.id)
            } else {
              setSelectedPreviewScriptId(scriptsData.scripts[0].id)
            }
          }
        }
      } catch (err) {
        console.error("获取脚本列表失败:", err)
      }
    } catch (error) {
      console.error("获取项目失败:", error)
      toast.error(error instanceof Error ? error.message : "获取项目失败")
      router.push("/")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  // 批量生成分镜图片
  const handleBatchGenerate = async () => {
    if (characters.length === 0) {
      toast.error("请先添加人物")
      return
    }
    if (scenes.length === 0) {
      toast.error("请先添加分镜")
      return
    }

    setGenerating(true)
    try {
      const res = await fetch("/api/generate/batch-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id })
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "生成失败")
      }

      toast.success(`生成完成！成功 ${data.results.filter((r: any) => r.status === "completed").length} 个`)
      fetchData()
    } catch (error) {
      console.error("批量生成失败:", error)
      toast.error("批量生成失败")
    } finally {
      setGenerating(false)
    }
  }

  // 生成视频片段（使用流式API）
  const handleGenerateVideos = async (mode: 'fast' | 'continuous' = 'continuous') => {
    if (completedScenes.length === 0) {
      toast.error("请先生成分镜图片")
      return
    }

    // 打开确认对话框
    setPendingVideoMode(mode)
    setVideoGenerateConfirmDialogOpen(true)
  }

  // 确认批量生成视频
  const handleConfirmGenerateVideos = async () => {
    setVideoGenerateConfirmDialogOpen(false)
    setVideoGenerationSession({
      isGenerating: true,
      total: completedScenes.length,
      completed: 0,
      currentScene: null,
      canPause: false,
      isPaused: false
    })

    try {
      const res = await fetch("/api/generate/videos-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, mode: pendingVideoMode, episodeId: selectedEpisodeId })
      })
      
      if (!res.ok) {
        throw new Error("视频生成请求失败")
      }
      
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error("无法读取响应流")
      }
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'progress') {
                setVideoGenerationSession(prev => ({
                  ...prev,
                  completed: data.completed,
                  currentScene: data.sceneNumber,
                  canPause: data.canPause || false
                }))
              } else if (data.type === 'error') {
                toast.error(`分镜 ${data.sceneNumber} 生成失败: ${data.error}`)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
      toast.success("视频生成完成")
      fetchData()
    } catch (error) {
      console.error("视频生成失败:", error)
      toast.error(error instanceof Error ? error.message : "视频生成失败")
    } finally {
      setVideoGenerationSession({
        isGenerating: false,
        total: 0,
        completed: 0,
        currentScene: null,
        canPause: false,
        isPaused: false
      })
    }
  }

  // 暂停/继续视频生成
  const handlePauseVideoGeneration = async () => {
    try {
      const res = await fetch("/api/generate/videos-stream", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: videoGenerationSession.isPaused ? "resume" : "pause" })
      })
      
      if (res.ok) {
        setVideoGenerationSession(prev => ({ ...prev, isPaused: !prev.isPaused }))
        toast.success(videoGenerationSession.isPaused ? "已继续生成" : "已暂停生成")
      }
    } catch (error) {
      toast.error("操作失败")
    }
  }

  // 取消视频生成
  const handleCancelVideoGeneration = async () => {
    try {
      const res = await fetch("/api/generate/videos-stream", {
        method: "DELETE"
      })
      
      if (res.ok) {
        setVideoGenerationSession({
          isGenerating: false,
          total: 0,
          completed: 0,
          currentScene: null,
          canPause: false,
          isPaused: false
        })
        toast.success("已取消生成")
      }
    } catch (error) {
      toast.error("取消失败")
    }
  }

  // 导出项目
  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/projects/${id}/export`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "导出失败")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${project?.name || 'project'}_export.zip`
      link.click()
      window.URL.revokeObjectURL(url)

      toast.success("项目导出成功")
    } catch (error) {
      console.error("导出项目失败:", error)
      toast.error(error instanceof Error ? error.message : "导出项目失败")
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return null
  }

  // 获取已完成图片的分镜（根据选中的脚本过滤）
  const completedScenes = scenes
    .filter(s => s.status === "completed")
    .filter(s => !selectedPreviewScriptId || s.scriptId === selectedPreviewScriptId)
  completedScenes.sort((a, b) => a.sceneNumber - b.sceneNumber)
  // 获取已完成视频的分镜
  const videoScenes = completedScenes.filter(s => s.videoStatus === "completed")
  const pendingVideoScenes = completedScenes.filter(s => s.videoStatus === "pending" || s.videoStatus === "failed")

  return (
    <ModelConfigProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold">{project.name}</h1>
                {project.description && (
                  <button
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    <span className={descriptionExpanded ? "" : "line-clamp-1"}>
                      {project.description}
                    </span>
                    {project.description.length > 50 && (
                      descriptionExpanded ? (
                        <ChevronUp className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      )
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1">
                <Users className="w-3 h-3" />
                {characters.length} 人物
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Video className="w-3 h-3" />
                {scenes.length} 分镜
              </Badge>
              {/* 项目状态 */}
              {project.status === 'analyzing' && (
                <Badge className="bg-blue-500 text-white gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  分析中
                </Badge>
              )}
              {project.status === 'ready' && (
                <Badge className="bg-green-500 text-white">已就绪</Badge>
              )}
              {project.status === 'generating' && (
                <Badge className="bg-amber-500 text-white">生成中</Badge>
              )}
              {project.status === 'completed' && (
                <Badge className="bg-green-600 text-white">已完成</Badge>
              )}
              {project.status === 'error' && (
                <Badge className="bg-red-500 text-white">错误</Badge>
              )}
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    导出项目
                  </>
                )}
              </Button>
              <Button
                onClick={handleBatchGenerate}
                disabled={generating || scenes.length === 0}
                className="amber-gradient text-white border-0"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4 mr-2" />
                    生成分镜图
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={videoGenerationSession.isGenerating || completedScenes.length === 0}
                    variant="default"
                  >
                    {videoGenerationSession.isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        合成中...
                      </>
                    ) : (
                      <>
                        <Film className="w-4 h-4 mr-2" />
                        合成视频
                        <ChevronRight className="w-4 h-4 ml-1 rotate-90" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>选择合成模式</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleGenerateVideos('continuous')}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">连续合成</span>
                      <span className="text-xs text-muted-foreground">
                        使用上一帧保持连贯性（推荐）
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleGenerateVideos('fast')}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">快速合成</span>
                      <span className="text-xs text-muted-foreground">
                        并行生成，速度快但可能不够连贯
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* 分析状态卡片 */}
        {project.status === 'analyzing' && (
          <Card className="mb-6 border-blue-500/50 bg-blue-500/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <div>
                  <p className="font-medium">正在分析内容...</p>
                  <p className="text-sm text-muted-foreground">AI 正在提取人物和分镜信息，请稍候</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* 错误状态卡片 */}
        {project.status === 'error' && (
          <Card className="mb-6 border-red-500/50 bg-red-500/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <span className="text-red-500 text-sm">!</span>
                </div>
                <div>
                  <p className="font-medium text-red-500">分析失败</p>
                  <p className="text-sm text-muted-foreground">请检查内容格式或重新创建项目</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* 空状态提示 */}
        {project.status === 'draft' && characters.length === 0 && scenes.length === 0 && (
          <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3">
                <Sparkles className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="font-medium">准备开始创作</p>
                  <p className="text-sm text-muted-foreground">点击右侧「手动分析」按钮开始提取人物和分镜</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          projectId: project.id,
                          content: project.sourceContent,
                        }),
                      })
                      const result = await res.json()
                      if (result.characters || result.scenes) {
                        toast.success(`分析完成！提取了 ${result.characters?.length || 0} 个人物，${result.scenes?.length || 0} 个分镜`)
                        fetchData()
                      } else {
                        toast.error(result.error || '分析失败')
                      }
                    } catch (err) {
                      toast.error('分析失败')
                    }
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  手动分析
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Tabs defaultValue="episodes" className="space-y-6">
          <TabsList className="bg-card/50 border border-border/50">
            <TabsTrigger value="episodes" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              剧集管理
            </TabsTrigger>
            <TabsTrigger value="characters" className="gap-2">
              <Users className="w-4 h-4" />
              人物管理
            </TabsTrigger>
            <TabsTrigger value="scenes" className="gap-2">
              <Video className="w-4 h-4" />
              分镜管理
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Play className="w-4 h-4" />
              视频预览
            </TabsTrigger>
          </TabsList>

          <TabsContent value="episodes">
            <EpisodesPanel
              projectId={id}
              onUpdate={fetchData}
              onSelectEpisode={setSelectedEpisodeId}
              selectedEpisodeId={selectedEpisodeId}
              scenes={scenes}
              scripts={scripts}
            />
          </TabsContent>

          <TabsContent value="characters">
            <CharactersPanel
              projectId={id}
              characters={characters}
              onUpdate={fetchData}
            />
          </TabsContent>

          <TabsContent value="scenes">
            <ScenesPanel
              projectId={id}
              scenes={scenes}
              characters={characters}
              onUpdate={fetchData}
              episodes={episodes}
            />
          </TabsContent>

          <TabsContent value="preview">
            <div className="space-y-6">
              {/* 视频生成进度可视化 */}
              {videoGenerationSession.isGenerating && (
                <VideoGenerationProgress
                  total={videoGenerationSession.total}
                  completed={videoGenerationSession.completed}
                  currentScene={videoGenerationSession.currentScene}
                  isPaused={videoGenerationSession.isPaused}
                  canPause={videoGenerationSession.canPause}
                  onPause={handlePauseVideoGeneration}
                  onCancel={handleCancelVideoGeneration}
                />
              )}
              
              {/* 视频进度卡片 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>视频合成进度</CardTitle>
                      <CardDescription>
                        将分镜图片转换为动态视频片段，保持场景连贯性
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={videoScenes.length === completedScenes.length && completedScenes.length > 0 ? "default" : "outline"}>
                        {videoScenes.length} / {completedScenes.length} 已完成
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center mb-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <div className="text-2xl font-bold text-primary">{completedScenes.length}</div>
                      <div className="text-sm text-muted-foreground">分镜图片</div>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <div className="text-2xl font-bold text-green-500">{videoScenes.length}</div>
                      <div className="text-sm text-muted-foreground">视频片段</div>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <div className="text-2xl font-bold text-amber-500">{pendingVideoScenes.length}</div>
                      <div className="text-sm text-muted-foreground">待生成</div>
                    </div>
                  </div>

                  {/* 合成按钮区域 */}
                  {pendingVideoScenes.length > 0 && !videoGenerationSession.isGenerating && (
                    <div className="flex gap-3 justify-center pt-2">
                      <Button
                        onClick={() => handleGenerateVideos('continuous')}
                        className="amber-gradient text-white border-0 gap-2"
                      >
                        <Film className="w-4 h-4" />
                        开始合成视频
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 视频播放器 */}
              {videoScenes.length > 0 ? (
                <>
                  {/* 视频筛选 */}
                  {scripts.length > 0 && (
                    <div className="flex items-center justify-end gap-2 mb-4">
                      <span className="text-sm text-muted-foreground">脚本筛选:</span>
                      <select
                        value={selectedPreviewScriptId || ''}
                        onChange={(e) => setSelectedPreviewScriptId(e.target.value || null)}
                        className="px-3 py-1.5 rounded-md border bg-background text-sm"
                      >
                        <option value="">全部</option>
                        {scripts.map(script => (
                          <option key={script.id} value={script.id}>
                            {script.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <VideoPlayer scenes={videoScenes} />
                </>
              ) : (
                <>
                  {/* 视频筛选 */}
                  {scripts.length > 0 && (
                    <div className="flex items-center justify-end gap-2 mb-4">
                      <span className="text-sm text-muted-foreground">脚本筛选:</span>
                      <select
                        value={selectedPreviewScriptId || ''}
                        onChange={(e) => setSelectedPreviewScriptId(e.target.value || null)}
                        className="px-3 py-1.5 rounded-md border bg-background text-sm"
                      >
                        <option value="">全部</option>
                        {scripts.map(script => (
                          <option key={script.id} value={script.id}>
                            {script.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center text-muted-foreground">
                        <Film className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">暂无视频片段</p>
                        <p className="text-sm">请在分镜管理中为单个分镜生成视频，或点击上方按钮批量合成</p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* 视频合并面板 */}
              {videoScenes.length > 0 && (
                <VideoMergePanel projectId={id} scenes={scenes} />
              )}

              {/* 分镜预览 */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>分镜预览</CardTitle>
                    <CardDescription>查看当前选中的脚本分镜图片</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {completedScenes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>暂无已生成的分镜</p>
                    </div>
                  ) : (
                    <ScenePreviewGallery scenes={completedScenes} />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* 批量视频生成确认对话框 */}
      <Dialog open={videoGenerateConfirmDialogOpen} onOpenChange={setVideoGenerateConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="w-5 h-5 text-blue-500" />
              确认批量生成视频
            </DialogTitle>
            <DialogDescription>
              即将开始批量生成分镜视频，请确认以下信息
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 统计信息 */}
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">待生成分镜</span>
                <span className="font-semibold text-lg">{completedScenes.length} 个</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">生成模式</span>
                <Badge variant="outline">
                  {pendingVideoMode === 'continuous' ? '连续生成（推荐）' : '快速生成'}
                </Badge>
              </div>
            </div>

            {/* 模式说明 */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {pendingVideoMode === 'continuous' 
                  ? '连续生成模式会使用上一个分镜的图片作为首帧，确保视频连贯性，但速度较慢。'
                  : '快速生成模式并行生成所有视频，速度快但可能不够连贯。'}
              </AlertDescription>
            </Alert>

            {/* 警告 */}
            <Alert variant="destructive">
              <Film className="h-4 w-4" />
              <AlertDescription>
                视频生成可能需要较长时间，请确保网络连接稳定。生成过程中请不要关闭页面。
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setVideoGenerateConfirmDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmGenerateVideos}
              className="blue-gradient text-white border-0"
            >
              <Film className="w-4 h-4 mr-2" />
              开始生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ModelConfigProvider>
  )
}

// 视频播放器组件
function VideoPlayer({ scenes }: { scenes: Scene[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const currentScene = scenes[currentIndex]

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsPlaying(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < scenes.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsPlaying(false)
    }
  }

  const handleVideoEnd = () => {
    setIsPlaying(false)
    // 自动播放下一个
    if (currentIndex < scenes.length - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
        setIsPlaying(true)
      }, 500)
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative">
          {/* 视频区域 */}
          <div className="aspect-video bg-black relative">
            {currentScene?.videoUrl ? (
              <video
                ref={videoRef}
                src={currentScene.videoUrl}
                className="w-full h-full object-contain"
                onEnded={handleVideoEnd}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={() => {
                  console.warn('Video playback error')
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}

            {/* 分镜序号 */}
            <div className="absolute top-4 left-4">
              <Badge className="bg-black/70 text-white">
                第 {currentScene?.sceneNumber} 镜
              </Badge>
            </div>

            {/* 播放计数 */}
            <div className="absolute top-4 right-4">
              <Badge variant="secondary">
                {currentIndex + 1} / {scenes.length}
              </Badge>
            </div>
          </div>

          {/* 控制栏 */}
          <div className="bg-card border-t p-4">
            <div className="flex items-center justify-between">
              {/* 分镜信息 */}
              <div className="flex-1">
                <h4 className="font-medium">{currentScene?.title || `分镜 ${currentScene?.sceneNumber}`}</h4>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {currentScene?.description}
                </p>
              </div>

              {/* 控制按钮 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handlePlayPause}
                  className="w-12 h-12"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  disabled={currentIndex === scenes.length - 1}
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 时间线缩略图 */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  onClick={() => {
                    setCurrentIndex(index)
                    setIsPlaying(false)
                  }}
                  className={`flex-shrink-0 w-20 h-12 rounded border-2 overflow-hidden transition-all ${
                    index === currentIndex
                      ? "border-primary"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  {scene.videoUrl ? (
                    <video
                      src={scene.videoUrl || ''}
                      className="w-full h-full object-cover"
                      muted
                      onError={() => {
                        // 视频加载失败，正常情况
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 分镜预览画廊组件
function ScenePreviewGallery({ scenes }: { scenes: Scene[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  // 获取所有图片 URL
  useEffect(() => {
    const fetchUrls = async () => {
      const urls: Record<string, string> = {}
      for (const scene of scenes) {
        // 优先使用直接存储的URL
        if (scene.imageUrl) {
          urls[scene.id] = scene.imageUrl
        } else if (scene.imageKey) {
          try {
            const res = await fetch(`/api/images?key=${scene.imageKey}`)
            const data = await res.json()
            urls[scene.id] = data.url
          } catch (error) {
            console.error(`Failed to fetch image for scene ${scene.id}:`, error)
          }
        }
      }
      setImageUrls(urls)
    }
    fetchUrls()
  }, [scenes])

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < scenes.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handleDownload = async (scene: Scene, index: number) => {
    const url = imageUrls[scene.id]
    if (!url) return

    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `分镜${index + 1}_${scene.title || 'scene'}.png`
      link.click()
      window.URL.revokeObjectURL(blobUrl)
      toast.success("下载成功")
    } catch (error) {
      console.error("下载失败:", error)
      toast.error("下载失败")
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {scenes.map((scene, index) => (
          <Card
            key={scene.id}
            className="group cursor-pointer hover:shadow-lg transition-all overflow-hidden"
            onClick={() => setSelectedIndex(index)}
          >
            <div className="aspect-video bg-secondary/50 relative">
              {imageUrls[scene.id] ? (
                <img
                  src={imageUrls[scene.id]}
                  alt={scene.title || `分镜 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* 视频状态 */}
              {scene.videoUrl && (
                <div className="absolute top-2 right-2">
                  <Badge variant="default" className="bg-green-500 text-white text-xs">
                    <Play className="w-3 h-3 mr-1" />
                    视频
                  </Badge>
                </div>
              )}
              {/* 分镜序号 - 使用索引+1作为连续序号 */}
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="bg-black/60 text-white text-xs">
                  {index + 1}
                </Badge>
              </div>
            </div>
            <CardContent className="p-2">
              <p className="text-xs text-muted-foreground line-clamp-1">
                {scene.title || scene.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 大图查看弹窗 */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-5xl w-full h-[90vh] max-h-[90vh] p-0">
          {selectedIndex !== null && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {scenes[selectedIndex].title || `分镜 ${selectedIndex + 1}`}
                </DialogTitle>
              </DialogHeader>
              <div className="relative w-full h-full flex">
                {/* 图片/视频区域 */}
                <div className="flex-1 relative bg-black flex items-center justify-center">
                  {scenes[selectedIndex].videoUrl ? (
                    <video
                      src={scenes[selectedIndex].videoUrl || ''}
                      controls
                      className="max-w-full max-h-full"
                      onError={() => {
                        // 视频加载失败，正常情况
                      }}
                    />
                  ) : imageUrls[scenes[selectedIndex].id] ? (
                    <img
                      src={imageUrls[scenes[selectedIndex].id]}
                      alt={scenes[selectedIndex].title || `分镜 ${selectedIndex + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  )}
                  
                  {/* 左右切换按钮 */}
                  {selectedIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                  )}
                  {selectedIndex < scenes.length - 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  )}
                  
                  {/* 分镜计数 */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                    {selectedIndex + 1} / {scenes.length}
                  </div>
                </div>
                
                {/* 信息面板 */}
                <div className="w-80 border-l bg-background p-4 overflow-y-auto">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">第 {scenes[selectedIndex].sceneNumber} 镜</Badge>
                        {scenes[selectedIndex].metadata?.shotType && (
                          <Badge variant="secondary">{scenes[selectedIndex].metadata.shotType}</Badge>
                        )}
                        {scenes[selectedIndex].metadata?.cameraMovement && (
                          <Badge variant="secondary">{scenes[selectedIndex].metadata.cameraMovement}</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg">
                        {scenes[selectedIndex].title || "分镜标题"}
                      </h3>
                    </div>
                    
                    {scenes[selectedIndex].description && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">场景描述</h4>
                        <p className="text-sm">{scenes[selectedIndex].description}</p>
                      </div>
                    )}
                    
                    {scenes[selectedIndex].dialogue && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">对白</h4>
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-sm italic">"{scenes[selectedIndex].dialogue}"</p>
                        </div>
                      </div>
                    )}
                    
                    {scenes[selectedIndex].action && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">动作/表演</h4>
                        <p className="text-sm">{scenes[selectedIndex].action}</p>
                      </div>
                    )}
                    
                    {scenes[selectedIndex].emotion && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">情绪氛围</h4>
                        <Badge>{scenes[selectedIndex].emotion}</Badge>
                      </div>
                    )}
                    
                    <Button
                      className="w-full amber-gradient text-white border-0"
                      onClick={() => handleDownload(scenes[selectedIndex], selectedIndex)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载图片
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
