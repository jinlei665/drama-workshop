'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown, ChevronUp, Info, Bug, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ExecutionLogsProps {
  executionId: string
}

export default function ExecutionLogs({ executionId }: ExecutionLogsProps) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [filterLevel, setFilterLevel] = React.useState<'all' | 'INFO' | 'DEBUG' | 'ERROR'>('all')

  // 加载日志
  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/workflow/logs?executionId=${executionId}`)
        const data = await response.json()

        if (data.success) {
          setLogs(data.data.logs)
        } else {
          toast.error('加载日志失败', { description: data.error })
        }
      } catch (error) {
        console.error('加载日志失败:', error)
        toast.error('加载日志失败')
      } finally {
        setLoading(false)
      }
    }

    loadLogs()
  }, [executionId])

  const filteredLogs = filterLevel === 'all'
    ? logs
    : logs.filter((log: any) => log.level === filterLevel)

  const groupedLogs = filteredLogs.reduce((acc: any, log: any) => {
    if (!acc[log.node_id]) {
      acc[log.node_id] = []
    }
    acc[log.node_id].push(log)
    return acc
  }, {})

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'INFO':
        return <Info className="w-4 h-4 text-blue-500" />
      case 'DEBUG':
        return <Bug className="w-4 h-4 text-gray-500" />
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'border-blue-500'
      case 'DEBUG':
        return 'border-gray-500'
      case 'ERROR':
        return 'border-red-500'
      default:
        return 'border-gray-300'
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">执行日志</h3>
        <div className="flex gap-2">
          <Button
            variant={filterLevel === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterLevel('all')}
          >
            全部
          </Button>
          <Button
            variant={filterLevel === 'INFO' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterLevel('INFO')}
          >
            INFO
          </Button>
          <Button
            variant={filterLevel === 'DEBUG' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterLevel('DEBUG')}
          >
            DEBUG
          </Button>
          <Button
            variant={filterLevel === 'ERROR' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterLevel('ERROR')}
          >
            ERROR
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-2">
          {Object.entries(groupedLogs).map(([nodeId, nodeLogs]: [string, any]) => (
            <Card key={nodeId} className="overflow-hidden">
              <div
                className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleNode(nodeId)}
              >
                <div className="flex items-center gap-3">
                  {expandedNodes.has(nodeId) ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{nodeId}</span>
                  <Badge variant="outline">{nodeLogs.length} 条日志</Badge>
                </div>
              </div>

              {expandedNodes.has(nodeId) && (
                <div className="p-3 space-y-2">
                  {nodeLogs.map((log: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 bg-muted/30 rounded-lg border-l-4 ${getLevelColor(log.level)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getLevelIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {log.level}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm break-all">{log.message}</p>
                          {log.data && (
                            <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}
