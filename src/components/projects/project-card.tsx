/**
 * 项目卡片组件
 * 现代化深色主题设计
 */

'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  MoreVertical, 
  Play, 
  Trash2, 
  Clock,
  FileText
} from 'lucide-react'
import type { Project } from '@/lib/types'

interface ProjectCardProps {
  project: Project
  onDelete?: (id: string) => void
  className?: string
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  analyzing: 'bg-blue-500/20 text-blue-400',
  generating: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-green-500/20 text-green-400',
  error: 'bg-red-500/20 text-red-400',
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  analyzing: '分析中',
  generating: '生成中',
  completed: '已完成',
  error: '失败',
}

export function ProjectCard({ project, onDelete, className }: ProjectCardProps) {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Card className={cn(
      'group relative overflow-hidden',
      'bg-card/50 hover:bg-card/80',
      'border-border hover:border-primary/50',
      'transition-all duration-300',
      className
    )}>
      {/* 装饰性渐变 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg truncate">
              <Link 
                href={`/projects/${project.id}`}
                className="hover:text-primary transition-colors"
              >
                {project.name}
              </Link>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3" />
              {formatDate(project.createdAt)}
            </CardDescription>
          </div>
          
          <Badge className={cn('shrink-0 ml-2', statusColors[project.status])}>
            {statusLabels[project.status] || project.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 描述 */}
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}

        {/* 统计 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {project.sourceContent?.length || 0} 字
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-2">
          <Link href={`/projects/${project.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              查看
            </Button>
          </Link>
          <Link href={`/projects/${project.id}/workflow`} className="flex-1">
            <Button size="sm" className="w-full">
              <Play className="h-3 w-3 mr-1" />
              工作流
            </Button>
          </Link>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(project.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
