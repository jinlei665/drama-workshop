/**
 * 设置页面
 * 用户配置 AI 模型、API Key 等
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Settings, Loader2, Save, RotateCcw } from 'lucide-react'

interface SettingsData {
  // Coze API 配置
  coze_api_key?: string | null
  coze_base_url?: string
  coze_bot_id?: string
  // LLM 配置
  llm_provider?: string
  llm_model?: string
  llm_api_key?: string | null
  llm_base_url?: string | null
  // 图像配置
  image_provider?: string
  image_model?: string
  image_api_key?: string | null
  image_base_url?: string | null
  image_size?: string
  // 视频配置
  video_provider?: string
  video_model?: string
  video_api_key?: string | null
  video_base_url?: string | null
  video_resolution?: string
  video_ratio?: string
  // 语音配置
  voice_provider?: string
  voice_model?: string
  voice_api_key?: string | null
  voice_base_url?: string | null
  voice_default_style?: string
  // FFmpeg 配置
  ffmpeg_path?: string | null
  ffprobe_path?: string | null
}

const defaultSettings: SettingsData = {
  llm_provider: 'doubao',
  llm_model: 'doubao-seed-1-8-251228',
  image_provider: 'doubao',
  image_model: 'doubao-seedream-4-0-250828',
  image_size: '1024x1024',
  video_provider: 'doubao',
  video_model: 'doubao-seedance-1-5-pro-251215',
  video_resolution: '720p',
  video_ratio: '16:9',
  voice_provider: 'doubao',
  voice_model: 'doubao-tts',
  voice_default_style: 'natural',
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SettingsData>({})
  const [hasChanges, setHasChanges] = useState(false)

  // 加载设置
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/settings')
        const data = await response.json()
        if (data.success && data.data?.settings) {
          setSettings({ ...defaultSettings, ...data.data.settings })
        } else {
          setSettings(defaultSettings)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        setSettings(defaultSettings)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  // 更新设置字段
  const updateSetting = (key: keyof SettingsData, value: string | boolean | null) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  // 保存设置
  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Coze API
          cozeApiKey: settings.coze_api_key,
          cozeBaseUrl: settings.coze_base_url,
          cozeBotId: settings.coze_bot_id,
          // LLM
          llmProvider: settings.llm_provider,
          llmModel: settings.llm_model,
          llmApiKey: settings.llm_api_key,
          llmBaseUrl: settings.llm_base_url,
          // Image
          imageProvider: settings.image_provider,
          imageModel: settings.image_model,
          imageApiKey: settings.image_api_key,
          imageBaseUrl: settings.image_base_url,
          imageSize: settings.image_size,
          // Video
          videoProvider: settings.video_provider,
          videoModel: settings.video_model,
          videoApiKey: settings.video_api_key,
          videoBaseUrl: settings.video_base_url,
          videoResolution: settings.video_resolution,
          videoRatio: settings.video_ratio,
          // Voice
          voiceProvider: settings.voice_provider,
          voiceModel: settings.voice_model,
          voiceApiKey: settings.voice_api_key,
          voiceBaseUrl: settings.voice_base_url,
          voiceDefaultStyle: settings.voice_default_style,
          // FFmpeg
          ffmpegPath: settings.ffmpeg_path,
          ffprobePath: settings.ffprobe_path,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('设置已保存')
        setHasChanges(false)
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('保存设置失败')
    } finally {
      setSaving(false)
    }
  }

  // 重置为默认
  const handleReset = () => {
    setSettings(defaultSettings)
    setHasChanges(true)
    toast.info('已重置为默认设置，请点击保存')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">系统设置</h1>
                <p className="text-xs text-muted-foreground">配置 AI 模型和 API</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={saving}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                重置
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                保存
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 内容 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Tabs defaultValue="llm" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="llm">大语言模型</TabsTrigger>
            <TabsTrigger value="image">图像生成</TabsTrigger>
            <TabsTrigger value="video">视频生成</TabsTrigger>
            <TabsTrigger value="other">其他配置</TabsTrigger>
          </TabsList>

          {/* LLM 配置 */}
          <TabsContent value="llm" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>大语言模型 (LLM) 配置</CardTitle>
                <CardDescription>
                  配置用于分析和处理文本的 AI 模型。系统默认使用豆包模型。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="llm_provider">模型提供商</Label>
                    <Select
                      value={settings.llm_provider || 'doubao'}
                      onValueChange={(v) => updateSetting('llm_provider', v)}
                    >
                      <SelectTrigger id="llm_provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doubao">豆包 (Doubao)</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="kimi">Kimi</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="llm_model">模型名称</Label>
                    <Input
                      id="llm_model"
                      value={settings.llm_model || ''}
                      onChange={(e) => updateSetting('llm_model', e.target.value)}
                      placeholder="例如: doubao-seed-1-8-251228"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="llm_api_key">API Key</Label>
                    <Input
                      id="llm_api_key"
                      type="password"
                      value={settings.llm_api_key || ''}
                      onChange={(e) => updateSetting('llm_api_key', e.target.value || null)}
                      placeholder="输入 API Key（可选）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="llm_base_url">API 地址</Label>
                    <Input
                      id="llm_base_url"
                      value={settings.llm_base_url || ''}
                      onChange={(e) => updateSetting('llm_base_url', e.target.value || null)}
                      placeholder="例如: https://api.example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 图像配置 */}
          <TabsContent value="image" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>图像生成配置</CardTitle>
                <CardDescription>
                  配置用于生成图像的 AI 模型。系统默认使用豆包图像模型。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="image_provider">模型提供商</Label>
                    <Select
                      value={settings.image_provider || 'doubao'}
                      onValueChange={(v) => updateSetting('image_provider', v)}
                    >
                      <SelectTrigger id="image_provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doubao">豆包 (Doubao)</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image_model">模型名称</Label>
                    <Input
                      id="image_model"
                      value={settings.image_model || ''}
                      onChange={(e) => updateSetting('image_model', e.target.value)}
                      placeholder="例如: doubao-seedream-4-0-250828"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="image_size">默认图像尺寸</Label>
                    <Select
                      value={settings.image_size || '1024x1024'}
                      onValueChange={(v) => updateSetting('image_size', v)}
                    >
                      <SelectTrigger id="image_size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512x512">512 x 512</SelectItem>
                        <SelectItem value="768x768">768 x 768</SelectItem>
                        <SelectItem value="1024x1024">1024 x 1024</SelectItem>
                        <SelectItem value="1024x768">1024 x 768 (横版)</SelectItem>
                        <SelectItem value="768x1024">768 x 1024 (竖版)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="image_api_key">API Key</Label>
                    <Input
                      id="image_api_key"
                      type="password"
                      value={settings.image_api_key || ''}
                      onChange={(e) => updateSetting('image_api_key', e.target.value || null)}
                      placeholder="输入 API Key（可选）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image_base_url">API 地址</Label>
                    <Input
                      id="image_base_url"
                      value={settings.image_base_url || ''}
                      onChange={(e) => updateSetting('image_base_url', e.target.value || null)}
                      placeholder="例如: https://api.example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 视频配置 */}
          <TabsContent value="video" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>视频生成配置</CardTitle>
                <CardDescription>
                  配置用于生成视频的 AI 模型。系统默认使用豆包视频模型。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="video_provider">模型提供商</Label>
                    <Select
                      value={settings.video_provider || 'doubao'}
                      onValueChange={(v) => updateSetting('video_provider', v)}
                    >
                      <SelectTrigger id="video_provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doubao">豆包 (Doubao)</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="video_model">模型名称</Label>
                    <Input
                      id="video_model"
                      value={settings.video_model || ''}
                      onChange={(e) => updateSetting('video_model', e.target.value)}
                      placeholder="例如: doubao-seedance-1-5-pro-251215"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="video_resolution">视频分辨率</Label>
                    <Select
                      value={settings.video_resolution || '720p'}
                      onValueChange={(v) => updateSetting('video_resolution', v)}
                    >
                      <SelectTrigger id="video_resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="480p">480p</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="video_ratio">视频比例</Label>
                    <Select
                      value={settings.video_ratio || '16:9'}
                      onValueChange={(v) => updateSetting('video_ratio', v)}
                    >
                      <SelectTrigger id="video_ratio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 (横版)</SelectItem>
                        <SelectItem value="9:16">9:16 (竖版)</SelectItem>
                        <SelectItem value="1:1">1:1 (方形)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="video_api_key">API Key</Label>
                    <Input
                      id="video_api_key"
                      type="password"
                      value={settings.video_api_key || ''}
                      onChange={(e) => updateSetting('video_api_key', e.target.value || null)}
                      placeholder="输入 API Key（可选）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="video_base_url">API 地址</Label>
                    <Input
                      id="video_base_url"
                      value={settings.video_base_url || ''}
                      onChange={(e) => updateSetting('video_base_url', e.target.value || null)}
                      placeholder="例如: https://api.example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 其他配置 */}
          <TabsContent value="other" className="space-y-6">
            {/* Coze API */}
            <Card>
              <CardHeader>
                <CardTitle>Coze API 配置</CardTitle>
                <CardDescription>
                  如果使用 Coze 平台的自定义 Bot，需要配置此部分。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="coze_api_key">Coze API Key</Label>
                    <Input
                      id="coze_api_key"
                      type="password"
                      value={settings.coze_api_key || ''}
                      onChange={(e) => updateSetting('coze_api_key', e.target.value || null)}
                      placeholder="输入 Coze API Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coze_base_url">API 地址</Label>
                    <Input
                      id="coze_base_url"
                      value={settings.coze_base_url || 'https://api.coze.com'}
                      onChange={(e) => updateSetting('coze_base_url', e.target.value)}
                      placeholder="https://api.coze.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coze_bot_id">Bot ID</Label>
                  <Input
                    id="coze_bot_id"
                    value={settings.coze_bot_id || ''}
                    onChange={(e) => updateSetting('coze_bot_id', e.target.value)}
                    placeholder="输入 Coze Bot ID"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 语音配置 */}
            <Card>
              <CardHeader>
                <CardTitle>语音生成配置</CardTitle>
                <CardDescription>
                  配置用于文字转语音的 AI 模型。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="voice_provider">模型提供商</Label>
                    <Select
                      value={settings.voice_provider || 'doubao'}
                      onValueChange={(v) => updateSetting('voice_provider', v)}
                    >
                      <SelectTrigger id="voice_provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doubao">豆包 (Doubao)</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="voice_model">模型名称</Label>
                    <Input
                      id="voice_model"
                      value={settings.voice_model || ''}
                      onChange={(e) => updateSetting('voice_model', e.target.value)}
                      placeholder="例如: doubao-tts"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="voice_api_key">API Key</Label>
                    <Input
                      id="voice_api_key"
                      type="password"
                      value={settings.voice_api_key || ''}
                      onChange={(e) => updateSetting('voice_api_key', e.target.value || null)}
                      placeholder="输入 API Key（可选）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="voice_default_style">默认语音风格</Label>
                    <Select
                      value={settings.voice_default_style || 'natural'}
                      onValueChange={(v) => updateSetting('voice_default_style', v)}
                    >
                      <SelectTrigger id="voice_default_style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="natural">自然</SelectItem>
                        <SelectItem value="professional">专业</SelectItem>
                        <SelectItem value="casual">休闲</SelectItem>
                        <SelectItem value="emotional">情感</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* FFmpeg 配置 */}
            <Card>
              <CardHeader>
                <CardTitle>FFmpeg 配置</CardTitle>
                <CardDescription>
                  配置视频合并功能使用的 FFmpeg 路径。系统已内置 FFmpeg，通常不需要修改。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ffmpeg_path">FFmpeg 路径</Label>
                    <Input
                      id="ffmpeg_path"
                      value={settings.ffmpeg_path || ''}
                      onChange={(e) => updateSetting('ffmpeg_path', e.target.value || null)}
                      placeholder="留空使用系统默认"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ffprobe_path">FFprobe 路径</Label>
                    <Input
                      id="ffprobe_path"
                      value={settings.ffprobe_path || ''}
                      onChange={(e) => updateSetting('ffprobe_path', e.target.value || null)}
                      placeholder="留空使用系统默认"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
