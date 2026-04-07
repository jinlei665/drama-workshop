/**
 * 人物库页面
 * 管理和复用角色形象
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Sparkles,
  Loader2,
  HelpCircle
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout'
import type { Character } from '@/lib/types'

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadingCharacter, setUploadingCharacter] = useState<Character | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [referenceImageUrl, setReferenceImageUrl] = useState('')
  const [generatingTripleViews, setGeneratingTripleViews] = useState(false)
  
  // 新建人物的参考图
  const [createReferenceImage, setCreateReferenceImage] = useState('')
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false)
  const [autoGenerateImage, setAutoGenerateImage] = useState(false) // 是否自动生成图像
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    appearance: '',
    personality: '',
    gender: '',
    age: '',
    style: 'realistic'
  })

  const fetchCharacters = async () => {
    try {
      setLoading(true)
      // 使用 character-library API 获取人物库数据
      const res = await fetch('/api/character-library')
      const data = await res.json()
      setCharacters(data.data?.characters || [])
    } catch (error) {
      console.error('获取人物列表失败:', error)
      toast.error('获取人物列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 重置新建表单
  const resetCreateForm = () => {
    setFormData({
      name: '',
      description: '',
      appearance: '',
      personality: '',
      gender: '',
      age: '',
      style: 'realistic'
    })
    setCreateReferenceImage('')
    setAutoGenerateImage(false)
  }

  useEffect(() => {
    fetchCharacters()
  }, [])

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入人物名称')
      return
    }

    if (!formData.appearance.trim()) {
      toast.error('请输入外貌描述')
      return
    }

    setCreating(true)
    try {
      // 使用 character-library API 创建人物
      const res = await fetch('/api/character-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          appearance: formData.appearance,
          personality: formData.personality,
          tags: formData.gender ? [formData.gender, formData.age].filter(Boolean) : (formData.age ? [formData.age] : []),
          style: formData.style,
          imageUrl: createReferenceImage || undefined // 参考图片 URL
        })
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        // API 返回的格式是 { error: { message: string, ... } }
        const errorMsg = result.error?.message || '创建失败'
        throw new Error(errorMsg)
      }

      toast.success('人物创建成功')

      const newCharacter = result.data.character

      // 如果启用了自动生成图像，则生成图像
      if (autoGenerateImage) {
        try {
          // 如果用户上传了参考图片，生成三视图；否则生成正面视图
          const hasReferenceImage = !!createReferenceImage

          if (hasReferenceImage) {
            toast.info('正在根据参考图生成三视图...')
          } else {
            toast.info('正在自动生成人物图像...')
          }

          const apiUrl = hasReferenceImage
            ? '/api/generate/character-triple-views'
            : '/api/generate/character-image'

          const genRes = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // 三视图需要的参数
              ...(hasReferenceImage ? {
                referenceImageUrl: createReferenceImage,
                characterId: newCharacter.id,
                characterName: newCharacter.name,
                appearance: newCharacter.appearance
              } : {
                // 文生图需要的参数
                characterId: newCharacter.id,
                characterName: newCharacter.name,
                appearance: newCharacter.appearance,
                personality: newCharacter.personality,
                style: newCharacter.style || 'realistic',
                gender: formData.gender,
                description: newCharacter.description
              })
            })
          })
          const genResult = await genRes.json()

          if (genResult.success) {
            toast.success(hasReferenceImage ? '三视图生成成功' : '人物图像生成成功')
          } else {
            toast.error('图像生成失败，人物已创建')
          }
        } catch (genError) {
          console.error('自动生成图像失败:', genError)
          toast.error('图像生成失败，人物已创建')
        }
      }

      setCreateDialogOpen(false)
      resetCreateForm()
      fetchCharacters()
    } catch (error) {
      console.error('创建人物失败:', error)
      toast.error(error instanceof Error ? error.message : '创建人物失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个人物吗？')) return

    try {
      const res = await fetch(`/api/character-library?id=${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('删除失败')
      }

      toast.success('人物已删除')
      fetchCharacters()
    } catch (error) {
      console.error('删除人物失败:', error)
      toast.error('删除人物失败')
    }
  }

  const handleEdit = (character: Character) => {
    setEditingCharacter(character)
    setFormData({
      name: character.name,
      description: character.description || '',
      appearance: character.appearance || '',
      personality: character.personality || '',
      gender: character.tags?.find(t => ['male', 'female', 'other'].includes(t)) || '',
      age: character.tags?.find(t => !['male', 'female', 'other'].includes(t)) || '',
      style: 'realistic'
    })
    setEditing(true)
  }

  const handleUpdate = async () => {
    if (!editingCharacter || !formData.name.trim()) {
      toast.error('请输入人物名称')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/character-library?id=${editingCharacter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          appearance: formData.appearance,
          personality: formData.personality,
          tags: formData.gender ? [formData.gender, formData.age].filter(Boolean) : (formData.age ? [formData.age] : []),
          style: formData.style
        })
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        const errorMsg = result.error?.message || '更新失败'
        throw new Error(errorMsg)
      }

      toast.success('人物更新成功')
      setEditing(false)
      setEditingCharacter(null)
      setFormData({
        name: '',
        description: '',
        appearance: '',
        personality: '',
        gender: '',
        age: '',
        style: 'realistic'
      })
      fetchCharacters()
    } catch (error) {
      console.error('更新人物失败:', error)
      toast.error(error instanceof Error ? error.message : '更新人物失败')
    } finally {
      setCreating(false)
    }
  }

  const handleGenerateImage = async (character: Character) => {
    toast.info('正在生成人物图像...')
    try {
      const res = await fetch('/api/generate/character-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          characterName: character.name,
          appearance: character.appearance,
          personality: character.personality,
          style: character.style || 'realistic',
          gender: character.tags?.find(t => ['male', 'female', 'other'].includes(t)),
          description: character.description
        })
      })
      const result = await res.json()

      if (result.success) {
        toast.success('人物图像生成成功')
        fetchCharacters()
      } else {
        const errorMsg = result.error?.message || '生成失败'
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('生成图像失败:', error)
      toast.error('生成图像失败')
    }
  }

  const handleUploadReferenceImage = async (file: File) => {
    if (!uploadingCharacter) return

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/character-image', {
        method: 'POST',
        body: formData
      })
      const result = await res.json()

      if (result.success) {
        setReferenceImageUrl(result.data.url)
        toast.success('参考图片上传成功')
      } else {
        const errorMsg = result.error?.message || '上传失败'
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('上传参考图片失败:', error)
      toast.error('上传参考图片失败')
    } finally {
      setUploadingImage(false)
    }
  }

  // 新建人物对话框上传参考图
  const handleUploadCreateReferenceImage = async (file: File) => {
    setUploadingCreateImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/character-image', {
        method: 'POST',
        body: formData
      })
      const result = await res.json()

      if (result.success) {
        setCreateReferenceImage(result.data.url)
        toast.success('参考图片上传成功')
      } else {
        const errorMsg = result.error?.message || '上传失败'
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('上传参考图片失败:', error)
      toast.error('上传参考图片失败')
    } finally {
      setUploadingCreateImage(false)
    }
  }

  const handleGenerateTripleViews = async () => {
    if (!uploadingCharacter || !referenceImageUrl) {
      toast.error('请先上传参考图片')
      return
    }

    setGeneratingTripleViews(true)
    try {
      const res = await fetch('/api/generate/character-triple-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImageUrl,
          characterId: uploadingCharacter.id,
          characterName: uploadingCharacter.name,
          appearance: uploadingCharacter.appearance
        })
      })
      const result = await res.json()

      if (result.success) {
        toast.success('三视图生成成功')
        setUploadDialogOpen(false)
        setReferenceImageUrl('')
        fetchCharacters()
      } else {
        const errorMsg = result.error?.message || '生成失败'
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('生成三视图失败:', error)
      toast.error('生成三视图失败')
    } finally {
      setGeneratingTripleViews(false)
    }
  }

  const handleOpenUploadDialog = (character: Character) => {
    setUploadingCharacter(character)
    setReferenceImageUrl('')
    setUploadDialogOpen(true)
  }

  const filteredCharacters = characters.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">人物库</h1>
                  <p className="text-xs text-muted-foreground">管理和复用角色形象</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索人物..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Dialog open={createDialogOpen} onOpenChange={(open) => {
                setCreateDialogOpen(open)
                if (open) {
                  resetCreateForm()
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    新建人物
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      创建新人物
                    </DialogTitle>
                    <DialogDescription>
                      定义人物的基本信息，可以上传参考图或使用文字描述，AI 将帮助生成人物图像
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">人物名称 *</Label>
                        <Input
                          id="name"
                          placeholder="输入人物名称"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">性别</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(v) => setFormData({ ...formData, gender: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择性别" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">男</SelectItem>
                            <SelectItem value="female">女</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="age">年龄</Label>
                        <Input
                          id="age"
                          placeholder="如：25岁"
                          value={formData.age}
                          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="style">图像风格</Label>
                        <Select
                          value={formData.style}
                          onValueChange={(v) => setFormData({ ...formData, style: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择风格" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realistic">写实风格</SelectItem>
                            <SelectItem value="anime">动漫风格</SelectItem>
                            <SelectItem value="cartoon">卡通风格</SelectItem>
                            <SelectItem value="oil_painting">油画风格</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* 参考图上传 */}
                    <div className="space-y-2">
                      <Label>参考图片（可选）</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                        {createReferenceImage ? (
                          <div className="space-y-2">
                            <img
                              src={createReferenceImage}
                              alt="参考图片"
                              className="w-full h-48 object-contain rounded-lg bg-muted"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                const input = document.getElementById('create-reference-image') as HTMLInputElement
                                input?.click()
                              }}
                              disabled={uploadingCreateImage}
                            >
                              {uploadingCreateImage ? '上传中...' : '更换参考图'}
                            </Button>
                          </div>
                        ) : (
                          <label
                            htmlFor="create-reference-image"
                            className="flex flex-col items-center justify-center cursor-pointer"
                          >
                            <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground mb-2">点击上传参考图片（可选）</p>
                            <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式，最大 5MB</p>
                          </label>
                        )}
                        <input
                          id="create-reference-image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadCreateReferenceImage(file)
                          }}
                          disabled={uploadingCreateImage}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        上传参考图片后，可以生成该角色的三视图（正面、侧面、背面）
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="appearance">外貌描述</Label>
                      <Textarea
                        id="appearance"
                        placeholder="描述人物的外貌特征，如：高挑身材，长发披肩，眼神锐利..."
                        className="h-20"
                        value={formData.appearance}
                        onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
                      />
                    </div>

                    {/* 自动生成图像选项 */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="auto-generate-image"
                        checked={autoGenerateImage}
                        onChange={(e) => setAutoGenerateImage(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="auto-generate-image" className="text-sm cursor-pointer">
                        创建后自动生成图像{createReferenceImage ? '（将生成三视图）' : ''}
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{createReferenceImage ? '已上传参考图，将生成三视图（正面、侧面、背面）' : '未上传参考图，将根据描述生成正面视图'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="personality">性格特点</Label>
                      <Textarea
                        id="personality"
                        placeholder="描述人物的性格，如：性格开朗，善于交际..."
                        className="h-20"
                        value={formData.personality}
                        onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">人物简介</Label>
                      <Textarea
                        id="description"
                        placeholder="人物背景故事或简介"
                        className="h-20"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleCreate} disabled={creating}>
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            创建中...
                          </>
                        ) : '创建人物'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* 编辑对话框 */}
              <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      编辑人物
                    </DialogTitle>
                    <DialogDescription>
                      更新人物信息
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">人物名称 *</Label>
                        <Input
                          id="edit-name"
                          placeholder="输入人物名称"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-gender">性别</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(v) => setFormData({ ...formData, gender: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择性别" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">男</SelectItem>
                            <SelectItem value="female">女</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-age">年龄</Label>
                        <Input
                          id="edit-age"
                          placeholder="如：25岁"
                          value={formData.age}
                          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-style">图像风格</Label>
                        <Select
                          value={formData.style}
                          onValueChange={(v) => setFormData({ ...formData, style: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择风格" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realistic">写实风格</SelectItem>
                            <SelectItem value="anime">动漫风格</SelectItem>
                            <SelectItem value="cartoon">卡通风格</SelectItem>
                            <SelectItem value="oil_painting">油画风格</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-appearance">外貌描述</Label>
                      <Textarea
                        id="edit-appearance"
                        placeholder="描述人物的外貌特征，如：高挑身材，长发披肩，眼神锐利..."
                        className="h-20"
                        value={formData.appearance}
                        onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-personality">性格特点</Label>
                      <Textarea
                        id="edit-personality"
                        placeholder="描述人物的性格，如：性格开朗，善于交际..."
                        className="h-20"
                        value={formData.personality}
                        onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">人物简介</Label>
                      <Textarea
                        id="edit-description"
                        placeholder="人物背景故事或简介"
                        className="h-20"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        取消
                      </Button>
                      <Button onClick={handleUpdate} disabled={creating}>
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            更新中...
                          </>
                        ) : '保存更改'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* 主内容 */}
        <main className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredCharacters.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? '没有找到匹配的人物' : '还没有任何人物'}
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个人物
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCharacters.map((character) => (
                <Card key={character.id} className="group overflow-hidden">
                  {/* 人物图像 */}
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                    {character.imageUrl ? (
                      <img
                        src={character.imageUrl}
                        alt={character.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-12 h-12 mb-2" />
                        <span className="text-sm">暂无图像</span>
                      </div>
                    )}
                    {/* 悬浮操作 */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenUploadDialog(character)}
                        disabled={uploadingImage || generatingTripleViews}
                      >
                        <ImageIcon className="w-4 h-4 mr-1" />
                        上传参考图
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerateImage(character)}
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        生成图像
                      </Button>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{character.name}</CardTitle>
                      {character.gender && (
                        <Badge variant="outline" className="text-xs">
                          {character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他'}
                        </Badge>
                      )}
                    </div>
                    {character.age && (
                      <CardDescription className="text-xs">{character.age}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pb-4">
                    {character.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {character.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(character)}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(character.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 上传参考图生成三视图对话框 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-green-500" />
              上传参考图生成三视图
            </DialogTitle>
            <DialogDescription>
              上传参考图片，AI 将根据参考图生成角色的三视图（正面、侧面、背面）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* 参考图上传 */}
            <div className="space-y-2">
              <Label htmlFor="reference-image">参考图片 *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                {referenceImageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={referenceImageUrl}
                      alt="参考图片"
                      className="w-full h-48 object-contain rounded-lg bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const input = document.getElementById('reference-image') as HTMLInputElement
                        input?.click()
                      }}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? '上传中...' : '更换参考图'}
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="reference-image"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">点击上传参考图片</p>
                    <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式，最大 5MB</p>
                  </label>
                )}
                <input
                  id="reference-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleUploadReferenceImage(file)
                    }
                  }}
                  disabled={uploadingImage}
                />
              </div>
            </div>

            {/* 提示信息 */}
            {referenceImageUrl && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">生成说明</p>
                <p className="text-xs text-muted-foreground">
                  AI 将根据上传的参考图片，生成角色的三视图（正面、侧面、背面），保持人物形象一致。
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={generatingTripleViews}>
                取消
              </Button>
              <Button
                onClick={handleGenerateTripleViews}
                disabled={!referenceImageUrl || uploadingImage || generatingTripleViews}
              >
                {generatingTripleViews ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    生成三视图
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
