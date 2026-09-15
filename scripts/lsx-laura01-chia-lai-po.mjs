// CHIA LẠI LSX 01/26-27 - LAURA THEO ĐÚNG 16 KHỐI PO CỦA FILE
//
//   node scripts/lsx-laura01-chia-lai-po.mjs           # DRY-RUN
//   node scripts/lsx-laura01-chia-lai-po.mjs --apply   # ghi thật
//
// VÌ SAO PHẢI DỰNG LẠI CẢ LỆNH, KHÔNG VÁ TỪNG Ô:
// File ghi ngày xuất MỘT LẦN ở dòng đầu mỗi khối PO (16/16 khối đều có ngày),
// nên mọi dòng đều suy được ngày — nhưng chỉ khi biết dòng thuộc khối nào.
// Lượt nạp trước gom 16 khối thành 3 nhóm theo họ SP và bỏ số PO, làm mất
// thông tin đó. Ghép ngược file ↔ DB theo (mã + số lượng) chỉ duy nhất được
// 41/87 dòng; 46 dòng còn lại có nhiều ứng viên và CẢ 46 ca các ứng viên mang
// NGÀY KHÁC NHAU — đoán là sai quá nửa. Dựng lại từ file là đường duy nhất lấy
// đúng ngày.
//
// AN TOÀN: đã kiểm trước, 87 dòng của lệnh này không có dòng chi tiết
// (`production_components`), không có việc SX (`production_jobs`), chưa ghi sổ
// sản lượng, chưa có ảnh chụp định mức. 4 đơn mua trỏ vào ĐẦU lệnh nên không
// đụng tới. Vẫn sao lưu toàn bộ nhóm + dòng ra JSON trước khi xoá.
//
// KHÔNG tạo đơn hàng: PO#31032193244 đã được LSX 02 dùng (file ghi rõ "PO này
// cập nhập số này - hủy số của PO này ở LSX 01") nên tạo đơn trùng mã là sai.
// Nhóm giữ `sales_order_id` trống như hiện nay.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { client } from './products-lib.mjs'

const XLSX = createRequire(import.meta.url)('xlsx')
const APPLY = process.argv.includes('--apply')
const FILE =
  'C:/Users/HGPC/Downloads/thanh phương/LAURA/LSX 01.26-27 HG-LAURA REVISED 12 AUG.xls'
const LSX_CODE = '01/26-27 - LAURA'
const BACKUP = 'backup-laura01-truoc-chia-po-20260915.json'

const n = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const nl = (s) =>
  String(s ?? '')
    .replace(/[ \t]+/g, ' ')
    .trim()
const low = (s) => n(s).toLowerCase()
const numv = (s) => {
  const t = n(s).replace(/,/g, '')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}
const keyOf = (s) => low(s).replace(/[^a-z0-9]/g, '')
const base = (s) => n(s).replace(/\.\d{2}$/, '')
const mdy = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(n(s))
  if (!m) return null
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
  return `${y}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`
}
/** LAURA đổi mã theo mùa — bảng này đã chốt từ lượt nạp trước, giữ nguyên. */
const ALIAS = {
  1708431: '1705703',
  1708432: '1700575.11',
  1708433: '1700574.11',
  1708422: '1708412',
}

