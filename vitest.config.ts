import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    // Mặc định vẫn là `node`: 2.700+ test logic thuần không cần DOM, và bật DOM
    // cho cả bộ là làm chậm tất cả. Test GIAO DIỆN (`*.test.tsx`) tự khai môi
    // trường ở dòng đầu file: `// @vitest-environment happy-dom`.
    environment: 'node',
    // eslint-rules: luật lint tự viết cũng phải có test — nó hỏng im lặng.
    // `.tsx`: test dựng thành phần + kiểm truy cập (B0 kế hoạch hệ thiết kế,
    // docs/he-thiet-ke-erp-ke-hoach.md §7).
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'eslint-rules/**/*.test.ts'],
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
