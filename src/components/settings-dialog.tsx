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
  Info,
  Film,
  CheckCircle,
  AlertCircle,
  Folder,
  Cloud
} from "lucide-react"
import { toast } from "sonner"

// 默认设置（系统模型）
const DEFAULT_SETTINGS: Settings = {
  id: 'default',
  // Coze API 配置（自部署时需要配置）
  coze_api_key: null,
  coze_base_url: 'https://api.coze.cn',
  coze_bot_id: null,
  llm_provider: 'doubao',
  llm_model: 'doubao-seed-1-8-251228',
  llm_api_key: null,
  llm_base_url: null,
  image_provider: 'doubao',
  image_model: 'doubao-seedream-4-0-250828',
  image_api_key: null,
  image_base_url: null,
  image_size: '2K',
  video_provider: 'doubao',
  video_model: 'doubao-seedance-1-0-pro-250528',
  video_api_key: null,
  video_base_url: null,
  video_resolution: '720p',
  video_ratio: '16:9',
  voice_provider: 'doubao',
  voice_model: 'doubao-tts',
  voice_api_key: null,
  voice_base_url: null,
  voice_default_style: 'natural',
  // FFmpeg 配置
  ffmpeg_path: null,
  ffprobe_path: null,
}

interface Settings {
  id: string
  // Coze API 配置
  coze_api_key: string | null
  coze_base_url: string | null
  coze_bot_id: string | null
  // LLM 配置
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
  // FFmpeg 配置
  ffmpeg_path: string | null
  ffprobe_path: string | null
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

// 火山引擎图像生成模型列表
// 文档：https://www.volcengine.com/docs/82379/1541523
const IMAGE_MODELS = [
  { value: "doubao-seedream-4-0-250828", label: "Doubao Seedream 4.0 (推荐)", description: "SOTA级多模态图像创作，支持多图融合、组图生成" },
  { value: "doubao-seedream-3-0-t2i-250415", label: "Doubao Seedream 3.0", description: "原生2K分辨率，文本排版效果增强" },
  { value: "doubao-seed-3-0", label: "Doubao Seed 3.0", description: "通用图像生成" },
]

// 火山引擎视频生成模型列表
// 文档：https://www.volcengine.com/docs/82379/1587798
const VIDEO_MODELS = [
  { value: "doubao-seedance-1-5-pro-251215", label: "Doubao Seedance 1.5 Pro (推荐)", description: "支持音频生成、首尾帧生视频" },
  { value: "doubao-seedance-1-0-pro-250528", label: "Doubao Seedance 1.0 Pro", description: "首尾帧生视频、多镜头叙事" },
  { value: "doubao-seedance-1-0-pro-fast", label: "Doubao Seedance 1.0 Pro Fast", description: "快速生成版本" },
  { value: "doubao-seedance-1-0-lite", label: "Doubao Seedance 1.0 Lite", description: "轻量版，性价比之选" },
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
  { value: "volcengine", label: "火山引擎 (OpenAI兼容)" },
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

// FFmpeg 配置组件
function FFmpegConfigSection({ 
  ffmpegPath, 
  ffprobePath,
  onUpdate 
}: { 
  ffmpegPath: string | null
  ffprobePath: string | null
  onUpdate: (key: string, value: string | null) => void 
}) {
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<{
    configured: boolean
    version?: string
    path?: string
    error?: string
  } | null>(null)

  const checkFfmpeg = async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/ffmpeg")
      const data = await res.json()
      setStatus(data.data || data)
    } catch {
      setStatus({ configured: false, error: "检测失败" })
    } finally {
      setChecking(false)
    }
  }

