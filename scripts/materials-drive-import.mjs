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
import { sureKey, softKey, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const APPLY = process.argv.includes('--apply')
/**
 * `--clean-only`: CHỈ nhập những NHÓM PHỤ không đụng danh mục app dòng nào.
 *
 * Dành cho 9 nhóm mà app đã có một phần. Hai danh mục đặt tên theo hai hệ khác
 * nhau — app gọi theo tiết diện ("Hộp 25x50x1"), sổ gọi mô tả ("Thép hộp mạ kẽm
 * 25x50x1.0mm") — nên khớp tự động chỉ được 1,5%. Đổ cả vào là dựng danh mục
 * song song ở đúng nhóm đắt tiền nhất, người soạn đơn gõ "hộp 25x50" ra hai kết
 * quả không biết chọn cái nào.
 *
 * Nhóm phụ nào KHÔNG có lấy một dòng khớp (kể cả mức "nghi ngờ") thì đó là họ
 * hàng app chưa từng có — vòng bi, dung môi, ron gioăng… — nhập an toàn.
 */
const CLEAN_ONLY = process.argv.includes('--clean-only')
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
      .select('id, code, name, group_name, note')
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

/*
 * Lọc theo NHÓM PHỤ: nhóm nào có dù chỉ MỘT dòng chạm danh mục app (chắc chắn
 * hoặc nghi ngờ) thì để lại toàn bộ nhóm cho người rà. Nửa vời — nhập phần
 * không khớp, bỏ phần khớp — là tệ nhất: cùng một họ hàng nằm hai nơi.
 */
let src_rows = src.rows
if (CLEAN_ONLY) {
  /*
   * Chỉ so với danh mục GỐC của app, BỎ QUA những dòng chính script này đã nạp
   * từ sổ Drive (nhận ra qua `note`).
   *
   * Vấn đề cần cách ly là hai HỆ ĐẶT TÊN khác nhau — app gọi theo tiết diện, sổ
   * gọi mô tả. Trùng giữa hai nhóm phụ của CÙNG cuốn sổ thì không phải vấn đề
   * đó: cùng một cách gọi, và bộ lọc trùng theo từng dòng bên dưới xử lý đủ.
   * Không tách ra thì đợt nhập trước tự làm bẩn đợt sau — nguyên cả nhóm "Vòng
   * bi - bạc đạn" 152 mã bị loại chỉ vì vài mã đã vào theo nhóm Dụng cụ.
   */
  const goc = existing.filter(
    (m) => !/Nguồn: sổ vật tư Cung ứng \(Drive\)/.test(m.note ?? ''),
  )
  const appKey = new Set()
  const appSoft = new Set()
  for (const m of goc) {
    const k = sureKey(m.name)
    if (k.length >= MIN_KEY_LEN) appKey.add(k)
    const s = softKey(m.name)
    if (s) appSoft.add(s)
  }
  console.log(
    `  (so với ${goc.length} vật tư gốc của app, bỏ ${existing.length - goc.length} dòng đã nạp từ sổ)`,
  )
  const dirty = new Set()
  for (const r of src.rows) {
    const k = sureKey(r.name)
    const s = softKey(r.name)
    if ((k.length >= MIN_KEY_LEN && appKey.has(k)) || (s && appSoft.has(s)))
      dirty.add(`${r.group_name} › ${r.sub_group}`)
  }
  const before = src_rows.length
  src_rows = src.rows.filter((r) => !dirty.has(`${r.group_name} › ${r.sub_group}`))
  console.log(
    `\n--clean-only: bỏ ${dirty.size} nhóm phụ đụng danh mục app (${before - src_rows.length} mã)`,
  )
}

const insert = []
const dupCode = []
const dupName = []
const dupInBatch = []
const seenBatch = new Map()

for (const r of src_rows) {
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
    sub_group: r.sub_group ?? null,
    po_template: r.po_template,
    min_stock: 0,
    is_active: true,
    // Vẫn ghi nhóm phụ vào `note` nữa: đợt nạp 02/08 chạy trước migration 0111
    // nên dữ liệu cũ chỉ có trong note, giữ cùng dạng để đối chiếu hai đợt.
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
