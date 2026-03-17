/**
 * 主布局组件
 * 深色主题，现代化设计
 */

'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: ReactNode
  className?: string
}

export function MainLayout({ children, className }: MainLayoutProps) {
  return (
    <div className={cn(
      'min-h-screen bg-background',
      'text-foreground',
      className
    )}>
      {children}
    </div>
  )
}

interface SidebarProps {
  children: ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps) {
  return (
    <aside className={cn(
      'w-64 border-r border-border',
      'bg-card/50 backdrop-blur-sm',
      'flex flex-col',
      className
    )}>
      {children}
    </aside>
  )
}

interface MainContentProps {
  children: ReactNode
  className?: string
}

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main className={cn(
      'flex-1 overflow-auto',
      className
    )}>
      {children}
    </main>
  )
}

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function Header({ title, subtitle, actions, className }: HeaderProps) {
  return (
    <header className={cn(
      'sticky top-0 z-10',
      'border-b border-border',
      'bg-background/80 backdrop-blur-sm',
      'px-6 py-4',
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

interface PageProps {
  children: ReactNode
  className?: string
}

export function Page({ children, className }: PageProps) {
  return (
    <div className={cn(
      'p-6 space-y-6',
      className
    )}>
      {children}
    </div>
  )
}
