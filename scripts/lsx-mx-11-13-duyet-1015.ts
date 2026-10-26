/**
 * KIỂM KỸ + DUYỆT 3 LỆNH 11, 12, 13/26-27 - MX (15/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/lsx-mx-11-13-duyet-1015.ts           # chỉ kiểm
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/lsx-mx-11-13-duyet-1015.ts --apply   # kiểm + duyệt
 *
 * Chủ dự án: "duyệt luôn 3 lệnh để chạy, kiểm tra kĩ, 3 lệnh này của chị Phương".
 * Đối chiếu LẠI từ đầu với 3 file LSX (không tin kết quả lượt nạp): lệnh/đơn/nhóm/dòng/hồ sơ SP.
 * Có lỗi thì DỪNG, không duyệt. Đúng vòng đời như bấm trên màn: `submit` bằng người lập
 * (Thanh Phương — luật chủ sở hữu) rồi `approve` bằng Giám đốc (dien@, người duyệt lệnh 10) —
 * có vết, đơn chuyển lsx_issued, chụp định mức, thông báo các bộ phận.
 */
import { createRequire } from 'node:module'
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const APPLY = process.argv.includes('--apply')
const DIR = process.env.LSX_DIR ?? 'C:/Users/HP/Downloads'
const FILES = [
  {
    lsx: '11/26-27 - MX',
    po: '18069',
    file: 'LSX 11.26.27( 18069 HG-MX).xls',
    ship: '2026-12-27',
  },
  {
    lsx: '12/26-27 - MX',
    po: '18085',
    file: 'LSX 12.26.27( 18085 HG-MX).xls',
    ship: '2027-01-10',
  },
  {
    lsx: '13/26-27 - MX',
    po: '18086',
    file: 'LSX 13.26.27( 18086 HG-MX).xls',
    ship: '2027-01-10',
  },
]
const SPEC_COLS: Record<string, string> = {
  may: 'mây',
  nem: 'nệm',
  son: 'sơn',
  kinh: 'kính',
  go: 'gỗ',
}
const n = (s: unknown) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()

