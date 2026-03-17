"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
  Mic
} from "lucide-react"
import { toast } from "sonner"

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

// 预设模型列表
const LLM_MODELS = [
  { value: "MiniMax-Text-01", label: "MiniMax Text 01", provider: "minimax" },
  { value: "abab6.5s-chat", label: "MiniMax abab6.5s Chat", provider: "minimax" },
  { value: "abab6.5g-chat", label: "MiniMax abab6.5g Chat", provider: "minimax" },
  { value: "abab6.5-chat", label: "MiniMax abab6.5 Chat", provider: "minimax" },
  { value: "doubao-seed-2-0-pro", label: "Doubao Seed 2.0 Pro", provider: "doubao" },
  { value: "doubao-seed-1-6", label: "Doubao Seed 1.6", provider: "doubao" },
  { value: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "openai" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "anthropic" },
  { value: "deepseek-chat", label: "DeepSeek Chat", provider: "deepseek" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner", provider: "deepseek" },
]

const IMAGE_MODELS = [
  { value: "doubao-seed-3-0", label: "Doubao Seed 3.0", provider: "doubao" },
  { value: "doubao-seedream-3-0-t2i-250415", label: "Doubao Seedream 3.0", provider: "doubao" },
  { value: "dall-e-3", label: "DALL-E 3", provider: "openai" },
  { value: "dall-e-2", label: "DALL-E 2", provider: "openai" },
  { value: "stable-diffusion-xl-1024-v1-0", label: "Stable Diffusion XL", provider: "stability" },
]

const VIDEO_MODELS = [
  { value: "doubao-seedance-1-5-pro-251215", label: "Doubao Seedance 1.5 Pro", provider: "doubao" },
  { value: "sora", label: "Sora", provider: "openai" },
  { value: "runway-gen3-turbo", label: "Runway Gen-3 Turbo", provider: "runway" },
  { value: "pika-2.0", label: "Pika 2.0", provider: "pika" },
]

const VOICE_MODELS = [
  { value: "doubao-tts", label: "Doubao TTS", provider: "doubao" },
  { value: "cosyvoice", label: "CosyVoice", provider: "alibaba" },
  { value: "tts-1", label: "OpenAI TTS-1", provider: "openai" },
  { value: "tts-1-hd", label: "OpenAI TTS-1 HD", provider: "openai" },
  { value: "eleven-monolingual-v1", label: "ElevenLabs Monolingual", provider: "elevenlabs" },
  { value: "eleven-multilingual-v2", label: "ElevenLabs Multilingual v2", provider: "elevenlabs" },
]

const VOICE_STYLES = [
  { value: "natural", label: "自然" },
  { value: "gentle", label: "温柔" },
  { value: "energetic", label: "活力" },
  { value: "serious", label: "严肃" },
  { value: "cheerful", label: "欢快" },
  { value: "sad", label: "悲伤" },
  { value: "angry", label: "愤怒" },
  { value: "calm", label: "平静" },
  { value: "domineering", label: "霸气" },
  { value: "cute", label: "可爱" },
]

const PROVIDERS = [
  { value: "minimax", label: "MiniMax" },
  { value: "doubao", label: "豆包 / 字节跳动" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "alibaba", label: "阿里云" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "stability", label: "Stability AI" },
  { value: "runway", label: "Runway" },
  { value: "pika", label: "Pika" },
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
  const [settings, setSettings] = useState<Settings | null>(null)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      setSettings(data.settings)
    } catch (error) {
      console.error("获取配置失败:", error)
      toast.error("获取配置失败")
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
    if (!settings) return

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
    if (settings) {
      setSettings({ ...settings, [key]: value })
    }
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
            配置AI模型和API参数，支持OpenAI兼容格式的API
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : settings ? (
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
                      API Key
                    </Label>
                    <Input
                      type="password"
                      placeholder="留空使用系统默认"
                      value={settings.llm_api_key || ""}
                      onChange={(e) => updateSetting("llm_api_key", e.target.value || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      Base URL
                    </Label>
                    <Input
                      placeholder="如: https://api.openai.com/v1"
                      value={settings.llm_base_url || ""}
                      onChange={(e) => updateSetting("llm_base_url", e.target.value || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      支持OpenAI兼容格式的API端点
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 图像配置 */}
            <TabsContent value="image" className="space-y-6 mt-4">
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
                        {PROVIDERS.map((p) => (
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
                      API Key
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
                      Base URL
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
                        {PROVIDERS.map((p) => (
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
                      API Key
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
                      Base URL
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
                        {PROVIDERS.filter(p => ['doubao', 'openai', 'alibaba', 'elevenlabs', 'custom'].includes(p.value)).map((p) => (
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
                      API Key
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
                      Base URL
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
        ) : null}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !settings}>
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
