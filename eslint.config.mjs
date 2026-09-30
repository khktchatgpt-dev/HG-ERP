import { readFileSync } from 'node:fs'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import hg from './eslint-rules/hg-ui.mjs'

/*
 * 30/09/2026 — GỠ bộ luật canh GIAO DIỆN (no-hardcoded-color, no-raw-control,
 * no-arbitrary-size/space, kit-icon, no-dark-variant) cùng bánh cóc
 * `ui-baseline.json` và test `ui-ratchet`. Chủ dự án chốt: chúng làm việc thiết
 * kế và chỉnh sửa màn mới khó hơn cái lợi đồng bộ mang lại. Token và kit vẫn là
 * cách ƯU TIÊN, nhưng là lựa chọn, không phải hàng rào máy chặn.
 *
 * Còn lại hai luật thuộc KIẾN TRÚC MÃ, không phải thiết kế:
 *   · hg/client-server-boundary — file 'use client' không được kéo vùng chạy
 *     bằng khoá bí mật Supabase vào trình duyệt;
 *   · max-lines — trần 800 dòng cho .tsx, file cũ giữ trần riêng (size-baseline).
 */

/* BÁNH CÓC CỠ FILE (28/09/2026): .tsx tối đa `max` dòng; file CŨ đã dài hơn giữ
 * trần riêng = số dòng lúc chốt — không được dài thêm, ngắn đi thì
 * `npm run size:baseline` hạ trần. Xem scripts/size-baseline.mjs. */
const sizeBaseline = JSON.parse(
  readFileSync(new URL('./size-baseline.json', import.meta.url), 'utf8'),
)

/* BẪY: route group của App Router có dấu ngoặc — `src/app/(workspace)/...`. Với
 * minimatch, `(` `)` là ký tự NHÓM, nên để nguyên thì baseline không khớp file
 * nào trong route group. Phải escape trước khi đưa vào `files`. */
const escapeGlob = (p) => p.replace(/[()[\]{}]/g, (ch) => `\\${ch}`)

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Worktree phiên Claude (chứa .next/build artifact riêng) — không lint.
    '.claude/**',
  ]),
  /* Ranh giới client/server (28/09/2026): file 'use client' chỉ `import type` từ
   * @/modules, @/server. Hàng rào thứ hai: `import 'server-only'` ở server/db.ts. */
  {
    name: 'hg/client-server-boundary',
    files: ['src/**/*.tsx', 'src/**/*.ts'],
    plugins: { hg },
    rules: {
      'hg/client-server-boundary': 'error',
    },
  },
  {
    name: 'hg/file-size',
    files: ['src/**/*.tsx'],
    rules: { 'max-lines': ['error', { max: sizeBaseline.max }] },
  },
  // Trần riêng từng file nợ cũ — đặt SAU khối trên để đè `max`.
  ...Object.entries(sizeBaseline.files).map(([file, cap]) => ({
    name: `hg/file-size-legacy:${file}`,
    files: [escapeGlob(file)],
    rules: { 'max-lines': ['error', { max: cap }] },
  })),
])
