import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/securebase-app/' : '/',  // GitHub Pages base path for production only, staging uses root
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Performance optimizations
    target: 'es2015',
    minify: 'esbuild',  // Use esbuild instead of terser (faster and built-in)
    rollupOptions: {
      output: {
        // Content-hashed filenames for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        // Aggressive code splitting for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts-legacy': ['chart.js', 'react-chartjs-2'],
          'charts-modern': ['recharts'],
          'ui-vendor': ['lucide-react', 'date-fns'],
          'network': ['axios'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting
    cssCodeSplit: true,
  },
  // Optimize dependencies
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
