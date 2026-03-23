import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

// 开发环境允许的来源列表
// Next.js 不支持通配符，需要列出具体的 IP 或域名
const devOrigins = [
  'localhost',
  '127.0.0.1',
  // 常见的局域网 IP 段
  ...Array.from({ length: 256 }, (_, i) => `192.168.${i}`),
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}`),
  ...Array.from({ length: 256 }, (_, i) => `10.0.${i}`),
  ...Array.from({ length: 256 }, (_, i) => `10.1.${i}`),
  ...Array.from({ length: 256 }, (_, i) => `10.2.${i}`),
  ...Array.from({ length: 256 }, (_, i) => `10.3.${i}`),
  ...Array.from({ length: 256 }, (_, i) => `10.4.${i}`),
];

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
  
  // 允许的开发源
  allowedDevOrigins: devOrigins,
  
  // 生产环境或禁用 HMR 时的配置
  ...(isProd || process.env.DISABLE_HMR === 'true' ? {
    // 生产模式或禁用 HMR 时不做特殊配置
  } : {
    // 开发环境配置
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
