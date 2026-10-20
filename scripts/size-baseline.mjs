#!/usr/bin/env node
/*
 * Sinh lại `size-baseline.json` — TRẦN số dòng của các file .tsx CŨ đang dài quá
 * 800 dòng (quy định cấu trúc code React, 28/09/2026).
 *
 * Chạy: npm run size:baseline
 *
 * Cách hoạt động (cùng tinh thần `ui-baseline`):
 *   · file .tsx MỚI: tối đa 800 dòng — luật `max-lines` mức error;
 *   · file CŨ đã dài hơn: trần = số dòng HIỆN TẠI của nó. Không được dài thêm;
 *     ngắn đi thì chạy lại script này để hạ trần. Xuống dưới 800 là rớt khỏi
 *     danh sách và từ đó theo trần chung.
 *   · trần chỉ được HẠ: script không bao giờ nâng trần, và THOÁT MÃ 1 nếu có file
 *     mới vượt 800 mà chưa nằm trong danh sách — "sửa" lint bằng cách nhét file
 *     vào đây là không được.
 *
 * Đếm bằng chính luật `max-lines` của ESLint (không tự đếm) để script và lint
 * không bao giờ lệch nhau một dòng.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { ESLint } from 'eslint'

export const MAX = 800
const OUT = new URL('../size-baseline.json', import.meta.url)
const prev = JSON.parse(readFileSync(OUT, 'utf8')).files ?? {}

const tsParser = await import('@typescript-eslint/parser').then((m) => m.default ?? m)
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.tsx'],
      languageOptions: {
        parser: tsParser,
        parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
      },
      // max: 0 → mọi file đều báo, kèm số dòng thật trong thông điệp.
      rules: { 'max-lines': ['error', { max: 0 }] },
    },
  ],
})
const results = await eslint.lintFiles(['src/**/*.tsx'])
const toPosix = (abs) => relative(process.cwd(), abs).split(sep).join('/')

const lines = {}
for (const r of results) {
  const m = r.messages.find((x) => x.ruleId === 'max-lines')
  const n = m && /\((\d+)\)/.exec(m.message)
  if (n) lines[toPosix(r.filePath)] = Number(n[1])
}

const files = {}
const added = []
for (const [f, n] of Object.entries(lines)) {
  if (n <= MAX) continue
  if (f in prev) files[f] = Math.min(prev[f], n)
  else added.push(`${f} (${n})`)
}
const sorted = Object.fromEntries(
  Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
)
const cleaned = Object.keys(prev).filter((f) => !(f in files))
const lowered = Object.keys(files).filter((f) => files[f] < prev[f])

// Lần chạy ĐẦU (baseline rỗng) thì nhận hết nợ hiện có — chỉ lần đó.
const first = Object.keys(prev).length === 0
if (first)
  for (const a of added.splice(0)) {
    const f = a.replace(/ \(\d+\)$/, '')
    sorted[f] = lines[f]
  }

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      _: 'SINH TỰ ĐỘNG bởi scripts/size-baseline.mjs — đừng sửa tay. Trần chỉ được HẠ.',
      max: MAX,
      files: first
        ? Object.fromEntries(
            Object.entries(sorted).sort(([a], [b]) => a.localeCompare(b)),
          )
        : sorted,
    },
    null,
    2,
  )}\n`,
)

const list = first ? sorted : files
console.log(
  `Trần chung ${MAX} dòng · ${Object.keys(list).length} file cũ giữ trần riêng.`,
)
if (cleaned.length)
  console.log(`  ĐÃ XUỐNG DƯỚI ${MAX} (${cleaned.length}): ${cleaned.join(', ')}`)
if (lowered.length)
  console.log(
    `  HẠ TRẦN (${lowered.length}): ${lowered.map((f) => `${f} ${prev[f]}→${files[f]}`).join(', ')}`,
  )
if (added.length) {
  console.error(`  ⚠ FILE MỚI VƯỢT ${MAX} DÒNG (${added.length}):`)
  for (const a of added) console.error(`    ${a}`)
  console.error(
    '  Danh sách chỉ dành cho nợ CŨ. Tách file (page → Screen → useXxx → khối) thay vì thêm vào đây.',
  )
  process.exit(1)
}
