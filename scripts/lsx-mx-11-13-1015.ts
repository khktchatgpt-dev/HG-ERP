/**
 * NẠP 3 LỆNH MERXX CÒN THIẾU — 11, 12, 13/26-27 - MX (15/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/lsx-mx-11-13-1015.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/lsx-mx-11-13-1015.ts --apply   # ghi
 *
 * Nguồn: thư mục Drive LSX MERXX của Thanh Phương (chủ dự án chốt "bổ sung lệnh còn chưa có,
 * không bổ sung lệnh REVISED" + "đầy đủ kể cả sản phẩm, hình ảnh nếu chưa có"):
 *   LSX 11.26.27( 18069 HG-MX).xls — 1 dòng · w52.26
 *   LSX 12.26.27( 18085 HG-MX).xls — 1 dòng · w01.27
 *   LSX 13.26.27( 18086 HG-MX).xls — 8 dòng · w01.27 (ô "Tổng" của file ghi 300, cộng thật 2.000)
 *
 * Đi ĐÚNG luồng của app như người bấm: hồ sơ SP → đơn bán (`ordersService.create`) →
 * phát lệnh (`lsxService.issue`, lệnh ở NHÁP, tự nạp dòng từ hồ sơ SP) → chép nhãn tuần +
 * thông số của TỜ LSX lên nhóm/dòng lệnh (tờ là lệnh cho xưởng; hồ sơ có thể ghi khác chữ).
 *
 * Hồ sơ SP (thư viện đã rút còn 144 SP ngày 08/10 — backups/products-prune-1008-*.json):
 *  · 26800-217 → KHÔI PHỤC CH0020HG-AL từ bản sao lưu (cùng mã khách, cùng mô tả ghế XC tựa dây
 *    dù tay polywood, ảnh LSX khớp) kèm 9 dòng định mức + 1 phương án đóng gói. Ảnh cũ mất theo
 *    Storage → gắn ảnh từ file LSX.
 *  · 22010-307 → MỞ MỚI. Bản sao lưu có CH0170HG-AL mang mã khách này nhưng là "Ghế 5 bậc Paxos"
 *    (Klappsessel, barcode …220147) — KHÁC hàng trên tờ (Stapelsessel = ghế xếp chồng, …220109).
 *  · 29518-800 → MỞ MỚI (nệm ghế Lugano — phụ kiện AC…HG-XX như nệm Riva AC0008–0011).
 *  · 7 SP còn lại đã có hồ sơ + ảnh: chỉ bù ô TRỐNG, không ghi đè.
 * Ảnh: mỗi dòng SP có một ảnh neo ĐÚNG dòng đó (lệch 0 — đã soi bằng mắt); chỉ gắn cho SP chưa có.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { filesService } from '@/modules/core/files/files.service'
import { buildProductCode, nextSerial } from '@/lib/product-code'
import { SPEC_FROM_PRODUCT } from '@/lib/lsx-line-fill'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const { readXlsImages } = require('./xls-images.mjs') as {
  readXlsImages: (f: string) => { row: number; buffer: Buffer; ext: string }[]
}

const APPLY = process.argv.includes('--apply')
const DIR = process.env.LSX_DIR ?? 'C:/Users/HP/Downloads'
const BACKUP = 'backups/products-prune-1008-2026-10-08T01-33-30.json'
const SALE = 'sales2@hoanggia.de' // Nguyễn Phạm Thanh Phương — người lập mọi lệnh MX
const SRC = 'nạp LSX 11–13 MX 15/10/2026'

const FILES = [
  { lsx: '11/26-27 - MX', po: '18069', file: 'LSX 11.26.27( 18069 HG-MX).xls' },
  { lsx: '12/26-27 - MX', po: '18085', file: 'LSX 12.26.27( 18085 HG-MX).xls' },
  { lsx: '13/26-27 - MX', po: '18086', file: 'LSX 13.26.27( 18086 HG-MX).xls' },
]
const RESTORE: Record<string, string> = {
  '26800-217': 'f6e9a308-65cc-47d9-8cdc-b9f5a7c5edad',
}
const NEW: Record<string, { type: string; mat: string }> = {
  '29518-800': { type: 'AC', mat: 'XX' },
  '22010-307': { type: 'CH', mat: 'AL' },
}

const n = (s: unknown) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const SPEC_COLS: Record<string, string> = {
  may: 'Mây',
  nem: 'Nệm',
  son: 'Sơn',
  kinh: 'Kính',
  go: 'Gỗ',
}
const PROD_KEY = Object.fromEntries(
  Object.entries(SPEC_FROM_PRODUCT).map(([p, s]) => [s, p]),
)

/** "w52.26" → chủ nhật cuối tuần ISO (cùng quy ước `lsx-bo-sung-0915.mjs`). */
function weekToDate(label: string): string {
  const m = /^w(\d{1,2})\.(\d{2})$/i.exec(n(label))
  if (!m) throw new Error(`nhãn tuần lạ: ${label}`)
  const year = 2000 + Number(m[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const mon = new Date(jan4)
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  mon.setUTCDate(mon.getUTCDate() + (Number(m[1]) - 1) * 7 + 6)
  return mon.toISOString().slice(0, 10)
}

type Line = {
  code: string
  name_foreign: string
  name_vi: string
  barcode: string
  unit: string
  qty: number
  specs: Record<string, string>
  packing: string
  week: string
  note: string
  img: { buffer: Buffer; ext: string } | null
}

function readLsx(path: string): Line[] {
  const ws = XLSX.readFile(path).Sheets['Sheet1']
  const ref = XLSX.utils.decode_range(ws['!ref'])
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: '',
  })
  const hi = rows.findIndex((r) => n(r[0]).toLowerCase() === 'stt')
  const H = rows[hi].map((h) => n(h).toLowerCase())
  const col = (k: string) => H.findIndex((h) => h.startsWith(k.toLowerCase()))
  const C = {
    code: col('Mã SP'),
    fn: col('Tên tiếng Đức'),
    vn: col('Tên tiếng việt'),
    bar: col('Số barcode'),
    unit: col('ĐVT'),
    qty: col('Số lượng'),
    pack: col('Đóng gói'),
    week: col('Thời gian xuất'),
    note: col('Note'),
  }
  // Ảnh neo theo dòng SHEET (0-based); sheet_to_json đếm từ đầu RANGE (A4) → cộng ref.s.r.
  const imgs = readXlsImages(path)
  const out: Line[] = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    if (/^tổng/i.test(n(r[1])) || /^để đảm bảo/i.test(n(r[0]))) break
    const code = n(r[C.code])
    if (!code) continue
    const qty = Number(n(r[C.qty]).replace(/,/g, ''))
    if (!(qty > 0)) throw new Error(`${path} dòng ${i}: SL "${r[C.qty]}"`)
    const sheetRow = i + ref.s.r
    const mine = imgs.filter((x) => x.row === sheetRow)
    const img = mine.sort((a, b) => b.buffer.length - a.buffer.length)[0] ?? null
    out.push({
      code,
      name_foreign: n(r[C.fn]),
      name_vi: n(r[C.vn]),
      barcode: n(r[C.bar]),
      unit: n(r[C.unit]) || 'cái',
      qty,
      specs: Object.fromEntries(
        Object.entries(SPEC_COLS)
          .map(([k, label]) => [k, n(r[col(label)])])
          .filter(([, v]) => v),
      ),
      packing: n(r[C.pack]),
      week: n(r[C.week]),
      note: n(r[C.note]),
      img: img ? { buffer: img.buffer, ext: img.ext } : null,
    })
  }
  return out
}

