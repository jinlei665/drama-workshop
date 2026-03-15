import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '漫剧创作工坊',
    template: '%s | 漫剧创作工坊',
  },
  description:
    '将文字故事转化为精美漫剧，AI驱动的角色设计与分镜生成工具',
  keywords: [
    '漫剧',
    '漫画',
    'AI创作',
    '分镜生成',
    '角色设计',
    '故事可视化',
  ],
  authors: [{ name: '漫剧创作工坊' }],
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
      </body>
    </html>
  );
}
