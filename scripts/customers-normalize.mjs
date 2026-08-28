// CHUẨN HOÁ NHÃN KHÁCH của thư viện sản phẩm (`technical_products.customer_name`).
//
//   node scripts/customers-normalize.mjs            # dò khô, in bảng đối chiếu
//   node scripts/customers-normalize.mjs --apply    # ghi (có sao lưu trước)
//
// VÌ SAO: nhãn khách cố ý gõ tự do (0091, không FK sang danh mục Kinh doanh),
// nên sau một năm nó trôi. Đo 21/08/2026 trên 765 SP active: 47 nhãn cho 557 SP,
// trong đó
//   · 5 cặp chỉ khác HOA/THƯỜNG — `LAURA` 93 SP nằm cạnh `Laura` 17 SP,
//     `CASUAL` 16 cạnh `Casual` 1 ⇒ người lọc theo khách bị chia đôi danh sách
//     mà không hề biết là mình đang xem thiếu;
//   · vài nhãn "con" mang thêm chi tiết của MỘT đơn hàng (`ROSCO - 138`,
//     `Bunning - hàng dự án`, `Westin Cocoa Beach`, `GIGA STEVE'S`);
//   · tên pháp nhân lẫn với mã ngắn (`MERXX HANDELS GMBH` vs `MERXX`).
//
// HAI TẦNG SỬA — script này chỉ là tầng dọn dẹp một lần:
//   1. Dữ liệu cũ: script này.
//   2. Không tái sinh: `normalizeCustomerLabel` gắn ở biên zod
//      (`technical.schema.ts`) nên mọi đường ghi đều viết hoa + gộp khoảng
//      trắng; `customerLabelFrom` khiến Kinh doanh tạo nhanh SP lấy MÃ khách
//      (MERXX) chứ không tên pháp nhân.
//
// Các cặp gộp bên dưới do user chốt 21/08/2026 (hỏi trực tiếp từng cặp).

import { mkdirSync, writeFileSync } from 'node:fs'
import { client } from './products-lib.mjs'

/** Bản sao của `src/lib/customer-label.ts` — script chạy `node` trần, không đọc TS. */
const normalize = (raw) => {
  if (raw == null) return null
  const t = raw
    .normalize('NFKC')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
  return t ? t.toLocaleUpperCase('vi') : null
}

/**
 * GỘP THEO QUYẾT ĐỊNH CỦA USER — khoá là nhãn ĐÃ viết hoa.
 *
 * Chỉ những cặp user đã duyệt mới nằm ở đây. Nhãn nào không có trong bảng này
 * thì script chỉ viết hoa, KHÔNG tự đoán "chắc là cùng một khách".
 */
const MERGE = {
  // Cùng một khách, thư viện SP gọi bằng mã ngắn.
  'MERXX HANDELS GMBH': 'MERXX',
  // Đuôi là số đơn / tính chất đơn / tên chi nhánh — không phải khách khác.
  'ROSCO - 138': 'ROSCO',
  'BUNNING - HÀNG DỰ ÁN': 'BUNNING',
  "GIGA STEVE'S": 'GIGA',
  'WESTIN COCOA BEACH': 'WESTIN',
  YOTRIO_WM: 'YOTRIO',
  // Hai nhãn cùng nghĩa "hàng làm cho dự án" (không phải tên khách).
  'DỰ ÁN': 'HÀNG DỰ ÁN',
}

const apply = process.argv.includes('--apply')
const db = await client(import.meta.url)

const { data, error } = await db
  .from('technical_products')
  .select('id, code, name, customer_name, is_active')
  .not('customer_name', 'is', null)
  .limit(5000)
if (error) throw new Error(error.message)

const rows = (data ?? []).filter((r) => (r.customer_name ?? '').trim() !== '')
const target = (v) => {
  const n = normalize(v)
  return n == null ? null : (MERGE[n] ?? n)
}

const changes = rows
  .map((r) => ({ ...r, to: target(r.customer_name) }))
  .filter((r) => r.to !== r.customer_name)

/* ── Báo cáo: gộp theo cặp cũ→mới để đọc được bằng mắt ─────────────────────── */
const pairs = new Map()
for (const r of changes) {
  const k = `${r.customer_name}\u0000${r.to}`
  pairs.set(k, (pairs.get(k) ?? 0) + 1)
}
const before = new Set(rows.map((r) => r.customer_name))
const after = new Set(rows.map((r) => target(r.customer_name)))

console.log(
  `${rows.length} SP có nhãn · ${before.size} nhãn hiện tại → ${after.size} nhãn sau chuẩn hoá`,
)
console.log(`${changes.length} SP phải sửa nhãn:\n`)
for (const [k, n] of [...pairs].sort((a, b) => b[1] - a[1])) {
  const [from, to] = k.split('\u0000')
  console.log(
    `  ${String(n).padStart(4)}  ${JSON.stringify(from)} → ${JSON.stringify(to)}`,
  )
}

const inactive = changes.filter((r) => !r.is_active).length
if (inactive)
  console.log(`\n(trong đó ${inactive} SP đã ngừng dùng — vẫn sửa cho nhất quán)`)

if (!apply) {
  console.log('\nDò khô. Thêm --apply để ghi.')
  process.exit(0)
}
if (changes.length === 0) {
  console.log('\nKhông có gì để sửa.')
  process.exit(0)
}

/* ── Sao lưu TRƯỚC khi ghi: đổi nhãn là đè mất bản gốc người ta đã gõ ──────── */
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
mkdirSync('supabase/backups', { recursive: true })
const backup = `supabase/backups/${stamp}_customer_name.json`
writeFileSync(
  backup,
  JSON.stringify(
    changes.map((r) => ({ id: r.id, code: r.code, from: r.customer_name, to: r.to })),
    null,
    2,
  ),
  'utf8',
)
console.log(`\nĐã lưu bản gốc: ${backup}`)

/* ── Ghi theo TỪNG NHÃN (không phải từng SP): 1 lệnh update cho cả trăm dòng ── */
const byTarget = new Map()
for (const r of changes) {
  const m = byTarget.get(r.customer_name) ?? { to: r.to, ids: [] }
  m.ids.push(r.id)
  byTarget.set(r.customer_name, m)
}
let done = 0
for (const [from, { to, ids }] of byTarget) {
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    const { error: e } = await db
      .from('technical_products')
      .update({ customer_name: to })
      .in('id', slice)
    if (e) throw new Error(`${from} → ${to}: ${e.message}`)
    done += slice.length
  }
  console.log(`  ✓ ${JSON.stringify(from)} → ${JSON.stringify(to)} (${ids.length} SP)`)
}
console.log(`\nXong: ${done} SP đã đổi nhãn.`)
