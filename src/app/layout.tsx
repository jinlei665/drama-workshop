import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '短剧漫剧创作工坊',
    template: '%s | 短剧漫剧创作工坊',
  },
  description:
    '将文字故事转化为精美短剧视频，AI驱动的角色造型设计与视频分镜生成工具',
  keywords: [
    '短剧',
    '漫剧',
    '视频分镜',
    'AI创作',
    '角色设计',
    '故事可视化',
    '影视制作',
  ],
  authors: [{ name: '短剧漫剧创作工坊' }],
  generator: 'Coze Code',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN">
      <body className={`antialiased paper-texture`}>
        {isDev && <Inspector />}
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
