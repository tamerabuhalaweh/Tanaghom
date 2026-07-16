import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const developmentProxy: Record<string, string | ProxyOptions> = {
  '/auth': 'http://localhost:4000',
  '/campaigns': 'http://localhost:4000',
  '/ai-generation': 'http://localhost:4000',
  '/algo': 'http://localhost:4000',
  '/approvals': 'http://localhost:4000',
  '/publishing-prep': 'http://localhost:4000',
  '/analytics': 'http://localhost:4000',
  '/spine': 'http://localhost:4000',
  '/observability': 'http://localhost:4000',
  '/ai-provider': 'http://localhost:4000',
  '/demo': 'http://localhost:4000',
  '/publishing-package': 'http://localhost:4000',
  '^/admin(/|$)': 'http://localhost:4000',
  '/integrations': 'http://localhost:4000',
  '/leads': 'http://localhost:4000',
  '/ghl': 'http://localhost:4000',
  '/users': 'http://localhost:4000',
  '/departments': 'http://localhost:4000',
  '/health': 'http://localhost:4000',
  '^/ideas/(generate|workflows|convert-to-campaign)': 'http://localhost:4000',
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useDevelopmentProxy = !env.VITE_API_BASE_URL

  return {
    plugins: [react(), tailwindcss()],
    build: {
      manifest: true,
    },
    server: {
      port: 3000,
      ...(useDevelopmentProxy ? { proxy: developmentProxy } : {}),
    },
  }
})
