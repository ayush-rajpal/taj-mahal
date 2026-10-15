import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // relative paths so it works on GitHub Pages and locally
  plugins: [react()],
  // 5173 Yale, 5174 Darul Kebab, 5175 the Metaverse Browser. Pick a free port for your world.
  server: { port: 5176, strictPort: true },
})
