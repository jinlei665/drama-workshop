/**
 * AI 生成模块首页
 * 提供多种 AI 生成功能的导航
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wand2, Image, Video, Play, ArrowLeft } from 'lucide-react'

export default function CreateIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">AI 生成</h1>
                <p className="text-xs text-muted-foreground">探索 AI 创作能力</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 内容 */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2">选择 AI 生成工具</h2>
          <p className="text-muted-foreground">探索多种 AI 生成能力，快速创作精彩内容</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 文生图 */}
          <Link href="/create/text-to-image">
            <Card className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4 group-hover:bg-pink-500/20 transition-colors">
                  <Wand2 className="w-6 h-6 text-pink-500" />
                </div>
                <CardTitle>文生图</CardTitle>
                <CardDescription>
                  根据文字描述生成精美图像，支持多种风格
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* 图生图 */}
          <Link href="/create/image-to-image">
            <Card className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                  <Image className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle>图生图</CardTitle>
                <CardDescription>
                  基于参考图片生成新的图像，保持风格一致性
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* 文生视频 */}
          <Link href="/create/text-to-video">
            <Card className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
                  <Video className="w-6 h-6 text-orange-500" />
                </div>
                <CardTitle>文生视频</CardTitle>
                <CardDescription>
                  根据文字描述生成动态视频，支持多种时长
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          {/* 图生视频 */}
          <Link href="/create/image-to-video">
            <Card className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <Play className="w-6 h-6 text-blue-500" />
                </div>
                <CardTitle>图生视频</CardTitle>
                <CardDescription>
                  将静态图片转换为动态视频，赋予图像生命力
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
