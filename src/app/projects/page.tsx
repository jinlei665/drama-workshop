/**
 * 项目列表页面
 */

'use client'

import { AppShell } from '@/components/layout'
import { ProjectList } from '@/components/projects'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ProjectsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sourceContent: '',
    sourceType: 'novel'
  })

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
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || '创建失败')
      }

      toast.success('项目创建成功')
      setCreateDialogOpen(false)
      setFormData({
        name: '',
        description: '',
        sourceContent: '',
        sourceType: 'novel'
      })
    } catch (error) {
      console.error('创建项目失败:', error)
      toast.error('创建项目失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-semibold">我的项目</h1>
              <p className="text-sm text-muted-foreground">管理所有创作项目</p>
            </div>
            
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </div>
        </header>

        {/* 项目列表 */}
        <main className="flex-1 overflow-auto p-6">
          <ProjectList />
        </main>
      </div>

      {/* 创建对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
            <DialogDescription>
              输入小说或脚本内容，AI 将自动分析并提取人物和分镜
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">小说/脚本内容 *</Label>
              <Textarea
                id="content"
                placeholder="粘贴你的小说或脚本内容..."
                className="h-[200px] resize-none"
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
              >
                {creating ? '创建中...' : '创建项目'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
