import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the static build works from any sub-path (GitHub Pages, itch.io, a folder) and from `vite preview`;
// routes live in the hash, so no server rewrites are needed. The build id names the deployed build in version
// errors: set BUILD_ID (for example `BUILD_ID=$(git rev-parse --short HEAD) npm run build`); GitHub Actions'
// GITHUB_SHA is used when present.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['BUILD_ID', 'GITHUB_SHA'])
  const build = env['BUILD_ID'] ?? env['GITHUB_SHA']?.slice(0, 7) ?? 'dev'
  return {
    plugins: [react()],
    base: './',
    define: { __BUILD_ID__: JSON.stringify(build) },
    // The 3D board and the networking library load lazily; pre-bundling them at start-up spares the dev server a
    // full page reload (and a lost sandbox game) the first time a board or an online game opens.
    optimizeDeps: {
      include: [
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        'three/examples/jsm/environments/RoomEnvironment.js',
        'three/examples/jsm/geometries/RoundedBoxGeometry.js',
        'trystero/nostr',
      ],
    },
    server: { port: 5173, strictPort: false },
    // The 3D board's chunk is mostly three.js (about 1.1 MB, 300 kB gzipped) and loads only when a board opens; the
    // main chunk (React, the engine, the screens) is about 620 kB. Both are expected, so the warning starts above them.
    build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1200 },
  }
})
