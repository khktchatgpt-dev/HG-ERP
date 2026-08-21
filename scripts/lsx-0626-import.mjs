// NẠP LỆNH SẢN XUẤT 06/26-27 - MX (file "LSX 06.26.27 (18023 HG-MX)").
//
//   node scripts/lsx-0626-import.mjs            # DRY-RUN, không ghi gì
//   node scripts/lsx-0626-import.mjs --apply    # ghi thật
//
// Bám đúng khuôn lệnh 08/26-27 - MX đã chạy (17/08/2026):
//   1. tạo SP còn thiếu trong thư viện Kỹ thuật (mã HG theo quy tắc đánh số);
//   2. BỔ SUNG hồ sơ SP đã có — CHỈ điền ô đang TRỐNG (tên nước ngoài, barcode,
//      đóng gói, quy cách sơn/nệm/mây/kính/gỗ). Không ghi đè số ai đã nhập;
//   3. tạo đơn hàng `18023 HG-MX` (26 dòng, đơn giá 0 — file LSX không có giá);
//   4. phát lệnh `06/26-27 - MX` ở trạng thái NHÁP + nhóm + 26 dòng.
//
// Dừng ở NHÁP có chủ đích: gửi GĐ duyệt là thao tác của Sales trên app, script
// không ký thay. Idempotent: đã có mã thì bỏ qua, chạy lại không đẻ bản trùng.
import { createRequire } from 'node:module'
const XLSX = createRequire(import.meta.url)('xlsx')
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const FI = process.argv.indexOf('--file')
 const FILE =
  (FI >= 0 ? process.argv[FI + 1] : null) ??
  'C:/Users/HP/AppData/Local/Temp/claude/D--HG-ERP/d8ab4111-9746-40bb-bd3b-53602b313719/scratchpad/lsx.xls'

const CUSTOMER_ID = '907daf96-aace-4c60-a24d-93fe6b509e6c' // MERXX HANDELS GMBH
const SALES_USER = 'e589c8de-66f5-48be-bf33-55bc2fa9fef9' // Nguyễn Phạm Thanh Phương
const ORDER_CODE = '18023 HG-MX'
const PO_NO = '18023'
const LSX_CODE = '06/26-27 - MX'
const SHIP_DATE = '2026-11-29' // w48.26 = hạn cuối tuần ISO 48/2026
const SHIP_LABEL = 'w48.26'
const SRC = 'LSX 06.26-27 (đơn 18023 HG-MX)'

/** Loại + vật liệu khung cho SP phải tạo mới — quyết theo tên Đức + tên Việt. */
const NEW_SPEC = {
  '21617-217': { type: 'TB', mat: 'AL' },
  '21650-217': { type: 'TB', mat: 'AL' },
  '21711-217': { type: 'TB', mat: 'AL' },
  '22019-011': { type: 'TB', mat: 'AL' },
  '26441-217': { type: 'TB', mat: 'AL' },
  '26443-219': { type: 'TB', mat: 'AL', note: 'Bản sơn BẠC của 26443-217.' },
  '26904-910': { type: 'OT', mat: 'IR' },
  '28256-262': { type: 'ST', mat: 'AL', note: 'Bản dây 2 khía của 28256-210.' },
  '29520-311': { type: 'AC', mat: 'XX' },
  '29593-800': { type: 'AC', mat: 'XX' },
  '29594-800': { type: 'AC', mat: 'XX' },
  '29599-800': { type: 'AC', mat: 'XX' },
  '29602-311': { type: 'AC', mat: 'XX' },
}

// ── Đọc file ────────────────────────────────────────────────────────────────
const norm = (s) =>
  String(s ?? '')
    .replace(/[ \t]+/g, ' ')
    .trim()
const rows = XLSX.utils.sheet_to_json(XLSX.readFile(FILE).Sheets['Sheet1'], {
  header: 1,
  raw: false,
  defval: '',
})
const lines = []
for (const r of rows.slice(7)) {
  const stt = norm(r[0])
  const code = norm(r[2])
  if (!/^\d+$/.test(stt) || !code) continue
  lines.push({
    stt: +stt,
    code,
    name_de: norm(r[3]),
    name_vi: norm(r[4]),
    barcode: norm(r[5]),
    unit: norm(r[6]) || 'cái',
    qty: Number(norm(r[7]).replace(/,/g, '')) || 0,
    specs: {
      may: norm(r[8]),
      nem: norm(r[9]),
      son: norm(r[10]),
      kinh: norm(r[11]),
      go: norm(r[12]),
    },
    packing: norm(r[13]),
    note: norm(r[15]) || null,
  })
}
if (lines.length !== 26) throw new Error(`Đọc được ${lines.length} dòng, mong đợi 26`)

/** "2 cái /thùng" → { qty: 2, label: 'thùng' }; "pallet" / "1 bộ/ 2 thùng" → null. */
const parsePacking = (t) => {
  const m = /^(\d+)\s*[^\d/]*\/\s*([\p{L} ]+)$/u.exec(t.trim())
  return m ? { qty: +m[1], label: m[2].trim().toLowerCase() } : null
}
/** Giá trị placeholder thì không chôn vào hồ sơ SP. */
const usable = (v) => (v && !/xác nhận sau|thông báo sau/i.test(v) ? v : '')

