import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  publicDir: 'public',
  base: '/',  // Changed to root for Netlify deployment
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    sourcemap: true,
    target: 'es2015',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts-legacy': ['chart.js', 'react-chartjs-2'],
          'charts-modern': ['recharts'],
          'ui-vendor': ['lucide-react', 'date-fns'],
          'network': ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'chart.js',
      'react-chartjs-2',
      'recharts',
    ],
  },
  define: {
    'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || 'https://api.securebase.com/v1'),
    'process.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL || 'wss://ws.securebase.com'),
    'process.env.VITE_ENV': JSON.stringify(process.env.VITE_ENV || 'development'),
  },
}));