// ── Đọc file thành 16 khối PO ───────────────────────────────────────────────
const rows = XLSX.utils.sheet_to_json(XLSX.readFile(FILE).Sheets['Sheet1'], {
  header: 1,
  raw: false,
  defval: '',
})
const hi = rows.findIndex((r) => low(r[0]) === 'stt')
const H = rows[hi].map(low)
const col = (...ks) => {
  for (const k of ks) {
    const i = H.findIndex((h) => h.includes(k))
    if (i >= 0) return i
  }
  return -1
}
const C = {
  code: col('mã sp'),
  fname: H.findIndex((h) => /tên tiếng (đức|anh)/.test(h)),
  vname: col('tên tiếng việt'),
  customs: col('tên khai hải quan'),
  unit: col('đvt'),
  qty: col('số lượng'),
  may: col('mây'),
  nem: col('nệm'),
  son: col('sơn'),
  kinh: col('kính'),
  go: col('gỗ'),
  pack: col('đóng gói'),
  ship: col('thời gian xuất'),
  note: col('note'),
  imp: col('lưu ý quan trọng'),
}
const blocks = []
let section = ''
let cur = null
for (let i = hi + 1; i < rows.length; i++) {
  const r = rows[i]
  if (/^(để đảm bảo|nơi nhận|giám đốc)/i.test(low(r[0]))) break
  const c1 = n(r[1])
  if (/^tổng/i.test(c1)) continue
  if (c1 && !n(r[C.code]) && !n(r[0])) {
    if (/^PO#/i.test(c1)) {
      const poNo = (/^PO#\s*([0-9A-Za-z._/-]+)/.exec(c1) ?? [null, null])[1]
      const extra = n(c1.replace(/^PO#\s*[0-9A-Za-z._/-]*/, '')).replace(
        /^[()\s-]+|[()\s]+$/g,
        '',
      )
      cur = { po: poNo, extra, section, date: null, lines: [] }
      blocks.push(cur)
    } else section = c1
    continue
  }
  const code = n(r[C.code])
  if (!code) continue
  const qty = numv(r[C.qty])
  if (qty == null) {
    if (cur?.lines.length) cur.lines[cur.lines.length - 1].altCodes.push(code)
    continue
  }
  const d = mdy(r[C.ship])
  if (d && !cur.date) cur.date = d // ngày ghi MỘT LẦN ở dòng đầu khối
  cur.lines.push({
    code,
    altCodes: [],
    name_foreign: nl(r[C.fname]) || null,
    name_vi: nl(r[C.vname]) || null,
    name_customs: C.customs >= 0 ? nl(r[C.customs]) || null : null,
    unit: n(r[C.unit]) || 'cái',
    qty,
    packing: nl(r[C.pack]) || null,
    note: C.note >= 0 ? nl(r[C.note]) || null : null,
    important: C.imp >= 0 ? nl(r[C.imp]) || null : null,
    specs: Object.fromEntries(
      Object.entries({
        may: nl(r[C.may]),
        nem: nl(r[C.nem]),
        son: nl(r[C.son]),
        kinh: nl(r[C.kinh]),
        go: nl(r[C.go]),
      }).filter(([, v]) => v),
    ),
  })
}
const fileLines = blocks.flatMap((b) => b.lines)
const fileQty = fileLines.reduce((a, b) => a + b.qty, 0)
const noDate = blocks.filter((b) => !b.date)
if (noDate.length) throw new Error(`${noDate.length} khối PO không có ngày — dừng`)

// ── DB ──────────────────────────────────────────────────────────────────────
const db = await client(import.meta.url)
const { data: lsx, error: e0 } = await db
  .from('production_orders')
  .select('*')
  .eq('code', LSX_CODE)
  .single()
if (e0) throw new Error(e0.message)
const { data: oldGroups } = await db
  .from('production_order_groups')
  .select('*')
  .eq('production_order_id', lsx.id)
  .order('sort_order')
const { data: oldLines } = await db
  .from('production_order_lines')
  .select('*')
  .eq('production_order_id', lsx.id)
  .order('sort_order')
const products = []
for (let f = 0; ; f += 1000) {
  const { data } = await db
    .from('technical_products')
    .select('id, code, customer_item_code, code_legacy, image_file_id')
    .range(f, f + 999)
  products.push(...data)
  if (data.length < 1000) break
}
const idx = new Map()
for (const p of products) {
  for (const k of [p.code, p.customer_item_code, p.code_legacy].filter(Boolean)) {
    if (!idx.has(keyOf(k))) idx.set(keyOf(k), p)
  }
}
const findProduct = (code) => {
  const b = base(code)
  const a = ALIAS[b]
  return (
    idx.get(keyOf(code)) ??
    (a ? (idx.get(keyOf(a)) ?? idx.get(keyOf(base(a)))) : null) ??
    idx.get(keyOf(b)) ??
    idx.get(keyOf(b + '.11')) ??
    null
  )
}

// ── Đối chiếu trước khi đụng ────────────────────────────────────────────────
const dbQty = oldLines.reduce((a, b) => a + Number(b.qty), 0)
console.log(`\n${APPLY ? '⚙ GHI THẬT' : '🔍 DRY-RUN (chưa ghi gì)'} — ${LSX_CODE}\n`)
console.log(`  hiện có : ${oldGroups.length} nhóm, ${oldLines.length} dòng, ${dbQty} sp`)
console.log(`  sẽ thành: ${blocks.length} nhóm, ${fileLines.length} dòng, ${fileQty} sp`)
if (dbQty !== fileQty || oldLines.length !== fileLines.length) {
  throw new Error('Số dòng / số lượng không khớp file — DỪNG, không dựng lại')
}
const missing = [...new Set(fileLines.map((l) => l.code))].filter((c) => !findProduct(c))
if (missing.length) throw new Error(`Chưa có hồ sơ SP: ${missing.join(', ')}`)

// Có ô nào trên DB mà file KHÔNG có (tức người dùng gõ tay) sẽ mất khi dựng lại?
const fileByKey = new Map()
for (const b of blocks) {
  for (const l of b.lines) {
    const k = keyOf(base(l.code)) + '|' + l.qty
    fileByKey.set(k, [...(fileByKey.get(k) ?? []), l])
  }
}
const risky = []
for (const l of oldLines) {
  const k = keyOf(base(l.customer_item_code || l.product_code)) + '|' + Number(l.qty)
  const cands = fileByKey.get(k) ?? []
  const has = (f, v) => cands.some((c) => n(c[f]) === n(v))
  if (n(l.note) && !has('note', l.note))
    risky.push(`${l.product_code}: note "${n(l.note).slice(0, 40)}"`)
  if (n(l.important_note) && !has('important', l.important_note))
    risky.push(`${l.product_code}: lưu ý "${n(l.important_note).slice(0, 40)}"`)
  if (l.checks && Object.keys(l.checks).length)
    risky.push(`${l.product_code}: đã tick kiểm`)
  if (l.extras && Object.keys(l.extras).length)
    risky.push(`${l.product_code}: extras ${JSON.stringify(l.extras).slice(0, 40)}`)
}
console.log(
  `  ô gõ tay trên DB mà file không có: ${risky.length ? risky.length + ' — XEM LẠI' : 'không có'}`,
)
for (const r of risky.slice(0, 10)) console.log('      · ' + r)

// Ghi chú Sales tự gõ trên app (đè lên ghi chú của file) — dựng lại từ file là
// mất. Giữ theo MÃ SP, và chỉ khi mọi dòng của mã đó mang CÙNG một ghi chú;
// khác nhau thì không đoán, để lại cho người sửa.
const fileNotes = new Set(fileLines.map((l) => n(l.note)).filter(Boolean))
const keepNote = new Map()
{
  const byProduct = new Map()
  for (const l of oldLines) {
    if (!n(l.note) || fileNotes.has(n(l.note))) continue
    byProduct.set(l.product_code, [...(byProduct.get(l.product_code) ?? []), n(l.note)])
  }
  for (const [code, notes] of byProduct) {
    const uniq = [...new Set(notes)]
    const total = oldLines.filter((l) => l.product_code === code).length
    if (uniq.length === 1 && notes.length === total) keepNote.set(code, uniq[0])
    else
      console.log(`      ! ${code}: ${uniq.length} ghi chú khác nhau — KHÔNG giữ tự động`)
  }
}
console.log(`  ghi chú Sales sẽ GIỮ LẠI: ${keepNote.size}`)
for (const [c, t] of keepNote) console.log(`      · ${c}: "${t.slice(0, 52)}"`)

console.log('\n  16 khối PO sẽ dựng:')
for (const b of blocks) {
  console.log(
    `    ${String(b.po).padEnd(13)} ${b.section.slice(0, 24).padEnd(26)} ` +
      `${String(b.lines.length).padStart(2)} dòng  ${String(b.lines.reduce((a, x) => a + x.qty, 0)).padStart(4)} sp  ngày ${b.date}`,
  )
}
console.log(
  `\n  ngày xuất: DB đang có ${oldLines.filter((l) => l.ship_date).length}/${oldLines.length} dòng → sau khi dựng lại ${fileLines.length}/${fileLines.length}`,
)
console.log(
  `  số PO   : DB đang có ${oldGroups.filter((g) => n(g.po_no)).length}/${oldGroups.length} nhóm → sau khi dựng lại ${blocks.length}/${blocks.length}`,
)

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

// ── Sao lưu rồi dựng lại ────────────────────────────────────────────────────
fs.writeFileSync(
  BACKUP,
  JSON.stringify(
    {
      taken_at: new Date().toISOString(),
      why: `Sao lưu trước khi chia lại ${LSX_CODE} theo 16 khối PO của file.`,
      restore:
        'Xoá nhóm+dòng hiện tại rồi chèn lại groups/lines dưới đây (giữ nguyên id).',
      lsx,
      groups: oldGroups,
      lines: oldLines,
    },
    null,
    1,
  ),
)
console.log(`  ✓ đã sao lưu → ${BACKUP}`)

// xoá dòng trước (nhóm là cha), rồi xoá nhóm
{
  const e = (
    await db.from('production_order_lines').delete().eq('production_order_id', lsx.id)
  ).error
  if (e) throw new Error('xoá dòng: ' + e.message)
  const e2 = (
    await db.from('production_order_groups').delete().eq('production_order_id', lsx.id)
  ).error
  if (e2) throw new Error('xoá nhóm: ' + e2.message)
}
let sort = 0
for (const [gi, b] of blocks.entries()) {
  const { data: g, error } = await db
    .from('production_order_groups')
    .insert({
      production_order_id: lsx.id,
      sales_order_id: null,
      title: `${b.section} — PO#${b.po}`,
      po_no: b.po,
      ship_date: b.date,
      ship_label: null,
      note: b.extra || null,
      sort_order: gi,
    })
    .select('id')
    .single()
  if (error) throw new Error(`nhóm ${b.po}: ${error.message}`)
  const rowsL = b.lines.map((l) => {
    const p = findProduct(l.code)
    return {
      production_order_id: lsx.id,
      group_id: g.id,
      product_id: p.id,
      product_code: p.code,
      customer_item_code: l.code,
      name_foreign: l.name_foreign,
      name_vi: l.name_vi,
      name_customs: l.name_customs,
      barcode: null,
      unit: l.unit,
      qty: l.qty,
      packing: l.packing,
      ship_date: b.date,
      ship_label: null,
      specs: l.specs,
      checks: {},
      extras: l.altCodes.length ? { ma_thung_2: l.altCodes.join(', ') } : {},
      note: keepNote.get(p.code) ?? l.note,
      important_note: l.important,
      image_file_id: p.image_file_id ?? null,
      sort_order: sort++,
    }
  })
  const e = (await db.from('production_order_lines').insert(rowsL)).error
  if (e) throw new Error(`dòng ${b.po}: ${e.message}`)
  console.log(`  + ${b.po} — ${rowsL.length} dòng, ngày ${b.date}`)
}
{
  const e = (
    await db
      .from('production_orders')
      .update({
        revision: lsx.revision + 1,
        revised_at: new Date().toISOString(),
        revised_by: lsx.created_by,
        revision_note: `Chia lại theo đúng 16 khối PO của file LSX 01.26-27 HG-LAURA REVISED 12 AUG (15/09/2026): lấy lại số PO cho 16 nhóm và ngày xuất cho cả ${fileLines.length} dòng. Sao lưu ở ${BACKUP}.`,
      })
      .eq('id', lsx.id)
  ).error
  if (e) throw new Error('revision: ' + e.message)
}
console.log('\n✓ Xong.\n')
