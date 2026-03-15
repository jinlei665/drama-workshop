"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  BookOpen, 
  Users, 
  Image, 
  MoreVertical,
  Trash2,
  Loader2
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface Project {
  id: string
  name: string
  description: string | null
  source_type: string
  status: string
  created_at: string
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sourceContent: "",
    sourceType: "novel"
  })

  // 获取项目列表
  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects")
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error("获取项目列表失败:", error)
      toast.error("获取项目列表失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // 创建项目
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("请输入项目名称")
      return
    }
    if (!formData.sourceContent.trim()) {
      toast.error("请输入小说或脚本内容")
      return
    }

    setCreating(true)
    try {
      // 创建项目
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "创建失败")
      }

      toast.success("项目创建成功，正在分析内容...")
      
      // 分析内容
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: data.project.id,
          content: formData.sourceContent
        })
      })

      if (analyzeRes.ok) {
        toast.success("内容分析完成！")
      } else {
        toast.warning("内容分析遇到问题，请手动添加人物和分镜")
      }

      setCreateDialogOpen(false)
      setFormData({
        name: "",
        description: "",
        sourceContent: "",
        sourceType: "novel"
      })
      fetchProjects()
    } catch (error) {
      console.error("创建项目失败:", error)
      toast.error("创建项目失败")
    } finally {
      setCreating(false)
    }
  }

  // 删除项目
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个项目吗？此操作不可恢复。")) {
      return
    }

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE"
      })
      
      if (res.ok) {
        toast.success("项目已删除")
        fetchProjects()
      } else {
        throw new Error("删除失败")
      }
    } catch (error) {
      console.error("删除项目失败:", error)
      toast.error("删除项目失败")
    }
  }

  // 获取状态徽章样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">草稿</Badge>
      case "processing":
        return <Badge variant="default" className="bg-amber-500">处理中</Badge>
      case "completed":
        return <Badge variant="default" className="bg-green-500">已完成</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg amber-gradient flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">短剧漫剧创作工坊</h1>
              <p className="text-xs text-muted-foreground">将文字故事转化为精美短剧视频</p>
            </div>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="amber-gradient text-white border-0 hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                新建项目
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>创建新项目</DialogTitle>
                <DialogDescription>
                  输入小说或脚本内容，AI将自动分析并提取人物和分镜
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">项目名称 *</Label>
                    <Input
                      id="name"
                      placeholder="输入项目名称"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">内容类型</Label>
                    <select
                      id="type"
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={formData.sourceType}
                      onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })}
                    >
                      <option value="novel">小说</option>
                      <option value="script">脚本</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">项目描述</Label>
                  <Input
                    id="description"
                    placeholder="简要描述你的故事（可选）"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">小说/脚本内容 *</Label>
                  <Textarea
                    id="content"
                    placeholder="粘贴你的小说或脚本内容..."
                    className="h-[200px] resize-none overflow-y-auto font-serif"
                    value={formData.sourceContent}
                    onChange={(e) => setFormData({ ...formData, sourceContent: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    disabled={creating}
                    className="amber-gradient text-white border-0"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      "创建并分析"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-secondary flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">还没有项目</h2>
            <p className="text-muted-foreground mb-6">
              创建你的第一个漫剧项目，开始创作之旅
            </p>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="amber-gradient text-white border-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              创建项目
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">
                        <Link 
                          href={`/projects/${project.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {project.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {project.description || "暂无描述"}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDelete(project.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除项目
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>人物</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Image className="w-4 h-4" />
                        <span>分镜</span>
                      </div>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    创建于 {new Date(project.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
