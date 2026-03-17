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
  User,
  Image as ImageIcon
} from "lucide-react"
import { toast } from "sonner"

interface Character {
  id: string
  name: string
  description: string | null
  appearance: string | null
  personality: string | null
  frontViewKey?: string | null
  sideViewKey?: string | null
  backViewKey?: string | null
  tags: string[]
  status?: string
  imageUrl?: string
}

interface CharactersPanelProps {
  projectId: string
  characters: Character[]
  onUpdate: () => void
}

export function CharactersPanel({ projectId, characters, onUpdate }: CharactersPanelProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    appearance: "",
    personality: "",
    tags: [] as string[]
  })

  // 创建人物
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("请输入人物名称")
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "创建失败")
      }

      toast.success("人物创建成功")
      setCreateDialogOpen(false)
      setFormData({
        name: "",
        description: "",
        appearance: "",
        personality: "",
        tags: []
      })
      onUpdate()
    } catch (error) {
      console.error("创建人物失败:", error)
      toast.error("创建人物失败")
    } finally {
      setCreating(false)
    }
  }

  // 更新人物
  const handleUpdate = async () => {
    if (!selectedCharacter) return

    setCreating(true)
    try {
      const res = await fetch(`/api/characters/${selectedCharacter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "更新失败")
      }

      toast.success("人物更新成功")
      setEditDialogOpen(false)
      setSelectedCharacter(null)
      onUpdate()
    } catch (error) {
      console.error("更新人物失败:", error)
      toast.error("更新人物失败")
    } finally {
      setCreating(false)
    }
  }

  // 删除人物
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个人物吗？")) return

    try {
      const res = await fetch(`/api/characters/${id}`, {
        method: "DELETE"
      })

      if (!res.ok) {
        throw new Error("删除失败")
      }

      toast.success("人物已删除")
      onUpdate()
    } catch (error) {
      console.error("删除人物失败:", error)
      toast.error("删除人物失败")
    }
  }

  // 生成角色造型图
  const handleGenerateViews = async (character: Character) => {
    if (!character.appearance) {
      toast.error("请先填写人物外貌描述")
      return
    }

    setGenerating(character.id)
    try {
      const res = await fetch("/api/generate/character-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          appearance: character.appearance
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "生成失败")
      }

      toast.success("角色造型图生成成功")
      onUpdate()
    } catch (error) {
      console.error("生成角色造型图失败:", error)
      toast.error("生成角色造型图失败")
    } finally {
      setGenerating(null)
    }
  }

  // 打开编辑对话框
  const openEditDialog = (character: Character) => {
    setSelectedCharacter(character)
    setFormData({
      name: character.name,
      description: character.description || "",
      appearance: character.appearance || "",
      personality: character.personality || "",
      tags: character.tags || []
    })
    setEditDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">人物管理</h2>
          <p className="text-sm text-muted-foreground">
            管理故事中的人物，生成人物三视图以保持一致性
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="amber-gradient text-white border-0">
              <Plus className="w-4 h-4 mr-2" />
              添加人物
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加人物</DialogTitle>
              <DialogDescription>
                创建故事中的角色，详细的外貌描述有助于生成一致性的人物形象
              </DialogDescription>
            </DialogHeader>
            <CharacterForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreate}
              loading={creating}
              submitText="创建人物"
            />
          </DialogContent>
        </Dialog>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑人物</DialogTitle>
              <DialogDescription>
                修改人物信息
              </DialogDescription>
            </DialogHeader>
            <CharacterForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleUpdate}
              loading={creating}
              submitText="保存修改"
            />
          </DialogContent>
        </Dialog>
      </div>

      {characters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">还没有人物，点击上方按钮添加</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              generating={generating === character.id}
              onEdit={() => openEditDialog(character)}
              onDelete={() => handleDelete(character.id)}
              onGenerateViews={() => handleGenerateViews(character)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 人物表单组件
function CharacterForm({
  formData,
  setFormData,
  onSubmit,
  loading,
  submitText
}: {
  formData: any
  setFormData: any
  onSubmit: () => void
  loading: boolean
  submitText: string
}) {
  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="char-name">人物名称 *</Label>
        <Input
          id="char-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="输入人物名称"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="char-desc">人物简介</Label>
        <Input
          id="char-desc"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="简短描述人物背景"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="char-appearance">外貌描述 *</Label>
        <Textarea
          id="char-appearance"
          value={formData.appearance}
          onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
          placeholder="详细描述外貌特征：发型、眼睛、体型、服装风格等"
          className="min-h-[80px]"
        />
        <p className="text-xs text-muted-foreground">
          外貌描述越详细，生成的人物形象越一致
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="char-personality">性格特点</Label>
        <Textarea
          id="char-personality"
          value={formData.personality}
          onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
          placeholder="描述人物的性格特征"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" type="button" onClick={() => {}}>
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

// 人物卡片组件
function CharacterCard({
  character,
  generating,
  onEdit,
  onDelete,
  onGenerateViews
}: {
  character: Character
  generating: boolean
  onEdit: () => void
  onDelete: () => void
  onGenerateViews: () => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // 获取图片 URL
  useEffect(() => {
    if (character.frontViewKey) {
      fetch(`/api/images?key=${character.frontViewKey}`)
        .then(res => res.json())
        .then(data => setImageUrl(data.url))
        .catch(console.error)
    }
  }, [character.frontViewKey])

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{character.name}</CardTitle>
            <CardDescription className="line-clamp-1">
              {character.description || "暂无描述"}
            </CardDescription>
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
              <DropdownMenuItem onClick={onGenerateViews} disabled={generating}>
                <Sparkles className="w-4 h-4 mr-2" />
                生成角色造型图
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 人物图片 */}
        <div className="aspect-square rounded-lg bg-secondary/50 relative overflow-hidden">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {generating ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">生成中...</p>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  className="flex flex-col items-center gap-2"
                  onClick={onGenerateViews}
                >
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs">点击生成角色造型图</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1">
          {character.tags?.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* 外貌描述 */}
        {character.appearance && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {character.appearance}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
