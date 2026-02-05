import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Build configuration
  build: {
    outDir: 'dist',           // Output directory (matches netlify.toml)
    emptyOutDir: true,        // Clean dist before building
    sourcemap: true,          // Enable source maps for debugging
    
    // Performance optimizations
    target: 'es2015',
    minify: 'esbuild',        // Fast minification with esbuild
    
    rollupOptions: {
      output: {
        // Content-hashed filenames for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        
        // Code splitting for better performance
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'icons': ['lucide-react'],
        },
      },
    },
  },
  
  // Base path configuration
  base: '/',                  // Root path for deployment
  
  // Development server configuration
  server: {
    port: 3000,
    open: true,
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
  },
})
