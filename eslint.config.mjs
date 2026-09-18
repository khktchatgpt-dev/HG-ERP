import { readFileSync } from 'node:fs'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import hgUi from './eslint-rules/hg-ui.mjs'

/*
 * BÁNH CÓC (ratchet) cho giao diện.
 *
 * `ui-baseline.json` liệt kê những file ĐANG bẩn tính đến lúc bật luật. Chúng
 * bị hạ xuống `warn` để `npm run check` không đỏ ngay ngày đầu; mọi file khác —
 * gồm TẤT CẢ file mới — là `error`, tức không lọt qua được.
 *
 * Dọn xong một file thì chạy `npm run ui:baseline` để nó rớt khỏi danh sách và
 * từ đó được canh ở mức `error` vĩnh viễn. Danh sách chỉ được phép NGẮN ĐI.
 */
const baseline = JSON.parse(
  readFileSync(new URL('./ui-baseline.json', import.meta.url), 'utf8'),
)

/* BẪY: route group của App Router có dấu ngoặc — `src/app/(workspace)/...`. Với
 * minimatch, `(` `)` là ký tự NHÓM, nên để nguyên thì baseline không khớp file
 * nào trong route group và ~200 lỗi cũ vẫn nổ. Phải escape trước khi đưa vào
 * `files`. Giữ danh sách trong JSON ở dạng thô cho người đọc/diff. */
const escapeGlob = (p) => p.replace(/[()[\]{}]/g, (ch) => `\\${ch}`)

/* Kit và trang mẫu ĐƯỢC PHÉP dùng thẻ thô + màu thật: chúng là nơi định nghĩa
 * ra chuẩn, không phải nơi tiêu thụ chuẩn.
 *
 * `src/app/print/**` miễn trừ vì lý do KHÁC (chốt 18/09/2026): nó không phải
 * giao diện, nó là GIẤY A4. Bảng của kit dựng cho màn hình — tiêu đề dính, tự
 * cuộn, vòng focus, chế độ tối — bốn thứ vô nghĩa hoặc có hại khi in. Phiếu in
 * cần đúng `<table>` viền đen của `PrintSheet`, và màu thì luôn là đen trên
 * trắng chứ không theo token. Bảy trang in cũ từng nằm trong danh sách nợ và
 * bị canh nhầm bằng thước của màn hình.
 *
 * DANH SÁCH NÀY PHẢI KHỚP `ignores` trong `scripts/ui-baseline.mjs` — hai bên
 * đã trôi khỏi nhau một lần và hậu quả là baseline tự dài ra.
 */
const KIT = [
  'src/components/erp/**',
  'src/components/shadcn/**',
  'src/components/ui/**',
  'src/components/kit/**',
  'src/app/design-lab/**',
  'src/app/print/**',
]

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
  {
    name: 'hg/ui-consistency',
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    ignores: KIT,
    plugins: { hg: hgUi },
    rules: {
      'hg/no-hardcoded-color': 'error',
      'hg/no-raw-control': 'error',
    },
  },
  {
    name: 'hg/ui-consistency-legacy',
    files: baseline.files.map(escapeGlob),
    rules: {
      'hg/no-hardcoded-color': 'warn',
      'hg/no-raw-control': 'warn',
    },
  },
])
