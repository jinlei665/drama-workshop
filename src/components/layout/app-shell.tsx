/**
 * 应用外壳组件
 * 包含导航栏、侧边栏等全局元素
 */

'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ModelConfigProvider } from '@/lib/model-config'
import { 
  Home, 
  FolderOpen, 
  Users, 
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Workflow
} from 'lucide-react'

interface AppShellProps {
  children: ReactNode
}

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/projects', label: '项目', icon: FolderOpen },
  { href: '/characters', label: '人物库', icon: Users },
  { href: '/workflow', label: '工作流（测试版）', icon: Workflow },
]

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <ModelConfigProvider>
      <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <aside className={cn(
        'flex flex-col border-r border-border',
        'bg-card/30 backdrop-blur-sm',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">漫剧工坊</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 导航 */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg',
                    'transition-colors duration-200',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* 底部状态 */}
        {!collapsed && (
          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              <p>v2.0.0-beta</p>
              <p className="mt-1">节点式工作流重构版</p>
            </div>
          </div>
        )}
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      </div>
    </ModelConfigProvider>
  )
}
