"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Settings, 
  Brain, 
  Image, 
  Video, 
  Save, 
  Loader2,
  Key,
  Server,
  Sparkles,
  Mic,
  Info
} from "lucide-react"
import { toast } from "sonner"

// 默认设置（系统模型）
const DEFAULT_SETTINGS: Settings = {
  id: 'default',
  llm_provider: 'doubao',
  llm_model: 'doubao-seed-1-8-251228',
  llm_api_key: null,
  llm_base_url: null,
  image_provider: 'doubao',
  image_model: 'doubao-seed-3-0',
  image_api_key: null,
  image_base_url: null,
  image_size: '2K',
  video_provider: 'doubao',
  video_model: 'doubao-seedance-1-5-pro-251215',
  video_api_key: null,
  video_base_url: null,
  video_resolution: '720p',
  video_ratio: '16:9',
  voice_provider: 'doubao',
  voice_model: 'doubao-tts',
  voice_api_key: null,
  voice_base_url: null,
  voice_default_style: 'natural',
}

interface Settings {
  id: string
  llm_provider: string
  llm_model: string
  llm_api_key: string | null
  llm_base_url: string | null
  image_provider: string
  image_model: string
  image_api_key: string | null
  image_base_url: string | null
  image_size: string
  video_provider: string
  video_model: string
  video_api_key: string | null
  video_base_url: string | null
  video_resolution: string
  video_ratio: string
  voice_provider: string
  voice_model: string
  voice_api_key: string | null
  voice_base_url: string | null
  voice_default_style: string
}

// 系统支持的 LLM 模型列表
const LLM_MODELS = [
  { value: "doubao-seed-2-0-pro-260215", label: "Doubao Seed 2.0 Pro (旗舰)", description: "复杂推理、多模态" },
  { value: "doubao-seed-2-0-lite-260215", label: "Doubao Seed 2.0 Lite", description: "平衡性能与成本" },
  { value: "doubao-seed-2-0-mini-260215", label: "Doubao Seed 2.0 Mini", description: "快速响应" },
  { value: "doubao-seed-1-8-251228", label: "Doubao Seed 1.8 (默认)", description: "多模态 Agent 优化" },
  { value: "doubao-seed-1-6-251015", label: "Doubao Seed 1.6", description: "通用对话" },
  { value: "doubao-seed-1-6-flash-250615", label: "Doubao Seed 1.6 Flash", description: "快速响应" },
  { value: "doubao-seed-1-6-thinking-250715", label: "Doubao Seed 1.6 Thinking", description: "深度推理" },
  { value: "doubao-seed-1-6-vision-250815", label: "Doubao Seed 1.6 Vision", description: "图像/视频理解" },
  { value: "deepseek-v3-2-251201", label: "DeepSeek V3.2", description: "高级推理" },
  { value: "deepseek-r1-250528", label: "DeepSeek R1", description: "研究分析" },
  { value: "kimi-k2-250905", label: "Kimi K2", description: "长上下文处理" },
  { value: "kimi-k2-5-260127", label: "Kimi K2.5", description: "Agent、代码、多模态" },
]

const IMAGE_MODELS = [
  { value: "doubao-seed-3-0", label: "Doubao Seed 3.0 (默认)", description: "高质量图像生成" },
  { value: "doubao-seedream-3-0-t2i-250415", label: "Doubao Seedream 3.0", description: "艺术风格图像" },
]

const VIDEO_MODELS = [
  { value: "doubao-seedance-1-5-pro-251215", label: "Doubao Seedance 1.5 Pro (默认)", description: "支持音频生成" },
]

const VOICE_MODELS = [
  { value: "doubao-tts", label: "Doubao TTS (默认)", description: "自然语音合成" },
  { value: "cosyvoice", label: "CosyVoice", description: "情感语音" },
]

