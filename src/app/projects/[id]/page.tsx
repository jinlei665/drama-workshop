"use client"

import { useState, useEffect, use, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Film,
  Pause,
  SkipBack,
  SkipForward,
  Package,
  FolderOpen
} from "lucide-react"
import { toast } from "sonner"
import { CharactersPanel } from "./characters-panel"
import { ScenesPanel } from "./scenes-panel"
import { EpisodesPanel } from "./episodes-panel"

interface Project {
  id: string
  name: string
  description: string | null
  source_content: string
  source_type: string
  status: string
  created_at: string
}

interface Character {
  id: string
  name: string
  description: string | null
  appearance: string | null
  personality: string | null
  front_view_key: string | null
  side_view_key: string | null
  back_view_key: string | null
  tags: string[]
}

interface Scene {
  id: string
  scene_number: number
  title: string | null
  description: string
  dialogue: string | null
  action: string | null
  emotion: string | null
  character_ids: string[]
  image_key: string | null
  image_url: string | null
  video_url: string | null
  video_status: string
  status: string
  metadata: {
    shotType?: string
    cameraMovement?: string
  } | null
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatingVideos, setGeneratingVideos] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoMode, setVideoMode] = useState<'fast' | 'continuous'>('continuous')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "获取项目失败")
      }

      setProject(data.project)
      setCharacters(data.characters || [])
      setScenes(data.scenes || [])
    } catch (error) {
      console.error("获取项目失败:", error)
      toast.error("获取项目失败")
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

  // 生成视频片段（支持两种模式）
  const handleGenerateVideos = async (mode: 'fast' | 'continuous' = 'continuous') => {
    if (completedScenes.length === 0) {
      toast.error("请先生成分镜图片")
      return
    }

    setGeneratingVideos(true)
    setVideoProgress(0)

    try {
      const res = await fetch("/api/generate/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, mode, episodeId: selectedEpisodeId })
      })
      
      // 检查响应类型
      const contentType = res.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("服务器返回了错误的响应格式")
      }
      
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "视频生成失败")
      }

      const completed = data.results.filter((r: any) => r.status === "completed").length
      const failed = data.results.filter((r: any) => r.status === "failed").length
      
      if (failed > 0) {
        toast.warning(`生成完成：${completed} 个成功，${failed} 个失败`)
      } else {
        toast.success(data.message || `成功生成 ${completed} 个视频片段`)
      }
      fetchData()
    } catch (error) {
      console.error("视频生成失败:", error)
      toast.error(error instanceof Error ? error.message : "视频生成失败")
    } finally {
      setGeneratingVideos(false)
      setVideoProgress(0)
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

  // 获取已完成图片的分镜
  const completedScenes = scenes.filter(s => s.status === "completed")
  // 获取已完成视频的分镜
  completedScenes.sort((a, b) => a.scene_number - b.scene_number)
  const videoScenes = completedScenes.filter(s => s.video_status === "completed")
  const pendingVideoScenes = completedScenes.filter(s => s.video_status === "pending" || s.video_status === "failed")

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{project.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {project.description || "暂无描述"}
                </p>
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
                    disabled={generatingVideos || completedScenes.length === 0}
                    variant="default"
                  >
                    {generatingVideos ? (
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
            />
          </TabsContent>

          <TabsContent value="preview">
            <div className="space-y-6">
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
                  {generatingVideos && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>正在生成视频片段（每个间隔3秒避免限流）...</span>
                        <span className="text-muted-foreground">这可能需要几分钟</span>
                      </div>
                      <Progress value={videoProgress} className="h-2" />
                    </div>
                  )}
                  
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
                  {pendingVideoScenes.length > 0 && !generatingVideos && (
                    <div className="flex gap-3 justify-center pt-2">
                      <Button
                        onClick={() => handleGenerateVideos('continuous')}
                        disabled={generatingVideos}
                        variant="default"
                        className="gap-2"
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
                <VideoPlayer scenes={videoScenes} />
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <Film className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg mb-2">暂无视频片段</p>
                      <p className="text-sm">请在分镜管理中为单个分镜生成视频，或点击上方按钮批量合成</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 分镜预览 */}
              <Card>
                <CardHeader>
                  <CardTitle>分镜预览</CardTitle>
                  <CardDescription>查看所有生成的分镜图片</CardDescription>
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
    </div>
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
            {currentScene?.video_url ? (
              <video
                ref={videoRef}
                src={currentScene.video_url}
                className="w-full h-full object-contain"
                onEnded={handleVideoEnd}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}

            {/* 分镜序号 */}
            <div className="absolute top-4 left-4">
              <Badge className="bg-black/70 text-white">
                第 {currentScene?.scene_number} 镜
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
                <h4 className="font-medium">{currentScene?.title || `分镜 ${currentScene?.scene_number}`}</h4>
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
                  {scene.video_url ? (
                    <video
                      src={scene.video_url}
                      className="w-full h-full object-cover"
                      muted
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
        if (scene.image_url) {
          urls[scene.id] = scene.image_url
        } else if (scene.image_key) {
          try {
            const res = await fetch(`/api/images?key=${scene.image_key}`)
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

  const handleDownload = async (scene: Scene) => {
    const url = imageUrls[scene.id]
    if (!url) return

    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `分镜${scene.scene_number}_${scene.title || 'scene'}.png`
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
                  alt={scene.title || `分镜 ${scene.scene_number}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* 视频状态 */}
              {scene.video_url && (
                <div className="absolute top-2 right-2">
                  <Badge variant="default" className="bg-green-500 text-white text-xs">
                    <Play className="w-3 h-3 mr-1" />
                    视频
                  </Badge>
                </div>
              )}
              {/* 分镜序号 */}
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="bg-black/60 text-white text-xs">
                  {scene.scene_number}
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
                  {scenes[selectedIndex].title || `分镜 ${scenes[selectedIndex].scene_number}`}
                </DialogTitle>
              </DialogHeader>
              <div className="relative w-full h-full flex">
                {/* 图片/视频区域 */}
                <div className="flex-1 relative bg-black flex items-center justify-center">
                  {scenes[selectedIndex].video_url ? (
                    <video
                      src={scenes[selectedIndex].video_url}
                      controls
                      className="max-w-full max-h-full"
                    />
                  ) : imageUrls[scenes[selectedIndex].id] ? (
                    <img 
                      src={imageUrls[scenes[selectedIndex].id]} 
                      alt={scenes[selectedIndex].title || `分镜 ${scenes[selectedIndex].scene_number}`}
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
                        <Badge variant="outline">第 {scenes[selectedIndex].scene_number} 镜</Badge>
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
                      onClick={() => handleDownload(scenes[selectedIndex])}
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
