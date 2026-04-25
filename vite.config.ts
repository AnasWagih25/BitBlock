import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    // Keep problematic deps out of optimizer, but allow normal discovery/prebundle
    // for everything else to avoid repeated ESM/CJS runtime import errors.
    exclude: ['@tensorflow-models/face-detection', '@mediapipe/face_detection'],
    include: ['set-cookie-parser'],
  },
})
