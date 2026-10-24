import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the static build works from any sub-path (GitHub Pages) and from `vite preview`.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: false },
  build: { target: 'es2022', sourcemap: true },
})
