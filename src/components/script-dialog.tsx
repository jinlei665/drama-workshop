"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  Sparkles,
  Plus,
  User,
  Film,
  Check,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ScriptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectStyle?: string
  projectDescription?: string
  existingCharacters: Array<{
    id: string
    name: string
    description?: string
    appearance?: string
  }>
  onSuccess: () => void
}

interface GeneratedCharacter {
  id: string
  name: string
  description: string
  gender: string
  age: string
}

interface GeneratedScene {
  id: string
  sceneNumber: number
  title: string
  description: string
  dialogue: string
  emotion: string
}

export function ScriptDialog({
  open,
  onOpenChange,
  projectId,
  projectStyle,
  projectDescription,
  existingCharacters,
  onSuccess,
}: ScriptDialogProps) {
  const [step, setStep] = useState<"input" | "preview">("input")
  const [scriptContent, setScriptContent] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatedCharacters, setGeneratedCharacters] = useState<GeneratedCharacter[]>([])
  const [generatedScenes, setGeneratedScenes] = useState<GeneratedScene[]>([])
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set())
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set())

  // 重置状态
  useEffect(() => {
    if (!open) {
      setStep("input")
      setScriptContent("")
      setAnalyzing(false)
      setSaving(false)
      setGeneratedCharacters([])
      setGeneratedScenes([])
      setSelectedCharacters(new Set())
      setSelectedScenes(new Set())
    }
  }, [open])

  // 全选/取消全选角色
  const toggleAllCharacters = () => {
    if (selectedCharacters.size === generatedCharacters.length) {
      setSelectedCharacters(new Set())
    } else {
      setSelectedCharacters(new Set(generatedCharacters.map((c) => c.id)))
    }
  }

  // 全选/取消全选分镜
  const toggleAllScenes = () => {
    if (selectedScenes.size === generatedScenes.length) {
      setSelectedScenes(new Set())
    } else {
      setSelectedScenes(new Set(generatedScenes.map((s) => s.id)))
    }
  }

  // 切换角色选中
  const toggleCharacter = (id: string) => {
    const newSet = new Set(selectedCharacters)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedCharacters(newSet)
  }

  // 切换分镜选中
  const toggleScene = (id: string) => {
    const newSet = new Set(selectedScenes)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedScenes(newSet)
  }

  // 分析脚本
  const handleAnalyze = async () => {
    if (!scriptContent.trim()) {
      toast.error("请输入脚本内容")
      return
    }

    setAnalyzing(true)
    try {
      const res = await fetch("/api/scripts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scriptContent,
          existingCharacters,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "分析失败")
      }

      setGeneratedCharacters(data.characters || [])
      setGeneratedScenes(data.scenes || [])
      setSelectedCharacters(new Set((data.characters || []).map((c: any) => c.id)))
      setSelectedScenes(new Set((data.scenes || []).map((s: any) => s.id)))
      setStep("preview")
      toast.success("脚本分析完成")
    } catch (error) {
      console.error("分析脚本失败:", error)
      toast.error(error instanceof Error ? error.message : "分析失败")
    } finally {
      setAnalyzing(false)
    }
  }

  // 保存脚本和选中的内容
  const handleSave = async () => {
    if (selectedScenes.size === 0) {
      toast.error("请至少选择一个分镜")
      return
    }

    setSaving(true)
    try {
      // 1. 创建脚本记录
      const scriptRes = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: `脚本 ${new Date().toLocaleDateString()}`,
          content: scriptContent,
          description: "AI 分析生成",
        }),
      })

      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) {
        throw new Error(scriptData.error || "创建脚本失败")
      }

      const scriptId = scriptData.script.id

      // 2. 批量创建选中的角色和分镜
      const batchRes = await fetch("/api/scenes/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scriptId,
          characters: generatedCharacters.filter((c) => selectedCharacters.has(c.id)),
          scenes: generatedScenes
            .filter((s) => selectedScenes.has(s.id))
            .map((s, index) => ({
              ...s,
              sceneNumber: index + 1,
            })),
        }),
      })

      const batchData = await batchRes.json()
      if (!batchRes.ok) {
        throw new Error(batchData.error || "批量创建失败")
      }

      toast.success(
        `创建完成：${batchData.charactersCount} 个角色，${batchData.scenesCount} 个分镜`
      )
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("保存失败:", error)
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            新增脚本片段
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "输入脚本内容，AI 将根据项目风格和剧情简介分析并生成分镜"
              : "预览 AI 生成的角色和分镜，选择要添加的内容"}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* 项目风格信息 */}
            {projectDescription && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <Label className="text-xs text-muted-foreground">项目剧情简介</Label>
                <p className="text-sm mt-1">{projectDescription}</p>
              </div>
            )}

            {/* 脚本输入 */}
            <div className="space-y-2">
              <Label htmlFor="script">
                脚本内容 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="script"
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                placeholder="输入本段脚本内容，包含场景描述、角色对话、动作说明等..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                输入越详细，AI 生成的分镜越准确。建议包含场景、角色动作、对话等内容。
              </p>
            </div>

            {/* 已有角色信息 */}
            {existingCharacters.length > 0 && (
              <div className="space-y-2">
                <Label>已有角色（AI 会自动识别是否出现）</Label>
                <div className="flex flex-wrap gap-2">
                  {existingCharacters.map((c) => (
                    <Badge key={c.id} variant="outline">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* 新角色预览 */}
            {generatedCharacters.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    新角色 ({selectedCharacters.size}/{generatedCharacters.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllCharacters}
                  >
                    {selectedCharacters.size === generatedCharacters.length
                      ? "取消全选"
                      : "全选"}
                  </Button>
                </div>
                <div className="grid gap-2">
                  {generatedCharacters.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => toggleCharacter(c.id)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedCharacters.has(c.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5",
                            selectedCharacters.has(c.id)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          )}
                        >
                          {selectedCharacters.has(c.id) && (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {c.gender === "male" ? "男" : c.gender === "female" ? "女" : "其他"}
                            </Badge>
                            {c.age && (
                              <Badge variant="outline" className="text-xs">
                                {c.age}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {c.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 分镜预览 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  分镜列表 ({selectedScenes.size}/{generatedScenes.length})
                </h4>
                <Button variant="ghost" size="sm" onClick={toggleAllScenes}>
                  {selectedScenes.size === generatedScenes.length
                    ? "取消全选"
                    : "全选"}
                </Button>
              </div>
              <div className="space-y-2">
                {generatedScenes.map((s, index) => (
                  <div
                    key={s.id}
                    onClick={() => toggleScene(s.id)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedScenes.has(s.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5",
                          selectedScenes.has(s.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}
                      >
                        {selectedScenes.has(s.id) && (
                          <Check className="w-3 h-3" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{s.title}</span>
                          {s.emotion && (
                            <Badge variant="secondary" className="text-xs">
                              {s.emotion}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {s.description}
                        </p>
                        {s.dialogue && (
                          <p className="text-sm mt-1 italic text-foreground/80">
                            "{s.dialogue}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          {step === "input" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleAnalyze} disabled={analyzing || !scriptContent.trim()}>
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI 分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    分析脚本
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("input")}
                disabled={saving}
              >
                上一步
              </Button>
              <Button onClick={handleSave} disabled={saving || selectedScenes.size === 0}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    添加到项目 ({selectedCharacters.size} 角色, {selectedScenes.size} 分镜)
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
