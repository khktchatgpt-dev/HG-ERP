// Xoá lệnh test giao diện LSX-TEST-UI (seed bởi dev-seed-lsx-test-ui.mjs).
// Chạy: node scripts/dev-cleanup-lsx-test-ui.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

const { data: orders } = await db
  .from('production_orders')
  .select('id, code')
  .eq('code', 'LSX-TEST-UI')
if (!orders?.length) {
  console.log('Không còn LSX-TEST-UI nào.')
  process.exit(0)
}
for (const o of orders) {
  for (const t of [
    'production_entries',
    'production_transfers',
    'production_jobs',
    'production_components',
    'production_order_boms',
    'production_order_lines',
    'production_order_groups',
  ]) {
    const { error } = await db.from(t).delete().eq('production_order_id', o.id)
    if (error) throw new Error(`${t}: ${error.message}`)
  }
  // Khoá sổ hôm seed gắn với tổ thật — chỉ xoá dòng do seed tạo trong NGÀY seed
  // thì không xác định được nữa; để nguyên (khoá sổ mềm, thống kê mở lại được).
  const { error } = await db.from('production_orders').delete().eq('id', o.id)
  if (error) throw new Error(`production_orders: ${error.message}`)
  console.log('Đã xoá', o.code, o.id)
}
