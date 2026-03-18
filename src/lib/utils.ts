import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';

/**
 * 下载文件（禁用代理）
 * 用于下载 AI 生成的图片、视频等资源
 */
export async function downloadFile(url: string): Promise<Buffer> {
  // 清除代理环境变量，避免本地代理干扰
  const savedProxy = {
    http: process.env.HTTP_PROXY,
    https: process.env.HTTPS_PROXY,
  };
  
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  } finally {
    // 恢复代理设置
    if (savedProxy.http) process.env.HTTP_PROXY = savedProxy.http;
    if (savedProxy.https) process.env.HTTPS_PROXY = savedProxy.https;
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
