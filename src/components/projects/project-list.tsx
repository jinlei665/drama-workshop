/**
 * 项目列表组件
 */

'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ProjectCard } from './project-card'
import { Plus, RefreshCw } from 'lucide-react'
import type { Project } from '@/lib/types'

interface ProjectListProps {
  className?: string
}

export function ProjectList({ className }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/projects')
      const result = await response.json()
      
      if (result.success) {
        setProjects(result.data.projects)
      } else {
        setError(result.error?.message || '加载失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此项目吗？此操作不可撤销。')) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setProjects(projects.filter(p => p.id !== id))
      }
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={fetchProjects}>
          重试
        </Button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-muted-foreground mb-4">还没有任何项目</p>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          创建第一个项目
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}
