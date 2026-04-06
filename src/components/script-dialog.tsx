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
  User,
} from "lucide-react"
import { toast } from "sonner"

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

export function ScriptDialog({
  open,
  onOpenChange,
  projectId,
  projectStyle,
  projectDescription,
  existingCharacters,
  onSuccess,
}: ScriptDialogProps) {
  const [scriptTitle, setScriptTitle] = useState("")
  const [scriptContent, setScriptContent] = useState("")
  const [analyzing, setAnalyzing] = useState(false)

  // 重置状态
  useEffect(() => {
    if (!open) {
      setScriptTitle("")
      setScriptContent("")
      setAnalyzing(false)
    }
  }, [open])

  // 分析脚本
  const handleAnalyze = async () => {
    if (!scriptContent.trim()) {
      toast.error("请输入脚本内容")
      return
    }

    setAnalyzing(true)
    try {
      // 1. 先创建脚本记录
      const scriptRes = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: scriptTitle.trim() || `脚本 ${new Date().toLocaleDateString()}`,
          content: scriptContent,
          description: "AI 分析生成",
        }),
      })

      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) {
        throw new Error(scriptData.error || "创建脚本失败")
      }

      const scriptId = scriptData.script.id

      // 2. 调用分析 API（会直接插入角色和分镜到数据库）
      const analyzeRes = await fetch("/api/scripts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scriptId,
          scriptContent,
          existingCharacters,
        }),
      })

      const analyzeData = await analyzeRes.json()
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || "分析失败")
      }

      toast.success(
        `创建完成：${analyzeData.charactersCount} 个角色，${analyzeData.scenesCount} 个分镜`
      )
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("分析脚本失败:", error)
      toast.error(error instanceof Error ? error.message : "分析失败")
    } finally {
      setAnalyzing(false)
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
            输入脚本内容，AI 将根据项目风格和剧情简介分析并生成角色和分镜
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* 项目风格信息 */}
          {projectDescription && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground">项目剧情简介</Label>
              <p className="text-sm mt-1">{projectDescription}</p>
            </div>
          )}

          {/* 脚本标题 */}
          <div className="space-y-2">
            <Label htmlFor="script-title">
              脚本标题（可选）
            </Label>
            <Input
              id="script-title"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
              placeholder="输入脚本标题..."
            />
          </div>

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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={analyzing}
          >
            取消
          </Button>
          <Button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                开始分析
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
