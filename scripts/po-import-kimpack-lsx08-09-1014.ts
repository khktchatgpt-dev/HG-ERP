/**
 * ĐƠN BAO BÌ KIMPACK "04-2026 HG" — LSX 8+9 (HG-MX), NHÁP cho chị Nga (14/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-kimpack-lsx08-09-1014.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-kimpack-lsx08-09-1014.ts --apply   # ghi
 *
 * Tờ (ảnh): 10 dòng carton, cộng 59.345.133 (chưa VAT; đơn Kimpack cũ đều VAT 8% chưa gồm).
 * Mẫu carton, giá theo THÙNG (như PO-2026-0045): đơn giá/thùng = m² × giá/m², tròn 2 lẻ
 * (cột numeric(18,2)) → tổng hệ thống lệch tờ vài đồng vì tờ làm tròn từng dòng.
 *  · m² lấy NGƯỢC từ thành tiền của tờ (công thức m² của Kimpack khác `cartonAreaM2`).
 *  · Mã SP + lệnh đối chiếu production_order_lines:
 *      26473-217/219, 26474-217, 26471-217/219 → LSX 08; 26471-210 → LSX 09 (dòng 5–6: 140 + 50);
 *      21668-011 (400) và 21660-011 (100) → LSX 06/26-27 MX — thùng 21660-011 của LSX 09 đã
 *      nhận đủ ở PO-2026-0097 (Bao bì 3/2), nên dòng 9–10 coi là của lệnh 06. Gắn 06 làm LSX phụ.
 *  · BB-0078 / BB-0079 chị Nga tạo 13/10 cho chính tờ này; còn lại dùng mã có sẵn trong danh mục.
 *  · Dòng 7 (Bàn Polywood 825×725×135): tờ chép m² 4,03 + giá/thùng của dòng 5 — NHẬP ĐÚNG TỜ,
 *    ghi chú dòng để người duyệt soát.
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'

const APPLY = process.argv.includes('--apply')
const NCC = 'dff9cc95-e14d-4cdf-ad14-1fbc2ab33b71' // KIMPACK (bản có MST 4001179967, NCC của PO-0045/0062)
const SO_DH = '04-2026 HG'

async function one<T>(q: PromiseLike<{ data: T[] | null }>): Promise<T | null> {
  const { data } = await q
  return data?.[0] ?? null
}

const r2 = (n: number) => Math.round(n * 100) / 100

type Dong = {
  ma: string
  sp: string | null
  ten: string
  mo: 'AD' | 'MR'
  sl: number
  dim: [number, number, number]
  m2: number
  giaM2: number
  ttTo: number // thành tiền in trên tờ
  lenh: Record<'06' | '08' | '09', number>
  note?: string
}

const DONG: Dong[] = [
  {
    ma: 'BB-0078',
    sp: '26473-217, 26473-219',
    ten: 'Bao bì nhôm kính 200(300)x110',
    mo: 'AD',
    sl: 160,
    dim: [2045, 1145, 110],
    m2: 6.26,
    giaM2: 12_212,
    ttTo: 12_231_539,
    lenh: { '06': 0, '08': 160, '09': 0 },
  },
  {
    ma: 'BB-0079',
    sp: '26473-217, 26473-219',
    ten: 'Hộp chân bàn',
    mo: 'MR',
    sl: 160,
    dim: [670, 255, 65],
    m2: 0.6308,
    giaM2: 10_719,
    ttTo: 1_081_847,
    lenh: { '06': 0, '08': 160, '09': 0 },
  },
  {
    ma: 'NHO0319',
    sp: '26474-217',
    ten: 'BB Bàn NK 220(340)',
    mo: 'AD',
    sl: 80,
    dim: [2245, 1145, 110],
    m2: 6.92265,
    giaM2: 12_212,
    ttTo: 6_763_152,
    lenh: { '06': 0, '08': 80, '09': 0 },
  },
  {
    ma: 'BB-0079',
    sp: '26474-217',
    ten: 'Hộp chân 3L',
    mo: 'MR',
    sl: 80,
    dim: [670, 255, 65],
    m2: 0.6308,
    giaM2: 10_719,
    ttTo: 540_924,
    lenh: { '06': 0, '08': 80, '09': 0 },
  },
  {
    ma: 'NHO0310',
    sp: '26471-217, 26471-219, 26471-210',
    ten: 'Bb nhôm kính 150(220)x90',
    mo: 'AD',
    sl: 190,
    dim: [1525, 925, 100],
    m2: 4.02545,
    giaM2: 12_212,
    ttTo: 9_340_171,
    lenh: { '06': 0, '08': 140, '09': 50 },
  },
  {
    ma: 'BB-0079',
    sp: '26471-217, 26471-219, 26471-210',
    ten: 'Hộp chân bàn 3L',
    mo: 'MR',
    sl: 190,
    dim: [670, 255, 65],
    m2: 0.6308,
    giaM2: 10_719,
    ttTo: 1_284_694,
    lenh: { '06': 0, '08': 140, '09': 50 },
  },
  {
    ma: 'BAO0124',
    sp: '21668-011',
    ten: 'Bàn Polywood 80(120)x70x75',
    mo: 'AD',
    sl: 400,
    dim: [825, 725, 135],
    m2: 4.02545,
    giaM2: 12_212,
    ttTo: 19_663_518,
    lenh: { '06': 400, '08': 0, '09': 0 },
    note: 'Tờ ghi m² 4,03 + giá/thùng 49.159 giống dòng BB nhôm kính 150(220) — cần soát lại với Kimpack',
  },
  {
    ma: 'PKN0265',
    sp: '21668-011',
    ten: 'HỘP CHÂN',
    mo: 'MR',
    sl: 400,
    dim: [690, 255, 65],
    m2: 0.6308,
    giaM2: 10_719,
    ttTo: 2_704_618,
    lenh: { '06': 400, '08': 0, '09': 0 },
  },
  {
    ma: 'BAO0143',
    sp: '21660-011, 26703-011',
    ten: 'BB bàn 150x(200) Nan Polywood',
    mo: 'AD',
    sl: 100,
    dim: [1525, 925, 110],
    m2: 4.14225,
    giaM2: 12_212,
    ttTo: 5_058_516,
    lenh: { '06': 100, '08': 0, '09': 0 },
    note: 'Layout bàn NK',
  },
  {
    ma: 'BB-0079',
    sp: '21660-011, 26703-011',
    ten: 'Hộp Chân 3L',
    mo: 'MR',
    sl: 100,
    dim: [670, 255, 65],
    m2: 0.6308,
    giaM2: 10_719,
    ttTo: 676_155,
    lenh: { '06': 100, '08': 0, '09': 0 },
  },
]

const TERMS = {
  terms_quality:
    'Đúng định lượng, Đúng quy cách, Thùng vuông góc, không rách móp ẩm mốc, in rõ đúng nội dung.',
  terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  terms_payment: 'Công nợ cuối tháng.',
  terms_invoice: 'Hóa đơn GTGT',
  terms_lead_time:
    'Giao hàng từ 7 đến 10 ngày kể từ ngày gởi đơn hàng.( không tính ngày lễ bà chủ nhật.)',
}

async function main() {
  // 1) Tiền: thành tiền tờ ↔ m² × giá/m² × SL (chưa tròn) — phải khớp từng dòng ±1đ.
  let tongTo = 0
  let tongHt = 0
  for (const [i, d] of DONG.entries()) {
    const raw = d.m2 * d.giaM2 * d.sl
    if (Math.abs(raw - d.ttTo) > 1)
      throw new Error(`dòng ${i + 1} lệch tờ: ${raw} vs ${d.ttTo}`)
    const chia = Object.values(d.lenh).reduce((s, x) => s + x, 0)
    if (chia !== d.sl) throw new Error(`dòng ${i + 1}: chia lệnh ${chia} ≠ SL ${d.sl}`)
    tongTo += d.ttTo
    tongHt += r2(d.m2 * d.giaM2) * d.sl
  }
  console.log(`Tờ (cộng từng dòng) ${tongTo.toLocaleString('vi-VN')} · tờ in 59.345.133 · hệ thống ${Math.round(tongHt).toLocaleString('vi-VN')}`) // prettier-ignore

  // 2) Lệnh, vật tư, người lập.
  const lsx: Record<string, string> = {}
  for (const k of ['06', '08', '09']) {
    const r = await one(
      db().from('production_orders').select('id').eq('code', `${k}/26-27 - MX`),
    )
    if (!r) throw new Error(`không thấy lệnh ${k}/26-27 - MX`)
    lsx[k] = (r as { id: string }).id
  }
  const vt = new Map<string, string>()
  for (const c of new Set(DONG.map((d) => d.ma))) {
    const r = await one(
      db().from('warehouse_materials').select('id, is_active').eq('code', c),
    )
    if (!r || !(r as { is_active: boolean }).is_active)
      throw new Error(`không thấy / ngưng ${c}`)
    vt.set(c, (r as { id: string }).id)
  }
  const users = await usersRepo.list()
  const nga = users.find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  if (!(await canAction(nga, 'supply.po.manage')))
    throw new Error('chị Nga thiếu quyền supply.po.manage')

  // 3) Chống nạp đôi theo số ĐH của NCC.
  const da = await one(
    db()
      .from('supply_purchase_orders')
      .select('code')
      .eq('supplier_id', NCC)
      .eq('supplier_doc_no', SO_DH)
      .neq('status', 'cancelled'),
  )
  if (da) return console.log(`ĐÃ NẠP: ${(da as { code: string }).code} — dừng.`)

  for (const [i, d] of DONG.entries())
    console.log(`  ${String(i + 1).padStart(2)} ${d.ma.padEnd(8)} ${d.ten.padEnd(32)} ${String(d.sl).padStart(4)} × ${r2(d.m2 * d.giaM2).toLocaleString('vi-VN')}  ${Object.entries(d.lenh).filter(([, q]) => q).map(([k, q]) => `L${k}:${q}`).join(' ')}`) // prettier-ignore
  console.log(`Đơn mới: KIMPACK · LSX chính 08 + phụ 09, 06 · carton · VAT 8% chưa gồm · Số ĐH ${SO_DH} · người lập ${nga.name}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const input = poCreateSchema.parse({
    production_order_id: lsx['08'],
    extra_lsx_ids: [lsx['09'], lsx['06']],
    supplier_id: NCC,
    template: 'carton',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    ...TERMS,
    lines: DONG.map((d) => {
      const chia = Object.entries(d.lenh).filter(([, q]) => q > 0)
      const chiLenh08 = chia.length === 1 && chia[0][0] === '08'
      return {
        material_id: vt.get(d.ma),
        product_code: d.sp,
        qty_ordered: d.sl,
        qty_demand: d.sl,
        unit_price: r2(d.m2 * d.giaM2),
        open_style: d.mo,
        pcs_per_ctn: 1,
        inner_l_mm: d.dim[0],
        inner_w_mm: d.dim[1],
        inner_h_mm: d.dim[2],
        area_m2: d.m2,
        price_per_m2: d.giaM2,
        carton_basis: 'ctn',
        note: [d.ten, d.note].filter(Boolean).join(' — '),
        lsx_split: chiLenh08
          ? null
          : chia.map(([k, q]) => ({ production_order_id: lsx[k], qty: q })),
      }
    }),
  })
  const po = await posService.create(nga, input)
  const { error } = await db()
    .from('supply_purchase_orders')
    .update({ supplier_doc_no: SO_DH })
    .eq('id', po.id)
  if (error) throw new Error(`ghi số ĐH: ${error.message}`)
  console.log(`✓ ${po.code} (nháp) — người lập ${nga.name}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
