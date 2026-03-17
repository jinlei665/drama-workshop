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
  Loader2,
  Settings,
  User,
  Film,
  Sparkles,
  Video,
  ArrowRight,
  Clock,
  FileText
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
import { SettingsDialog } from "@/components/settings-dialog"
import { ProfileDialog } from "@/components/profile-dialog"

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
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
    if (!confirm("确定要删除这个项目吗？所有相关数据都会被删除。")) return

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE"
      })

      if (!res.ok) {
        throw new Error("删除失败")
      }

      toast.success("项目已删除")
      fetchProjects()
    } catch (error) {
      console.error("删除项目失败:", error)
      toast.error("删除项目失败")
    }
  }

  // 获取状态样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="font-normal">草稿</Badge>
      case "processing":
        return <Badge className="bg-amber-500 font-normal">处理中</Badge>
      case "completed":
        return <Badge className="bg-green-500 font-normal">已完成</Badge>
      default:
        return <Badge variant="secondary" className="font-normal">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* 头部导航 */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Film className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  短剧创作工坊
                </h1>
                <p className="text-xs text-muted-foreground">
                  AI驱动的短剧视频创作平台
                </p>
              </div>
            </div>
            
            {/* 右侧操作 */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setProfileOpen(true)}
                className="rounded-full hover:bg-secondary"
              >
                <User className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="rounded-full hover:bg-secondary"
              >
                <Settings className="w-5 h-5" />
              </Button>
              
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 shadow-lg shadow-amber-500/20 rounded-full px-6">
                    <Plus className="w-4 h-4 mr-2" />
                    新建项目
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      创建新项目
                    </DialogTitle>
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
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">内容类型</Label>
                        <select
                          id="type"
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background"
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
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content">小说/脚本内容 *</Label>
                      <Textarea
                        id="content"
                        placeholder="粘贴你的小说或脚本内容，AI将自动分析提取人物和分镜..."
                        className="h-[200px] resize-none rounded-lg"
                        value={formData.sourceContent}
                        onChange={(e) => setFormData({ ...formData, sourceContent: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-lg">
                        取消
                      </Button>
                      <Button 
                        onClick={handleCreate} 
                        disabled={creating}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 rounded-lg"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            创建并分析
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-8 relative">
        {/* Hero区域 - 仅在没有项目时显示 */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-4" />
              <p className="text-muted-foreground">加载中...</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="py-16">
            {/* 欢迎卡片 */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm mb-6">
                <Sparkles className="w-4 h-4" />
                AI驱动的短剧创作工具
              </div>
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
                将文字故事转化为精美短剧视频
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                上传小说或脚本，AI自动分析人物、生成分镜、创建角色造型、合成视频，一站式完成短剧制作
              </p>
              
              {/* 功能特点 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
                <div className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-amber-500/30 hover:bg-card transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="font-semibold mb-2">智能人物分析</h3>
                  <p className="text-sm text-muted-foreground">
                    AI自动提取人物信息，生成角色造型图，保持人物一致性
                  </p>
                </div>
                
                <div className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-amber-500/30 hover:bg-card transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Image className="w-6 h-6 text-purple-500" />
                  </div>
                  <h3 className="font-semibold mb-2">自动分镜生成</h3>
                  <p className="text-sm text-muted-foreground">
                    智能拆分场景，生成真人风格分镜图，支持景别和镜头运动
                  </p>
                </div>
                
                <div className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-amber-500/30 hover:bg-card transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Video className="w-6 h-6 text-green-500" />
                  </div>
                  <h3 className="font-semibold mb-2">视频合成导出</h3>
                  <p className="text-sm text-muted-foreground">
                    分镜图片转视频，保持场景连贯性，支持一键导出
                  </p>
                </div>
              </div>

              <Button 
                size="lg"
                onClick={() => setCreateDialogOpen(true)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 shadow-xl shadow-amber-500/20 rounded-full px-8 h-12 text-base"
              >
                <Plus className="w-5 h-5 mr-2" />
                开始创建第一个项目
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 项目统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="border-0 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{projects.length}</div>
                      <div className="text-sm text-muted-foreground">总项目</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-gradient-to-br from-green-500/10 to-green-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{projects.filter(p => p.status === 'completed').length}</div>
                      <div className="text-sm text-muted-foreground">已完成</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{projects.filter(p => p.status === 'processing').length}</div>
                      <div className="text-sm text-muted-foreground">处理中</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{projects.filter(p => p.status === 'draft').length}</div>
                      <div className="text-sm text-muted-foreground">草稿</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 项目列表标题 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">我的项目</h2>
                <p className="text-sm text-muted-foreground">管理你的短剧创作项目</p>
              </div>
            </div>

            {/* 项目卡片列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Link 
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group"
                >
                  <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:border-amber-500/30 transition-all duration-300 overflow-hidden">
                    {/* 卡片顶部装饰 */}
                    <div className="h-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
                    
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg line-clamp-1 group-hover:text-amber-600 transition-colors">
                            {project.name}
                          </CardTitle>
                          <CardDescription className="mt-1 line-clamp-2">
                            {project.description || "暂无描述"}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDelete(project.id)
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除项目
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="flex items-center justify-between mb-3">
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
                      
                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">
                          创建于 {new Date(project.created_at).toLocaleDateString('zh-CN')}
                        </span>
                        <div className="flex items-center text-amber-600 text-sm font-medium group-hover:gap-2 transition-all">
                          进入项目
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              
              {/* 新建项目卡片 */}
              <Card 
                className="h-full border-dashed border-2 border-border/50 bg-card/30 backdrop-blur-sm hover:border-amber-500/50 hover:bg-card/50 transition-all duration-300 cursor-pointer"
                onClick={() => setCreateDialogOpen(true)}
              >
                <CardContent className="flex flex-col items-center justify-center h-full py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8 text-amber-600" />
                  </div>
                  <p className="font-medium text-muted-foreground">新建项目</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">开始创作新短剧</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* 配置中心对话框 */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* 个人中心对话框 */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  )
}