// ── Thư viện SP ─────────────────────────────────────────────────────────────
const db = await client(import.meta.url)
const products = []
for (let f = 0; ; f += 1000) {
  const { data, error } = await db
    .from('technical_products')
    .select(
      'id, code, code_legacy, customer_item_code, name, name_foreign, barcode, unit, packing, tech_spec, image_file_id',
    )
    .order('code')
    .range(f, f + 999)
  if (error) throw new Error(error.message)
  products.push(...data)
  if (data.length < 1000) break
}
const up = (s) => String(s ?? '').toUpperCase()
const find = (code) =>
  products.find((p) =>
    [p.customer_item_code, p.code_legacy, p.code].some((k) => up(k) === up(code)),
  )

// Mã kế tiếp theo LOẠI (đếm chung mọi vật liệu, không lấp khoảng trống).
const CODE_RE = /^([A-Z]{2})(\d{4,6})HG-([A-Z]{2})$/
const serial = {}
for (const p of products) {
  const m = CODE_RE.exec(up(p.code))
  if (m) serial[m[1]] = Math.max(serial[m[1]] ?? 0, +m[2])
}
const nextCode = (type, mat) => {
  serial[type] = (serial[type] ?? 0) + 1
  return `${type}${String(serial[type]).padStart(4, '0')}HG-${mat}`
}

// ── Dựng kế hoạch ───────────────────────────────────────────────────────────
const toCreate = []
const toPatch = []
const plan = []
for (const l of lines) {
  const hit = find(l.code)
  const pk = parsePacking(l.packing)
  const specPatch = {}
  const fromLsx = {
    machine: l.specs.may,
    cushion: l.specs.nem,
    paint: l.specs.son,
    glass: l.specs.kinh,
    wood: l.specs.go,
  }
  for (const [k, v] of Object.entries(fromLsx)) if (usable(v)) specPatch[k] = v

  if (!hit) {
    const s = NEW_SPEC[l.code]
    if (!s) throw new Error(`Chưa khai loại/vật liệu cho mã mới ${l.code}`)
    const code = nextCode(s.type, s.mat)
    toCreate.push({
      lsx: l,
      row: {
        code,
        name: l.name_vi,
        unit: l.unit,
        customer_name: 'MERXX',
        customer_item_code: l.code,
        name_foreign: l.name_de || null,
        barcode: l.barcode || null,
        product_type: s.type,
        frame_material: s.mat,
        packing: pk
          ? {
              qty_per_carton: pk.qty,
              ...(pk.label !== 'thùng' ? { pack_unit_label: pk.label } : {}),
            }
          : {},
        tech_spec: specPatch,
        bom_status: 'none',
        is_active: true,
        notes: `Nạp từ ${SRC}.${s.note ? ' ' + s.note : ''}`,
      },
    })
    plan.push({ stt: l.stt, ma: l.code, hg: code, act: 'TẠO MỚI', qty: l.qty })
  } else {
    const patch = {}
    if (!hit.name_foreign?.trim() && l.name_de) patch.name_foreign = l.name_de
    if (!hit.barcode?.trim() && l.barcode) patch.barcode = l.barcode
    if (!hit.packing?.qty_per_carton && pk)
      patch.packing = {
        ...(hit.packing ?? {}),
        qty_per_carton: pk.qty,
        ...(pk.label !== 'thùng' ? { pack_unit_label: pk.label } : {}),
      }
    const ts = { ...(hit.tech_spec ?? {}) }
    let tsChanged = false
    for (const [k, v] of Object.entries(specPatch))
      if (!ts[k]?.trim()) {
        ts[k] = v
        tsChanged = true
      }
    if (tsChanged) patch.tech_spec = ts
    if (Object.keys(patch).length) toPatch.push({ id: hit.id, code: hit.code, patch })
    plan.push({
      stt: l.stt,
      ma: l.code,
      hg: hit.code,
      act: Object.keys(patch).length ? `bù: ${Object.keys(patch).join(', ')}` : 'đủ',
      qty: l.qty,
    })
  }
}

console.log(`\n${APPLY ? '⚙ GHI THẬT' : '🔍 DRY-RUN (chưa ghi gì)'} — ${SRC}\n`)
console.log('STT  Mã LSX         SL  Mã HG            Việc')
for (const p of plan)
  console.log(
    `${String(p.stt).padStart(3)}  ${p.ma.padEnd(11)} ${String(p.qty).padStart(5)}  ${p.hg.padEnd(16)} ${p.act}`,
  )
console.log(
  `\nTạo mới ${toCreate.length} SP · bù hồ sơ ${toPatch.length} SP · đơn ${ORDER_CODE} · lệnh ${LSX_CODE} (nháp)`,
)

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.')
  process.exit(0)
}

