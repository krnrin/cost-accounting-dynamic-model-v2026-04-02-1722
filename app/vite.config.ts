import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  root: __dirname,
  envPrefix: 'VITE_',
  define: {
    'process.env.VITE_FEISHU_APP_ID': JSON.stringify(process.env.VITE_FEISHU_APP_ID),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: '高压线束成本核算工作台',
        short_name: '成本工作台',
        description: '汽车高压线束成本核算动态模型 — 离线优先',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        display_override: ['window-controls-overlay'],
        icons: [
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12 MiB (Univer spreadsheet engine ~10MB)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/feishu-api': {
        target: 'https://open.feishu.cn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/feishu-api/, '/open-apis'),
        secure: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('react-router-dom')) return 'vendor-react';
          if (id.includes('@douyinfe/semi-ui') || id.includes('@douyinfe/semi-icons')) return 'vendor-semi';
          if (id.includes('echarts')) return 'vendor-echarts';
          if (id.includes('dexie')) return 'vendor-dexie';
          if (id.includes('@univerjs')) return 'vendor-univer';
        },
      },
    },
  },
});
