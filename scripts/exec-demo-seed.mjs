// Dữ liệu MẪU cho khu Ban Giám đốc (/exec — Hộp ký).
//
// Vì sao cần: hệ thống thật đang có 0 phiếu chờ duyệt, nên Hộp ký luôn rỗng và
// không xem được thẻ phiếu, nút Ký / Trả lại, chọn nhiều → ký hàng loạt, cờ
// "giá trị lớn". Script này dựng vài đơn mua GIẢ để xem đủ mọi trạng thái, rồi
// xoá sạch bằng một lệnh.
//
// Usage (chạy ở thư mục gốc dự án):
//   node scripts/exec-demo-seed.mjs --seed     # tạo dữ liệu mẫu
//   node scripts/exec-demo-seed.mjs --clean    # XOÁ sạch dữ liệu mẫu
//   node scripts/exec-demo-seed.mjs --status   # đếm xem còn sót gì không
//
// AN TOÀN:
//   · Mọi bản ghi đều mang mã bắt đầu bằng DEMO-GD- → --clean xoá đúng chúng,
//     không đụng tới bất kỳ đơn thật nào.
//   · Ghi thẳng vào DB, KHÔNG qua app ⇒ không bắn thông báo cho ai.
//   · --seed chạy lại nhiều lần vẫn ra đúng bấy nhiêu đơn (xoá cũ rồi tạo lại).
//
// CẢNH BÁO: đây là DB thật của công ty. Nhớ chạy --clean sau khi xem xong.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const PREFIX = 'DEMO-GD-'

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
}

loadEnvLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (.env.local)')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

/** Ngày ISO lùi n ngày — dùng để giả "đã chờ n ngày". */
function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}
function dateOnly(n) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

/**
 * 4 đơn cố ý phủ hết các nhánh hiển thị của Hộp ký:
 *   1. VND nhỏ, chờ 5 ngày   → thẻ vàng "chờ lâu", ký nhanh được (tích chọn)
 *   2. VND >50tr, chờ 2 ngày → cờ "Giá trị lớn", KHÔNG cho tích chọn
 *   3. USD, chờ 1 ngày       → cũng "Giá trị lớn" vì chưa đặt ngưỡng USD
 *   4. VND, hàng về quá hẹn, dòng không có giá → 2 dòng cảnh báo
 */
const DEMOS = [
  {
    code: `${PREFIX}01`,
    currency: 'VND',
    created_at: daysAgo(5),
    expected_at: dateOnly(10),
    note: 'Đơn mẫu — vật tư phụ, giá trị nhỏ',
    lines: [
      { name: 'Ốc vít inox M6', qty: 500, price: 2_500 },
      { name: 'Keo dán gỗ', qty: 20, price: 85_000 },
    ],
  },
  {
    code: `${PREFIX}02`,
    currency: 'VND',
    created_at: daysAgo(2),
    expected_at: dateOnly(20),
    note: 'Đơn mẫu — nhôm định hình, vượt ngưỡng 50 triệu',
    lines: [
      { name: 'Nhôm định hình 6063', qty: 1_200, price: 62_000 },
      { name: 'Sơn tĩnh điện', qty: 40, price: 210_000 },
    ],
  },
  {
    code: `${PREFIX}03`,
    currency: 'USD',
    created_at: daysAgo(1),
    expected_at: dateOnly(30),
    note: 'Đơn mẫu — hàng nhập, tiền USD chưa đặt ngưỡng',
    lines: [{ name: 'Vải Textilene nhập', qty: 300, price: 4.2 }],
  },
  {
    code: `${PREFIX}04`,
    currency: 'VND',
    created_at: daysAgo(9),
    expected_at: dateOnly(-4), // hàng về đã quá hẹn 4 ngày
    note: 'Đơn mẫu — quá hẹn giao VÀ dòng chưa có đơn giá',
    lines: [{ name: 'Gỗ keo xẻ sấy', qty: 15, price: null }],
  },
]

async function pickSupplier() {
  const { data } = await db.from('supply_suppliers').select('id, name').limit(1)
  if (!data?.length) throw new Error('Chưa có nhà cung cấp nào trong DB')
  return data[0]
}

async function pickCreator() {
  // Ưu tiên người phụ trách cung ứng thật để thẻ hiện "lập bởi …" cho giống đời.
  const { data } = await db
    .from('users')
    .select('id, name, email')
    .eq('email', 'kehoach@hoanggia.de')
    .maybeSingle()
  if (data) return data
  const { data: any1 } = await db.from('users').select('id, name').limit(1)
  return any1?.[0] ?? null
}

async function clean() {
  const { data: pos } = await db
    .from('supply_purchase_orders')
    .select('id, code')
    .like('code', `${PREFIX}%`)
  const ids = (pos ?? []).map((p) => p.id)
  if (!ids.length) {
    console.log('Không còn đơn mẫu nào.')
    return 0
  }
  // Dòng trước, đơn sau — phòng khi FK không đặt cascade.
  await db.from('supply_purchase_order_lines').delete().in('po_id', ids)
  const { error } = await db.from('supply_purchase_orders').delete().in('id', ids)
  if (error) throw new Error(error.message)
  console.log(`Đã xoá ${ids.length} đơn mẫu: ${pos.map((p) => p.code).join(', ')}`)
  return ids.length
}

async function seed() {
  await clean() // chạy lại không đẻ thêm bản trùng
  const supplier = await pickSupplier()
  const creator = await pickCreator()

  for (const d of DEMOS) {
    const { data: po, error } = await db
      .from('supply_purchase_orders')
      .insert({
        code: d.code,
        supplier_id: supplier.id,
        status: 'pending_approval',
        currency: d.currency,
        expected_at: d.expected_at,
        note: d.note,
        created_by: creator?.id ?? null,
        created_at: d.created_at,
      })
      .select('id')
      .single()
    if (error) throw new Error(`${d.code}: ${error.message}`)

    const lines = d.lines.map((l, i) => ({
      po_id: po.id,
      line_name: l.name,
      line_unit: 'cái',
      qty_ordered: l.qty,
      unit_price: l.price,
      sort_order: i,
    }))
    const { error: le } = await db.from('supply_purchase_order_lines').insert(lines)
    if (le) throw new Error(`${d.code} (dòng): ${le.message}`)
    console.log(`+ ${d.code} — ${d.currency}, ${lines.length} dòng`)
  }

  console.log(
    `\nXong. Mở /exec để xem Hộp ký.\nXoá sạch khi xem xong:\n  node scripts/exec-demo-seed.mjs --clean`,
  )
}

async function status() {
  const { data } = await db
    .from('supply_purchase_orders')
    .select('code, status, currency, created_at')
    .like('code', `${PREFIX}%`)
    .order('code')
  if (!data?.length) return console.log('Sạch — không còn đơn mẫu nào.')
  console.log(`Còn ${data.length} đơn mẫu:`)
  for (const p of data) console.log(`  ${p.code}  ${p.status}  ${p.currency}`)
}

const mode = process.argv[2]
try {
  if (mode === '--seed') await seed()
  else if (mode === '--clean') await clean()
  else if (mode === '--status') await status()
  else {
    console.log('Dùng: node scripts/exec-demo-seed.mjs --seed | --clean | --status')
    process.exit(1)
  }
} catch (e) {
  console.error('LỖI:', e.message)
  process.exit(1)
}