/** "1 cái/ thùng" → {qty 1, thùng}; "pallet"/"palett" → không có số → để Kỹ thuật điền. */
function packingOf(t: string) {
  const m = /^(\d+)\s*[^\d/]*\/\s*([\p{L} ]+)$/u.exec(t)
  return m
    ? { qty_per_carton: Number(m[1]), pack_unit_label: m[2].trim().toLowerCase() }
    : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dữ liệu PostgREST thô của script một lần
type Row = any

async function main() {
  const data = FILES.map((f) => ({ ...f, lines: readLsx(`${DIR}/${f.file}`) }))
  for (const d of data) {
    const weeks = new Set(d.lines.map((l) => l.week))
    if (weeks.size !== 1) throw new Error(`${d.file}: nhiều tuần xuất ${[...weeks]}`)
    console.log(`${d.lsx} ← ${d.file}: ${d.lines.length} dòng · ${d.lines.reduce((s, l) => s + l.qty, 0)} sp · ${d.lines[0].week} = ${weekToDate(d.lines[0].week)} · ảnh ${d.lines.filter((l) => l.img).length}/${d.lines.length}`) // prettier-ignore
  }

  const users = await usersRepo.list()
  const sale = users.find((u) => u.email === SALE)
  if (!sale) throw new Error('thiếu Thanh Phương')
  const { data: cus } = await db().from('sales_customers').select('id').eq('code', 'MERXX').single() // prettier-ignore
  const customerId = (cus as Row).id as string
  for (const d of data) {
    const { data: hit } = await db()
      .from('production_orders')
      .select('id')
      .eq('code', d.lsx)
    if (hit?.length) throw new Error(`${d.lsx} đã có — dừng (chạy lại sau khi đã nạp?)`)
    const { data: so } = await db()
      .from('sales_orders')
      .select('id')
      .eq('code', `${d.po} HG-MX`)
    if (so?.length) throw new Error(`đơn ${d.po} HG-MX đã có — dừng`)
  }

  // ── Hồ sơ SP ──────────────────────────────────────────────────────────────
  const prods: Row[] = []
  for (let f = 0; ; f += 1000) {
    const { data: p } = await db()
      .from('technical_products')
      .select('*')
      .range(f, f + 999)
    prods.push(...(p ?? []))
    if ((p ?? []).length < 1000) break
  }
  const backup = JSON.parse(readFileSync(BACKUP, 'utf8'))
  const codesForSerial = [...prods, ...backup.technical_products].map((p: Row) =>
    String(p.code),
  )
  const find = (code: string): Row | null => {
    const hits = prods.filter(
      (p) =>
      [p.customer_item_code, p.code_legacy, p.code].filter(Boolean).some((k: string) => keyOf(k) === keyOf(code)), // prettier-ignore
    )
    // 22028-209 khớp CẢ "28256-228 Ghế thư giãn Riva" (mã khách gõ nhầm) — chọn hồ sơ mã HG thật.
    return hits.find((p) => /HG-/.test(p.code)) ?? hits[0] ?? null
  }

  const allLines = data.flatMap((d) => d.lines)
  const byCode = new Map<string, Row>()
  const imgTodo: { p: Row; l: Line }[] = []
  console.log('\n── HỒ SƠ SP ──')
  for (const l of allLines) {
    if (byCode.has(l.code)) continue
    const ts = Object.fromEntries(
      Object.entries(l.specs).map(([k, v]) => [PROD_KEY[k], v]),
    )
    const pk = packingOf(l.packing)
    let p = find(l.code)
    if (p) {
      const patch: Row = {}
      if (!n(p.name_foreign) && l.name_foreign) patch.name_foreign = l.name_foreign
      if (!n(p.barcode) && l.barcode) patch.barcode = l.barcode
      const tsNew = { ...(p.tech_spec ?? {}) }
      for (const [k, v] of Object.entries(ts)) if (!n(tsNew[k])) tsNew[k] = v
      if (JSON.stringify(tsNew) !== JSON.stringify(p.tech_spec ?? {}))
        patch.tech_spec = tsNew
      if (!p.packing?.qty_per_carton && pk)
        patch.packing = { ...(p.packing ?? {}), ...pk }
      console.log(`  = ${l.code} → ${p.code}${Object.keys(patch).length ? ` · bù ${Object.keys(patch).join(', ')}` : ''}${p.image_file_id ? '' : ' · THIẾU ảnh'}`) // prettier-ignore
      if (APPLY && Object.keys(patch).length) {
        const { error } = await db()
          .from('technical_products')
          .update(patch)
          .eq('id', p.id)
        if (error) throw new Error(`${p.code}: ${error.message}`)
        Object.assign(p, patch)
      }
    } else if (RESTORE[l.code]) {
      const bk = backup.technical_products.find((x: Row) => x.id === RESTORE[l.code])
      if (!bk) throw new Error(`backup thiếu ${l.code}`)
      const parts = backup.technical_product_parts.filter(
        (x: Row) => x.product_id === bk.id,
      )
      const packs = backup.technical_packing_options.filter(
        (x: Row) => x.product_id === bk.id,
      )
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bỏ cột sinh tự động + ảnh đã mất
      const { search_text, image_file_id, ...rest } = bk
      p = {
        ...rest,
        name_foreign: l.name_foreign || bk.name_foreign,
        barcode: l.barcode || bk.barcode,
        tech_spec: { ...(bk.tech_spec ?? {}), ...ts },
        packing: pk ? { ...(bk.packing ?? {}), ...pk } : bk.packing,
        customer_id: customerId,
        image_file_id: null,
        notes: `${bk.notes ?? ''}\nKhôi phục ${SRC} từ bản sao lưu xoá thư viện 08/10 (kèm ${parts.length} dòng định mức) — SP có trên LSX 12.26.27 (18085 HG-MX).`.trim(), // prettier-ignore
      }
      console.log(`  ↺ ${l.code} → KHÔI PHỤC ${bk.code} "${bk.name}" + ${parts.length} dòng định mức + ${packs.length} đóng gói`) // prettier-ignore
      if (APPLY) {
        const { error } = await db().from('technical_products').insert(p)
        if (error) throw new Error(`khôi phục ${bk.code}: ${error.message}`)
        if (parts.length) {
          const { error: e2 } = await db().from('technical_product_parts').insert(parts)
          if (e2) throw new Error(`định mức ${bk.code}: ${e2.message}`)
        }
        if (packs.length) {
          const { error: e3 } = await db().from('technical_packing_options').insert(packs)
          if (e3) throw new Error(`đóng gói ${bk.code}: ${e3.message}`)
        }
      }
      prods.push(p)
    } else if (NEW[l.code]) {
      const { type, mat } = NEW[l.code]
      const serial = nextSerial(codesForSerial, type)
      const code = buildProductCode(type, serial, mat)
      codesForSerial.push(code)
      p = {
        code,
        serial_no: serial,
        name: l.name_vi.slice(0, 200),
        name_foreign: l.name_foreign.slice(0, 200) || null,
        unit: l.unit,
        customer_name: 'MERXX',
        customer_id: customerId,
        customer_item_code: l.code,
        barcode: l.barcode || null,
        product_type: type,
        frame_material: mat,
        packing: pk ?? {},
        tech_spec: ts,
        bom_status: 'none',
        is_active: true,
        notes: `Mở ${SRC} từ file LSX. Định mức chưa có.`,
      }
      console.log(`  + ${l.code} → MỞ MỚI ${code} "${p.name}"`)
      if (APPLY) {
        const { data: ins, error } = await db().from('technical_products').insert(p).select('*').single() // prettier-ignore
        if (error) throw new Error(`${code}: ${error.message}`)
        p = ins
      }
      prods.push(p)
    } else throw new Error(`${l.code}: chưa có hồ sơ và chưa khai cách xử lý`)
    byCode.set(l.code, p)
    if (!p.image_file_id) {
      if (l.img) imgTodo.push({ p, l })
      else console.log(`    ⚠ ${l.code} không có ảnh trong file`)
    }
  }
  console.log(`  ảnh sẽ gắn: ${imgTodo.map((x) => `${x.p.code} (${(x.l.img!.buffer.length / 1024).toFixed(0)} KB)`).join(', ') || '—'}`) // prettier-ignore

  // ── Đơn bán + lệnh ────────────────────────────────────────────────────────
  console.log('\n── ĐƠN BÁN + LỆNH (nháp) ──')
  for (const d of data) {
    const ship = weekToDate(d.lines[0].week)
    const lines = d.lines.map((l) => {
      const p = byCode.get(l.code)!
      const price =
        p.plan_currency === 'USD' && Number(p.plan_price) > 0 ? Number(p.plan_price) : 0
      return { product_id: p.id, qty: l.qty, unit_price: price, ship_date: ship }
    })
    console.log(`  ${d.po} HG-MX → ${d.lsx} · xuất ${d.lines[0].week} (${ship}) · ${lines.length} dòng · giá có sẵn ${lines.filter((x) => x.unit_price > 0).length}/${lines.length}`) // prettier-ignore
    if (!APPLY) continue
    const order = await ordersService.create(sale, {
      code: `${d.po} HG-MX`,
      customer_id: customerId,
      currency: 'USD',
      customer_po_no: d.po,
      due_date: ship,
      note: `Nạp từ ${d.file} (${SRC}). Đơn giá chờ Kinh doanh điền.`,
      lines,
    } as Parameters<typeof ordersService.create>[1])
    const lsx = await lsxService.issue(sale, {
      code: d.lsx,
      order_ids: [order.id],
      ship_date: ship,
      note: `Nạp từ file ${d.file.replace(/\.xls$/, '')} — ${SRC}.`,
    })
    // Nhãn tuần + thông số / ghi chú của TỜ lên nhóm và dòng lệnh vừa nạp.
    const { error: eg } = await db().from('production_order_groups').update({ ship_label: d.lines[0].week }).eq('production_order_id', lsx.id) // prettier-ignore
    if (eg) throw new Error(`nhãn tuần nhóm: ${eg.message}`)
    const { data: pl } = await db().from('production_order_lines').select('id, product_id, qty, specs, packing, note').eq('production_order_id', lsx.id).order('sort_order') // prettier-ignore
    if ((pl ?? []).length !== d.lines.length)
      throw new Error(`${d.lsx}: nạp ${pl?.length} dòng ≠ tờ ${d.lines.length}`)
    for (const [i, row] of (pl as Row[]).entries()) {
      const l = d.lines[i]
      if (row.product_id !== byCode.get(l.code)!.id || Number(row.qty) !== l.qty)
        throw new Error(`${d.lsx} dòng ${i + 1} lệch tờ`)
      const specs = { ...(row.specs ?? {}), ...l.specs }
      const diff = Object.keys(l.specs).filter((k) => n(row.specs?.[k]) !== l.specs[k])
      if (diff.length) console.log(`    · ${l.code}: theo tờ ${diff.map((k) => `${k} "${n(row.specs?.[k]) || '—'}"→"${l.specs[k]}"`).join(', ')}`) // prettier-ignore
      const { error } = await db()
        .from('production_order_lines')
        .update({
          ship_label: l.week,
          specs,
          packing: l.packing || row.packing,
          note: l.note || row.note,
        })
        .eq('id', row.id)
      if (error) throw new Error(`dòng ${d.lsx}: ${error.message}`)
    }
    console.log(`  ✓ ${order.code} + ${lsx.code} (${lsx.status})`)
  }

  // ── Ảnh ───────────────────────────────────────────────────────────────────
  if (APPLY) {
    for (const { p, l } of imgTodo) {
      const img = l.img!
      const fileId = await filesService.uploadFromServer(sale, {
        buffer: img.buffer,
        filename: `${p.code} ${l.code}.${img.ext}`,
        mime_type: img.ext === 'png' ? 'image/png' : 'image/jpeg',
        bucket: 'attachments',
        parent: { kind: 'product', id: p.id },
        doc_type: 'image',
      })
      const { error } = await db().from('technical_products').update({ image_file_id: fileId }).eq('id', p.id) // prettier-ignore
      if (error) throw new Error(`ảnh ${p.code}: ${error.message}`)
      console.log(`  + ảnh ${p.code}`)
    }
  }
  console.log(APPLY ? '\n✓ Xong.' : '\nDò khô — thêm --apply để ghi.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
