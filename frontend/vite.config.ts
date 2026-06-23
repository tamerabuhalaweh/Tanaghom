import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/campaigns': 'http://localhost:4000',
      '/ai-generation': 'http://localhost:4000',
      '/algo': 'http://localhost:4000',
      '/approvals': 'http://localhost:4000',
      '/publishing-prep': 'http://localhost:4000',
      '/analytics': 'http://localhost:4000',
      '/spine': 'http://localhost:4000',
      '/observability': 'http://localhost:4000',
      '/users': 'http://localhost:4000',
      '/departments': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
})