const VOICE_STYLES = [
  { value: "natural", label: "自然" },
  { value: "gentle", label: "温柔" },
  { value: "energetic", label: "活力" },
  { value: "serious", label: "严肃" },
  { value: "cheerful", label: "欢快" },
  { value: "sad", label: "悲伤" },
  { value: "calm", label: "平静" },
  { value: "domineering", label: "霸气" },
  { value: "cute", label: "可爱" },
]

const PROVIDERS = [
  { value: "doubao", label: "豆包 / 字节跳动 (系统默认)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "kimi", label: "Kimi / 月之暗面" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "custom", label: "自定义 (OpenAI兼容)" },
]

const IMAGE_SIZES = ["1K", "2K", "4K"]
const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"]
const VIDEO_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      // 如果有用户配置，合并默认配置
      if (data.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      } else {
        setSettings(DEFAULT_SETTINGS)
      }
    } catch (error) {
      console.error("获取配置失败:", error)
      // 出错时也使用默认配置
      setSettings(DEFAULT_SETTINGS)
      toast.error("获取配置失败，使用默认配置")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchSettings()
    }
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llmProvider: settings.llm_provider,
          llmModel: settings.llm_model,
          llmApiKey: settings.llm_api_key,
          llmBaseUrl: settings.llm_base_url,
          imageProvider: settings.image_provider,
          imageModel: settings.image_model,
          imageApiKey: settings.image_api_key,
          imageBaseUrl: settings.image_base_url,
          imageSize: settings.image_size,
          videoProvider: settings.video_provider,
          videoModel: settings.video_model,
          videoApiKey: settings.video_api_key,
          videoBaseUrl: settings.video_base_url,
          videoResolution: settings.video_resolution,
          videoRatio: settings.video_ratio,
          voiceProvider: settings.voice_provider,
          voiceModel: settings.voice_model,
          voiceApiKey: settings.voice_api_key,
          voiceBaseUrl: settings.voice_base_url,
          voiceDefaultStyle: settings.voice_default_style,
        })
      })

      if (!res.ok) {
        throw new Error("保存失败")
      }

      toast.success("配置已保存")
      onOpenChange(false)
    } catch (error) {
      console.error("保存配置失败:", error)
      toast.error("保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof Settings, value: string | null) => {
    setSettings({ ...settings, [key]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            模型配置
          </DialogTitle>
          <DialogDescription>
            配置AI模型参数。系统已内置豆包模型，可直接使用。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="llm" className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="llm" className="gap-2">
                <Brain className="w-4 h-4" />
                LLM模型
              </TabsTrigger>
              <TabsTrigger value="image" className="gap-2">
                <Image className="w-4 h-4" />
                图像模型
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2">
                <Video className="w-4 h-4" />
                视频模型
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-2">
                <Mic className="w-4 h-4" />
                语音模型
              </TabsTrigger>
            </TabsList>

            {/* LLM配置 */}
            <TabsContent value="llm" className="space-y-6 mt-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">系统已内置豆包模型</p>
                      <p className="text-muted-foreground mt-1">
                        默认使用 Doubao Seed 1.8 模型，支持多模态理解。
                        无需配置 API Key 即可使用。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    大语言模型配置
                  </CardTitle>
                  <CardDescription>
                    用于文本分析、分镜生成等任务
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>服务商</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.llm_provider}
                        onChange={(e) => updateSetting("llm_provider", e.target.value)}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.llm_model}
                        onChange={(e) => updateSetting("llm_model", e.target.value)}
                      >
                        {LLM_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key (可选)
                    </Label>
                    <Input
                      type="password"
                      placeholder="留空使用系统默认"
                      value={settings.llm_api_key || ""}
                      onChange={(e) => updateSetting("llm_api_key", e.target.value || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      仅在使用自定义 API 时需要填写
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      Base URL (可选)
                    </Label>
                    <Input
                      placeholder="如: https://api.openai.com/v1"
                      value={settings.llm_base_url || ""}
                      onChange={(e) => updateSetting("llm_base_url", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 图像配置 */}
            <TabsContent value="image" className="space-y-6 mt-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">系统已内置图像生成模型</p>
                      <p className="text-muted-foreground mt-1">
                        默认使用 Doubao Seed 3.0，支持 2K/4K 分辨率。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    图像生成模型配置
                  </CardTitle>
                  <CardDescription>
                    用于生成分镜图片、角色造型图
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>服务商</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.image_provider}
                        onChange={(e) => updateSetting("image_provider", e.target.value)}
                      >
                        {PROVIDERS.filter(p => ['doubao', 'custom'].includes(p.value)).map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.image_model}
                        onChange={(e) => updateSetting("image_model", e.target.value)}
                      >
                        {IMAGE_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>图片尺寸</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.image_size}
                        onChange={(e) => updateSetting("image_size", e.target.value)}
                      >
                        {IMAGE_SIZES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key (可选)
                    </Label>
                    <Input
                      type="password"
                      placeholder="留空使用系统默认"
                      value={settings.image_api_key || ""}
                      onChange={(e) => updateSetting("image_api_key", e.target.value || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      Base URL (可选)
                    </Label>
                    <Input
                      placeholder="如: https://api.openai.com/v1"
                      value={settings.image_base_url || ""}
                      onChange={(e) => updateSetting("image_base_url", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 视频配置 */}
            <TabsContent value="video" className="space-y-6 mt-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">系统已内置视频生成模型</p>
                      <p className="text-muted-foreground mt-1">
                        使用 Doubao Seedance 1.5 Pro，支持图生视频、自动音频生成。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    视频生成模型配置
                  </CardTitle>
                  <CardDescription>
                    用于将分镜图片转换为视频片段
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>服务商</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.video_provider}
                        onChange={(e) => updateSetting("video_provider", e.target.value)}
                      >
                        {PROVIDERS.filter(p => ['doubao', 'custom'].includes(p.value)).map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.video_model}
                        onChange={(e) => updateSetting("video_model", e.target.value)}
                      >
                        {VIDEO_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>分辨率</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.video_resolution}
                        onChange={(e) => updateSetting("video_resolution", e.target.value)}
                      >
                        {VIDEO_RESOLUTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>宽高比</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.video_ratio}
                        onChange={(e) => updateSetting("video_ratio", e.target.value)}
                      >
                        {VIDEO_RATIOS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key (可选)
                    </Label>
                    <Input
                      type="password"
                      placeholder="留空使用系统默认"
                      value={settings.video_api_key || ""}
                      onChange={(e) => updateSetting("video_api_key", e.target.value || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      Base URL (可选)
                    </Label>
                    <Input
                      placeholder="如: https://api.openai.com/v1"
                      value={settings.video_base_url || ""}
                      onChange={(e) => updateSetting("video_base_url", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 语音配置 */}
            <TabsContent value="voice" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    语音合成模型配置
                  </CardTitle>
                  <CardDescription>
                    用于角色配音、对白朗读等任务
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>服务商</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.voice_provider}
                        onChange={(e) => updateSetting("voice_provider", e.target.value)}
                      >
                        {PROVIDERS.filter(p => ['doubao', 'custom'].includes(p.value)).map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>模型</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.voice_model}
                        onChange={(e) => updateSetting("voice_model", e.target.value)}
                      >
                        {VOICE_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>默认语音风格</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={settings.voice_default_style}
                        onChange={(e) => updateSetting("voice_default_style", e.target.value)}
                      >
                        {VOICE_STYLES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key (可选)
                    </Label>
                    <Input
                      type="password"
                      placeholder="留空使用系统默认"
                      value={settings.voice_api_key || ""}
                      onChange={(e) => updateSetting("voice_api_key", e.target.value || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      Base URL (可选)
                    </Label>
                    <Input
                      placeholder="如: https://api.openai.com/v1"
                      value={settings.voice_base_url || ""}
                      onChange={(e) => updateSetting("voice_base_url", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
