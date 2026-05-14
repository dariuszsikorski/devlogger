// @purpose Build config - emits ESM (.mjs), CJS (.cjs), browser IIFE (.global.js), and .d.ts from a single TypeScript source.
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    target: 'es2020',
  },
  {
    entry: { 'index.global': 'src/index.ts' },
    format: ['iife'],
    globalName: 'DevLogger',
    outExtension: () => ({ js: '.js' }),
    sourcemap: true,
    splitting: false,
    target: 'es2020',
    minify: false,
  },
])
