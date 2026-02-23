import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Replace 'edh-dashboard' with your actual GitHub repo name
  base: '/edh-dashboard/',
})
