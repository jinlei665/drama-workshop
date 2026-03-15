"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  User, 
  Film, 
  Image, 
  Video, 
  Clock,
  TrendingUp
} from "lucide-react"

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stats?: {
    projectCount: number
    sceneCount: number
    videoCount: number
  }
}

export function ProfileDialog({ open, onOpenChange, stats }: ProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            个人中心
          </DialogTitle>
          <DialogDescription>
            查看您的创作统计和账户信息
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* 用户信息卡片 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">创作者</h3>
                  <p className="text-sm text-muted-foreground">短剧制作达人</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 统计数据 */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <Film className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{stats?.projectCount || 0}</div>
                <div className="text-xs text-muted-foreground">项目数</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Image className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">{stats?.sceneCount || 0}</div>
                <div className="text-xs text-muted-foreground">分镜数</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Video className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">{stats?.videoCount || 0}</div>
                <div className="text-xs text-muted-foreground">视频数</div>
              </CardContent>
            </Card>
          </div>

          {/* 功能列表 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">功能特性</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">AI文本分析</span>
                <Badge variant="secondary">已启用</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">智能分镜生成</span>
                <Badge variant="secondary">已启用</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">角色一致性</span>
                <Badge variant="secondary">已启用</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">视频合成</span>
                <Badge variant="secondary">已启用</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
