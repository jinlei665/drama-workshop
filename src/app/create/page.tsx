/**
 * AI 生成模块首页
 * 重定向到文生图页面
 */

import { redirect } from 'next/navigation'

export default function CreateIndexPage() {
  redirect('/create/text-to-image')
}
