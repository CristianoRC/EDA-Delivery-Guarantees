import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  // Relative base so the build works under any path the host serves it from
  // (custom domain root, /EDA-Delivery-Guarantees/, gh-pages subpath, etc.)
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
      styles: { configFile: 'src/styles/settings.scss' },
    }),
  ],
  build: {
    target: 'esnext',
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
})
