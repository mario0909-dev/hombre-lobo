import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

/**
 * Genera `sw.js` en el build con la lista de todos los archivos de la app, para que
 * funcione sin conexión desde la primera visita. La versión cambia si cambia cualquier archivo.
 */
function serviceWorker(): Plugin {
  return {
    name: 'castronegro-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const publicFiles = listFiles('public').map((f) => relative('public', f).replaceAll('\\', '/'))
      const files = ['./', ...new Set([...Object.keys(bundle), 'index.html', ...publicFiles])].sort()
      const hash = createHash('sha256')
      for (const name of Object.keys(bundle).sort()) hash.update(name)
      for (const f of publicFiles) hash.update(readFileSync(join('public', f)))
      const source = readFileSync('pwa/sw.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(files))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona igual en la raíz de un dominio o en una subcarpeta.
  base: './',
  plugins: [react(), serviceWorker()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
