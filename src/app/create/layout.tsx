/**
 * AI 生成模块布局
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Wand2, Image, Video, Sparkles, ArrowLeft } from 'lucide-react'

const navItems = [
  {
    title: '文生图',
    href: '/create/text-to-image',
    icon: Image,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    description: '根据文字描述生成图像',
  },
  {
    title: '图生图',
    href: '/create/image-to-image',
    icon: Sparkles,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    description: '基于参考图片生成新图像',
  },
  {
    title: '文生视频',
    href: '/create/text-to-video',
    icon: Video,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    description: '根据文字描述生成视频',
  },
  {
    title: '图生视频',
    href: '/create/image-to-video',
    icon: Video,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    description: '基于图片生成动态视频',
  },
]

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // 检查是否是具体页面（非首页）
  const isSpecificPage = navItems.some((item) => pathname === item.href)

  // 如果是具体页面，直接渲染内容
  if (isSpecificPage) {
    return <>{children}</>
  }

  // 否则显示 AI 生成模块首页
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">AI 生成</h1>
              <p className="text-xs text-muted-foreground">专业级 AI 创作工作流</p>
            </div>
          </div>
        </div>
      </header>

      {/* 内容 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group"
              >
                <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110',
                          item.bgColor
                        )}
                      >
                        <Icon className={cn('w-6 h-6', item.color)} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* 额外内容 */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">使用说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary mb-2">1</div>
                <h3 className="font-medium">输入内容</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  输入文字描述或上传参考图片
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary mb-2">2</div>
                <h3 className="font-medium">选择参数</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  选择风格、尺寸等生成参数
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary mb-2">3</div>
                <h3 className="font-medium">下载使用</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  生成完成后可直接下载
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
