import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // relative paths so it works on GitHub Pages and locally
  plugins: [react()],
  // 5173 Yale, 5174 Darul Kebab, 5175 the Metaverse Browser, 5176 World Starter, 5178 Metaverse Square
  server: { port: 5179, strictPort: true },
})