function readLsx(path: string) {
  const rows: string[][] = XLSX.utils.sheet_to_json(
    XLSX.readFile(path).Sheets['Sheet1'],
    {
      header: 1,
      raw: false,
      defval: '',
    },
  )
  const hi = rows.findIndex((r) => n(r[0]).toLowerCase() === 'stt')
  const H = rows[hi].map((h) => n(h).toLowerCase())
  const col = (k: string) => H.findIndex((h) => h.startsWith(k))
  const out = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    if (/^tổng/i.test(n(r[1]))) break
    if (!n(r[col('mã sp')])) continue
    out.push({
      code: n(r[col('mã sp')]),
      fn: n(r[col('tên tiếng đức')]),
      vn: n(r[col('tên tiếng việt')]),
      bar: n(r[col('số barcode')]),
      unit: n(r[col('đvt')]),
      qty: Number(n(r[col('số lượng')]).replace(/,/g, '')),
      pack: n(r[col('đóng gói')]),
      week: n(r[col('thời gian xuất')]),
      specs: Object.fromEntries(
        Object.entries(SPEC_COLS)
          .map(([k, h]) => [k, n(r[col(h)])])
          .filter(([, v]) => v),
      ),
    })
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dữ liệu PostgREST thô của script một lần
type Row = any

async function main() {
  const users = await usersRepo.list()
  const phuong = users.find((u) => u.email === 'sales2@hoanggia.de')
  const gd = users.find((u) => u.email === 'dien@hoanggia.de')
  if (!phuong || !gd) throw new Error('thiếu tài khoản Thanh Phương / Giám đốc')
  console.log(`Người lập: ${phuong.name} · Người duyệt: ${gd.name}\n`)
  const { data: mx } = await db().from('sales_customers').select('id, owner_id').eq('code', 'MERXX').single() // prettier-ignore
  const errs: string[] = []
  const warn: string[] = []
  const ok = (cond: boolean, msg: string) => (cond ? null : errs.push(msg))

  const ids: Record<string, string> = {}
  for (const f of FILES) {
    const want = readLsx(`${DIR}/${f.file}`)
    const { data: lsx } = (await db().from('production_orders').select('*').eq('code', f.lsx).single()) as { data: Row } // prettier-ignore
    ok(!!lsx, `${f.lsx}: không thấy lệnh`)
    if (!lsx) continue
    ids[f.lsx] = lsx.id
    const tag = f.lsx
    ok(lsx.status === 'draft', `${tag}: trạng thái ${lsx.status} (phải là nháp)`)
    ok(lsx.created_by === phuong.id && lsx.issued_by === phuong.id, `${tag}: người lập/phát không phải Thanh Phương`) // prettier-ignore
    ok(lsx.customer_id === (mx as Row).id, `${tag}: khách không phải MERXX`)
    ok(lsx.ship_date === f.ship, `${tag}: ngày xuất ${lsx.ship_date} ≠ ${f.ship}`)

    const { data: so } = (await db().from('sales_orders').select('*').eq('production_order_id', lsx.id)) as { data: Row[] } // prettier-ignore
    ok(so.length === 1, `${tag}: ${so.length} đơn bán (phải 1)`)
    const o = so[0]
    if (o) {
      ok(o.code === `${f.po} HG-MX` && o.customer_po_no === f.po, `${tag}: đơn ${o.code} / PO ${o.customer_po_no}`) // prettier-ignore
      ok(o.created_by === phuong.id, `${tag}: đơn ${o.code} không do Thanh Phương lập`)
      ok(o.customer_id === (mx as Row).id && o.currency === 'USD' && o.due_date === f.ship, `${tag}: đơn sai khách/tiền tệ/hạn`) // prettier-ignore
    }
    const { data: sol } = (await db().from('sales_order_lines').select('*').eq('order_id', o?.id ?? '')) as { data: Row[] } // prettier-ignore
    const { data: grp } = (await db().from('production_order_groups').select('*').eq('production_order_id', lsx.id)) as { data: Row[] } // prettier-ignore
    ok(grp.length === 1 && grp[0].sales_order_id === o?.id && grp[0].po_no === f.po && grp[0].ship_label === want[0].week, `${tag}: nhóm lệnh sai (PO/nhãn tuần/nối đơn)`) // prettier-ignore
    const { data: lines } = (await db().from('production_order_lines').select('*, p:technical_products(*)').eq('production_order_id', lsx.id).order('sort_order')) as { data: Row[] } // prettier-ignore
    ok(lines.length === want.length, `${tag}: ${lines.length} dòng ≠ tờ ${want.length}`)
    ok(
      sol.length === want.length,
      `${tag}: đơn có ${sol.length} dòng ≠ tờ ${want.length}`,
    )
    const sum = lines.reduce((s, l) => s + Number(l.qty), 0)
    const sumTo = want.reduce((s, l) => s + l.qty, 0)
    ok(sum === sumTo, `${tag}: tổng SL ${sum} ≠ tờ ${sumTo}`)
    console.log(`${tag} · đơn ${o?.code} · ${lines.length} dòng · ${sum} sp · xuất ${lsx.ship_date} (${want[0].week})`) // prettier-ignore

    for (const [i, w] of want.entries()) {
      const l = lines[i]
      const at = `${tag} dòng ${i + 1} ${w.code}`
      if (!l) continue
      const p = l.p
      ok(l.customer_item_code === w.code && p?.customer_item_code === w.code, `${at}: mã khách ${l.customer_item_code}/${p?.customer_item_code}`) // prettier-ignore
      ok(Number(l.qty) === w.qty, `${at}: SL ${l.qty} ≠ ${w.qty}`)
      ok(n(l.barcode) === w.bar, `${at}: barcode ${l.barcode} ≠ ${w.bar}`)
      ok(n(l.name_foreign) === w.fn, `${at}: tên Đức khác tờ`)
      ok(n(l.unit).toLowerCase() === w.unit.toLowerCase(), `${at}: ĐVT ${l.unit}`)
      ok(l.ship_label === w.week && l.ship_date === f.ship, `${at}: tuần/ngày ${l.ship_label} ${l.ship_date}`) // prettier-ignore
      for (const [k, v] of Object.entries(w.specs)) ok(n(l.specs?.[k]) === v, `${at}: ${k} "${l.specs?.[k]}" ≠ "${v}"`) // prettier-ignore
      if (w.pack)
        ok(n(l.packing) === w.pack, `${at}: đóng gói "${l.packing}" ≠ "${w.pack}"`)
      const s = sol.find((x) => x.id === l.sales_order_line_id)
      ok(!!s && s.product_id === l.product_id && Number(s.qty) === w.qty, `${at}: dòng đơn không khớp`) // prettier-ignore
      // 60 hồ sơ MERXX cũ chỉ ghi customer_name, customer_id trống — vẫn đúng khách.
      ok(p?.is_active && (p?.customer_id === (mx as Row).id || (!p?.customer_id && p?.customer_name === 'MERXX')), `${at}: hồ sơ ${p?.code} không hoạt động / sai khách`) // prettier-ignore
      ok(!!p?.image_file_id, `${at}: ${p?.code} chưa có ảnh`)
      ok(n(p?.barcode) === w.bar, `${at}: barcode hồ sơ ${p?.code} = ${p?.barcode}`)
      const vn = n(p?.name)
      if (vn !== w.vn) warn.push(`${at}: tên Việt hồ sơ "${vn}" ≠ tờ "${w.vn}"`)
      if (p?.bom_status !== 'done')
        warn.push(`${at}: ${p?.code} định mức "${p?.bom_status}"`)
      if (!p?.packing?.qty_per_carton) warn.push(`${at}: ${p?.code} chưa có số SP/thùng`)
      if (Number(s?.unit_price ?? 0) === 0) warn.push(`${at}: đơn giá bán = 0`)
      console.log(`  ${String(i + 1).padStart(2)} ${p?.code.padEnd(12)} ${w.code.padEnd(10)} ${String(w.qty).padStart(4)} ${l.unit} · ${w.bar} · ${Object.entries(l.specs ?? {}).map(([k, v]) => `${k}:${v}`).join(' · ')} · ${l.packing ?? '—'}`) // prettier-ignore
    }
  }

  // Ảnh dùng chung với SP khác = dấu hiệu gắn nhầm (bẫy 08/2026).
  const { data: ps } = (await db().from('production_order_lines').select('p:technical_products(code, image_file_id)').in('production_order_id', Object.values(ids))) as { data: Row[] } // prettier-ignore
  for (const { p } of ps) {
    const { data: share } = await db().from('technical_products').select('code').eq('image_file_id', p.image_file_id).neq('code', p.code) // prettier-ignore
    if (share?.length)
      warn.push(`${p.code}: ảnh dùng chung với ${share.map((x) => x.code).join(', ')}`)
  }

  console.log(`\nLỖI CHẶN: ${errs.length}`)
  errs.forEach((e) => console.log('  ✗ ' + e))
  console.log(`LƯU Ý (không chặn duyệt): ${warn.length}`)
  warn.forEach((w) => console.log('  · ' + w))
  if (errs.length) throw new Error('Có lỗi — KHÔNG duyệt')
  if (!APPLY) return console.log('\nChỉ kiểm — thêm --apply để gửi duyệt + duyệt.')

  for (const f of FILES) {
    await lsxService.submit(phuong, ids[f.lsx])
    const after = await lsxService.approve(gd, ids[f.lsx])
    const { data: o } = await db().from('sales_orders').select('code, status').eq('production_order_id', ids[f.lsx]) // prettier-ignore
    const { count } = await db().from('production_order_boms').select('product_id', { count: 'exact', head: true }).eq('production_order_id', ids[f.lsx]) // prettier-ignore
    console.log(`✓ ${f.lsx} → ${after.status} · đơn ${o?.map((x) => `${x.code} ${x.status}`).join(', ')} · ${count ?? 0} dòng định mức đã chụp`) // prettier-ignore
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
