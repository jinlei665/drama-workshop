/**
 * 首页 - 现代化深色主题设计
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Film, 
  Users, 
  Workflow, 
  Sparkles,
  ArrowRight,
  Clock,
  FileText,
  Settings,
  ChevronRight
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { SettingsDialog } from '@/components/settings-dialog'
import { AppShell } from '@/components/layout'
import { ModelConfigStatus } from '@/components/model-config-status'
import type { Project } from '@/lib/types'

// 画面风格配置
const VISUAL_STYLES = {
  realistic: {
    label: '真人类',
    styles: [
      { value: 'realistic_cinema', label: '电影级写实', description: '专业影视剧质感，电影级光影' },
      { value: 'realistic_drama', label: '短剧写实', description: '现代短剧风格，自然光线' },
      { value: 'realistic_period', label: '古装写实', description: '古风影视质感，唯美画面' },
      { value: 'realistic_idol', label: '偶像剧', description: '韩剧/偶像剧风格，柔美滤镜' },
    ]
  },
  anime: {
    label: '动漫类',
    styles: [
      { value: 'anime_3d_cn', label: '国漫3D', description: '国产3D动画风格，如斗罗大陆' },
      { value: 'anime_2d_cn', label: '国风2D', description: '国风2D动画，如魔道祖师' },
      { value: 'anime_jp', label: '日漫风格', description: '日本动漫风格，如鬼灭之刃' },
      { value: 'anime_chibi', label: 'Q版萌系', description: '可爱Q版风格，大头小身' },
    ]
  },
  artistic: {
    label: '艺术类',
    styles: [
      { value: 'art_watercolor', label: '水彩插画', description: '水彩画风格，柔和淡雅' },
      { value: 'art_ink', label: '水墨国风', description: '中国传统水墨画风格' },
      { value: 'art_oil', label: '油画质感', description: '油画风格，厚重笔触' },
      { value: 'art_comic', label: '美漫风格', description: '美式漫画风格，强对比' },
    ]
  }
} as const

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sourceContent: '',
    sourceType: 'novel',
    style: 'realistic_cinema'
  })

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      // API 返回格式: { success: true, data: { projects: [...] } }
      const projectList = data.success ? (data.data?.projects || []) : (data.projects || [])
      setProjects(projectList)
    } catch (error) {
      console.error('获取项目列表失败:', error)
      toast.error('获取项目列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入项目名称')
      return
    }
    if (!formData.sourceContent.trim()) {
      toast.error('请输入小说或脚本内容')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || result.error || '创建失败')
      }

      toast.success('项目创建成功')
      setCreateDialogOpen(false)
      setFormData({
        name: '',
        description: '',
        sourceContent: '',
        sourceType: 'novel',
        style: 'realistic_cinema'
      })
      fetchProjects()
      
      // 跳转到项目详情页
      const projectId = result.data?.project?.id
      if (projectId) {
        window.location.href = `/projects/${projectId}`
      }
    } catch (error) {
      console.error('创建项目失败:', error)
      toast.error(error instanceof Error ? error.message : '创建项目失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？所有相关数据都会被删除。')) return

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('删除失败')
      }

      toast.success('项目已删除')
      fetchProjects()
    } catch (error) {
      console.error('删除项目失败:', error)
      toast.error('删除项目失败')
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    processing: 'bg-amber-500/20 text-amber-400',
    completed: 'bg-green-500/20 text-green-400',
  }

  const statusLabels: Record<string, string> = {
    draft: '草稿',
    processing: '处理中',
    completed: '已完成',
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">漫剧创作工坊</h1>
                <p className="text-xs text-muted-foreground">AI 驱动的短剧视频创作平台</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 配置状态指示器 */}
              <ModelConfigStatus />
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => settingsOpen || setSettingsOpen(true)}
              >
                <Settings className="w-5 h-5" />
              </Button>
              
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    新建项目
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      创建新项目
                    </DialogTitle>
                    <DialogDescription>
                      输入小说或脚本内容，AI 将自动分析并提取人物和分镜
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
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
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background"
                          value={formData.sourceType}
                          onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })}
                        >
                          <option value="novel">小说</option>
                          <option value="script">脚本</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* 画面风格选择 */}
                    <div className="space-y-3">
                      <Label>画面风格</Label>
                      <div className="space-y-3">
                        {Object.entries(VISUAL_STYLES).map(([category, { label, styles }]) => (
                          <div key={category} className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium">{label}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {styles.map((style) => (
                                <button
                                  key={style.value}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, style: style.value })}
                                  className={`text-left p-3 rounded-lg border transition-all ${
                                    formData.style === style.value
                                      ? 'border-primary bg-primary/10'
                                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                  }`}
                                >
                                  <p className="text-sm font-medium">{style.label}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{style.description}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
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
                        placeholder="粘贴你的小说或脚本内容，AI 将自动分析提取人物和分镜..."
                        className="h-[150px] resize-none"
                        value={formData.sourceContent}
                        onChange={(e) => setFormData({ ...formData, sourceContent: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      取消
                    </Button>
                    <Button 
                      onClick={handleCreate} 
                      disabled={creating}
                    >
                      {creating ? '创建中...' : '创建项目'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* 主内容 */}
        <main className="flex-1 overflow-auto p-6">
          {/* 快捷入口 */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Link href="/workflow">
              <Card className="group hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Workflow className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">工作流编辑器</h3>
                      <p className="text-sm text-muted-foreground">ComfyUI 风格节点式创作</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/characters">
              <Card className="group hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                      <Users className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">人物库</h3>
                      <p className="text-sm text-muted-foreground">管理和复用角色形象</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/projects">
              <Card className="group hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Film className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">我的项目</h3>
                      <p className="text-sm text-muted-foreground">查看所有创作项目</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* 最近项目 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">最近项目</h2>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="gap-1">
                  查看全部
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Film className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">还没有任何项目</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    创建第一个项目
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.slice(0, 6).map((project) => (
                  <Card 
                    key={project.id} 
                    className="group hover:border-primary/50 hover:bg-card/80 transition-all"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          <Link 
                            href={`/projects/${project.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {project.name}
                          </Link>
                        </CardTitle>
                        <Badge className={statusColors[project.status]}>
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3" />
                        {new Date(project.createdAt).toLocaleDateString('zh-CN')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Link href={`/projects/${project.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            查看详情
                          </Button>
                        </Link>
                        <Link href={`/projects/${project.id}/workflow`} className="flex-1">
                          <Button size="sm" className="w-full">
                            工作流
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 设置对话框 */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AppShell>
  )
}
