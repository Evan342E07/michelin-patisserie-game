import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // 将 React、Three.js 核心与 R3F 生态拆分为可并行加载、长效缓存的独立模块
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/') || id.includes('/zustand/')) {
              return 'vendor-react';
            }
            if (id.includes('/three/examples/jsm/postprocessing/')) {
              return 'vendor-post';
            }
            if (id.includes('/three/')) {
              return 'vendor-three';
            }
            if (id.includes('@react-three') || id.includes('three-stdlib') || id.includes('maath') || id.includes('camera-controls')) {
              return 'vendor-r3f';
            }
            return 'vendor-misc';
          }
        },
      },
    },
  },
});
