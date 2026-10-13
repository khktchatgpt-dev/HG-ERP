/**
 * SỬA LẠI VĂN PHÒNG — 2 tờ đặt hàng ngoài lệnh, lên NHÁP cho chị Nga (12/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-sua-van-phong-1012.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-sua-van-phong-1012.ts --apply   # ghi
 *
 * Tờ 1: BG38070 Cách Nhiệt Tân Tâm (báo giá = đơn đặt) — 6 dòng, 7.673.417. Tờ có HAI
 *   mức thuế: panel EPS 8% (4.599.460 → 367.957), U nhôm + bo góc 10% (2.460.000 →
 *   246.000). Đơn mua chỉ có một VAT/đơn → TÁCH 2 ĐƠN cùng NCC, cùng hạng mục (user chốt).
 * Tờ 2: ĐH16869 EWIN Group — 7 dòng, 6.595.400, tờ để trống dòng thuế → "giá ĐÃ GỒM
 *   VAT 8%" (user chốt), tổng giữ nguyên.
 *
 * Chủ dự án chốt (12/10):
 *  · Một HẠNG MỤC ngoài sản xuất "Sửa lại văn phòng" (0230) — cả 3 đơn gắn vào đó.
 *  · Vật tư TÁCH quy cách / chất liệu / màu ra khỏi tên (tờ NCC dồn hết vào tên dòng).
 *  · Mẫu đơn theo loại hàng: Tân Tâm → Phụ kiện (Vật liệu + Quy cách); EWIN → Phụ
 *    tùng / bảo trì (cột "Model / Mã hãng" giữ mã hàng EWIN — NCC dò theo mã đó).
 * DOD0005 "Tấm cách nhiệt (Panel EPS 50)" có sẵn nhưng chung chung và chưa đơn nào
 * dùng → để nguyên, tạo mã panel vân gỗ riêng. Mọi thứ tạo qua service đứng tên chị
 * Nga; chạy lại không tạo đôi (NCC theo mã, vật tư theo tên + quy cách, đơn theo số tờ).
 * Danh mục CẤM trùng tên (bỏ dấu câu/khoảng trắng) nên hai tấm ốp 3m/4m mang chiều dài
 * trong tên — lượt chạy đầu vấp chỗ này sau khi đã tạo BB-0066…0069 (đổi tên BB-0069).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { supplierCreateSchema } from '@/modules/dept/supply/suppliers.schema'
import { projectsService } from '@/modules/dept/supply/projects.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'

const APPLY = process.argv.includes('--apply')
const HANG_MUC = 'Sửa lại văn phòng'
const NHOM = 'Văn phòng - nội bộ - bảo hộ'
const TIEU_NHOM = 'Vật tư xây dựng - hoàn thiện'

type Vt = {
  key: string
  name: string
  unit: string
  spec: string
  material_grade?: string
  finish?: string
  note?: string
  vat_rate: number
  last_purchase_price: number
}

// ── Danh mục: tên ngắn, thông số ra cột riêng ─────────────────────────────────
const VT: Vt[] = [
  { key: 'panel', name: 'Panel EPS 50mm tôn vân gỗ hai mặt', unit: 'M²', spec: 'Dày 50mm · khổ ngang 1,15m', material_grade: 'Tôn màu vân gỗ dày 0,25mm (±0,08) · lõi xốp EPS tỷ trọng 8kg/m³', finish: 'Hai mặt phẳng/gân · dán PE chống trầy 2 mặt', note: 'Cách Nhiệt Tân Tâm (BG38070). Lắp tấm theo chiều mũi tên để khớp ngàm, đồng màu.', vat_rate: 8, last_purchase_price: 151_000 }, // prettier-ignore
  { key: 'unhom', name: 'Nẹp U nhôm 50', unit: 'Mét', spec: 'Cho panel dày 50mm · cây 6m', material_grade: 'Nhôm', vat_rate: 10, last_purchase_price: 40_000 }, // prettier-ignore
  { key: 'bogoc', name: 'Nẹp bo góc ngoài panel', unit: 'Mét', spec: 'Cây 6m', vat_rate: 10, last_purchase_price: 90_000 }, // prettier-ignore
  { key: 'pvc3', name: 'Tấm ốp tường PVC dài 3m', unit: 'M²', spec: '400×9×3000mm', material_grade: 'Nhựa PVC', finish: 'Màu S26', note: 'Mã EWIN: TOT-S26 (3)', vat_rate: 8, last_purchase_price: 83_000 }, // prettier-ignore
  { key: 'pvc4', name: 'Tấm ốp tường PVC dài 4m', unit: 'M²', spec: '400×9×4000mm', material_grade: 'Nhựa PVC', finish: 'Màu S26', note: 'Mã EWIN: TOT-S26 (4)', vat_rate: 8, last_purchase_price: 83_000 }, // prettier-ignore
  { key: 'phaov', name: 'Phào V góc dương PVC', unit: 'Thanh', spec: '30×30×3000mm', material_grade: 'Nhựa PVC', finish: 'Màu S26', note: 'Mã EWIN: PGD-S26', vat_rate: 8, last_purchase_price: 23_500 }, // prettier-ignore
  { key: 'phaoam', name: 'Phào góc âm PVC', unit: 'Thanh', spec: '40×3000mm', material_grade: 'Nhựa PVC', finish: 'Màu S26', note: 'Mã EWIN: PGA-S26', vat_rate: 8, last_purchase_price: 23_500 }, // prettier-ignore
  { key: 'phaou', name: 'Phào kết thúc U tròn PVC', unit: 'Thanh', spec: '42×13×3000mm', material_grade: 'Nhựa PVC', finish: 'Màu S26', note: 'Mã EWIN: PHÀO U - S26', vat_rate: 8, last_purchase_price: 23_500 }, // prettier-ignore
  { key: 'ke', name: 'Ke inox thi công tấm ốp nano', unit: 'Túi', spec: 'Túi 100 cái', material_grade: 'Inox', note: 'Mã EWIN: KE INOX NANO', vat_rate: 8, last_purchase_price: 26_000 }, // prettier-ignore
  { key: 'keo', name: 'Keo dán miễn đinh King Bond E500', unit: 'Thùng', spec: 'Thùng 24 lọ', finish: 'Vàng ngà', note: 'Mã EWIN: KEO E500 - VÀNG NGÀ (NG.T)', vat_rate: 8, last_purchase_price: 576_000 }, // prettier-ignore
]

type Dong = { vt: string; qty: number; price: number; spec?: string; grade?: string; note?: string; amount: number } // prettier-ignore

// ── Ba đơn — `amount` là số NGUYÊN VĂN trên tờ, script so trước khi ghi ──────
const DON: {
  key: string
  doc: string
  ncc: 'TTAM' | 'EWIN'
  template: 'accessory' | 'mro'
  vat: number
  incl: boolean
  note: string
  payment?: string
  lines: Dong[]
  hang: number
  total: number
}[] = [
  {
    key: 'A',
    doc: 'BG38070',
    ncc: 'TTAM',
    template: 'accessory',
    vat: 8,
    incl: false,
    note: 'Theo báo giá BG38070 ngày 12/10/2026 — phần PANEL (thuế 8%). Phần U nhôm + bo góc (thuế 10%) ở đơn tách riêng cùng tờ. Đơn giá chưa gồm vận chuyển.',
    payment: 'Đặt cọc 30%, 70% thanh toán ngay khi nhận hàng',
    lines: [
      { vt: 'panel', qty: 25.67, price: 151_000, spec: '8 tấm × dài 2,79m × khổ 1,15m', amount: 3_876_170 }, // prettier-ignore
      { vt: 'panel', qty: 2.3, price: 151_000, spec: '2 tấm × dài 1,00m × khổ 1,15m', amount: 347_300 }, // prettier-ignore
      { vt: 'panel', qty: 1.79, price: 151_000, spec: '2 tấm × dài 0,78m × khổ 1,15m', amount: 270_290 }, // prettier-ignore
      { vt: 'panel', qty: 0.7, price: 151_000, spec: '1 tấm × dài 0,61m × khổ 1,15m', amount: 105_700 }, // prettier-ignore
    ],
    hang: 4_599_460,
    total: 4_967_417,
  },
  {
    key: 'B',
    doc: 'BG38070',
    ncc: 'TTAM',
    template: 'accessory',
    vat: 10,
    incl: false,
    note: 'Theo báo giá BG38070 ngày 12/10/2026 — phần U NHÔM + BO GÓC (thuế 10%). Phần panel (thuế 8%) ở đơn tách riêng cùng tờ. Đơn giá chưa gồm vận chuyển.',
    payment: 'Đặt cọc 30%, 70% thanh toán ngay khi nhận hàng',
    lines: [
      { vt: 'unhom', qty: 48, price: 40_000, spec: '8 cây × 6m', amount: 1_920_000 },
      { vt: 'bogoc', qty: 6, price: 90_000, spec: '1 cây × 6m', amount: 540_000 },
    ],
    hang: 2_460_000,
    total: 2_706_000,
  },
  {
    key: 'C',
    doc: 'ĐH16869',
    ncc: 'EWIN',
    template: 'mro',
    vat: 8,
    incl: true,
    note: 'Theo đơn đặt hàng ĐH16869 ngày 12/10/2026 (EWIN Group). Đổi hàng: miễn phí 3 ngày đầu, phí 5% từ ngày 4–30, sau 30 ngày không nhận đổi.',
    lines: [
      { vt: 'pvc3', qty: 40.8, price: 83_000, grade: 'TOT-S26 (3)', spec: '400×9×3000mm · màu S26', note: '34 tấm', amount: 3_386_400 }, // prettier-ignore
      { vt: 'pvc4', qty: 16, price: 83_000, grade: 'TOT-S26 (4)', spec: '400×9×4000mm · màu S26', note: '10 tấm', amount: 1_328_000 }, // prettier-ignore
      { vt: 'phaov', qty: 5, price: 23_500, grade: 'PGD - S26', spec: '30×30×3000mm · màu S26', amount: 117_500 }, // prettier-ignore
      { vt: 'phaoam', qty: 9, price: 23_500, grade: 'PGA - S26', spec: '40×3000mm · màu S26', amount: 211_500 }, // prettier-ignore
      { vt: 'phaou', qty: 36, price: 23_500, grade: 'PHÀO U - S26', spec: '42×13×3000mm · màu S26', amount: 846_000 }, // prettier-ignore
      { vt: 'ke', qty: 5, price: 26_000, grade: 'KE INOX NANO', spec: 'Túi 100 cái', amount: 130_000 }, // prettier-ignore
      { vt: 'keo', qty: 1, price: 576_000, grade: 'KEO E500 - VÀNG NGÀ (NG.T)', spec: 'Thùng 24 lọ · vàng ngà', amount: 576_000 }, // prettier-ignore
    ],
    hang: 6_595_400,
    total: 6_595_400,
  },
]

async function one<T>(q: PromiseLike<{ data: T[] | null }>): Promise<T | null> {
  const { data } = await q
  return data?.[0] ?? null
}
const vnd = (n: number) => n.toLocaleString('vi-VN')

async function main() {
  // 1) Tiền khớp TỜ tới từng đồng — lệch là dừng, không ghi gì.
  for (const d of DON) {
    for (const l of d.lines) {
      const a = Math.round(l.qty * l.price)
      if (a !== l.amount) throw new Error(`đơn ${d.key} ${l.vt}: ${a} ≠ tờ ${l.amount}`)
    }
    const hang = d.lines.reduce((s, l) => s + l.amount, 0)
    const total = d.incl ? hang : hang + Math.round((hang * d.vat) / 100)
    if (hang !== d.hang || total !== d.total)
      throw new Error(
        `đơn ${d.key}: hàng ${hang} / tổng ${total} ≠ tờ ${d.hang} / ${d.total}`,
      )
    console.log(`Đơn ${d.key} (${d.doc} · ${d.template} · VAT ${d.vat}%${d.incl ? ' đã gồm' : ''}): hàng ${vnd(hang)} → tổng ${vnd(total)} — khớp tờ`) // prettier-ignore
  }
  const tt = DON[0].total + DON[1].total
  if (tt !== 7_673_417) throw new Error(`Tân Tâm A+B ${tt} ≠ 7.673.417`)
  console.log(`Tân Tâm A + B = ${vnd(tt)} — khớp tổng tờ BG38070`)

  // 2) Chống nạp đôi theo số tờ.
  for (const doc of ['BG38070', 'ĐH16869']) {
    const da = await one(db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', doc)) // prettier-ignore
    if (da)
      return console.log(`ĐÃ NẠP tờ ${doc}: ${(da as { code: string }).code} — dừng.`)
  }

  // 3) Chị Nga + quyền.
  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  for (const k of [
    'supply.supplier.manage',
    'warehouse.material.create',
    'supply.po.manage',
  ] as const)
    // prettier-ignore
    if (!(await canAction(nga, k))) throw new Error(`chị Nga thiếu quyền ${k}`)

  // 4) Có sẵn thì dùng lại.
  const hm = await one(
    db().from('supply_projects').select('id,code').eq('name', HANG_MUC),
  )
  const ncc = new Map<string, string>()
  for (const c of ['TTAM', 'EWIN']) {
    const r = await one(db().from('supply_suppliers').select('id').eq('code', c))
    if (r) ncc.set(c, (r as { id: string }).id)
  }
  const vtId = new Map<string, string>()
  for (const v of VT) {
    const r = await one(db().from('warehouse_materials').select('id,code').eq('name', v.name).eq('spec', v.spec).eq('group_name', NHOM)) // prettier-ignore
    if (r) vtId.set(v.key, (r as { id: string }).id)
  }
  console.log(
    `Hạng mục: ${hm ? `dùng lại ${(hm as { code: string }).code}` : `TẠO MỚI "${HANG_MUC}"`}`,
  )
  console.log(`NCC: TTAM ${ncc.has('TTAM') ? 'dùng lại' : 'TẠO MỚI'} · EWIN ${ncc.has('EWIN') ? 'dùng lại' : 'TẠO MỚI'}`) // prettier-ignore
  for (const v of VT)
    console.log(`  Vật tư ${vtId.has(v.key) ? 'dùng lại' : 'MỚI   '} ${v.name} | ${v.spec} | ${v.unit} | ${v.material_grade ?? '—'} | ${v.finish ?? '—'}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  // 5) Ghi.
  const projectId = hm
    ? (hm as { id: string }).id
    : (await projectsService.create(nga, { name: HANG_MUC, kind: 'Sửa chữa văn phòng', currency: 'VND', note: 'Sửa lại văn phòng 10/2026 — panel EPS (Cách Nhiệt Tân Tâm) + ốp tường PVC (EWIN).' })).id // prettier-ignore

  if (!ncc.has('TTAM'))
    ncc.set('TTAM', (await suppliersService.create(nga, supplierCreateSchema.parse({ code: 'TTAM', name: 'Cách Nhiệt Tân Tâm', short_name: 'Tân Tâm', email: 'cachnhietantam@gmail.com', website: 'cachnhietantam.com', note: 'Tạo từ BG38070 (12/10/2026) — ảnh tờ cắt mất đầu: tên pháp lý, MST, địa chỉ, SĐT chờ bổ sung.' }))).id) // prettier-ignore
  if (!ncc.has('EWIN'))
    ncc.set('EWIN', (await suppliersService.create(nga, supplierCreateSchema.parse({ code: 'EWIN', name: 'Công ty Cổ phần EWIN Group', short_name: 'EWIN', address: 'Góc đường số 2 & đường số 3, Khu CN Hòa Cầm, TP Đà Nẵng', note: 'Tạo từ ĐH16869 (12/10/2026) — MST chờ bổ sung.' }))).id) // prettier-ignore

  for (const v of VT) {
    if (vtId.has(v.key)) continue
    const m = await materialsService.create(nga, { name: v.name, unit: v.unit, spec: v.spec, group_name: NHOM, sub_group: TIEU_NHOM, material_grade: v.material_grade ?? null, finish: v.finish ?? null, note: v.note ?? null, vat_rate: v.vat_rate, last_purchase_price: v.last_purchase_price }) // prettier-ignore
    vtId.set(v.key, m.id)
  }

  for (const d of DON) {
    const input = poCreateSchema.parse({
      production_order_id: null,
      project_id: projectId,
      supplier_id: ncc.get(d.ncc),
      template: d.template,
      currency: 'VND',
      vat_rate: d.vat,
      price_includes_vat: d.incl,
      note: d.note,
      terms_payment: d.payment ?? null,
      lines: d.lines.map((l) => ({
        material_id: vtId.get(l.vt),
        qty_ordered: l.qty,
        unit_price: l.price,
        spec: l.spec ?? null,
        material_grade: l.grade ?? VT.find((v) => v.key === l.vt)!.material_grade ?? null,
        note: l.note ?? null,
      })),
    })
    const po = await posService.create(nga, input)
    const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: d.doc }).eq('id', po.id) // prettier-ignore
    if (error) throw new Error(`số tờ ${d.key}: ${error.message}`)
    console.log(`✓ ${po.code} (nháp) — đơn ${d.key} · ${d.doc}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
