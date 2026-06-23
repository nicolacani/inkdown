import { defineConfig } from 'vite';

// Build the renderer into ../dist as a self-contained bundle loaded by Electron
// via file://. `base: './'` keeps asset paths relative so file:// loading works.
export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'chrome128',
    chunkSizeWarningLimit: 2000,
  },
});
