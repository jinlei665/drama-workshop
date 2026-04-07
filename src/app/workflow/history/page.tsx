'use client'

import React, { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  Copy,
  FileText,
  Calendar,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import ExecutionCompare from '@/components/workflow/execution-compare'
import ExecutionLogs from '@/components/workflow/execution-logs'

interface ExecutionHistory {
  id: string
  workflow_id: string
  project_id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  start_time: string
  end_time?: string
  results?: any[]
  error?: string
  created_at: string
}

export default function ExecutionHistoryPage() {
  const [executions, setExecutions] = useState<ExecutionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExecution, setSelectedExecution] = useState<ExecutionHistory | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareExecutions, setCompareExecutions] = useState<[ExecutionHistory | null, ExecutionHistory | null]>([null, null])
  const [showLogs, setShowLogs] = useState<string | null>(null)

  // 加载执行历史
  const loadExecutions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/workflow/history?limit=50')
      const data = await response.json()

      if (data.success) {
        setExecutions(data.data.executions)
      } else {
        toast.error('加载执行历史失败', { description: data.error })
      }
    } catch (error) {
      console.error('加载执行历史失败:', error)
      toast.error('加载执行历史失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExecutions()
  }, [])

  // 重试执行
  const handleRetry = async (executionId: string) => {
    try {
      const response = await fetch(`/api/workflow/history/${executionId}/retry`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('重试执行成功', { description: `新的执行 ID: ${data.data.executionId}` })
        setTimeout(() => loadExecutions(), 1000)
      } else {
        toast.error('重试执行失败', { description: data.error })
      }
    } catch (error) {
      console.error('重试执行失败:', error)
      toast.error('重试执行失败')
    }
  }

  // 选择对比
  const handleSelectForCompare = (execution: ExecutionHistory, index: number) => {
    const newCompareExecutions = [...compareExecutions] as [ExecutionHistory | null, ExecutionHistory | null]
    newCompareExecutions[index] = execution
    setCompareExecutions(newCompareExecutions)

    if (newCompareExecutions[0] && newCompareExecutions[1]) {
      setCompareMode(true)
    }
  }

  // 从历史创建模板
  const handleCreateTemplate = async (executionId: string) => {
    const name = prompt('请输入模板名称')
    if (!name) return

    try {
      const response = await fetch('/api/workflow/templates/from-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          name,
          description: '从执行历史创建',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('模板创建成功', { description: `模板 ID: ${data.data.templateId}` })
      } else {
        toast.error('创建模板失败', { description: data.error })
      }
    } catch (error) {
      console.error('创建模板失败:', error)
      toast.error('创建模板失败')
    }
  }

  // 计算执行时长
  const getDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).getTime()
    const end = endTime ? new Date(endTime).getTime() : Date.now()
    const duration = Math.round((end - start) / 1000)
    return `${duration}秒`
  }

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">成功</Badge>
      case 'failed':
        return <Badge variant="destructive">失败</Badge>
      case 'running':
        return <Badge variant="default" className="bg-blue-500">运行中</Badge>
      case 'cancelled':
        return <Badge variant="secondary">已取消</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)] overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">执行历史</h1>
              <p className="text-muted-foreground mt-1">查看和管理工作流执行记录</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadExecutions}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
              {compareMode ? (
                <Button variant="outline" onClick={() => setCompareMode(false)}>
                  退出对比
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={!compareExecutions[0] || !compareExecutions[1]}
                  onClick={() => setCompareMode(true)}
                >
                  对比执行
                </Button>
              )}
            </div>
          </div>

          {/* 对比模式 */}
          {compareMode && compareExecutions[0] && compareExecutions[1] && (
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">执行对比</h2>
              <ExecutionCompare
                execution1={compareExecutions[0]}
                execution2={compareExecutions[1]}
              />
            </Card>
          )}

          {/* 执行列表 */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : executions.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">暂无执行历史</p>
                <p className="text-sm text-muted-foreground">
                  执行工作流后，历史记录将显示在这里
                </p>
              </Card>
            ) : (
              executions.map((execution) => (
                <Card key={execution.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{execution.workflow_id}</h3>
                        {getStatusBadge(execution.status)}
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getDuration(execution.start_time, execution.end_time)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(execution.start_time).toLocaleString('zh-CN')}
                        </span>
                        <span>执行 ID: {execution.id}</span>
                        <span>项目 ID: {execution.project_id}</span>
                      </div>

                      {execution.error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
                          <p className="text-sm text-destructive">{execution.error}</p>
                        </div>
                      )}

                      {execution.results && execution.results.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          成功完成 {execution.results.length} 个节点
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(execution.id)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重试
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCreateTemplate(execution.id)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        创建模板
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLogs(execution.id)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        查看日志
                      </Button>
                      {!compareMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectForCompare(execution, 0)}
                        >
                          对比 A
                        </Button>
                      )}
                      {!compareMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectForCompare(execution, 1)}
                        >
                          对比 B
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 日志模态框 */}
      {showLogs && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-[800px] h-[600px] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">执行日志</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLogs(null)}
              >
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ExecutionLogs executionId={showLogs} />
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  )
}
