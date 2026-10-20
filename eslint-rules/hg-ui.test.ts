/*
 * Test cho luật client-server-boundary.
 *
 * Vì sao luật lint cần test: nó hỏng IM LẶNG. Một regex viết sai thì lint vẫn
 * chạy, vẫn báo "0 lỗi", và cả hàng rào là đồ giả. Không có test thì không ai
 * phát hiện. Nên phần quan trọng nhất là các ca INVALID: chúng canh việc luật
 * vẫn BẮT được.
 *
 * (30/09/2026: các luật canh giao diện đã gỡ cùng test của chúng.)
 */
import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { describe, it } from 'vitest'
import hg from './hg-ui.mjs'

// RuleTester của ESLint 9 tự dò `describe`/`it` toàn cục; vitest chạy với
// `globals: false` nên phải đưa vào tay.
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
  },
})

const client = (body: string) => `'use client'\n${body}`

ruleTester.run('client-server-boundary', hg.rules['client-server-boundary'], {
  valid: [
    // Chỉ lấy KIỂU — bị xoá sạch lúc biên dịch.
    client(`import type { Po } from '@/modules/dept/supply/pos.repo'`),
    client(`import { type Po, type PoLine } from '@/modules/dept/supply/pos.repo'`),
    client(`export type { Po } from '@/modules/dept/supply/pos.repo'`),
    // Module thuần được phép: zod schema, danh mục quyền.
    client(`import { CERT_TYPES } from '@/modules/dept/supply/certs.schema'`),
    client(`import { ACTIONS } from '@/modules/core/rbac/actions'`),
    // Vùng client bình thường.
    client(`import { api } from '@/lib/api'`),
    client(`import { Btn } from '@/components/kit'`),
    // File SERVER (không có 'use client') thì lấy gì cũng được.
    `import { posService } from '@/modules/dept/supply/pos.service'`,
    `import { db } from '@/server/db'`,
    // Chuỗi 'use client' không đứng thành directive thì không tính.
    `const s = 'use client'\nimport { db } from '@/server/db'`,
  ],
  invalid: [
    {
      code: client(`import { posService } from '@/modules/dept/supply/pos.service'`),
      errors: [{ messageId: 'value' }],
    },
    {
      code: client(`import { db } from '@/server/db'`),
      errors: [{ messageId: 'value' }],
    },
    // Trộn: một specifier giá trị là đủ kéo cả module vào bundle.
    {
      code: client(`import { type Po, posRepo } from '@/modules/dept/supply/pos.repo'`),
      errors: [{ messageId: 'value' }],
    },
    // Import chỉ để chạy tác dụng phụ cũng kéo module vào.
    { code: client(`import '@/server/db'`), errors: [{ messageId: 'value' }] },
    // Re-export giá trị.
    {
      code: client(`export { posRepo } from '@/modules/dept/supply/pos.repo'`),
      errors: [{ messageId: 'value' }],
    },
    { code: client(`export * from '@/server/http'`), errors: [{ messageId: 'value' }] },
    // Directive "use client" bằng nháy kép.
    {
      code: `"use client"\nimport { handle } from '@/server/http'`,
      errors: [{ messageId: 'value' }],
    },
  ],
})
