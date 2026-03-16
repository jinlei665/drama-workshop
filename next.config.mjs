import path from 'path';

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
  
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
