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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit,
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
} from "lucide-react"
import { toast } from "sonner"

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
}

interface EpisodesPanelProps {
  projectId: string
  onUpdate: () => void
  onSelectEpisode: (episodeId: string | null) => void
  selectedEpisodeId: string | null
}

export function EpisodesPanel({ projectId, onUpdate, onSelectEpisode, selectedEpisodeId }: EpisodesPanelProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [creating, setCreating] = useState(false)
  const [merging, setMerging] = useState<Set<string>>(new Set())
  const [currentSeason, setCurrentSeason] = useState(1)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  })

  const fetchEpisodes = async () => {
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
  }

  useEffect(() => {
    fetchEpisodes()
  }, [projectId])

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

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error("请输入剧集标题")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          seasonNumber: currentSeason,
          episodeNumber: getNextEpisodeNumber(),
          title: formData.title,
          description: formData.description,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "创建失败")
      }

      toast.success(`剧集 "${formData.title}" 创建成功`)
      setCreateDialogOpen(false)
      setFormData({ title: "", description: "" })
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
    if (!confirm("确定要删除这个剧集吗？")) return

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

      toast.success(`视频合成成功，共 ${data.sceneCount} 个分镜`)
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
      const res = await fetch(`/api/episodes/${episode.id}/merge-videos`)
      if (!res.ok) throw new Error("下载失败")

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

  const openEditDialog = (episode: Episode) => {
    setSelectedEpisode(episode)
    setFormData({
      title: episode.title,
      description: episode.description || "",
    })
    setEditDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">待合成</Badge>
      case "merging":
        return <Badge variant="default" className="bg-blue-500">合成中</Badge>
      case "completed":
        return <Badge variant="default" className="bg-green-500">已合成</Badge>
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
            组织和管理您的剧集内容
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />
              新建剧集
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建剧集</DialogTitle>
              <DialogDescription>
                创建一个新的剧集分集
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">剧集标题</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例如：第一章：相遇"
                />
              </div>
              <div>
                <Label htmlFor="description">剧集描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="简要描述本集内容..."
                  rows={3}
                />
              </div>
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
      </div>

      {/* 季选择器 */}
      {seasons.length > 1 && (
        <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
          <Label className="text-base font-medium">选择季数:</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentSeason(Math.max(1, currentSeason - 1))}
              disabled={currentSeason <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 py-2 bg-background border rounded-lg min-w-[100px] text-center">
              <span className="text-lg font-bold">第 {currentSeason} 季</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentSeason(Math.min(Math.max(...seasons), currentSeason + 1))}
              disabled={currentSeason >= Math.max(...seasons)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
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
          <CardContent className="py-12 text-center">
            <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">还没有剧集</h3>
            <p className="text-muted-foreground mb-4">点击"新建剧集"按钮创建第一个剧集</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              创建剧集
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {currentSeasonEpisodes.map((episode) => (
            <Card key={episode.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-6">
                  {/* 拖拽手柄 */}
                  <div className="text-muted-foreground">
                    <GripVertical className="w-5 h-5 cursor-move" />
                  </div>

                  {/* 剧集信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="secondary" className="font-medium">
                        E{episode.episode_number}
                      </Badge>
                      <h3 className="text-lg font-semibold truncate">{episode.title}</h3>
                      {getStatusBadge(episode.merged_video_status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {episode.description || "暂无描述"}
                    </p>
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
                    </div>
                  </div>

                  {/* 视频预览 */}
                  {episode.merged_video_status === "completed" && episode.merged_video_url && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => episode.merged_video_url && window.open(episode.merged_video_url, '_blank')}
                        disabled={!episode.merged_video_url}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        播放
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(episode)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载
                      </Button>
                    </div>
                  )}

                  {/* 操作菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(episode)}>
                        <Edit className="w-4 h-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleMerge(episode.id)}
                        disabled={merging.has(episode.id)}
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
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* 合成进度条 */}
                {episode.merged_video_status === "merging" && (
                  <div className="px-6 pb-6">
                    <Progress value={33} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">正在合成视频...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑剧集</DialogTitle>
            <DialogDescription>
              修改剧集信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">剧集标题</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例如：第一章：相遇"
              />
            </div>
            <div>
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
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
