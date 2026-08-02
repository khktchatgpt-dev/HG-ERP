// NẠP 5 NHÓM VẬT TƯ TIÊU HAO từ bộ sổ gốc của phòng Cung ứng trên Drive.
//
//   node scripts/materials-drive-import.mjs           # dry-run, in bảng
//   node scripts/materials-drive-import.mjs --apply   # ghi vào warehouse_materials
//
// Vì sao cần: danh mục app mới có 1.320 vật tư, còn bộ sổ thật của phòng
// (`HOANGGIADATA/4 - BỘ PHẬN CUNG ỨNG/1 - Quản lí Vật Tư - Nhà Cung Cấp/
// 1. So vat tu (master)`) có ~12.200 mã chia 14 nhóm. NĂM nhóm dưới đây app
// KHÔNG có lấy một mã:
//
//   Dụng cụ - máy móc - mài · Điện - chiếu sáng - điều khiển
//   Ống - van - khí nén - thủy lực · Văn phòng - nội bộ - bảo hộ
//   Vật tư hàn - cắt
//
// Đây là vật tư TIÊU HAO (que hàn, đá mài, mũi khoan, bóng đèn, ống hơi, găng
// tay) — không nằm trong BOM sản phẩm nhưng xưởng mua liên tục, và hiện không
// đặt được một cái nào trên app.
//
// NGUỒN là file JSON đã bóc sẵn (`supabase/backups/2026-08-02_drive-so-vat-tu-5-nhom.json`),
// KHÔNG đọc thẳng Drive: script phải chạy lại được trên máy bất kỳ, và ảnh chụp
// nguồn giữ nguyên để sau còn đối chiếu "hồi đó sổ ghi gì".
//
// ĐÃ XỬ LÝ Ở BƯỚC BÓC (xem docs/dvt-chuan-hoa.md):
//   · ĐVT gom 131 cách viết → 40 nhãn chuẩn; `unit_raw` giữ nguyên văn để truy.
//   · 31 dòng DỊCH VỤ/PHÍ (cước vận chuyển, phí kiểm định, đại tu máy) bị LOẠI —
//     chúng không phải vật tư kho, nhập vào là sinh ra mặt hàng tồn kho mà Kho
//     không bao giờ nhập/xuất được.
//
// GIỮ NGUYÊN MÃ CỦA SỔ (`HAN0096`, `DCC0421`) chứ không cấp lại theo kiểu
// `XX-0000` của app: mã này in trên báo giá, đơn đặt và nằm trong trí nhớ nhân
// viên. Đổi số là cắt đứt liên kết với bộ sổ gốc. Hai kiểu mã sống chung được vì
// mã app luôn có dấu gạch, mã sổ thì không.
//
// Không import gì từ src/ trừ khoá so trùng — chỗ CHẶN lúc tạo trên app và chỗ
// DÒ ở đây phải hiểu "trùng" giống hệt nhau.

import { readFileSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'
import { sureKey, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const APPLY = process.argv.includes('--apply')
const SRC =
  process.argv.find((a) => a.endsWith('.json')) ??
  'supabase/backups/2026-08-02_drive-so-vat-tu-5-nhom.json'

const src = JSON.parse(readFileSync(SRC, 'utf8'))
const sb = await client(import.meta.url)

/** Đọc TOÀN BỘ danh mục — PostgREST chặn cứng 1000 dòng/request, `.limit()` lớn
 *  hơn vẫn chỉ trả 1000 và KHÔNG báo lỗi. */
async function readAll() {
  const PAGE = 1000
  const out = []
  for (let from = 0; from < 40_000; from += PAGE) {
    const { data, error } = await sb
      .from('warehouse_materials')
      .select('id, code, name, group_name')
      .order('code')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  return out
}

const existing = await readAll()
const byCode = new Set(existing.map((m) => m.code))
// So trùng TÊN trong cùng nhóm — bỏ nhóm ra khỏi khoá là gộp nhầm chéo vật liệu.
const byNameKey = new Map()
for (const m of existing) {
  const k = sureKey(m.name)
  if (k.length < MIN_KEY_LEN) continue
  byNameKey.set(`${(m.group_name ?? '').toLowerCase()}::${k}`, m)
}

const insert = []
const dupCode = []
const dupName = []
const dupInBatch = []
const seenBatch = new Map()

for (const r of src.rows) {
  if (byCode.has(r.code)) {
    dupCode.push(r)
    continue
  }
  const k = sureKey(r.name)
  const scoped = `${r.group_name.toLowerCase()}::${k}`
  if (k.length >= MIN_KEY_LEN) {
    const hit = byNameKey.get(scoped)
    if (hit) {
      dupName.push({ ...r, da_co: `${hit.code} — ${hit.name}` })
      continue
    }
    const prev = seenBatch.get(scoped)
    if (prev) {
      dupInBatch.push({ ...r, trung_voi: `${prev.code} — ${prev.name}` })
      continue
    }
    seenBatch.set(scoped, r)
  }
  insert.push({
    code: r.code,
    name: r.name,
    unit: r.unit,
    spec: r.spec,
    group_name: r.group_name,
    po_template: r.po_template,
    min_stock: 0,
    is_active: true,
    // Nhóm phụ (109 nhóm con của sổ) chưa có cột riêng — giữ trong note để
    // không mất tầng phân loại thứ hai, sau này cần thì bóc ra cột.
    note: [
      r.sub_group && `Nhóm phụ: ${r.sub_group}`,
      r.unit_raw !== r.unit && `ĐVT gốc: "${r.unit_raw}"`,
      'Nguồn: sổ vật tư Cung ứng (Drive) 02/08/2026',
    ]
      .filter(Boolean)
      .join(' · '),
  })
}

// ── in ───────────────────────────────────────────────────────────────────────
const byGroup = {}
for (const r of insert) byGroup[r.group_name] = (byGroup[r.group_name] ?? 0) + 1

console.log(`NGUỒN: ${SRC}`)
console.log(`  ${src.rows.length} dòng · bóc ngày ${src.ngay_boc}`)
console.log(`\nDANH MỤC HIỆN TẠI: ${existing.length} vật tư`)
console.log(`\n── SẼ THÊM: ${insert.length} ──`)
for (const [g, n] of Object.entries(byGroup).sort((a, b) => b[1] - a[1]))
  console.log(`  ${g.padEnd(34)} ${String(n).padStart(5)}`)
for (const r of insert.slice(0, 5))
  console.log(`     vd  ${r.code}  ${r.name.slice(0, 44).padEnd(46)} ${r.unit}`)

console.log(`\n── BỎ QUA ──`)
console.log(`  trùng MÃ đã có          ${dupCode.length}`)
console.log(`  trùng TÊN trong nhóm    ${dupName.length}`)
console.log(`  trùng TÊN ngay trong sổ ${dupInBatch.length}`)
for (const r of dupName.slice(0, 8))
  console.log(`     ${r.code} "${r.name.slice(0, 34)}" ≡ ${r.da_co.slice(0, 44)}`)
for (const r of dupInBatch.slice(0, 8))
  console.log(`     ${r.code} "${r.name.slice(0, 34)}" ≡ ${r.trung_voi.slice(0, 44)}`)

if (!APPLY) {
  console.log('\n(dry-run — thêm --apply để ghi)')
  process.exit(0)
}

let ok = 0
for (const part of chunk(insert, 500)) {
  const { error } = await sb.from('warehouse_materials').insert(part)
  if (error) {
    console.error(`✗ lô ${ok}: ${error.message}`)
    process.exit(1)
  }
  ok += part.length
  console.log(`  … ${ok}/${insert.length}`)
}
console.log(`\n✓ đã thêm ${ok} vật tư`)
