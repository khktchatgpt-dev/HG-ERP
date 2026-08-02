// BÓC NHÓM PHỤ TỪ `note` SANG CỘT `sub_group` (migration 0111).
//
//   node scripts/materials-subgroup-backfill.mjs           # dry-run
//   node scripts/materials-subgroup-backfill.mjs --apply   # ghi
//
// Đợt nạp sổ Cung ứng 02/08 chưa có cột riêng nên nhét nhóm phụ vào `note`
// dạng `Nhóm phụ: Vòng bi - bạc đạn · ĐVT gốc: "ổ" · Nguồn: …`. Nạp thì được,
// LỌC thì không — 828 vật tư nhóm "Cơ khí - vòng bi - khuôn" mà không lọc nổi
// theo nhóm phụ thì người soạn đơn phải cuộn tay qua cả nghìn dòng.
//
// GIỮ NGUYÊN `note`: nó còn mang ĐVT gốc và nguồn nạp, là đường truy ngược duy
// nhất khi số liệu lệch. Chỉ COPY sang cột mới.

import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)

const rows = []
for (let from = 0; from < 40_000; from += 1000) {
  const { data, error } = await sb
    .from('warehouse_materials')
    .select('id, code, group_name, sub_group, note')
    .order('code')
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  rows.push(...(data ?? []))
  if ((data ?? []).length < 1000) break
}

const plan = []
for (const m of rows) {
  if (m.sub_group) continue
  const hit = /Nhóm phụ:\s*([^·]+?)\s*(?:·|$)/.exec(m.note ?? '')
  if (!hit) continue
  plan.push({ id: m.id, code: m.code, group_name: m.group_name, sub: hit[1].trim() })
}

const byGroup = {}
for (const p of plan) {
  const k = `${p.group_name} › ${p.sub}`
  byGroup[k] = (byGroup[k] ?? 0) + 1
}
const entries = Object.entries(byGroup).sort((a, b) => b[1] - a[1])

console.log(
  `danh mục: ${rows.length} · đã có sub_group: ${rows.filter((m) => m.sub_group).length}`,
)
console.log(`\n── SẼ ĐIỀN: ${plan.length} vật tư · ${entries.length} nhóm phụ ──`)
for (const [k, n] of entries.slice(0, 20)) console.log(`  ${String(n).padStart(5)}  ${k}`)
if (entries.length > 20) console.log(`  … còn ${entries.length - 20} nhóm phụ`)
console.log(
  `\nkhông có nhóm phụ trong note: ${rows.length - plan.length - rows.filter((m) => m.sub_group).length}`,
)

if (!APPLY) {
  console.log('\n(dry-run — thêm --apply để ghi)')
  process.exit(0)
}

// Gom theo GIÁ TRỊ nhóm phụ rồi update một lần cho cả cụm — 109 câu thay vì
// 11.744 lượt đi-về.
const byValue = new Map()
for (const p of plan) {
  const list = byValue.get(p.sub) ?? []
  list.push(p.id)
  byValue.set(p.sub, list)
}
let ok = 0
for (const [sub, ids] of byValue) {
  for (const part of chunk(ids, 300)) {
    const { error } = await sb
      .from('warehouse_materials')
      .update({ sub_group: sub })
      .in('id', part)
    if (error) {
      console.error(`✗ ${sub}: ${error.message}`)
      process.exit(1)
    }
    ok += part.length
  }
}
console.log(`\n✓ đã điền ${ok} vật tư · ${byValue.size} nhóm phụ`)
