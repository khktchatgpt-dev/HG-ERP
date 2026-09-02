import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // eslint-rules: luật lint tự viết cũng phải có test — nó hỏng im lặng.
    include: ['src/**/*.test.ts', 'eslint-rules/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/lib/database.types.ts', 'src/app/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
