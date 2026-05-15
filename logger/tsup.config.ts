// @purpose Build config - emits ESM (.mjs), CJS (.cjs), browser IIFE (.global.js), and .d.ts from a single TypeScript source.
// Run from repository root with `pnpm build`; paths are relative to root.
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['logger/src/index.ts'],
    outDir: 'logger/dist',
    format: ['esm', 'cjs'],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    target: 'es2020',
  },
  {
    entry: { 'index.global': 'logger/src/index.ts' },
    outDir: 'logger/dist',
    format: ['iife'],
    globalName: 'DevLogger',
    outExtension: () => ({ js: '.js' }),
    sourcemap: true,
    splitting: false,
    target: 'es2020',
    minify: false,
  },
])
