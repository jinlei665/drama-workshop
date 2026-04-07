"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
  Image as ImageIcon,
  Download,
  Upload,
  Search,
  Library,
  User,
  Check,
  GripVertical,
  Sparkles
} from "lucide-react"
import { toast } from "sonner"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

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

interface CharacterAppearance {
  id: string
  characterId: string
  name: string
  imageKey: string
  imageUrl: string | null
  isPrimary: boolean
  description: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface CharactersPanelProps {
  projectId: string
  characters: Character[]
  onUpdate: () => void
}

export function CharactersPanel({ projectId, characters, onUpdate }: CharactersPanelProps) {
  // 人物库相关状态
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryCharacters, setLibraryCharacters] = useState<Character[]>([])
  const [librarySearch, setLibrarySearch] = useState("")

  // 人物操作状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [importingFromLibrary, setImportingFromLibrary] = useState<string | null>(null)
  const [addingToLibrary, setAddingToLibrary] = useState<string | null>(null)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    appearance: "",
    personality: "",
    tags: [] as string[]
  })

  // 形象管理相关状态
  const [appearanceDialogOpen, setAppearanceDialogOpen] = useState(false)
  const [selectedCharacterForAppearances, setSelectedCharacterForAppearances] = useState<Character | null>(null)
  const [appearances, setAppearances] = useState<CharacterAppearance[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<{ url: string; file: File } | null>(null)
  const [appearanceName, setAppearanceName] = useState("")
  const [appearanceDescription, setAppearanceDescription] = useState("")
  const [loadingAppearances, setLoadingAppearances] = useState(false)
  const [generateMode, setGenerateMode] = useState<'upload' | 'text'>('upload')
  const [changeDescription, setChangeDescription] = useState("")
  const [generatingAppearance, setGeneratingAppearance] = useState(false)

  // 加载人物库
  const loadLibrary = async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch(`/api/character-library?search=${encodeURIComponent(librarySearch)}`)
      const data = await res.json()
      if (data.success) {
        setLibraryCharacters(data.data.characters)
      }
    } catch (error) {
      console.error('加载人物库失败:', error)
    } finally {
      setLibraryLoading(false)
    }
  }

  // 从人物库导入
  const handleImportFromLibrary = async (libraryCharacter: Character) => {
    setImportingFromLibrary(libraryCharacter.id)
    try {
      const res = await fetch(`/api/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: libraryCharacter.name,
          description: libraryCharacter.description,
          appearance: libraryCharacter.appearance,
          personality: libraryCharacter.personality,
          tags: libraryCharacter.tags,
          imageUrl: libraryCharacter.imageUrl,
          frontViewKey: libraryCharacter.frontViewKey,
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "导入失败")
      }

      toast.success(`已从人物库导入「${libraryCharacter.name}」`)
      setLibraryDialogOpen(false)
      onUpdate()
    } catch (error) {
      console.error("从人物库导入失败:", error)
      toast.error("导入失败")
    } finally {
      setImportingFromLibrary(null)
    }
  }

  // 添加人物到人物库
  const handleAddToLibrary = async (character: Character, actualImageUrl: string | null) => {
    setAddingToLibrary(character.id)
    try {
      const res = await fetch("/api/character-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: character.name,
          description: character.description,
          appearance: character.appearance,
          personality: character.personality,
          tags: character.tags,
          // 优先使用实际获取到的图片URL，否则使用character对象中的
          imageUrl: actualImageUrl || character.imageUrl,
          frontViewKey: character.frontViewKey,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "添加失败")
      }

      toast.success(`「${character.name}」已添加到人物库`)
    } catch (error) {
      console.error("添加到人物库失败:", error)
      toast.error("添加到人物库失败")
    } finally {
      setAddingToLibrary(null)
    }
  }

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

  // 打开形象管理对话框
  const openAppearanceDialog = async (character: Character) => {
    setSelectedCharacterForAppearances(character)
    setAppearanceDialogOpen(true)
    setLoadingAppearances(true)

    // 重置表单状态
    setGenerateMode('upload')
    setUploadedImage(null)
    setChangeDescription('')
    setAppearanceName('')
    setAppearanceDescription('')

    try {
      const res = await fetch(`/api/characters/${character.id}/appearances`)
      if (res.ok) {
        const data = await res.json()
        // 修复：访问 data.data.appearances 而不是 data.appearances
        setAppearances(data.data?.appearances || [])
      }
    } catch (error) {
      console.error('加载形象列表失败:', error)
      toast.error('加载形象列表失败')
    } finally {
      setLoadingAppearances(false)
    }
  }

  // 上传图片
  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/character-image', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '上传失败')
      }

      const data = await res.json()
      setUploadedImage({
        url: data.url,
        file: file
      })
      toast.success('图片上传成功')
    } catch (error) {
      console.error('上传图片失败:', error)
      toast.error('上传图片失败')
    } finally {
      setUploadingImage(false)
    }
  }

  // 根据文字描述生成新形象
  const handleGenerateAppearance = async () => {
    console.log('[Generate Appearance] Function called')
    if (!selectedCharacterForAppearances) {
      console.error('[Generate Appearance] No character selected')
      toast.error('未选择人物')
      return
    }

    if (!appearanceName.trim()) {
      console.error('[Generate Appearance] No appearance name')
      toast.error('请输入形象名称')
      return
    }

    if (!changeDescription.trim()) {
      console.error('[Generate Appearance] No change description')
      toast.error('请输入变更描述')
      return
    }

    setGeneratingAppearance(true)
    console.log('[Generate Appearance] Starting generation process')
    try {
      // 获取参考图片（优先使用主形象，否则使用角色的正面视图）
      let referenceImage: string | undefined

      // 1. 优先使用 appearances 中的主形象
      const primaryAppearance = appearances.find(a => a.is_primary)
      if (primaryAppearance?.imageUrl) {
        referenceImage = primaryAppearance.imageUrl
        console.log('[Generate Appearance] Using primary appearance:', referenceImage)
      }

      // 2. 如果没有主形象，使用角色的 imageUrl
      if (!referenceImage && selectedCharacterForAppearances.imageUrl) {
        referenceImage = selectedCharacterForAppearances.imageUrl
        console.log('[Generate Appearance] Using character imageUrl:', referenceImage)
      }

      // 3. 如果都没有，尝试使用 frontViewKey 获取公网 URL
      if (!referenceImage && selectedCharacterForAppearances.frontViewKey) {
        try {
          const domain = window.location.origin
          const imageUrlRes = await fetch(`${domain}/api/images?key=${selectedCharacterForAppearances.frontViewKey}`)
          if (imageUrlRes.ok) {
            const imageUrlData = await imageUrlRes.json()
            referenceImage = imageUrlData.url
            console.log('[Generate Appearance] Using frontViewKey -> public URL:', referenceImage)
          }
        } catch (error) {
          console.warn('[Generate Appearance] Failed to get public URL for frontViewKey:', error)
        }
      }

      if (!referenceImage) {
        toast.warn('未找到参考图片，将使用纯文字描述生成')
      }

      console.log('[Generate Appearance] Request payload:', {
        characterId: selectedCharacterForAppearances.id,
        characterName: selectedCharacterForAppearances.name,
        appearance: selectedCharacterForAppearances.appearance,
        changeDescription,
        hasReferenceImage: !!referenceImage
      })

      const res = await fetch('/api/generate/appearance-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: selectedCharacterForAppearances.id,
          characterName: selectedCharacterForAppearances.name,
          appearance: selectedCharacterForAppearances.appearance,
          changeDescription: changeDescription,
          referenceImage
        })
      })

      if (!res.ok) {
        const data = await res.json()
        console.error('[Generate Appearance] API error:', data)
        throw new Error(data.error || '生成失败')
      }

      const data = await res.json()
      console.log('[Generate Appearance] API response:', data)

      // 添加生成的形象
      const addRes = await fetch(`/api/characters/${selectedCharacterForAppearances.id}/appearances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: appearanceName,
          imageKey: data.fileKey,
          imageUrl: data.viewUrl,
          description: appearanceDescription || null
        })
      })

      console.log('[Add Appearance] Response status:', addRes.status, addRes.statusText)

      if (!addRes.ok) {
        const errorText = await addRes.text()
        console.error('[Add Appearance] API error response:', errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error?.message || errorData.error || '添加形象失败')
        } catch (parseError) {
          throw new Error(errorText || '添加形象失败')
        }
      }

      const addResText = await addRes.text()
      console.log('[Add Appearance] Success response text:', addResText)

      let addResData
      try {
        addResData = JSON.parse(addResText)
      } catch (parseError) {
        console.error('[Add Appearance] Parse response error:', parseError)
        throw new Error('响应格式错误')
      }

      console.log('[Add Appearance] Success response data:', addResData)

      toast.success('新形象生成成功')

      // 重新加载形象列表
      const listRes = await fetch(`/api/characters/${selectedCharacterForAppearances.id}/appearances`)
      if (listRes.ok) {
        const listText = await listRes.text()
        console.log('[Load Appearances] Response:', listText)
        try {
          const listData = JSON.parse(listText)
          console.log('[Load Appearances] Parsed data:', listData)
          console.log('[Load Appearances] Appearances count:', listData.data?.appearances?.length)
          console.log('[Load Appearances] First appearance:', listData.data?.appearances?.[0])
          // 修复：访问 listData.data.appearances 而不是 listData.appearances
          setAppearances(listData.data?.appearances || [])
        } catch (parseError) {
          console.error('[Load Appearances] Parse error:', parseError)
        }
      } else {
        console.error('[Load Appearances] Failed to fetch:', listRes.status, listRes.statusText)
      }

      // 清空表单
      setChangeDescription('')
      setAppearanceName('')
      setAppearanceDescription('')
    } catch (error) {
      console.error('生成新形象失败:', error)
      // 改进错误消息显示
      let errorMessage = '生成新形象失败'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error)
      }
      toast.error(errorMessage)
    } finally {
      setGeneratingAppearance(false)
    }
  }

  // 添加形象
  const handleAddAppearance = async () => {
    if (!uploadedImage || !selectedCharacterForAppearances) return

    if (!appearanceName.trim()) {
      toast.error('请输入形象名称')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/characters/${selectedCharacterForAppearances.id}/appearances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: appearanceName,
          imageKey: uploadedImage.url,
          description: appearanceDescription || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '添加失败')
      }

      toast.success('形象添加成功')

      // 重新加载形象列表
      const listRes = await fetch(`/api/characters/${selectedCharacterForAppearances.id}/appearances`)
      if (listRes.ok) {
        const listData = await listRes.json()
        // 修复：访问 listData.data.appearances 而不是 listData.appearances
        setAppearances(listData.data?.appearances || [])
      }

      // 清空表单
      setUploadedImage(null)
      setAppearanceName('')
      setAppearanceDescription('')
    } catch (error) {
      console.error('添加形象失败:', error)
      toast.error('添加形象失败')
    } finally {
      setCreating(false)
    }
  }

  // 设置主形象
  const handleSetPrimary = async (appearanceId: string) => {
    if (!selectedCharacterForAppearances) return

    try {
      const res = await fetch(`/api/character-appearances/${appearanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true })
      })

      if (!res.ok) {
        throw new Error('设置失败')
      }

      toast.success('已设为默认形象')

      // 重新加载形象列表
      const listRes = await fetch(`/api/characters/${selectedCharacterForAppearances.id}/appearances`)
      if (listRes.ok) {
        const listData = await listRes.json()
        // 修复：访问 listData.data.appearances 而不是 listData.appearances
        setAppearances(listData.data?.appearances || [])
      }
    } catch (error) {
      console.error('设置主形象失败:', error)
      toast.error('设置主形象失败')
    }
  }

  // 删除形象
  const handleDeleteAppearance = async (appearanceId: string) => {
    if (!confirm('确定要删除这个形象吗？')) return

    try {
      const res = await fetch(`/api/character-appearances/${appearanceId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('删除失败')
      }

      toast.success('形象已删除')

      // 重新加载形象列表
      if (selectedCharacterForAppearances) {
        const listRes = await fetch(`/api/characters/${selectedCharacterForAppearances.id}/appearances`)
        if (listRes.ok) {
          const listData = await listRes.json()
          // 修复：访问 listData.data.appearances 而不是 listData.appearances
          setAppearances(listData.data?.appearances || [])
        }
      }
    } catch (error) {
      console.error('删除形象失败:', error)
      toast.error('删除形象失败')
    }
  }

  // 处理拖拽结束
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !selectedCharacterForAppearances) return

    const newAppearances = Array.from(appearances)
    const [reorderedItem] = newAppearances.splice(result.source.index, 1)
    newAppearances.splice(result.destination.index, 0, reorderedItem)

    // 更新本地状态
    setAppearances(newAppearances)

    // 更新数据库
    try {
      const res = await fetch('/api/character-appearances/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: selectedCharacterForAppearances.id,
          appearanceIds: newAppearances.map(a => a.id)
        })
      })

      if (!res.ok) {
        throw new Error('排序更新失败')
      }

      toast.success('排序已更新')
    } catch (error) {
      console.error('更新排序失败:', error)
      toast.error('更新排序失败')
      // 重新加载列表
      if (selectedCharacterForAppearances) {
        const listRes = await fetch(`/api/characters/${selectedCharacterForAppearances.id}/appearances`)
        if (listRes.ok) {
          const listData = await listRes.json()
          // 修复：访问 listData.data.appearances 而不是 listData.appearances
          setAppearances(listData.data?.appearances || [])
        }
      }
    }
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加人物</DialogTitle>
              <DialogDescription>
                选择手动创建或从人物库导入角色
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="create" className="mt-4" onValueChange={(value) => {
              if (value === 'library') {
                loadLibrary()
              }
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">手动创建</TabsTrigger>
                <TabsTrigger value="library">
                  从人物库选择
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="create">
                <CharacterForm
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleCreate}
                  loading={creating}
                  submitText="创建人物"
                />
              </TabsContent>
              
              <TabsContent value="library">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索人物库..."
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadLibrary()
                        }
                      }}
                      className="pl-9"
                    />
                  </div>
                  
                  <ScrollArea className="h-[300px] pr-4">
                    {libraryLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : libraryCharacters.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Library className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>人物库中暂无人物</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {libraryCharacters.map((char) => (
                          <Card key={char.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                {char.imageUrl ? (
                                  <img 
                                    src={char.imageUrl} 
                                    alt={char.name}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                    <User className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium truncate">{char.name}</h4>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {char.description || '暂无描述'}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleImportFromLibrary(char)}
                                  disabled={importingFromLibrary === char.id}
                                >
                                  {importingFromLibrary === char.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="w-4 h-4 mr-1" />
                                      导入
                                    </>
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
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

        {/* 形象管理对话框 */}
        <Dialog open={appearanceDialogOpen} onOpenChange={setAppearanceDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>管理形象 - {selectedCharacterForAppearances?.name}</DialogTitle>
              <DialogDescription>
                添加和管理人物的不同形象（服装、角度等），生成分镜时可以选择使用哪个形象
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* 添加新形象 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">添加新形象</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 生成模式选择 */}
                  <div className="flex items-center gap-4">
                    <Label>生成方式</Label>
                    <Tabs value={generateMode} onValueChange={(v) => setGenerateMode(v as 'upload' | 'text')} className="flex-1">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload">直接上传</TabsTrigger>
                        <TabsTrigger value="text">文字生成</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* 直接上传模式 */}
                  {generateMode === 'upload' && (
                    <>
                      <div className="space-y-2">
                        <Label>上传图片</Label>
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleImageUpload(file)
                            }}
                            className="hidden"
                            id="appearance-image-upload"
                          />
                          <label htmlFor="appearance-image-upload">
                            <Button variant="outline" asChild disabled={uploadingImage}>
                              <span>
                                <Upload className="w-4 h-4 mr-2" />
                                {uploadingImage ? '上传中...' : '选择图片'}
                              </span>
                            </Button>
                          </label>
                          {uploadedImage && (
                            <div className="flex items-center gap-2">
                              <img src={uploadedImage.url} alt="预览" className="w-16 h-16 rounded object-cover" />
                              <Button variant="ghost" size="sm" onClick={() => setUploadedImage(null)}>
                                重新选择
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* 文字生成模式 */}
                  {generateMode === 'text' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="change-description">变更描述 *</Label>
                        <Textarea
                          id="change-description"
                          value={changeDescription}
                          onChange={(e) => setChangeDescription(e.target.value)}
                          placeholder="请描述你希望如何改变人物形象，例如：换一套红色的西装、变成古代装束、穿着休闲运动服等"
                          className="min-h-[80px]"
                        />
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <p className="text-sm font-medium">生成说明</p>
                        <p className="text-xs text-muted-foreground">
                          AI 将根据文字描述生成一张新的人物形象图片，保持人物面部特征一致。
                        </p>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="appearance-name">形象名称 *</Label>
                    <Input
                      id="appearance-name"
                      value={appearanceName}
                      onChange={(e) => setAppearanceName(e.target.value)}
                      placeholder="如：正面、侧面、服装A、古代装等"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appearance-desc">形象描述（可选）</Label>
                    <Textarea
                      id="appearance-desc"
                      value={appearanceDescription}
                      onChange={(e) => setAppearanceDescription(e.target.value)}
                      placeholder="描述这个形象的特点"
                      className="min-h-[60px]"
                    />
                  </div>

                  {generateMode === 'upload' ? (
                    <Button
                      onClick={handleAddAppearance}
                      disabled={!uploadedImage || creating}
                      className="amber-gradient text-white border-0"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          添加中...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          添加形象
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleGenerateAppearance}
                      disabled={!appearanceName || !changeDescription || generatingAppearance}
                      className="amber-gradient text-white border-0"
                    >
                      {generatingAppearance ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成新形象
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* 形象列表 */}
              {appearances.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      已有形象 ({appearances.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="appearances">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="grid grid-cols-2 md:grid-cols-3 gap-4"
                          >
                            {appearances.map((appearance, index) => (
                              <Draggable
                                key={appearance.id}
                                draggableId={appearance.id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`relative group border rounded-lg overflow-hidden ${
                                      appearance.isPrimary ? 'ring-2 ring-primary' : ''
                                    } ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className="absolute top-2 left-2 z-20 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                    {appearance.isPrimary && (
                                      <div className="absolute top-2 left-2 z-10 bg-primary text-white text-xs px-2 py-0.5 rounded">
                                        主形象
                                      </div>
                                    )}
                                    <img
                                      src={appearance.imageUrl || ''}
                                      alt={appearance.name}
                                      className="w-full aspect-square object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      {!appearance.isPrimary && (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handleSetPrimary(appearance.id)}
                                        >
                                          <Check className="w-4 h-4 mr-1" />
                                          设为主形象
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteAppearance(appearance.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                      <p className="text-white text-sm font-medium">{appearance.name}</p>
                                      {appearance.description && (
                                        <p className="text-white/70 text-xs line-clamp-1">{appearance.description}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </CardContent>
                </Card>
              )}

              {appearances.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">还没有形象，点击上方添加</p>
                  </CardContent>
                </Card>
              )}
            </div>
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
              addingToLibrary={addingToLibrary === character.id}
              onEdit={() => openEditDialog(character)}
              onDelete={() => handleDelete(character.id)}
              onGenerateViews={() => handleGenerateViews(character)}
              onAddToLibrary={(imageUrl) => handleAddToLibrary(character, imageUrl)}
              onManageAppearances={() => openAppearanceDialog(character)}
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
  addingToLibrary,
  onEdit,
  onDelete,
  onGenerateViews,
  onAddToLibrary,
  onManageAppearances
}: {
  character: any
  generating: boolean
  addingToLibrary: boolean
  onEdit: () => void
  onDelete: () => void
  onGenerateViews: () => void
  onAddToLibrary: (imageUrl: string) => void
  onManageAppearances: () => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // 获取图片 URL
  useEffect(() => {
    // 优先使用直接存储的 imageUrl
    if (character.imageUrl) {
      setImageUrl(character.imageUrl)
      return
    }

    // 如果有 frontViewKey，从存储获取签名 URL
    if (character.frontViewKey) {
      fetch(`/api/images?key=${character.frontViewKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.url) {
            setImageUrl(data.url)
          }
        })
        .catch(console.error)
    }
  }, [character.frontViewKey, character.imageUrl])

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
              <DropdownMenuItem onClick={onManageAppearances}>
                <User className="w-4 h-4 mr-2" />
                管理形象
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerateViews} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    生成造型图
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
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
          {character.tags?.map((tag: string, i: number) => (
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
