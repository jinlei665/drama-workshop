import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'standalone',
  
  // 将 pg 包外部化，避免 Turbopack 打包问题
  serverExternalPackages: ['pg', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass', 'pg-connection-string'],
  
  // 包含必要的依赖 (Next.js 16 移到顶层)
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/styled-jsx/**/*',
      './node_modules/@swc/helpers/**/*',
      './node_modules/pg/**/*',
      './node_modules/pg-pool/**/*',
      './node_modules/pg-protocol/**/*',
      './node_modules/pg-types/**/*',
      './node_modules/pgpass/**/*',
      './node_modules/pg-connection-string/**/*',
      './node_modules/pg-int8/**/*',
      './node_modules/pg-cloudflare/**/*',
      './node_modules/buffer-from/**/*',
      './node_modules/dotenv/**/*',
      './node_modules/semver/**/*',
    ],
  },
  
  // 允许的开发源 - 包括局域网 IP
  allowedDevOrigins: [
    '*.dev.coze.site', 
    'localhost', 
    '*.local',
    // 允许所有 IP（用于本地部署）
    '*',
  ],
  
  // 开发环境 WebSocket 配置
  ...(isProd ? {} : {
    // 使用轮询方式检测文件变化，避免 WebSocket 问题
    experimental: {
      // 禁用 Turbopack 以获得更稳定的 HMR
    },
    // 配置 assetPrefix 为空，避免资源加载问题
    assetPrefix: '',
  }),
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.coze.cn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.volces.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.tos-cn-beijing.volces.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
