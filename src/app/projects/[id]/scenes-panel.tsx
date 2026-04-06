"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Download,
  Check,
  Info,
  AlertTriangle,
  FileText,
  ListFilter
} from "lucide-react"
import { toast } from "sonner"
import { ScriptDialog } from "@/components/script-dialog"

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

interface Character {
  id: string
  name: string
  appearance: string | null
  frontViewKey?: string | null
  imageUrl?: string | null
}

interface Script {
  id: string
  projectId: string
  title: string
  content: string | null
  description: string | null
  status: string
  createdAt: string
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

interface ScenesPanelProps {
  projectId: string
  scenes: Scene[]
  characters: Character[]
  onUpdate: () => void
  onScriptSelect?: (scriptId: string | null) => void
  projectStyle?: string
  projectDescription?: string
  episodes?: Episode[]
}

export function ScenesPanel({ projectId, scenes, characters, onUpdate, onScriptSelect, projectStyle, projectDescription, episodes = [] }: ScenesPanelProps) {
  // 调试：打印人物数据
  console.log('[ScenesPanel] Characters data:', characters.map(c => ({
    id: c.id,
    name: c.name,
    frontViewKey: c.frontViewKey,
    imageUrl: c.imageUrl
  })))

  // 脚本相关状态
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false)

  // 获取脚本列表
  const fetchScripts = async () => {
    try {
      const res = await fetch(`/api/scripts?projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setScripts(data.scripts || [])
      }
    } catch (error) {
      console.error("获取脚本列表失败:", error)
    }
  }

  // 初始化和监听项目变化
  useEffect(() => {
    fetchScripts()
  }, [projectId])

  // 处理脚本选择
  const handleScriptSelect = (scriptId: string | null) => {
    setSelectedScriptId(scriptId)
    onScriptSelect?.(scriptId)
  }

  // 删除脚本
  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm("确定要删除这个脚本吗？关联的分镜不会被删除。")) {
      return
    }

    try {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "删除失败")
      }

      toast.success("脚本已删除")
      
      // 如果当前选中的是要删除的脚本，重置选择
      if (selectedScriptId === scriptId) {
        setSelectedScriptId(null)
      }
      
      fetchScripts()
      onUpdate()
    } catch (error) {
      console.error("删除脚本失败:", error)
      toast.error(error instanceof Error ? error.message : "删除脚本失败")
    }
  }

  // 过滤分镜列表
  const filteredScenes = selectedScriptId
    ? scenes.filter(s => s.scriptId === selectedScriptId)
    : scenes

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [imageGenerateDialogOpen, setImageGenerateDialogOpen] = useState(false)
  const [videoGenerateDialogOpen, setVideoGenerateDialogOpen] = useState(false)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [creating, setCreating] = useState(false)
  const [generatingImage, setGeneratingImage] = useState<string | null>(null)
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null)
  const [imageGenerateFormData, setImageGenerateFormData] = useState({
    description: "",
    action: "",
    emotion: "",
    characterIds: [] as string[]
  })
  const [videoGenerateFormData, setVideoGenerateFormData] = useState({
    duration: 6,
    dialogue: "",
    action: "",
    emotion: "",
    lastFrameSceneId: "" as string | null,
    ratio: "16:9" as "16:9" | "9:16"
  })
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
          scriptId: selectedScriptId,
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

  // 生成分镜图片 - 打开确认对话框
  const handleGenerateImage = (scene: Scene) => {
    if (!scene.description) {
      toast.error("请先填写场景描述")
      return
    }

    setSelectedScene(scene)
    setImageGenerateFormData({
      description: scene.description,
      action: scene.action || "",
      emotion: scene.emotion || "",
      characterIds: scene.characterIds || []
    })
    setImageGenerateDialogOpen(true)
  }

  // 确认生成分镜图片
  const handleConfirmGenerateImage = async () => {
    if (!selectedScene) return

    setGeneratingImage(selectedScene.id)
    setImageGenerateDialogOpen(false)

    try {
      // 获取出场人物的外貌描述
      const charDescriptions = imageGenerateFormData.characterIds
        .map(id => characters.find(c => c.id === id)?.appearance)
        .filter(Boolean)

      const res = await fetch("/api/generate/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: selectedScene.id,
          description: imageGenerateFormData.description,
          emotion: imageGenerateFormData.emotion,
          characterDescriptions: charDescriptions,
          characterIds: imageGenerateFormData.characterIds
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

  // 生成单个分镜视频 - 打开确认对话框
  const handleGenerateVideo = async (scene: Scene) => {
    if (!scene.imageKey && !scene.imageUrl) {
      toast.error("请先生成分镜图片")
      return
    }

    // 查找下一个分镜（自动选择为尾帧）
    const nextScene = scenes.find(s => s.sceneNumber === scene.sceneNumber + 1)
    const nextSceneWithImage = nextScene && (nextScene.imageKey || nextScene.imageUrl) ? nextScene : null

    setSelectedScene(scene)
    setVideoGenerateFormData({
      duration: 6, // 默认6秒
      dialogue: scene.dialogue || "",
      action: scene.action || "",
      emotion: scene.emotion || "",
      lastFrameSceneId: nextSceneWithImage?.id || null,
      ratio: "16:9" // 默认16:9
    })
    setVideoGenerateDialogOpen(true)
  }

  // 确认生成单个分镜视频
  const handleConfirmGenerateVideo = async () => {
    if (!selectedScene) return

    setGeneratingVideo(selectedScene.id)
    setVideoGenerateDialogOpen(false)

    try {
      const res = await fetch("/api/generate/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneIds: [selectedScene.id],
          duration: videoGenerateFormData.duration,
          dialogue: videoGenerateFormData.dialogue,
          action: videoGenerateFormData.action,
          emotion: videoGenerateFormData.emotion,
          lastFrameSceneId: videoGenerateFormData.lastFrameSceneId,
          ratio: videoGenerateFormData.ratio
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
      {/* 脚本筛选区域 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListFilter className="w-4 h-4" />
            <span>筛选:</span>
          </div>
          {/* 全部按钮 */}
          <button
            onClick={() => handleScriptSelect(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedScriptId === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
            }`}
          >
            全部 ({scenes.length})
          </button>
          {/* 脚本标签 */}
          {scripts.map(script => {
            const sceneCount = scenes.filter(s => s.scriptId === script.id).length
            return (
              <div
                key={script.id}
                className={`group relative px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedScriptId === script.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                }`}
                onClick={() => handleScriptSelect(script.id)}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{script.title}</span>
                <span className="text-xs opacity-70">({sceneCount})</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteScript(script.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-opacity"
                  title="删除脚本"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* 新增脚本按钮 */}
          <Button
            variant="outline"
            onClick={() => setScriptDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            新增脚本片段
          </Button>

          {/* 添加分镜按钮 */}
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
      </div>

      {/* 新增脚本对话框 */}
      <ScriptDialog
        open={scriptDialogOpen}
        onOpenChange={setScriptDialogOpen}
        projectId={projectId}
        projectStyle={projectStyle}
        projectDescription={projectDescription}
        existingCharacters={characters.map(c => ({
          id: c.id,
          name: c.name,
          appearance: c.appearance || undefined
        }))}
        onSuccess={() => {
          fetchScripts()
          onUpdate()
        }}
      />

      {/* 标题描述 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">视频分镜管理</h2>
          <p className="text-sm text-muted-foreground">
            {selectedScriptId
              ? `正在查看「${scripts.find(s => s.id === selectedScriptId)?.title}」的分镜`
              : "管理短剧视频分镜，生成每个分镜的画面和视频"}
          </p>
        </div>
      </div>

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

      {/* 图片生成确认对话框 */}
      <Dialog open={imageGenerateDialogOpen} onOpenChange={setImageGenerateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              确认生成分镜图片
            </DialogTitle>
            <DialogDescription>
              请确认分镜信息，生成图片时会根据以下内容创作
            </DialogDescription>
          </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* 提示信息 */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  AI 将根据以下信息生成分镜图片，确保人物外观保持一致。您可以在这里微调内容。
                </AlertDescription>
              </Alert>

              {/* 分镜序号 */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  分镜 {selectedScene?.sceneNumber}
                </Badge>
                {selectedScene?.title && (
                  <span className="font-semibold">{selectedScene.title}</span>
                )}
              </div>

              {/* 场景描述 */}
              <div className="space-y-2">
                <Label htmlFor="gen-desc">场景描述 *</Label>
                <Textarea
                  id="gen-desc"
                  value={imageGenerateFormData.description}
                  onChange={(e) => setImageGenerateFormData({ ...imageGenerateFormData, description: e.target.value })}
                  placeholder="详细描述场景画面：环境、构图、光线、角度等"
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  场景描述越详细，生成的画面越准确
                </p>
              </div>

              {/* 动作描述 */}
              <div className="space-y-2">
                <Label htmlFor="gen-action">动作/表演描述</Label>
                <Textarea
                  id="gen-action"
                  value={imageGenerateFormData.action}
                  onChange={(e) => setImageGenerateFormData({ ...imageGenerateFormData, action: e.target.value })}
                  placeholder="人物动作和表演描述"
                  className="min-h-[60px]"
                />
              </div>

              {/* 情绪氛围 */}
              <div className="space-y-2">
                <Label htmlFor="gen-emotion">情绪氛围</Label>
                <Input
                  id="gen-emotion"
                  value={imageGenerateFormData.emotion}
                  onChange={(e) => setImageGenerateFormData({ ...imageGenerateFormData, emotion: e.target.value })}
                  placeholder="如：紧张、温馨、悲伤"
                />
              </div>

              {/* 出场人物选择 */}
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span>出场人物</span>
                  <span className="text-xs text-muted-foreground">
                    已选择 {imageGenerateFormData.characterIds.length} 人
                  </span>
                </Label>

                {imageGenerateFormData.characterIds.length === 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      未选择出场人物，可能影响人物一致性
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-2">
                  {characters.map((char) => {
                    const isSelected = imageGenerateFormData.characterIds.includes(char.id)
                    return (
                      <label
                        key={char.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-secondary hover:bg-secondary/80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setImageGenerateFormData({
                                ...imageGenerateFormData,
                                characterIds: [...imageGenerateFormData.characterIds, char.id]
                              })
                            } else {
                              setImageGenerateFormData({
                                ...imageGenerateFormData,
                                characterIds: imageGenerateFormData.characterIds.filter((id: string) => id !== char.id)
                              })
                            }
                          }}
                        />
                        <span className="font-medium">{char.name}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* 参考图片预览 */}
              {imageGenerateFormData.characterIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    人物参考图
                    <span className="text-xs text-muted-foreground">
                      (AI 将根据这些图片保持人物外观一致)
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {imageGenerateFormData.characterIds.map((charId) => {
                      const char = characters.find(c => c.id === charId)
                      if (!char) return null

                      // 获取角色参考图 URL
                      let imageUrl = null
                      // 优先使用 frontViewKey
                      if (char.frontViewKey) {
                        if (char.frontViewKey.startsWith('http')) {
                          imageUrl = char.frontViewKey
                        } else {
                          // frontViewKey 可能是 "char_xxx/views_xxx.png" 或 "characters/char_xxx/views_xxx.png"
                          // 需要去除 "characters/" 前缀（如果存在）
                          const cleanKey = char.frontViewKey.startsWith('characters/')
                            ? char.frontViewKey.replace('characters/', '')
                            : char.frontViewKey
                          imageUrl = `/characters/${cleanKey}`
                        }
                      }
                      // 其次使用 imageUrl
                      if (!imageUrl && char.imageUrl) {
                        if (char.imageUrl.startsWith('http')) {
                          imageUrl = char.imageUrl
                        } else {
                          const cleanKey = char.imageUrl.startsWith('characters/')
                            ? char.imageUrl.replace('characters/', '')
                            : char.imageUrl
                          imageUrl = `/characters/${cleanKey}`
                        }
                      }

                      // 调试日志
                      console.log(`[Scene Image] Character ${char.name}:`, {
                        id: char.id,
                        frontViewKey: char.frontViewKey,
                        imageUrl: char.imageUrl,
                        finalImageUrl: imageUrl
                      })

                      return (
                        <div key={char.id} className="space-y-1">
                          <div className="aspect-square rounded-lg bg-secondary/50 overflow-hidden border">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={char.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error(`[Scene Image] Failed to load image for ${char.name}:`, imageUrl, e)
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    const noImageDiv = document.createElement('div')
                                    noImageDiv.className = 'w-full h-full flex items-center justify-center'
                                    noImageDiv.innerHTML = '<span class="text-xs text-muted-foreground">无参考图</span>'
                                    parent.appendChild(noImageDiv)
                                  }
                                }}
                                onLoad={() => {
                                  console.log(`[Scene Image] Successfully loaded image for ${char.name}:`, imageUrl)
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">无参考图</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-center text-muted-foreground">{char.name}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setImageGenerateDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmGenerateImage}
                disabled={imageGenerateFormData.characterIds.length === 0 || !imageGenerateFormData.description.trim()}
                className="amber-gradient text-white border-0"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                确认生成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 视频生成确认对话框 */}
        <Dialog open={videoGenerateDialogOpen} onOpenChange={setVideoGenerateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-blue-500" />
                确认生成分镜视频
              </DialogTitle>
              <DialogDescription>
                请确认视频生成参数，AI 将根据首尾帧生成连贯的视频片段
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* 提示信息 */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  视频生成将使用当前分镜图片作为首帧，确保画面连贯性。您可以在这里调整时长和内容。
                </AlertDescription>
              </Alert>

              {/* 分镜序号 */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  分镜 {selectedScene?.sceneNumber}
                </Badge>
                {selectedScene?.title && (
                  <span className="font-semibold">{selectedScene.title}</span>
                )}
              </div>

              {/* 首尾帧预览 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 首帧 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    首帧（当前分镜）
                  </Label>
                  <div className="aspect-video rounded-lg bg-secondary/50 overflow-hidden border">
                    {selectedScene?.imageUrl ? (
                      <img
                        src={selectedScene.imageUrl}
                        alt={`分镜 ${selectedScene.sceneNumber}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">无图片</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 尾帧 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    尾帧（下一个分镜）
                  </Label>
                  <div className="aspect-video rounded-lg bg-secondary/50 overflow-hidden border">
                    {videoGenerateFormData.lastFrameSceneId ? (() => {
                      const nextScene = scenes.find(s => s.id === videoGenerateFormData.lastFrameSceneId)
                      return nextScene?.imageUrl ? (
                        <img
                          src={nextScene.imageUrl}
                          alt={`分镜 ${nextScene.sceneNumber}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">无图片</span>
                        </div>
                      )
                    })() : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">未选择尾帧</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 尾帧选择 */}
              <div className="space-y-3">
                <Label>选择尾帧参考（可选）</Label>
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      videoGenerateFormData.lastFrameSceneId === null
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="lastFrame"
                      className="hidden"
                      checked={videoGenerateFormData.lastFrameSceneId === null}
                      onChange={() => setVideoGenerateFormData({ ...videoGenerateFormData, lastFrameSceneId: null })}
                    />
                    <span className="font-medium">不使用尾帧</span>
                    {videoGenerateFormData.lastFrameSceneId === null && <Check className="w-4 h-4" />}
                  </label>

                  {scenes
                    .filter(s => selectedScene && s.sceneNumber === selectedScene.sceneNumber + 1)
                    .filter(s => s.imageKey || s.imageUrl)
                    .map((scene) => (
                      <label
                        key={scene.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          videoGenerateFormData.lastFrameSceneId === scene.id
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-secondary hover:bg-secondary/80"
                        }`}
                      >
                        <input
                          type="radio"
                          name="lastFrame"
                          className="hidden"
                          checked={videoGenerateFormData.lastFrameSceneId === scene.id}
                          onChange={() => setVideoGenerateFormData({ ...videoGenerateFormData, lastFrameSceneId: scene.id })}
                        />
                        <span className="font-medium">分镜 {scene.sceneNumber}</span>
                        {scene.title && <span className="text-xs text-muted-foreground">({scene.title})</span>}
                        {videoGenerateFormData.lastFrameSceneId === scene.id && <Check className="w-4 h-4" />}
                      </label>
                    ))}
                </div>
                {!selectedScene || scenes.filter(s => s.sceneNumber === selectedScene.sceneNumber + 1).filter(s => s.imageKey || s.imageUrl).length === 0 && (
                  <p className="text-xs text-muted-foreground">下一个分镜还没有图片，无法选择尾帧</p>
                )}
              </div>

              {/* 时长选择 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="duration">视频时长</Label>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {videoGenerateFormData.duration} 秒
                  </Badge>
                </div>
                <Slider
                  id="duration"
                  min={4}
                  max={15}
                  step={1}
                  value={[videoGenerateFormData.duration]}
                  onValueChange={(value) => setVideoGenerateFormData({ ...videoGenerateFormData, duration: value[0] })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>4秒（快速过渡）</span>
                  <span>15秒（详细场景）</span>
                </div>
              </div>

              {/* 比例选择 */}
              <div className="space-y-2">
                <Label>视频比例</Label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                      videoGenerateFormData.ratio === "16:9"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-secondary hover:bg-secondary/80 border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ratio"
                      className="hidden"
                      checked={videoGenerateFormData.ratio === "16:9"}
                      onChange={() => setVideoGenerateFormData({ ...videoGenerateFormData, ratio: "16:9" })}
                    />
                    <div className="text-center">
                      <div className="w-8 h-5 border-2 border-current rounded-sm mb-1 mx-auto" />
                      <span className="text-sm font-medium">16:9</span>
                      <div className="text-xs text-muted-foreground">横屏</div>
                    </div>
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                      videoGenerateFormData.ratio === "9:16"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-secondary hover:bg-secondary/80 border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ratio"
                      className="hidden"
                      checked={videoGenerateFormData.ratio === "9:16"}
                      onChange={() => setVideoGenerateFormData({ ...videoGenerateFormData, ratio: "9:16" })}
                    />
                    <div className="text-center">
                      <div className="w-5 h-8 border-2 border-current rounded-sm mb-1 mx-auto" />
                      <span className="text-sm font-medium">9:16</span>
                      <div className="text-xs text-muted-foreground">竖屏</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 对话编辑 */}
              <div className="space-y-2">
                <Label htmlFor="video-dialogue">对话内容</Label>
                <Textarea
                  id="video-dialogue"
                  value={videoGenerateFormData.dialogue}
                  onChange={(e) => setVideoGenerateFormData({ ...videoGenerateFormData, dialogue: e.target.value })}
                  placeholder="角色的对白内容（如需要）"
                  className="min-h-[80px]"
                />
              </div>

              {/* 动作编辑 */}
              <div className="space-y-2">
                <Label htmlFor="video-action">动作描述</Label>
                <Textarea
                  id="video-action"
                  value={videoGenerateFormData.action}
                  onChange={(e) => setVideoGenerateFormData({ ...videoGenerateFormData, action: e.target.value })}
                  placeholder="描述视频中的动作和表演"
                  className="min-h-[60px]"
                />
              </div>

              {/* 情绪编辑 */}
              <div className="space-y-2">
                <Label htmlFor="video-emotion">情绪氛围</Label>
                <Input
                  id="video-emotion"
                  value={videoGenerateFormData.emotion}
                  onChange={(e) => setVideoGenerateFormData({ ...videoGenerateFormData, emotion: e.target.value })}
                  placeholder="如：紧张、温馨、悲伤"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setVideoGenerateDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmGenerateVideo}
                disabled={!selectedScene}
                className="blue-gradient text-white border-0"
              >
                <Film className="w-4 h-4 mr-2" />
                开始生成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {filteredScenes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {selectedScriptId
                ? `「${scripts.find(s => s.id === selectedScriptId)?.title}」还没有分镜，点击上方按钮添加`
                : "还没有分镜，点击上方按钮添加"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredScenes.map((scene) => (
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
    let duration = 4; // 基础4秒

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

    return Math.min(Math.max(duration, 4), 15);
  }

  const estimatedDuration = calculateDuration();

  // 获取出场人物名称
  const sceneCharacters = scene.characterIds
    .map(id => characters.find(c => c.id === id)?.name)
    .filter(Boolean)

  const hasImage = scene.imageKey || scene.imageUrl
  const hasVideo = scene.videoUrl
  const [videoError, setVideoError] = useState(false)

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row">
        {/* 图片/视频区域 */}
        <div className="md:w-1/4 aspect-video md:aspect-auto bg-secondary/50 relative overflow-hidden">
          {hasVideo && !videoError ? (
            // 显示视频
            <video 
              src={scene.videoUrl || ''} 
              className="w-full h-full object-cover"
              muted
              loop
              onMouseEnter={(e) => {
                e.currentTarget.play().catch(() => {
                  // 播放被中断或失败，正常情况
                })
              }}
              onMouseLeave={(e) => {
                e.currentTarget.pause()
                e.currentTarget.currentTime = 0
              }}
              onError={() => {
                setVideoError(true)
              }}
            />
          ) : videoError && hasVideo ? (
            // 视频加载失败，显示错误提示
            <div className="absolute inset-0 flex items-center justify-center bg-secondary">
              <div className="text-center">
                <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">视频加载失败</p>
              </div>
            </div>
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
          <div className="flex gap-2 mt-3 items-center flex-wrap">
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
            {hasImage && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={onGenerateImage}
                  disabled={generatingImage}
                >
                  {generatingImage ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  重新生成图片
                </Button>
                {!hasVideo && (
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
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
