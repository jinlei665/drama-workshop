/**
 * 图生图页面
 * 根据参考图片和文本提示词生成新图像
 */

'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Wand2, Loader2, Download, Maximize2, X, Upload, Image, Copy, Check, Sparkles, ArrowLeft } from 'lucide-react'

const STYLE_OPTIONS = [
  { value: 'realistic', label: '写实风格' },
  { value: 'anime', label: '动漫风格' },
  { value: 'cartoon', label: '卡通风格' },
  { value: 'oil_painting', label: '油画风格' },
  { value: 'watercolor', label: '水彩风格' },
  { value: 'digital_art', label: '数字艺术' },
]

const SIZE_OPTIONS = [
  { value: '512x512', label: '512 x 512' },
  { value: '768x768', label: '768 x 768' },
  { value: '1024x1024', label: '1024 x 1024' },
  { value: '1024x768', label: '1024 x 768 (横版)' },
  { value: '768x1024', label: '768 x 1024 (竖版)' },
]

export default function ImageToImagePage() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [style, setStyle] = useState('realistic')
  const [size, setSize] = useState('1024x1024')
  const [strength, setStrength] = useState([0.7])
  const [generating, setGenerating] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [result, setResult] = useState<{ url: string; originalUrl: string } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
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
        body: JSON.stringify({ prompt, type: 'image' }),
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

  // 下载图片
  const downloadImage = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename || `image_${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
      toast.success('下载成功')
    } catch (error) {
      console.error('Download failed:', error)
      window.open(url, '_blank')
      toast.info('文件已在新窗口打开，请右键另存为')
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

  // 生成图像
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('请输入图像描述')
      return
    }
    if (!imagePreview) {
      toast.error('请上传参考图片')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/create/image-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negativePrompt,
          imageUrl: imagePreview,
          style,
          size,
          strength: strength[0],
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResult(data.data)
        toast.success('生成成功')
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/create">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">图生图</h1>
                <p className="text-xs text-muted-foreground">基于参考图片生成新图像</p>
              </div>
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
                <CardTitle>参考图片</CardTitle>
                <CardDescription>
                  上传一张参考图片，AI 将在此基础上生成新图像
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
                      alt="参考图片"
                      className="w-full aspect-square object-contain rounded-lg border bg-muted"
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
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">点击上传参考图片</p>
                    <p className="text-xs text-muted-foreground mt-1">支持 PNG、JPG、WebP</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>图像描述</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="prompt">描述</Label>
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
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要生成的图像变化..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="negative">反向提示词（可选）</Label>
                  <Textarea
                    id="negative"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="低质量，模糊..."
                    className="min-h-[60px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>生成参数</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>图像风格</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>图像尺寸</Label>
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>变换强度: {Math.round(strength[0] * 100)}%</Label>
                  <Slider
                    value={strength}
                    onValueChange={setStrength}
                    min={0.1}
                    max={1}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">
                    数值越高，生成的图像与原图差异越大
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || !imagePreview}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  生成图像
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
                    <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={result.url}
                        alt="生成结果"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Maximize2 className="w-4 h-4 mr-1" />
                        查看大图
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => downloadImage(result.url)}
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">参考图片</p>
                        <img
                          src={imagePreview || ''}
                          alt="参考"
                          className="w-full aspect-square object-cover rounded"
                        />
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">生成结果</p>
                        <img
                          src={result.url}
                          alt="结果"
                          className="w-full aspect-square object-cover rounded"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>上传参考图片并输入描述后生成</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 大图预览弹窗 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0">
          <DialogTitle className="sr-only">图像预览</DialogTitle>
          {result && (
            <div className="relative">
              <img src={result.url} alt="预览" className="w-full h-auto" />
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
