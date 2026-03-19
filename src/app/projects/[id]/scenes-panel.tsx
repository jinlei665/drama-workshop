"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit, 
  Sparkles, 
  Loader2,
  Image as ImageIcon,
  Video,
  Play,
  Film,
  Download
} from "lucide-react"
import { toast } from "sonner"

interface Scene {
  id: string
  sceneNumber: number
  title: string | null
  description: string
  dialogue: string | null
  action: string | null
  emotion: string | null
  characterIds: string[]
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

interface Character {
  id: string
  name: string
  appearance: string | null
}

interface ScenesPanelProps {
  projectId: string
  scenes: Scene[]
  characters: Character[]
  onUpdate: () => void
}

export function ScenesPanel({ projectId, scenes, characters, onUpdate }: ScenesPanelProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [creating, setCreating] = useState(false)
  const [generatingImage, setGeneratingImage] = useState<string | null>(null)
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    sceneNumber: scenes.length + 1,
    title: "",
    description: "",
    dialogue: "",
    action: "",
    emotion: "",
    shotType: "",
    cameraMovement: "",
    characterIds: [] as string[]
  })

  // 创建分镜
  const handleCreate = async () => {
    if (!formData.description.trim()) {
      toast.error("请输入场景描述")
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneNumber: formData.sceneNumber,
          title: formData.title,
          description: formData.description,
          dialogue: formData.dialogue,
          action: formData.action,
          emotion: formData.emotion,
          characterIds: formData.characterIds,
          metadata: {
            shotType: formData.shotType,
            cameraMovement: formData.cameraMovement,
          }
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "创建失败")
      }

      toast.success("分镜创建成功")
      setCreateDialogOpen(false)
      setFormData({
        sceneNumber: scenes.length + 2,
        title: "",
        description: "",
        dialogue: "",
        action: "",
        emotion: "",
        shotType: "",
        cameraMovement: "",
        characterIds: []
      })
      onUpdate()
    } catch (error) {
      console.error("创建分镜失败:", error)
      toast.error("创建分镜失败")
    } finally {
      setCreating(false)
    }
  }

  // 更新分镜
  const handleUpdate = async () => {
    if (!selectedScene) return

    setCreating(true)
    try {
      const res = await fetch(`/api/scenes/${selectedScene.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          metadata: {
            shotType: formData.shotType,
            cameraMovement: formData.cameraMovement,
          }
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "更新失败")
      }

      toast.success("分镜更新成功")
      setEditDialogOpen(false)
      setSelectedScene(null)
      onUpdate()
    } catch (error) {
      console.error("更新分镜失败:", error)
      toast.error("更新分镜失败")
    } finally {
      setCreating(false)
    }
  }

  // 删除分镜
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个分镜吗？")) return

    try {
      const res = await fetch(`/api/scenes/${id}`, {
        method: "DELETE"
      })

      if (!res.ok) {
        throw new Error("删除失败")
      }

      toast.success("分镜已删除")
      onUpdate()
    } catch (error) {
      console.error("删除分镜失败:", error)
      toast.error("删除分镜失败")
    }
  }

  // 生成分镜图片
  const handleGenerateImage = async (scene: Scene) => {
    if (!scene.description) {
      toast.error("请先填写场景描述")
      return
    }

    setGeneratingImage(scene.id)
    try {
      // 获取出场人物的外貌描述
      const charDescriptions = scene.characterIds
        .map(id => characters.find(c => c.id === id)?.appearance)
        .filter(Boolean)

      const res = await fetch("/api/generate/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.id,
          description: scene.description,
          emotion: scene.emotion,
          characterDescriptions: charDescriptions
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "生成失败")
      }

      toast.success("分镜图片生成成功")
      onUpdate()
    } catch (error) {
      console.error("生成分镜图片失败:", error)
      toast.error("生成分镜图片失败")
    } finally {
      setGeneratingImage(null)
    }
  }

  // 生成单个分镜视频
  const handleGenerateVideo = async (scene: Scene) => {
    if (!scene.imageKey && !scene.imageUrl) {
      toast.error("请先生成分镜图片")
      return
    }

    setGeneratingVideo(scene.id)
    try {
      const res = await fetch("/api/generate/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId,
          sceneIds: [scene.id]
        })
      })

      // 检查响应类型
      const contentType = res.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("服务器返回了错误的响应格式，请稍后重试")
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "视频生成失败")
      }

      if (data.results?.[0]?.status === 'completed') {
        toast.success("视频生成成功")
      } else {
        const errorMsg = data.results?.[0]?.error || "视频生成失败"
        if (errorMsg.includes('403')) {
          throw new Error("API请求频率过高，请等待几分钟后再试")
        }
        throw new Error(errorMsg)
      }
      onUpdate()
    } catch (error) {
      console.error("生成视频失败:", error)
      toast.error(error instanceof Error ? error.message : "生成视频失败")
    } finally {
      setGeneratingVideo(null)
    }
  }

  // 打开编辑对话框
  const openEditDialog = (scene: Scene) => {
    setSelectedScene(scene)
    setFormData({
      sceneNumber: scene.sceneNumber,
      title: scene.title || "",
      description: scene.description,
      dialogue: scene.dialogue || "",
      action: scene.action || "",
      emotion: scene.emotion || "",
      shotType: scene.metadata?.shotType || "",
      cameraMovement: scene.metadata?.cameraMovement || "",
      characterIds: scene.characterIds || []
    })
    setEditDialogOpen(true)
  }

  // 获取状态样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">待生成</Badge>
      case "generating":
        return <Badge variant="default" className="bg-amber-500">生成中</Badge>
      case "completed":
        return <Badge variant="default" className="bg-green-500">已完成</Badge>
      case "failed":
        return <Badge variant="destructive">失败</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // 获取视频状态样式
  const getVideoStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-muted-foreground">待生成视频</Badge>
      case "generating":
        return <Badge variant="default" className="bg-blue-500">视频生成中</Badge>
      case "completed":
        return <Badge variant="default" className="bg-green-600">视频已完成</Badge>
      case "failed":
        return <Badge variant="destructive">视频生成失败</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">视频分镜管理</h2>
          <p className="text-sm text-muted-foreground">
            管理短剧视频分镜，生成每个分镜的画面和视频
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="amber-gradient text-white border-0">
              <Plus className="w-4 h-4 mr-2" />
              添加分镜
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>添加视频分镜</DialogTitle>
              <DialogDescription>
                创建新的视频分镜画面
              </DialogDescription>
            </DialogHeader>
            <SceneForm
              formData={formData}
              setFormData={setFormData}
              characters={characters}
              onSubmit={handleCreate}
              loading={creating}
              submitText="创建分镜"
            />
          </DialogContent>
        </Dialog>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>编辑视频分镜</DialogTitle>
              <DialogDescription>
                修改分镜信息
              </DialogDescription>
            </DialogHeader>
            <SceneForm
              formData={formData}
              setFormData={setFormData}
              characters={characters}
              onSubmit={handleUpdate}
              loading={creating}
              submitText="保存修改"
            />
          </DialogContent>
        </Dialog>
      </div>

      {scenes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">还没有分镜，点击上方按钮添加</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              characters={characters}
              generatingImage={generatingImage === scene.id}
              generatingVideo={generatingVideo === scene.id}
              onEdit={() => openEditDialog(scene)}
              onDelete={() => handleDelete(scene.id)}
              onGenerateImage={() => handleGenerateImage(scene)}
              onGenerateVideo={() => handleGenerateVideo(scene)}
              getStatusBadge={getStatusBadge}
              getVideoStatusBadge={getVideoStatusBadge}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 分镜表单组件
function SceneForm({
  formData,
  setFormData,
  characters,
  onSubmit,
  loading,
  submitText
}: {
  formData: any
  setFormData: any
  characters: Character[]
  onSubmit: () => void
  loading: boolean
  submitText: string
}) {
  return (
    <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="scene-number">分镜序号</Label>
          <Input
            id="scene-number"
            type="number"
            value={formData.sceneNumber}
            onChange={(e) => setFormData({ ...formData, sceneNumber: parseInt(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scene-emotion">情绪氛围</Label>
          <Input
            id="scene-emotion"
            value={formData.emotion}
            onChange={(e) => setFormData({ ...formData, emotion: e.target.value })}
            placeholder="如：紧张、温馨、悲伤"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="shot-type">景别</Label>
          <select
            id="shot-type"
            className="w-full h-10 px-3 rounded-md border border-input bg-background"
            value={formData.shotType}
            onChange={(e) => setFormData({ ...formData, shotType: e.target.value })}
          >
            <option value="">选择景别</option>
            <option value="远景">远景</option>
            <option value="全景">全景</option>
            <option value="中景">中景</option>
            <option value="近景">近景</option>
            <option value="特写">特写</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="camera-movement">镜头运动</Label>
          <select
            id="camera-movement"
            className="w-full h-10 px-3 rounded-md border border-input bg-background"
            value={formData.cameraMovement}
            onChange={(e) => setFormData({ ...formData, cameraMovement: e.target.value })}
          >
            <option value="">选择镜头运动</option>
            <option value="固定">固定</option>
            <option value="推镜">推镜</option>
            <option value="拉镜">拉镜</option>
            <option value="摇镜">摇镜</option>
            <option value="跟拍">跟拍</option>
            <option value="移镜">移镜</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scene-title">分镜标题</Label>
        <Input
          id="scene-title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="输入分镜标题"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scene-desc">场景描述 *</Label>
        <Textarea
          id="scene-desc"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="详细描述场景画面：环境、构图、光线、角度等"
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          场景描述越详细，生成的画面越准确
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scene-dialogue">对白内容</Label>
        <Textarea
          id="scene-dialogue"
          value={formData.dialogue}
          onChange={(e) => setFormData({ ...formData, dialogue: e.target.value })}
          placeholder="人物对白（视频生成时会自动配音）"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scene-action">动作/表演描述</Label>
        <Textarea
          id="scene-action"
          value={formData.action}
          onChange={(e) => setFormData({ ...formData, action: e.target.value })}
          placeholder="人物动作和表演描述"
        />
      </div>
      <div className="space-y-2">
        <Label>出场人物</Label>
        <div className="flex flex-wrap gap-2">
          {characters.map((char) => (
            <label
              key={char.id}
              className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                formData.characterIds.includes(char.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={formData.characterIds.includes(char.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      characterIds: [...formData.characterIds, char.id]
                    })
                  } else {
                    setFormData({
                      ...formData,
                      characterIds: formData.characterIds.filter((id: string) => id !== char.id)
                    })
                  }
                }}
              />
              {char.name}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-background">
        <Button variant="outline" type="button">
          取消
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={loading}
          className="amber-gradient text-white border-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              处理中...
            </>
          ) : (
            submitText
          )}
        </Button>
      </div>
    </div>
  )
}

// 分镜卡片组件
function SceneCard({
  scene,
  characters,
  generatingImage,
  generatingVideo,
  onEdit,
  onDelete,
  onGenerateImage,
  onGenerateVideo,
  getStatusBadge,
  getVideoStatusBadge
}: {
  scene: Scene
  characters: Character[]
  generatingImage: boolean
  generatingVideo: boolean
  onEdit: () => void
  onDelete: () => void
  onGenerateImage: () => void
  onGenerateVideo: () => void
  getStatusBadge: (status: string) => React.ReactNode
  getVideoStatusBadge: (status: string) => React.ReactNode
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // 获取图片 URL
  useEffect(() => {
    if (scene.imageUrl) {
      setImageUrl(scene.imageUrl)
    } else if (scene.imageKey) {
      fetch(`/api/images?key=${scene.imageKey}`)
        .then(res => res.json())
        .then(data => setImageUrl(data.url))
        .catch(console.error)
    }
  }, [scene.imageKey, scene.imageUrl])

  // 下载视频
  const handleDownloadVideo = async () => {
    if (!scene.videoUrl) return
    
    setDownloading(true)
    try {
      const res = await fetch(`/api/scenes/${scene.id}/download`)
      if (!res.ok) throw new Error("下载失败")
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `scene_${scene.sceneNumber}_${scene.title || 'untitled'}.mp4`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("下载视频失败:", error)
      toast.error("下载视频失败")
    } finally {
      setDownloading(false)
    }
  }

  // 计算预估视频时长（秒）
  const calculateDuration = () => {
    let duration = 6; // 基础6秒
    
    // 根据对白长度计算
    if (scene.dialogue) {
      const len = scene.dialogue.length;
      if (len > 50) duration += 4;
      else if (len > 30) duration += 3;
      else if (len > 15) duration += 2;
      else if (len > 0) duration += 1;
    }
    
    // 有动作描述增加时长
    if (scene.action && scene.action.length > 20) duration += 2;
    else if (scene.action && scene.action.length > 0) duration += 1;
    
    // 场景描述很长时也增加时长
    if (scene.description && scene.description.length > 100) duration += 1;
    
    return Math.min(Math.max(duration, 6), 12);
  }

  const estimatedDuration = calculateDuration();

  // 获取出场人物名称
  const sceneCharacters = scene.characterIds
    .map(id => characters.find(c => c.id === id)?.name)
    .filter(Boolean)

  const hasImage = scene.imageKey || scene.imageUrl
  const hasVideo = scene.videoUrl

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row">
        {/* 图片/视频区域 */}
        <div className="md:w-1/4 aspect-video md:aspect-auto bg-secondary/50 relative overflow-hidden">
          {hasVideo ? (
            // 显示视频
            <video 
              src={scene.videoUrl!} 
              className="w-full h-full object-cover"
              muted
              loop
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => {
                e.currentTarget.pause()
                e.currentTarget.currentTime = 0
              }}
            />
          ) : imageUrl ? (
            // 显示图片
            <img 
              src={imageUrl} 
              alt={scene.title || `分镜 ${scene.sceneNumber}`}
              className="w-full h-full object-cover"
            />
          ) : (
            // 空状态
            <div className="absolute inset-0 flex items-center justify-center">
              {generatingImage ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">生成图片...</p>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  className="flex flex-col items-center gap-2"
                  onClick={onGenerateImage}
                >
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs">点击生成分镜图</span>
                </Button>
              )}
            </div>
          )}

          {/* 视频播放标识 */}
          {hasVideo && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-green-600 text-white">
                <Play className="w-3 h-3 mr-1" />
                视频
              </Badge>
            </div>
          )}

          {/* 分镜序号 */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-black/60 text-white">
              {scene.sceneNumber}
            </Badge>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(scene.status)}
              {scene.videoStatus && getVideoStatusBadge(scene.videoStatus)}
              {scene.metadata?.shotType && (
                <Badge variant="outline">{scene.metadata.shotType}</Badge>
              )}
              {scene.metadata?.cameraMovement && (
                <Badge variant="outline">{scene.metadata.cameraMovement}</Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onGenerateImage} disabled={generatingImage}>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  {hasImage ? "重新生成图片" : "生成分镜图"}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onGenerateVideo} 
                  disabled={generatingVideo || !hasImage}
                >
                  <Film className="w-4 h-4 mr-2" />
                  {hasVideo ? "重新生成视频" : "生成视频"}
                </DropdownMenuItem>
                {hasVideo && (
                  <DropdownMenuItem onClick={handleDownloadVideo} disabled={downloading}>
                    <Download className="w-4 h-4 mr-2" />
                    {downloading ? "下载中..." : "下载视频"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h3 className="font-semibold mb-2">
            {scene.title || "分镜标题"}
          </h3>

          {scene.description && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
              {scene.description}
            </p>
          )}

          {scene.dialogue && (
            <div className="bg-secondary/50 rounded px-3 py-2 mb-2">
              <p className="text-sm italic">"{scene.dialogue}"</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {scene.emotion && (
              <Badge variant="outline" className="text-xs">{scene.emotion}</Badge>
            )}
            {sceneCharacters.length > 0 && (
              <span>出场：{sceneCharacters.join("、")}</span>
            )}
          </div>

          {/* 快捷操作按钮 */}
          <div className="flex gap-2 mt-3 items-center">
            {!hasImage && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={onGenerateImage}
                disabled={generatingImage}
              >
                {generatingImage ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-1" />
                )}
                生成图片
              </Button>
            )}
            {hasImage && !hasVideo && (
              <>
                <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={onGenerateVideo}
                  disabled={generatingVideo}
                >
                  {generatingVideo ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Film className="w-4 h-4 mr-1" />
                  )}
                  生成视频
                </Button>
                <span className="text-xs text-muted-foreground">
                  预估 {estimatedDuration} 秒
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
