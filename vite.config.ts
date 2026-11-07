import { defineConfig } from 'vite';

export default defineConfig({
  base: '/the-unraveled-spell/',
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