  const testCustomPath = async () => {
    if (!ffmpegPath) return
    setChecking(true)
    try {
      const res = await fetch("/api/ffmpeg", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ffmpegPath, ffprobePath })
      })
      const data = await res.json()
      setStatus(data.data || data)
      if (data.configured) {
        toast.success(`FFmpeg 检测成功: v${data.version}`)
      } else {
        toast.error(data.error || "FFmpeg 路径无效")
      }
    } catch {
      toast.error("检测失败")
    } finally {
      setChecking(false)
    }
  }

  const clearCustomPath = async () => {
    try {
      const res = await fetch("/api/ffmpeg", { method: "DELETE" })
      const data = await res.json()
      onUpdate("ffmpeg_path", null)
      onUpdate("ffprobe_path", null)
      setStatus(data.data || data)
      toast.success("已清除自定义配置")
    } catch {
      toast.error("清除失败")
    }
  }

  // 首次加载时检测
  useEffect(() => {
    checkFfmpeg()
  }, [])

  return (
    <div className="space-y-6">
      {/* 状态卡片 */}
      <Card className={status?.configured ? "border-green-500/20 bg-green-500/5" : "border-amber-500/20 bg-amber-500/5"}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {status?.configured ? (
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">
                {status?.configured ? "FFmpeg 可用" : "FFmpeg 未检测到"}
              </p>
              {status?.version && (
                <p className="text-sm text-muted-foreground mt-1">
                  版本: {status.version} | 路径: {status.path || "系统环境变量"}
                </p>
              )}
              {status?.error && (
                <p className="text-sm text-destructive mt-1">{status.error}</p>
              )}
              {!status?.configured && (
                <p className="text-sm text-muted-foreground mt-2">
                  视频合并功能需要 FFmpeg。请安装 FFmpeg 或配置自定义路径。
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkFfmpeg}
              disabled={checking}
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "重新检测"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FFmpeg 路径配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Folder className="w-4 h-4" />
            自定义路径
          </CardTitle>
          <CardDescription>
            如果系统环境变量中没有 FFmpeg，可以手动配置路径
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>FFmpeg 可执行文件路径</Label>
            <div className="flex gap-2">
              <Input
                placeholder={process.platform === 'win32' 
                  ? "如: C:\\ffmpeg\\bin\\ffmpeg.exe" 
                  : "如: /usr/local/bin/ffmpeg"}
                value={ffmpegPath || ""}
                onChange={(e) => onUpdate("ffmpeg_path", e.target.value || null)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {process.platform === 'win32' 
                ? "Windows 用户需要指定完整的 .exe 文件路径" 
                : "Linux/Mac 用户需要指定 ffmpeg 可执行文件的完整路径"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>FFprobe 可执行文件路径 (可选)</Label>
            <Input
              placeholder={process.platform === 'win32' 
                ? "如: C:\\ffmpeg\\bin\\ffprobe.exe" 
                : "如: /usr/local/bin/ffprobe"}
              value={ffprobePath || ""}
              onChange={(e) => onUpdate("ffprobe_path", e.target.value || null)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={testCustomPath}
              disabled={checking || !ffmpegPath}
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  检测中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  测试路径
                </>
              )}
            </Button>
            {ffmpegPath && (
              <Button
                variant="ghost"
                onClick={clearCustomPath}
                disabled={checking}
              >
                清除自定义配置
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 安装指南 */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">安装指南</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div>
            <p className="font-medium text-foreground mb-1">Windows:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>从 <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ffmpeg.org</a> 下载</li>
              <li>解压到如 C:\ffmpeg</li>
              <li>将 C:\ffmpeg\bin 添加到系统环境变量 PATH</li>
              <li>或直接在上方配置完整路径</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">macOS (Homebrew):</p>
            <code className="block bg-secondary/50 p-2 rounded text-xs">brew install ffmpeg</code>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Linux (Ubuntu/Debian):</p>
            <code className="block bg-secondary/50 p-2 rounded text-xs">sudo apt update && sudo apt install ffmpeg</code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
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
          cozeApiKey: settings.coze_api_key,
          cozeBaseUrl: settings.coze_base_url,
          cozeBotId: settings.coze_bot_id,
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
          ffmpegPath: settings.ffmpeg_path,
          ffprobePath: settings.ffprobe_path,
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
            配置AI模型参数和工具路径。系统已内置豆包模型，可直接使用。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="llm" className="mt-4">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="api" className="gap-2">
                <Cloud className="w-4 h-4" />
                API
              </TabsTrigger>
              <TabsTrigger value="llm" className="gap-2">
                <Brain className="w-4 h-4" />
                LLM
              </TabsTrigger>
              <TabsTrigger value="image" className="gap-2">
                <Image className="w-4 h-4" />
                图像
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2">
                <Video className="w-4 h-4" />
                视频
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-2">
                <Mic className="w-4 h-4" />
                语音
              </TabsTrigger>
              <TabsTrigger value="ffmpeg" className="gap-2">
                <Film className="w-4 h-4" />
                FFmpeg
              </TabsTrigger>
            </TabsList>

            {/* API 配置 */}
            <TabsContent value="api" className="space-y-6 mt-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Cloud className="w-5 h-5 text-primary mt-0.5" />
                    <div className="text-sm flex-1">
                      <p className="font-medium">Coze API 配置</p>
                      <p className="text-muted-foreground mt-1">
                        在 Coze 平台获取 API Key 后，填入下方配置即可使用系统内置的 AI 模型。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Coze API 密钥配置
                  </CardTitle>
                  <CardDescription>
                    配置后可在自部署环境中使用豆包系列模型
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key
                    </Label>
                    <Input
                      type="password"
                      placeholder="pat-xxxxxxxxxxxxx"
                      value={settings.coze_api_key || ""}
                      onChange={(e) => updateSetting("coze_api_key", e.target.value || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      从 Coze 平台获取：个人设置 → API 访问令牌 → 创建令牌
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      Base URL
                    </Label>
                    <Input
                      placeholder="https://api.coze.cn"
                      value={settings.coze_base_url || ""}
                      onChange={(e) => updateSetting("coze_base_url", e.target.value || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      国内用户使用 api.coze.cn，海外用户使用 api.coze.com
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Bot ID（智能体ID）
                    </Label>
                    <Input
                      placeholder="73xxxxxxxxxx"
                      value={settings.coze_bot_id || ""}
                      onChange={(e) => updateSetting("coze_bot_id", e.target.value || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      在 Coze 创建智能体后，URL 中的数字即为 Bot ID
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 获取指南 */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">获取 Coze API Key 和 Bot ID</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>
                      访问 <a href="https://www.coze.cn" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Coze 平台</a> 并登录
                    </li>
                    <li>点击右上角头像 →「个人设置」</li>
                    <li>在左侧菜单选择「API 访问令牌」</li>
                    <li>点击「创建令牌」，选择权限后生成</li>
                    <li>复制生成的 Token（以 pat- 开头）</li>
                    <li>
                      <strong>创建智能体</strong>：点击「工作空间」→「创建 Bot」
                    </li>
                    <li>
                      配置智能体后发布，从 URL 获取 Bot ID（如 /bot/<strong>73428668xxx</strong>）
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="font-medium text-xs mb-1">💡 提示</p>
                    <p className="text-xs text-muted-foreground">
                      配置 Coze API 后，可使用豆包系列大模型（Doubao Seed）、图像生成（Doubao Seedream）、视频生成（Doubao Seedance）等全部 AI 能力。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

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
                        {PROVIDERS.filter(p => ['doubao', 'volcengine', 'custom'].includes(p.value)).map((p) => (
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
                      placeholder="火山引擎: https://ark.cn-beijing.volces.com/api/v3"
                      value={settings.image_base_url || ""}
                      onChange={(e) => updateSetting("image_base_url", e.target.value || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      选择火山引擎时，填写火山方舟BASE URL
                    </p>
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

            {/* FFmpeg 配置 */}
            <TabsContent value="ffmpeg" className="space-y-6 mt-4">
              <FFmpegConfigSection 
                ffmpegPath={settings.ffmpeg_path}
                ffprobePath={settings.ffprobe_path}
                onUpdate={(key, value) => updateSetting(key as keyof Settings, value)}
              />
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
