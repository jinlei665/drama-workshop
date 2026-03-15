"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  ChevronRight
} from "lucide-react"
import { toast } from "sonner"
import { CharactersPanel } from "./characters-panel"
import { ScenesPanel } from "./scenes-panel"

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

  // 获取已完成的分镜
  const completedScenes = scenes.filter(s => s.status === "completed")

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
                    <Sparkles className="w-4 h-4 mr-2" />
                    批量生成分镜
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="characters" className="space-y-6">
          <TabsList className="bg-card/50 border border-border/50">
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>短剧视频预览</CardTitle>
                    <CardDescription>
                      预览生成的视频分镜效果，点击图片可查看大图
                    </CardDescription>
                  </div>
                  {completedScenes.length > 0 && (
                    <Badge variant="outline">
                      共 {completedScenes.length} 个分镜
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {completedScenes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无已生成的分镜，请先生成分镜图片</p>
                  </div>
                ) : (
                  <ScenePreviewGallery scenes={completedScenes} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
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
        if (scene.image_key) {
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              {/* 悬停遮罩 */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button variant="secondary" size="sm">
                  <ZoomIn className="w-4 h-4 mr-1" />
                  查看大图
                </Button>
              </div>
              {/* 分镜序号 */}
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="bg-black/60 text-white">
                  第 {scene.scene_number} 镜
                </Badge>
              </div>
            </div>
            <CardContent className="p-3">
              <h4 className="font-medium text-sm line-clamp-1">
                {scene.title || "分镜标题"}
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {scene.description}
              </p>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {scene.metadata?.shotType && (
                  <Badge variant="outline" className="text-xs">{scene.metadata.shotType}</Badge>
                )}
                {scene.metadata?.cameraMovement && (
                  <Badge variant="outline" className="text-xs">{scene.metadata.cameraMovement}</Badge>
                )}
              </div>
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
                {/* 图片区域 */}
                <div className="flex-1 relative bg-black flex items-center justify-center">
                  {imageUrls[scenes[selectedIndex].id] ? (
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
