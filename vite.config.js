import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import beaconOffline from './scripts/beacon/offline-plugin.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), beaconOffline()],
})