// ── Ghi ─────────────────────────────────────────────────────────────────────
const created = new Map()
for (const c of toCreate) {
  const { data, error } = await db
    .from('technical_products')
    .insert(c.row)
    .select('id, code')
    .single()
  if (error) throw new Error(`${c.row.code}: ${error.message}`)
  created.set(c.lsx.code, data)
  console.log(`  + SP ${data.code} ← ${c.lsx.code} ${c.lsx.name_vi}`)
}
for (const p of toPatch) {
  const { error } = await db.from('technical_products').update(p.patch).eq('id', p.id)
  if (error) throw new Error(`${p.code}: ${error.message}`)
  console.log(`  ~ SP ${p.code}: ${Object.keys(p.patch).join(', ')}`)
}
const idOf = (code) => created.get(code)?.id ?? find(code)?.id

// Đơn hàng
let { data: order } = await db
  .from('sales_orders')
  .select('id, code, status')
  .eq('code', ORDER_CODE)
  .maybeSingle()
if (!order) {
  const ins = await db
    .from('sales_orders')
    .insert({
      code: ORDER_CODE,
      customer_id: CUSTOMER_ID,
      customer_po_no: PO_NO,
      currency: 'USD',
      due_date: SHIP_DATE,
      created_by: SALES_USER,
      note: `Nạp từ file ${SRC} ngày 11/08/2026. Giao ${SHIP_LABEL}. Đơn giá chờ Kinh doanh điền.`,
    })
    .select('id, code, status')
    .single()
  if (ins.error) throw new Error(ins.error.message)
  order = ins.data
  console.log(`  + Đơn ${order.code} (${order.status})`)
  const rowsL = lines.map((l, i) => ({
    order_id: order.id,
    product_id: idOf(l.code),
    qty: l.qty,
    unit_price: 0,
    ship_date: SHIP_DATE,
    sort_order: i,
    note: null,
  }))
  const e = (await db.from('sales_order_lines').insert(rowsL)).error
  if (e) throw new Error(e.message)
  console.log(`  + ${rowsL.length} dòng đơn`)
} else console.log(`  = Đơn ${ORDER_CODE} đã có, bỏ qua`)

// Lệnh sản xuất
let { data: lsx } = await db
  .from('production_orders')
  .select('id, code, status')
  .eq('code', LSX_CODE)
  .maybeSingle()
if (!lsx) {
  const now = new Date().toISOString()
  const ins = await db
    .from('production_orders')
    .insert({
      code: LSX_CODE,
      customer_id: CUSTOMER_ID,
      status: 'draft',
      ship_date: SHIP_DATE,
      created_by: SALES_USER,
      issued_by: SALES_USER,
      issued_at: now,
      note: `Nạp từ file ${SRC}.`,
    })
    .select('id, code, status')
    .single()
  if (ins.error) throw new Error(ins.error.message)
  lsx = ins.data
  console.log(`  + Lệnh ${lsx.code} (${lsx.status})`)
  const at = (
    await db
      .from('sales_orders')
      .update({ production_order_id: lsx.id })
      .eq('id', order.id)
  ).error
  if (at) throw new Error(at.message)

  const g = await db
    .from('production_order_groups')
    .insert({
      production_order_id: lsx.id,
      sales_order_id: order.id,
      title: `Đơn ${ORDER_CODE}`,
      po_no: PO_NO,
      ship_date: SHIP_DATE,
      ship_label: SHIP_LABEL,
      sort_order: 0,
    })
    .select('id')
    .single()
  if (g.error) throw new Error(g.error.message)

  const { data: ols } = await db
    .from('sales_order_lines')
    .select('id, product_id')
    .eq('order_id', order.id)
  const olBy = new Map(ols.map((o) => [o.product_id, o.id]))
  const { data: ps } = await db
    .from('technical_products')
    .select('id, code, image_file_id')
    .in('id', [...new Set(ols.map((o) => o.product_id))])
  const prodBy = new Map(ps.map((p) => [p.id, p]))

  const rowsL = lines.map((l, i) => {
    const pid = idOf(l.code)
    const p = prodBy.get(pid)
    const specs = Object.fromEntries(Object.entries(l.specs).filter(([, v]) => v))
    return {
      production_order_id: lsx.id,
      group_id: g.data.id,
      product_id: pid,
      sales_order_line_id: olBy.get(pid) ?? null,
      product_code: p?.code ?? '',
      customer_item_code: l.code,
      name_foreign: l.name_de || null,
      name_vi: l.name_vi,
      barcode: l.barcode || null,
      unit: l.unit,
      qty: l.qty,
      packing: l.packing || null,
      ship_date: SHIP_DATE,
      ship_label: SHIP_LABEL,
      specs,
      checks: {},
      extras: {},
      note: l.note,
      image_file_id: p?.image_file_id ?? null,
      sort_order: i,
    }
  })
  const e = (await db.from('production_order_lines').insert(rowsL)).error
  if (e) throw new Error(e.message)
  console.log(`  + ${rowsL.length} dòng lệnh`)
} else console.log(`  = Lệnh ${LSX_CODE} đã có, bỏ qua`)

console.log('\n✓ Xong. Lệnh đang ở NHÁP — Sales mở /sales/lsx soát rồi bấm Gửi duyệt.')
