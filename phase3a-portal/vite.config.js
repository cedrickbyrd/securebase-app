import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const timestamp = Date.now();

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  publicDir: 'public',
  base: '/',
  server: {
    port: 3000,
    open: true,
  },
  // Removed css.postcss section - now uses postcss.config.cjs
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    sourcemap: true,
    target: 'es2015',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].${timestamp}.js`,
        chunkFileNames: `assets/[name].${timestamp}.js`,
        assetFileNames: `assets/[name].${timestamp}.[ext]`,
      },
    },
  },
}));
