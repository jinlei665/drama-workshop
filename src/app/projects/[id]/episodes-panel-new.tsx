"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit3,
  Play,
  Loader2,
  Download,
  Film,
  FileVideo,
  Clock,
  Layers,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Eye,
  Image as ImageIcon,
  Video,
  Sparkles,
  ListOrdered,
  ArrowUpDown,
  Move,
  Settings2,
  ListFilter,
  SplitSquareHorizontal,
  Scissors,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Scene {
  id: string
  sceneNumber: number
  scene_number?: number
  title: string | null
  description: string
  dialogue: string | null
  imageUrl: string | null
  image_url?: string | null
  videoUrl: string | null
  video_url?: string | null
  videoStatus?: string
  video_status?: string
  status: string
  episodeId?: string | null
  episode_id?: string | null
}

interface Episode {
  id: string
  season_number: number
  episode_number: number
  title: string
  description: string | null
  merged_video_url: string | null
  merged_video_status: string
  sceneCount?: number
  duration?: number
  scenes?: Scene[]
}

interface EpisodesPanelProps {
  projectId: string
  onUpdate: () => void
  onSelectEpisode: (episodeId: string | null) => void
  selectedEpisodeId: string | null
  scenes: Scene[]
}

export function EpisodesPanel({ 
  projectId, 
  onUpdate, 
  onSelectEpisode, 
  selectedEpisodeId,
  scenes = [] 
}: EpisodesPanelProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [episodeDetailOpen, setEpisodeDetailOpen] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [creating, setCreating] = useState(false)
  const [merging, setMerging] = useState<Set<string>>(new Set())
  const [currentSeason, setCurrentSeason] = useState(1)
  const [draggedEpisode, setDraggedEpisode] = useState<Episode | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  })
  const [sceneAssignment, setSceneAssignment] = useState<{
    sceneIds: string[]
    mode: 'all' | 'selected' | 'range'
  }>({
    sceneIds: [],
    mode: 'all'
  })
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set())
  const [sceneRange, setSceneRange] = useState({ start: 1, end: 1 })

  const fetchEpisodes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/episodes?projectId=${projectId}`)
      const data = await res.json()
      setEpisodes(data.episodes || [])
    } catch (error) {
      console.error("获取剧集失败:", error)
      toast.error("获取剧集失败")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchEpisodes()
  }, [fetchEpisodes])

  // 按季分组
  const groupedEpisodes = episodes.reduce((acc, ep) => {
    const season = ep.season_number
    if (!acc[season]) acc[season] = []
    acc[season].push(ep)
    return acc
  }, {} as Record<number, Episode[]>)

  // 获取所有季
  const seasons = Object.keys(groupedEpisodes)
    .map(Number)
    .sort((a, b) => a - b)

  // 当前季的剧集
  const currentSeasonEpisodes = (groupedEpisodes[currentSeason] || []).sort(
    (a, b) => a.episode_number - b.episode_number
  )

  // 获取下一集编号
  const getNextEpisodeNumber = () => {
    const maxEpisode = Math.max(...currentSeasonEpisodes.map(ep => ep.episode_number), 0)
    return maxEpisode + 1
  }

  // 获取未分配的分镜（同时兼容 camelCase 和 snake_case）
  const unassignedScenes = scenes.filter(s => !s.episodeId && !s.episode_id)

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error("请输入剧集标题")
      return
    }

    setCreating(true)
    try {
      const requestBody: Record<string, any> = {
        projectId,
        seasonNumber: currentSeason,
        episodeNumber: getNextEpisodeNumber(),
        title: formData.title,
        description: formData.description,
      }

      // 根据模式分配分镜
      if (sceneAssignment.mode === 'selected' && sceneAssignment.sceneIds.length > 0) {
        requestBody.sceneIds = sceneAssignment.sceneIds
      } else if (sceneAssignment.mode === 'range' && sceneRange.start && sceneRange.end) {
        requestBody.sceneStart = sceneRange.start
        requestBody.sceneEnd = sceneRange.end
      }

      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "创建失败")
      }

      toast.success(`剧集 "${formData.title}" 创建成功`)
      setCreateDialogOpen(false)
      setFormData({ title: "", description: "" })
      setSceneAssignment({ sceneIds: [], mode: 'all' })
      fetchEpisodes()
      onUpdate()
    } catch (error) {
      console.error("创建剧集失败:", error)
      toast.error(error instanceof Error ? error.message : "创建剧集失败")
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedEpisode) return
    if (!formData.title.trim()) {
      toast.error("请输入剧集标题")
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/episodes/${selectedEpisode.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "更新失败")
      }

      toast.success("剧集更新成功")
      setEditDialogOpen(false)
      setFormData({ title: "", description: "" })
      setSelectedEpisode(null)
      fetchEpisodes()
      onUpdate()
    } catch (error) {
      console.error("更新剧集失败:", error)
      toast.error(error instanceof Error ? error.message : "更新剧集失败")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (episodeId: string) => {
    if (!confirm("确定要删除这个剧集吗？相关分镜将保留但不再关联到此剧集。")) return

    try {
      const res = await fetch(`/api/episodes/${episodeId}`, { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "删除失败")
      }

      toast.success("剧集删除成功")
      fetchEpisodes()
      onUpdate()
    } catch (error) {
      console.error("删除剧集失败:", error)
      toast.error(error instanceof Error ? error.message : "删除剧集失败")
    }
  }

  const handleMerge = async (episodeId: string) => {
    setMerging(new Set([...merging, episodeId]))
    try {
      const res = await fetch(`/api/episodes/${episodeId}/merge-videos`, { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "合成失败")
      }

      toast.success(`视频合成任务已启动，共 ${data.sceneCount} 个分镜`)
      fetchEpisodes()
    } catch (error) {
      console.error("合成视频失败:", error)
      toast.error(error instanceof Error ? error.message : "合成视频失败")
    } finally {
      setMerging(new Set([...merging].filter(id => id !== episodeId)))
    }
  }

  const handleDownload = async (episode: Episode) => {
    if (!episode.merged_video_url) {
      toast.error("该剧集尚未合成视频")
      return
    }

    try {
      const res = await fetch(episode.merged_video_url)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `S${episode.season_number}E${episode.episode_number}_${episode.title || 'episode'}.mp4`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("下载视频失败:", error)
      toast.error("下载视频失败")
    }
  }

  // 打开编辑对话框
  const openEditDialog = (episode: Episode) => {
    setSelectedEpisode(episode)
    setFormData({
      title: episode.title,
      description: episode.description || "",
    })
    setEditDialogOpen(true)
  }

  // 打开剧集详情
  const openEpisodeDetail = async (episode: Episode) => {
    // 先打开对话框并显示基本信息
    setSelectedEpisode(episode)
    setEpisodeDetailOpen(true)
    
    // 获取该剧集的分镜列表
    try {
      const res = await fetch(`/api/episodes/${episode.id}`)
      const data = await res.json()
      
      // 即使 API 返回错误，只要剧集存在就更新显示
      if (data.episode) {
        setSelectedEpisode({ 
          ...episode, 
          scenes: data.episode.scenes || [],
          description: data.episode.description || episode.description
        })
      } else if (data.error) {
        console.warn("获取分镜列表失败:", data.error)
        // 仍然保持剧集信息显示
        setSelectedEpisode({ ...episode, scenes: [] })
      }
    } catch (error) {
      console.error("获取剧集详情失败:", error)
      // 保持显示基本信息
      setSelectedEpisode({ ...episode, scenes: [] })
    }
  }

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, episode: Episode) => {
    setDraggedEpisode(episode)
    e.dataTransfer.effectAllowed = 'move'
  }

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedEpisode(null)
    setDragOverIndex(null)
  }

  // 放置（重新排序）
  const handleDrop = async (e: React.DragEvent, targetEpisode: Episode) => {
    e.preventDefault()
    if (!draggedEpisode || draggedEpisode.id === targetEpisode.id) return

    // 交换剧集编号
    try {
      const res = await fetch(`/api/episodes/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId1: draggedEpisode.id,
          episodeId2: targetEpisode.id,
        }),
      })

      if (!res.ok) {
        throw new Error("排序失败")
      }

      toast.success("剧集排序已更新")
      fetchEpisodes()
    } catch (error) {
      console.error("排序失败:", error)
      toast.error("排序失败")
    }

    setDraggedEpisode(null)
    setDragOverIndex(null)
  }

  // 切换场景选中
  const toggleSceneSelection = (sceneId: string) => {
    const newSelected = new Set(selectedScenes)
    if (newSelected.has(sceneId)) {
      newSelected.delete(sceneId)
    } else {
      newSelected.add(sceneId)
    }
    setSelectedScenes(newSelected)
    setSceneAssignment({ sceneIds: Array.from(newSelected), mode: 'selected' })
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedScenes.size === unassignedScenes.length) {
      setSelectedScenes(new Set())
      setSceneAssignment({ sceneIds: [], mode: 'all' })
    } else {
      setSelectedScenes(new Set(unassignedScenes.map(s => s.id)))
      setSceneAssignment({ sceneIds: unassignedScenes.map(s => s.id), mode: 'selected' })
    }
  }

  // 从剧集中移除分镜
  const handleRemoveSceneFromEpisode = async (sceneId: string) => {
    if (!selectedEpisode) {
      toast.error("移除失败：未选择剧集")
      return
    }

    console.log("移除分镜:", { episodeId: selectedEpisode.id, sceneId })

    try {
      const res = await fetch(`/api/scenes/${sceneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: null }),
      })

      const data = await res.json()
      console.log("移除结果:", data)

      if (!res.ok) {
        throw new Error(data.error || "移除失败")
      }

      toast.success("分镜已从剧集中移除")
      
      // 直接更新本地状态：移除分镜
      setSelectedEpisode(prev => prev ? {
        ...prev,
        scenes: (prev.scenes || []).filter(s => s.id !== sceneId),
      } : null)
      
      fetchEpisodes()
      onUpdate()
    } catch (error) {
      console.error("移除分镜失败:", error)
      toast.error(error instanceof Error ? error.message : "移除分镜失败")
    }
  }

  // 将分镜添加到剧集
  const handleAddScenesToEpisode = async (sceneIds: string[]) => {
    if (!selectedEpisode || sceneIds.length === 0) {
      console.warn("无法添加分镜: selectedEpisode 为空或 sceneIds 为空", { selectedEpisode, sceneIds })
      toast.error("添加失败：数据不完整")
      return
    }

    console.log("添加分镜:", { episodeId: selectedEpisode.id, sceneIds })
    console.log("当前 scenes 数组长度:", scenes.length)
    console.log("当前 selectedEpisode.scenes 长度:", selectedEpisode.scenes?.length)

    try {
      const res = await fetch(`/api/scenes/batch-update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneIds,
          episodeId: selectedEpisode.id,
        }),
      })

      const data = await res.json()
      console.log("添加结果:", data)

      if (!res.ok) {
        throw new Error(data.error || "添加失败")
      }

      toast.success(`已添加 ${sceneIds.length} 个分镜到剧集`)
      
      // 直接更新本地状态：添加分镜到列表（去重）
      const existingSceneIds = new Set((selectedEpisode.scenes || []).map(s => s.id))
      const newScenes = [
        ...(selectedEpisode.scenes || []),
        ...scenes
          .filter(s => sceneIds.includes(s.id) && !existingSceneIds.has(s.id))
          .map(s => ({ ...s, episode_id: selectedEpisode.id, episodeId: selectedEpisode.id }))
      ]
      console.log("新的分镜列表长度:", newScenes.length)
      
      setSelectedEpisode(prev => prev ? { ...prev, scenes: newScenes } : null)
      fetchEpisodes()
      onUpdate()
    } catch (error) {
      console.error("添加分镜失败:", error)
      toast.error(error instanceof Error ? error.message : "添加分镜失败")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">待合成</Badge>
      case "merging":
        return <Badge variant="default" className="bg-blue-500">合成中</Badge>
      case "completed":
        return <Badge variant="default" className="bg-green-500">已完成</Badge>
      case "failed":
        return <Badge variant="destructive">合成失败</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* 标题和操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Film className="w-6 h-6" />
            剧集管理
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            组织和管理您的剧集内容，支持拖拽排序
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unassignedScenes.length > 0 && (
            <Badge variant="outline" className="px-3 py-1">
              <Layers className="w-3 h-3 mr-1" />
              {unassignedScenes.length} 个未分配分镜
            </Badge>
          )}
          <Button onClick={() => {
            setSceneAssignment({ sceneIds: [], mode: 'all' })
            setCreateDialogOpen(true)
          }}>
            <Plus className="w-4 h-4 mr-2" />
            新建剧集
          </Button>
        </div>
      </div>

      {/* 季选择器 */}
      {seasons.length > 0 && (
        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">当前季:</Label>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentSeason(Math.max(1, currentSeason - 1))}
                disabled={currentSeason <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-1.5 bg-background border rounded-md min-w-[80px] text-center font-medium">
                第 {currentSeason} 季
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentSeason(Math.min(Math.max(...seasons, 1), currentSeason + 1))}
                disabled={currentSeason >= Math.max(...seasons, 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentSeason(1)}
              className={cn(currentSeason === 1 && "bg-primary/10")}
            >
              第1季
            </Button>
            {seasons.filter(s => s !== 1).map(season => (
              <Button
                key={season}
                variant="outline"
                size="sm"
                onClick={() => setCurrentSeason(season)}
                className={cn(currentSeason === season && "bg-primary/10")}
              >
                第{season}季
              </Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground ml-auto">
            共 {currentSeasonEpisodes.length} 集
          </span>
        </div>
      )}

      {/* 剧集列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : currentSeasonEpisodes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Film className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">还没有剧集</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              点击"新建剧集"按钮创建第一个剧集，可以将未分配的分镜添加到剧集中
            </p>
            <Button onClick={() => {
              setSceneAssignment({ sceneIds: [], mode: 'all' })
              setCreateDialogOpen(true)
            }}>
              <Plus className="w-4 h-4 mr-2" />
              创建剧集
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {currentSeasonEpisodes.map((episode, index) => (
            <Card 
              key={episode.id}
              className={cn(
                "transition-all duration-200",
                draggedEpisode?.id === episode.id && "opacity-50",
                dragOverIndex === index && "ring-2 ring-primary"
              )}
              draggable
              onDragStart={(e) => handleDragStart(e, episode)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, episode)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* 拖拽手柄 */}
                  <div className="text-muted-foreground hover:text-foreground cursor-move">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* 剧集编号 */}
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-lg font-bold text-lg",
                    selectedEpisodeId === episode.id 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}>
                    {episode.episode_number}
                  </div>

                  {/* 剧集信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{episode.title}</h3>
                      {getStatusBadge(episode.merged_video_status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {episode.sceneCount || 0} 个分镜
                      </span>
                      {episode.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.floor(episode.duration / 60)}:{(episode.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                      {episode.description && (
                        <span className="truncate max-w-[200px]">{episode.description}</span>
                      )}
                    </div>
                  </div>

                  {/* 视频预览 */}
                  {episode.merged_video_status === "completed" && episode.merged_video_url && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(episode.merged_video_url!, '_blank')}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        预览
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(episode)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEpisodeDetail(episode)}
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(episode)}>
                          <Edit3 className="w-4 h-4 mr-2" />
                          编辑信息
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleMerge(episode.id)}
                          disabled={merging.has(episode.id) || (episode.sceneCount || 0) === 0}
                        >
                          {merging.has(episode.id) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              合成中...
                            </>
                          ) : (
                            <>
                              <FileVideo className="w-4 h-4 mr-2" />
                              合成视频
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(episode.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除剧集
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 新建剧集对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建剧集</DialogTitle>
            <DialogDescription>
              创建一个新的剧集分集，可以将未分配的分镜添加到该剧集中
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">剧集标题</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例如：第一集：相遇"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="season">所属季</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">第</span>
                  <Input
                    id="season"
                    type="number"
                    min={1}
                    value={currentSeason}
                    onChange={(e) => setCurrentSeason(parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  <span className="text-sm">季</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">剧集描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="简要描述本集内容..."
                rows={2}
              />
            </div>

            {/* 分镜分配 */}
            {unassignedScenes.length > 0 && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    分配分镜 ({unassignedScenes.length} 个未分配)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSceneAssignment({ ...sceneAssignment, mode: 'all' })}
                      className={cn(sceneAssignment.mode === 'all' && "bg-primary/10")}
                    >
                      全部
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSceneAssignment({ ...sceneAssignment, mode: 'selected' })}
                      className={cn(sceneAssignment.mode === 'selected' && "bg-primary/10")}
                    >
                      选择
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSceneAssignment({ ...sceneAssignment, mode: 'range' })}
                      className={cn(sceneAssignment.mode === 'range' && "bg-primary/10")}
                    >
                      范围
                    </Button>
                  </div>
                </div>

                {sceneAssignment.mode === 'selected' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                      >
                        {selectedScenes.size === unassignedScenes.length ? "取消全选" : "全选"}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        已选择 {selectedScenes.size} 个分镜
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-2 bg-background rounded border">
                      {unassignedScenes.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => toggleSceneSelection(scene.id)}
                          className={cn(
                            "p-2 rounded text-sm font-medium transition-colors",
                            selectedScenes.has(scene.id)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          )}
                        >
                          {scene.sceneNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sceneAssignment.mode === 'range' && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">从</Label>
                      <Input
                        type="number"
                        min={1}
                        max={unassignedScenes.length}
                        value={sceneRange.start}
                        onChange={(e) => setSceneRange({ ...sceneRange, start: parseInt(e.target.value) || 1 })}
                        className="w-20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">到</Label>
                      <Input
                        type="number"
                        min={sceneRange.start}
                        max={unassignedScenes.length}
                        value={sceneRange.end}
                        onChange={(e) => setSceneRange({ ...sceneRange, end: parseInt(e.target.value) || sceneRange.start })}
                        className="w-20"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      共 {Math.max(0, sceneRange.end - sceneRange.start + 1)} 个分镜
                    </span>
                  </div>
                )}

                {sceneAssignment.mode === 'all' && (
                  <p className="text-sm text-muted-foreground">
                    将所有未分配的分镜 ({unassignedScenes.length} 个) 添加到此剧集
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              创建剧集
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑剧集对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑剧集</DialogTitle>
            <DialogDescription>
              修改剧集的标题和描述
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">剧集标题</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例如：第一集：相遇"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">剧集描述</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="简要描述本集内容..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 剧集详情对话框 */}
      <Dialog open={episodeDetailOpen} onOpenChange={setEpisodeDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground font-bold">
                {selectedEpisode?.episode_number}
              </div>
              <div>
                <DialogTitle>{selectedEpisode?.title}</DialogTitle>
                <DialogDescription>
                  第 {selectedEpisode?.season_number} 季 · {selectedEpisode?.episode_number} 集
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {selectedEpisode?.description && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">{selectedEpisode.description}</p>
              </div>
            )}

            {/* 分镜列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  分镜列表 ({selectedEpisode?.scenes?.length || 0})
                </h4>
              </div>

              {selectedEpisode?.scenes && selectedEpisode.scenes.length > 0 ? (
                <div className="space-y-2">
                  {selectedEpisode.scenes
                    .sort((a, b) => (a.scene_number || a.sceneNumber || 0) - (b.scene_number || b.sceneNumber || 0))
                    .map((scene, index) => (
                      <div 
                        key={scene.id}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded bg-muted font-medium text-sm">
                          {scene.scene_number || scene.sceneNumber}
                        </div>
                        {scene.image_url || scene.imageUrl ? (
                          <div className="w-20 h-14 rounded overflow-hidden bg-muted flex-shrink-0">
                            <img 
                              src={(scene.image_url || scene.imageUrl) || ''} 
                              alt={`分镜 ${scene.scene_number || scene.sceneNumber}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{scene.title || `分镜 ${scene.scene_number || scene.sceneNumber}`}</p>
                          <p className="text-xs text-muted-foreground truncate">{scene.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(scene.video_url || scene.videoUrl) ? (
                            <Badge variant="default" className="bg-green-500">已生成</Badge>
                          ) : scene.video_status === 'generating' || scene.videoStatus === 'generating' ? (
                            <Badge variant="default" className="bg-blue-500">生成中</Badge>
                          ) : (
                            <Badge variant="outline">待生成</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSceneFromEpisode(scene.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>暂无分镜</p>
                </div>
              )}
            </div>

            {/* 添加分镜 */}
            {unassignedScenes.length > 0 && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  添加分镜 ({unassignedScenes.length} 个可用)
                </h4>
                <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto p-2 bg-background rounded border">
                  {unassignedScenes.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => handleAddScenesToEpisode([scene.id])}
                      className="p-2 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-sm font-medium transition-colors"
                    >
                      {scene.sceneNumber || scene.scene_number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEpisodeDetailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
