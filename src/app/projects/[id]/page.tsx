"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Users, 
  Image, 
  Play, 
  Loader2,
  Sparkles,
  Download,
  RefreshCw
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
                <Image className="w-3 h-3" />
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
              <Image className="w-4 h-4" />
              分镜管理
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Play className="w-4 h-4" />
              漫剧预览
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
                <CardTitle>漫剧预览</CardTitle>
                <CardDescription>
                  预览生成的漫剧效果
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scenes.filter(s => s.status === "completed").length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无已生成的分镜，请先生成分镜图片</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {scenes
                      .filter(s => s.status === "completed")
                      .map((scene) => (
                        <ScenePreview key={scene.id} scene={scene} />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

// 分镜预览组件
function ScenePreview({ scene }: { scene: Scene }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (scene.image_key) {
      // 获取图片 URL
      fetch(`/api/images?key=${scene.image_key}`)
        .then(res => res.json())
        .then(data => setImageUrl(data.url))
        .catch(console.error)
    }
  }, [scene.image_key])

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-1/2 aspect-video bg-secondary/50 relative">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={scene.title || `分镜 ${scene.scene_number}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="md:w-1/2 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline">第 {scene.scene_number} 镜</Badge>
            {scene.emotion && <Badge>{scene.emotion}</Badge>}
          </div>
          <h3 className="font-semibold text-lg mb-2">
            {scene.title || "分镜标题"}
          </h3>
          {scene.description && (
            <p className="text-sm text-muted-foreground mb-3">
              {scene.description}
            </p>
          )}
          {scene.dialogue && (
            <div className="bg-secondary/50 rounded-lg p-3 mb-3">
              <p className="text-sm italic">"{scene.dialogue}"</p>
            </div>
          )}
          {scene.action && (
            <p className="text-xs text-muted-foreground">
              动作：{scene.action}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
