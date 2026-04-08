/**
 * 图生视频页面
 * 根据图片生成视频
 */

'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Video, Loader2, Download, Play, Upload, Image, X, Copy, Check, Sparkles } from 'lucide-react'

const DURATION_OPTIONS = [
  { value: '4', label: '4 秒' },
  { value: '5', label: '5 秒' },
  { value: '6', label: '6 秒' },
  { value: '8', label: '8 秒' },
  { value: '10', label: '10 秒' },
  { value: '12', label: '12 秒' },
]

const ASPECT_OPTIONS = [
  { value: '16:9', label: '16:9 (横版)' },
  { value: '9:16', label: '9:16 (竖版)' },
  { value: '1:1', label: '1:1 (方形)' },
]

export default function ImageToVideoPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState('5')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [generating, setGenerating] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [result, setResult] = useState<{ url: string; originalUrl: string } | null>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 优化提示词
  const handleOptimizePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('请先输入提示词')
      return
    }

    setOptimizing(true)
    try {
      const response = await fetch('/api/create/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type: 'video' }),
      })

      const data = await response.json()
      if (data.success) {
        setPrompt(data.data.optimized)
        toast.success('提示词优化完成')
      } else {
        toast.error(data.error || '优化失败')
      }
    } catch (error) {
      console.error('Optimize error:', error)
      toast.error('优化失败，请重试')
    } finally {
      setOptimizing(false)
    }
  }

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 下载视频
  const downloadVideo = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename || `video_${Date.now()}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
      toast.success('下载成功')
    } catch (error) {
      console.error('Download failed:', error)
      window.open(url, '_blank')
      toast.info('视频已在新窗口打开')
    }
  }

  // 复制链接
  const copyUrl = async () => {
    if (!result?.url) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      toast.success('链接已复制')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  // 生成视频
  const handleGenerate = async () => {
    if (!imagePreview) {
      toast.error('请上传图片')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/create/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imagePreview,
          prompt,
          duration: parseInt(duration),
          aspectRatio,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResult(data.data)
        toast.success('视频生成成功')
      } else {
        toast.error(data.error || '生成失败')
      }
    } catch (error) {
      console.error('Generate error:', error)
      toast.error('生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">图生视频</h1>
              <p className="text-xs text-muted-foreground">基于图片生成动态视频</p>
            </div>
          </div>
        </div>
      </header>

      {/* 内容 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：参数配置 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>上传图片</CardTitle>
                <CardDescription>
                  上传一张静态图片，AI 将其转化为动态视频
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="上传图片"
                      className="w-full aspect-video object-contain rounded-lg border bg-black/5"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setImagePreview(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                    >
                      更换图片
                    </Button>
                  </div>
                ) : (
                  <div
                    className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">点击上传图片</p>
                    <p className="text-xs text-muted-foreground mt-1">支持 PNG、JPG、WebP</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>运动描述</CardTitle>
                <CardDescription>
                  描述图片中想要的运动效果（可选）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOptimizePrompt}
                    disabled={optimizing || !prompt.trim()}
                    className="h-7 text-xs"
                  >
                    {optimizing ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    LLM 优化
                  </Button>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例如：镜头缓慢推进，人物微微转身，背景云朵飘动..."
                  className="min-h-[100px] resize-none"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>视频参数</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>视频时长</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>视频比例</Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              disabled={generating || !imagePreview}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  生成视频
                </>
              )}
            </Button>
          </div>

          {/* 右侧：预览 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>预览</CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-4">
                    <div className="relative aspect-video rounded-lg overflow-hidden border bg-black">
                      <video
                        ref={videoRef}
                        src={result.url}
                        className="w-full h-full object-contain"
                        controls
                        onPlay={() => setVideoPlaying(true)}
                        onPause={() => setVideoPlaying(false)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        播放大图
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => downloadVideo(result.url)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        下载
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyUrl}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">时长</span>
                        <span>{duration} 秒</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">比例</span>
                        <span>{aspectRatio}</span>
                      </div>
                      {prompt && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">运动描述</p>
                          <p className="text-sm">{prompt}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>上传图片后点击生成</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 提示 */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>提示：</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>图片清晰度越高，生成效果越好</li>
                    <li>主体明确的图片效果更佳</li>
                    <li>添加运动描述可获得更精确的效果</li>
                    <li>视频生成可能需要数分钟，请耐心等待</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 视频预览弹窗 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black">
          <DialogTitle className="sr-only">视频预览</DialogTitle>
          {result && (
            <div className="relative">
              <video
                src={result.url}
                className="w-full"
                controls
                autoPlay
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
