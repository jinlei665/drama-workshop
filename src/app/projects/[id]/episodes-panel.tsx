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
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit, 
  ChevronRight,
  ChevronDown,
  Film,
  Folder,
  Play,
  Loader2,
  Download,
  Merge,
  Video,
  FileVideo
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
  const [merging, setMerging] = useState<string | null>(null)
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]))
  const [formData, setFormData] = useState({
    seasonNumber: 1,
    episodeNumber: 1,
    title: "",
    description: "",
  })

  const fetchEpisodes = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/episodes?projectId=${projectId}`)
      const data = await res.json()
      setEpisodes(data.episodes || [])
      
      // 自动展开有剧集的季
      const seasons = new Set<number>()
      ;(data.episodes || []).forEach((ep: Episode) => seasons.add(ep.season_number))
      setExpandedSeasons(seasons)
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

  // 计算下一集的季数和集数
  const getNextEpisodeNumber = () => {
    const lastEpisode = episodes[episodes.length - 1]
    if (lastEpisode) {
      return {
        seasonNumber: lastEpisode.season_number,
        episodeNumber: lastEpisode.episode_number + 1,
      }
    }
    return { seasonNumber: 1, episodeNumber: 1 }
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
          seasonNumber: formData.seasonNumber,
          episodeNumber: formData.episodeNumber,
          title: formData.title,
          description: formData.description,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "创建失败")
      }

      toast.success("剧集创建成功")
      setCreateDialogOpen(false)
      setFormData({
        seasonNumber: getNextEpisodeNumber().seasonNumber,
        episodeNumber: getNextEpisodeNumber().episodeNumber,
        title: "",
        description: "",
      })
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

    setCreating(true)
    try {
      const res = await fetch(`/api/episodes/${selectedEpisode.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "更新失败")
      }

      toast.success("剧集更新成功")
      setEditDialogOpen(false)
      setSelectedEpisode(null)
      fetchEpisodes()
      onUpdate()
    } catch (error) {
      console.error("更新剧集失败:", error)
      toast.error("更新剧集失败")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (episodeId: string) => {
    if (!confirm("确定要删除这个剧集吗？剧集下的所有分镜也会被删除。")) return

    try {
      const res = await fetch(`/api/episodes/${episodeId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("删除失败")
      
      toast.success("剧集已删除")
      fetchEpisodes()
      onUpdate()
    } catch (error) {
      console.error("删除剧集失败:", error)
      toast.error("删除剧集失败")
    }
  }

  const handleMerge = async (episodeId: string) => {
    setMerging(episodeId)
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
      setMerging(null)
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

  const toggleSeason = (season: number) => {
    const newExpanded = new Set(expandedSeasons)
    if (newExpanded.has(season)) {
      newExpanded.delete(season)
    } else {
      newExpanded.add(season)
    }
    setExpandedSeasons(newExpanded)
  }

  const openEditDialog = (episode: Episode) => {
    setSelectedEpisode(episode)
    setFormData({
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
      title: episode.title,
      description: episode.description || "",
    })
    setEditDialogOpen(true)
  }

  const getMergeStatusBadge = (status: string) => {
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
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">剧集管理</h2>
          <p className="text-sm text-muted-foreground">
            管理剧集分集，组织分镜内容
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="amber-gradient text-white border-0">
              <Plus className="w-4 h-4 mr-2" />
              添加剧集
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加剧集</DialogTitle>
              <DialogDescription>创建新的剧集分集</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>季数</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.seasonNumber}
                    onChange={(e) => setFormData({ ...formData, seasonNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>集数</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.episodeNumber}
                    onChange={(e) => setFormData({ ...formData, episodeNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>标题 *</Label>
                <Input
                  placeholder="如：1.病房惊变"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>简介</Label>
                <Textarea
                  placeholder="剧集简介（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
                <Button onClick={handleCreate} disabled={creating} className="amber-gradient text-white border-0">
                  {creating ? "创建中..." : "创建"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑剧集</DialogTitle>
              <DialogDescription>修改剧集信息</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>季数</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.seasonNumber}
                    onChange={(e) => setFormData({ ...formData, seasonNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>集数</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.episodeNumber}
                    onChange={(e) => setFormData({ ...formData, episodeNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>标题 *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>简介</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
                <Button onClick={handleUpdate} disabled={creating} className="amber-gradient text-white border-0">
                  {creating ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(groupedEpisodes).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">还没有剧集，点击上方按钮添加</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedEpisodes)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([season, seasonEpisodes]) => (
              <Card key={season} className="overflow-hidden">
                <CardHeader 
                  className="py-3 cursor-pointer hover:bg-secondary/50"
                  onClick={() => toggleSeason(Number(season))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedSeasons.has(Number(season)) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Folder className="w-4 h-4 text-amber-500" />
                      <CardTitle className="text-sm">第 {season} 季</CardTitle>
                      <Badge variant="secondary">{seasonEpisodes.length} 集</Badge>
                    </div>
                  </div>
                </CardHeader>
                
                {expandedSeasons.has(Number(season)) && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {seasonEpisodes
                        .sort((a, b) => a.episode_number - b.episode_number)
                        .map((episode) => (
                          <div
                            key={episode.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedEpisodeId === episode.id 
                                ? 'border-primary bg-primary/5' 
                                : 'hover:bg-secondary/50'
                            }`}
                            onClick={() => onSelectEpisode(episode.id)}
                          >
                            <div className="flex items-center gap-3">
                              <FileVideo className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm">
                                  E{episode.episode_number}. {episode.title}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{episode.sceneCount || 0} 分镜</span>
                                  {getMergeStatusBadge(episode.merged_video_status)}
                                </div>
                              </div>
                            </div>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>操作</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(episode)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMerge(episode.id)} disabled={merging === episode.id}>
                                  {merging === episode.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Merge className="w-4 h-4 mr-2" />
                                  )}
                                  合成视频
                                </DropdownMenuItem>
                                {episode.merged_video_status === "completed" && (
                                  <DropdownMenuItem onClick={() => handleDownload(episode)}>
                                    <Download className="w-4 h-4 mr-2" />
                                    下载视频
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDelete(episode.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
