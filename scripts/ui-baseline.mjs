#!/usr/bin/env node
/*
 * Sinh lại `ui-baseline.json` — danh sách file ĐANG vi phạm luật giao diện
 * (hg/no-hardcoded-color, hg/no-raw-control).
 *
 * Chạy: npm run ui:baseline
 *
 * Danh sách này chỉ được phép NGẮN ĐI. Script in ra chênh lệch so với lần
 * trước và THOÁT MÃ 1 nếu có file mới lọt vào — để CI bắt được việc "sửa" lỗi
 * lint bằng cách nhét file vào baseline thay vì dọn nó.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { ESLint } from 'eslint'
import hgUi from '../eslint-rules/hg-ui.mjs'

const OUT = new URL('../ui-baseline.json', import.meta.url)
const prev = JSON.parse(readFileSync(OUT, 'utf8')).files ?? []

const tsParser = await import('@typescript-eslint/parser').then((m) => m.default ?? m)

// Cấu hình ĐỘC LẬP: chỉ chạy 2 luật của mình, không kéo theo next/typescript,
// để việc dò baseline nhanh và không lẫn với lỗi lint khác.
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.tsx'],
      ignores: [
        'src/components/erp/**',
        'src/components/shadcn/**',
        'src/components/ui/**',
        'src/app/design-lab/**',
      ],
      languageOptions: {
        parser: tsParser,
        parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
      },
      plugins: { hg: hgUi },
      rules: { 'hg/no-hardcoded-color': 'error', 'hg/no-raw-control': 'error' },
    },
  ],
})

const results = await eslint.lintFiles(['src/app/**/*.tsx', 'src/components/**/*.tsx'])

const toPosix = (abs) => relative(process.cwd(), abs).split(sep).join('/')

/*
 * Đếm theo ĐÚNG hai luật của mình, không dùng `errorCount`.
 * BẪY đã dính: cấu hình độc lập ở trên không nạp plugin `react-hooks`, nên mọi
 * dòng `// eslint-disable-next-line react-hooks/exhaustive-deps` có sẵn trong
 * code sinh ra lỗi "Definition for rule not found" và bị cộng vào `errorCount`.
 * Hậu quả: file đã dọn SẠCH vẫn kẹt trong baseline vĩnh viễn — tức bánh cóc
 * không bao giờ siết được, mà không có dấu hiệu gì báo ra.
 */
const dirty = results
  .map((r) => ({
    file: toPosix(r.filePath),
    count: r.messages.filter((m) => m.ruleId?.startsWith('hg/')).length,
  }))
  .filter((r) => r.count > 0)
  .sort((a, b) => b.count - a.count)

const files = dirty.map((d) => d.file).sort()
const added = files.filter((f) => !prev.includes(f))
const removed = prev.filter((f) => !files.includes(f))
const total = dirty.reduce((s, d) => s + d.count, 0)

const payload = {
  _: 'SINH TỰ ĐỘNG bởi scripts/ui-baseline.mjs — đừng sửa tay. Danh sách chỉ được ngắn đi.',
  generated_violations: total,
  files,
}
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)

console.log(`Baseline: ${files.length} file, ${total} vi phạm.`)
if (removed.length) {
  const head = removed.slice(0, 10).join(', ')
  console.log(`  ĐÃ DỌN (${removed.length}): ${head}${removed.length > 10 ? '…' : ''}`)
}
if (added.length) {
  console.error(`  ⚠ FILE MỚI LỌT VÀO BASELINE (${added.length}):`)
  for (const f of added) console.error(`    ${f}`)
  console.error('  Baseline chỉ dành cho nợ CŨ. Dọn file cho sạch thay vì thêm vào đây.')
  process.exit(1)
}
console.log('\nTop 10 nợ nặng nhất:')
for (const d of dirty.slice(0, 10))
  console.log(`  ${String(d.count).padStart(4)}  ${d.file}`)
