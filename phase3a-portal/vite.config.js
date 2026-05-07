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
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].${timestamp}.js`,
        chunkFileNames: `assets/[name].${timestamp}.js`,
        assetFileNames: `assets/[name].${timestamp}.[ext]`,
        manualChunks: {
          // Charting stack
          'vendor-charts': ['chart.js', 'react-chartjs-2', 'recharts'],
          // Stripe browser SDK
          'vendor-stripe': ['@stripe/stripe-js'],
          // Animation library
          'vendor-motion': ['framer-motion'],
          // React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
}));
