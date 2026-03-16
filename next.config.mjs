import path from 'path';

const nextConfig = {
  output: 'standalone',
  
  // 确保这些包不被外部化
  serverExternalPackages: [],
  
  // 包含必要的依赖
  experimental: {
    // 确保所有依赖都被打包
    outputFileTracingIncludes: {
      '/*': [
        './node_modules/styled-jsx/**/*',
      ],
    },
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
