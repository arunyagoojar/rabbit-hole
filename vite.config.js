import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const azureEndpoint = env.VITE_AZURE_OPENAI_ENDPOINT
  const azureFoundryBaseUrl = env.VITE_AZURE_FOUNDRY_BASE_URL || env.VITE_AZURE_OPENAI_BASE_URL || env.VITE_AZURE_FOUNDRY_PROJECT_ENDPOINT

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      proxy: {
        '/api/v1': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true
        },
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
          secure: true
        },
        '/api/pexels': {
          target: 'https://api.pexels.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/pexels/, ''),
          secure: true
        },
        ...(azureEndpoint ? {
          '/api/azure-openai': {
            target: azureEndpoint,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/azure-openai/, ''),
            secure: true
          }
        } : {}),
        ...(azureFoundryBaseUrl ? {
          '/api/azure-foundry': {
            target: azureFoundryBaseUrl,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/azure-foundry/, ''),
            secure: true
          }
        } : {})
      }
    }
  }
})
