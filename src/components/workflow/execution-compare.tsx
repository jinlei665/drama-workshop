'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, XCircle, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'

interface ExecutionCompareProps {
  execution1: any
  execution2: any
}

export default function ExecutionCompare({ execution1, execution2 }: ExecutionCompareProps) {
  // 计算执行时长
  const getDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).getTime()
    const end = endTime ? new Date(endTime).getTime() : Date.now()
    return Math.round((end - start) / 1000)
  }

  const duration1 = getDuration(execution1.start_time, execution1.end_time)
  const duration2 = getDuration(execution2.start_time, execution2.end_time)
  const durationDiff = duration2 - duration1

  // 计算成功节点数
  const successCount1 = execution1.results?.filter((r: any) => r.result.status === 'success').length || 0
  const successCount2 = execution2.results?.filter((r: any) => r.result.status === 'success').length || 0

  // 计算失败节点数
  const failedCount1 = execution1.results?.filter((r: any) => r.result.status === 'error').length || 0
  const failedCount2 = execution2.results?.filter((r: any) => r.result.status === 'error').length || 0

  return (
    <div className="space-y-6">
      {/* 基本信息对比 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-2">执行 A</div>
          <div className="font-semibold mb-2">{execution1.id}</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>状态:</span>
              <Badge
                variant={execution1.status === 'completed' ? 'default' : 'destructive'}
                className={execution1.status === 'completed' ? 'bg-green-500' : ''}
              >
                {execution1.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>时长:</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {duration1}秒
              </span>
            </div>
            <div className="flex justify-between">
              <span>成功节点:</span>
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                {successCount1}
              </span>
            </div>
            <div className="flex justify-between">
              <span>失败节点:</span>
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="w-3 h-3" />
                {failedCount1}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-2">执行 B</div>
          <div className="font-semibold mb-2">{execution2.id}</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>状态:</span>
              <Badge
                variant={execution2.status === 'completed' ? 'default' : 'destructive'}
                className={execution2.status === 'completed' ? 'bg-green-500' : ''}
              >
                {execution2.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>时长:</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {duration2}秒
              </span>
            </div>
            <div className="flex justify-between">
              <span>成功节点:</span>
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                {successCount2}
              </span>
            </div>
            <div className="flex justify-between">
              <span>失败节点:</span>
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="w-3 h-3" />
                {failedCount2}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 差异分析 */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">差异分析</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">执行时长差异:</span>
            <div className="flex items-center gap-2">
              <Badge variant={durationDiff > 0 ? 'destructive' : 'default'}>
                {durationDiff > 0 ? '+' : ''}{durationDiff}秒
              </Badge>
              {durationDiff > 0 ? (
                <TrendingUp className="w-4 h-4 text-red-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-500" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">成功节点差异:</span>
            <div className="flex items-center gap-2">
              <Badge variant={successCount2 >= successCount1 ? 'default' : 'destructive'}>
                {successCount2 - successCount1 > 0 ? '+' : ''}{successCount2 - successCount1}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">失败节点差异:</span>
            <div className="flex items-center gap-2">
              <Badge variant={failedCount2 <= failedCount1 ? 'default' : 'destructive'}>
                {failedCount2 - failedCount1 > 0 ? '+' : ''}{failedCount2 - failedCount1}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </Card>

      {/* 节点结果对比 */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">节点结果对比</h3>
        <div className="space-y-2">
          {execution1.results?.map((result1: any, index: number) => {
            const result2 = execution2.results?.[index]
            if (!result2) return null

            const node1Success = result1.result.status === 'success'
            const node2Success = result2.result.status === 'success'

            return (
              <div key={result1.nodeId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">{result1.nodeId}</div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={node1Success ? 'default' : 'destructive'}>
                      A: {node1Success ? '成功' : '失败'}
                    </Badge>
                    {!node1Success && result1.result.error && (
                      <span className="text-xs text-red-500 max-w-[200px] truncate">
                        {result1.result.error}
                      </span>
                    )}
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground" />

                  <div className="flex items-center gap-2">
                    <Badge variant={node2Success ? 'default' : 'destructive'}>
                      B: {node2Success ? '成功' : '失败'}
                    </Badge>
                    {!node2Success && result2.result.error && (
                      <span className="text-xs text-red-500 max-w-[200px] truncate">
                        {result2.result.error}
                      </span>
                    )}
                  </div>

                  {node1Success !== node2Success && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                      变化
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
