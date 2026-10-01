import {defineConfig} from 'vite';
import motionCanvas from '@motion-canvas/vite-plugin';
export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [motionCanvas()],
  build: {
    outDir: '../../assets/animations/ipsec-explainer',
    emptyOutDir: true,
    rollupOptions: {
      input: {project: './src/project.ts?project', player: './src/player.ts'},
      output: {entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js'},
    },
  },
});
