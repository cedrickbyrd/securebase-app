import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  appType: 'spa',
  
  // Build configuration
  build: {
    outDir: 'dist',           // Output directory (matches netlify.toml)
    emptyOutDir: true,        // Clean dist before building
    sourcemap: true,          // Enable source maps for debugging
    
    // Performance optimizations
    target: 'esnext',
    minify: 'esbuild',        // Fast minification with esbuild

    rollupOptions: {
      output: {
        manualChunks: {
          // Ant Design — largest single library, split it out
          'vendor-antd': ['antd'],
          // AWS SDK clients
          'vendor-aws': [
            '@aws-sdk/client-dynamodb',
            '@aws-sdk/client-s3',
            '@aws-sdk/client-ses',
            '@aws-sdk/lib-dynamodb',
          ],
          // Charting stack
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          // Stripe browser SDK
          'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          // React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  
  // Base path configuration
  base: '/',                  // Root path for deployment
  
  // Development server configuration
  server: {
    port: 3000,strictPort: true,
    open: true,
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
  },
})
