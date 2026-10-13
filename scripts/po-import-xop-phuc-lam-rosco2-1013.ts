/**
 * ĐƠN XỐP PHÚC LÂM — LSX 02/26-27 - ROSCO, Số ĐH 1/2026- HG/DS, HĐ 1-2026 (13/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-xop-phuc-lam-rosco2-1013.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-xop-phuc-lam-rosco2-1013.ts --apply   # ghi
 *
 * Tờ (ảnh chủ dự án gửi 13/10): 4 dòng xốp D18 · 255.821.600 + VAT 8% 20.465.728 = 276.287.328.
 * Tờ ghi "LSX 2 - ROSCO CHELSEA" = lệnh 02/26-27 - ROSCO (đã soát ở lần nạp PO-2026-0088, 25/09).
 *
 * Chủ dự án chốt (13/10):
 *  · Bốn món này TỪNG nằm trên nháp PO-2026-0088 (Danh Sơn, cùng Số ĐH) → TÁCH 4 dòng khỏi
 *    PO-0088 (Danh Sơn còn 3 dòng tính m³) và bỏ trống Số ĐH + HĐ ở PO-0088 để không trùng.
 *    Sao lưu JSON PO-0088 trước khi sửa. 4 dòng không có đợt giao / chia lệnh / kho / hoá đơn.
 *  · Tờ ghi D18 cả 4 dòng; MUT0551/0552/0553 tên ghi D20 → TẠO 3 MÃ MỚI D18 (ĐVT "Thanh" cho
 *    cùng họ MUT0551…0557). Mặt bàn tròn dùng MUT0557 (đã là D18).
 *  · Số ĐH + HĐ ghi vào đơn Phúc Lâm. Nháp, người lập chị Nga. Hạn giao: tờ ghi "theo kế
 *    hoạch từng đợt" nên để trống.
 *
 * "SL đơn hàng" = số SP (qty_demand) × Đm/sp (dm_per_sp) — quy ước từ 26/09 (`suggestOrderQty`).
 * Dòng 3: tờ ghi SL đặt 7.982 trong khi 1.996 × 4 = 7.984 — giữ đúng tờ (thành tiền 70.241.600
 * khớp 7.982), màn đơn sẽ nhắc "thiếu 2 so với nhu cầu".
 */
import { writeFileSync } from 'node:fs'
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'

const APPLY = process.argv.includes('--apply')
const NCC = 'ae33d1fe-0381-421c-b8a8-dc65b16ed20d' // CÔNG TY TNHH SX VÀ TM PHÚC LÂM (PL, MST 4101566543)
const LSX = '02/26-27 - ROSCO'
const SO_DH = '1/2026- HG/DS'
const HD = '1-2026'
const PO_CU = 'PO-2026-0088'
const BO_KHOI_PO_CU = ['MUT0551', 'MUT0552', 'MUT0553', 'MUT0557']
const NHOM = 'Mút - xốp - nệm - gòn'
const BACKUP = process.env.BACKUP_DIR ?? '.'

/** Ba mã D18 mới — tạo nếu chưa có (chạy lại không tạo trùng: tra theo tên). */
const MA_MOI = [
  { key: 'u200', name: 'Xốp U khe 35mm 200x100x130 D18', spec: '200×100×130' },
  { key: 'u1200', name: 'Xốp U khe 35mm 1200x100x130 D18', spec: '1200×100×130' },
  { key: 'goc', name: 'Xốp góc khe 35mm 200x200x130 D18', spec: '200×200×130' },
] as const

const TERMS = {
  terms_quality:
    'Quy cách: như thông tin trên đơn đặt hàng. Chất lượng: đúng như mẫu đã duyệt.',
  terms_invoice: 'Hoá đơn GTGT',
  terms_delivery_place: 'Tại Công ty TNHH SX & TM Hoàng Gia',
  terms_lead_time: 'Giao theo kế hoạch từng đợt. Thời gian sẽ thông tin cụ thể qua Zalo.',
  terms_payment: 'Khối lượng thanh toán: theo số lượng thực nhận và đạt chất lượng.',
  note:
    'Đóng gói/Bảo quản: đóng bao hoặc bọc nilon theo từng mã. Ghi KT và SL từng mã cụ thể.\n' +
    'Bảo hành - Đổi trả: hàng lỗi, sai quy cách đổi trả trong vòng 1 tuần.',
}

async function one<T>(q: PromiseLike<{ data: T[] | null }>): Promise<T | null> {
  const { data } = await q
  return data?.[0] ?? null
}

async function main() {
  // 1) Tiền khớp TỜ tới từng đồng.
  const d = [3744 * 4_500, 4380 * 26_400, 7982 * 8_800, 3540 * 15_000]
  const hang = d.reduce((s, x) => s + x, 0)
  const vat = Math.round(hang * 0.08)
  if (
    d.join() !== '16848000,115632000,70241600,53100000' ||
    hang !== 255_821_600 ||
    vat !== 20_465_728 ||
    hang + vat !== 276_287_328
  )
    throw new Error(`lệch tờ: ${d} / ${hang} / ${vat}`)
  console.log(`Tiền hàng ${hang.toLocaleString('vi-VN')} + VAT 8% ${vat.toLocaleString('vi-VN')} = ${(hang + vat).toLocaleString('vi-VN')} — khớp tờ`) // prettier-ignore

  // 2) Chống nạp đôi: Phúc Lâm đã có đơn mang Số ĐH này thì dừng.
  const da = await one(
    db().from('supply_purchase_orders').select('code').eq('supplier_id', NCC).eq('supplier_doc_no', SO_DH), // prettier-ignore
  )
  if (da) return console.log(`ĐÃ NẠP: ${(da as { code: string }).code} — dừng.`)

  const lsx = await one(db().from('production_orders').select('id').eq('code', LSX))
  if (!lsx) throw new Error(`không thấy lệnh ${LSX}`)
  const lsxId = (lsx as { id: string }).id

  const users = await usersRepo.list()
  const nga = users.find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  if (!(await canAction(nga, 'supply.po.manage'))) throw new Error('chị Nga thiếu quyền supply.po.manage') // prettier-ignore

  // 3) PO-0088: phải còn là NHÁP của Danh Sơn, 4 dòng cần gỡ không có gì bám vào.
  const cu = await one(db().from('supply_purchase_orders').select('*').eq('code', PO_CU))
  if (!cu) throw new Error(`không thấy ${PO_CU}`)
  const cuPo = cu as { id: string; status: string; supplier_doc_no: string | null }
  if (cuPo.status !== 'draft') throw new Error(`${PO_CU} không còn nháp (${cuPo.status}) — dừng, hỏi lại`) // prettier-ignore
  const { data: cuLines } = await db()
    .from('supply_purchase_order_lines')
    .select('*, mat:warehouse_materials(code)')
    .eq('po_id', cuPo.id)
  const goLines = (cuLines ?? []).filter((l) =>
    BO_KHOI_PO_CU.includes((l as { mat: { code: string } | null }).mat?.code ?? ''),
  ) as { id: string; mat: { code: string } }[]
  if (goLines.length !== 4) throw new Error(`${PO_CU}: thấy ${goLines.length}/4 dòng cần gỡ — dừng`) // prettier-ignore
  const ids = goLines.map((l) => l.id)
  for (const [t, c] of [
    ['supply_po_line_lsx', 'line_id'],
    ['supply_po_shipment_lines', 'po_line_id'],
    ['warehouse_movements', 'po_line_id'],
    ['supply_po_issues', 'po_line_id'],
    ['supply_lsx_material_plan', 'po_line_id'],
    ['accounting_supplier_invoice_lines', 'po_line_id'],
  ] as const) {
    const { count } = await db()
      .from(t)
      .select('*', { count: 'exact', head: true })
      .in(c, ids)
    if (count == null || count > 0) throw new Error(`${PO_CU}: dòng cần gỡ đang bám ${t} (${count}) — dừng`) // prettier-ignore
  }

  // 4) Mã: 3 mã D18 (có rồi thì dùng lại) + MUT0557.
  const vt = new Map<string, string>()
  const tao: string[] = []
  for (const m of MA_MOI) {
    const co = await one(
      db().from('warehouse_materials').select('id, code').eq('name', m.name),
    )
    if (co) vt.set(m.key, (co as { id: string }).id)
    else tao.push(m.name)
  }
  const ban = await one(
    db().from('warehouse_materials').select('id').eq('code', 'MUT0557'),
  )
  if (!ban) throw new Error('không thấy MUT0557')
  vt.set('ban', (ban as { id: string }).id)

  console.log(`Mã mới sẽ tạo: ${tao.length ? tao.join(' · ') : '(đã có đủ)'}`)
  console.log(`${PO_CU}: gỡ ${goLines.map((l) => l.mat.code).join(', ')} · còn ${(cuLines ?? []).length - 4} dòng · bỏ trống Số ĐH "${cuPo.supplier_doc_no}" + HĐ`) // prettier-ignore
  console.log(`Đơn mới: NCC Phúc Lâm · ${LSX} · xốp · VAT 8% chưa gồm · Số ĐH ${SO_DH} · HĐ ${HD} · người lập ${nga.name}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  // ── GHI ─────────────────────────────────────────────────────────────
  const file = `${BACKUP}/po-sua-${PO_CU}-1013.json`
  writeFileSync(file, JSON.stringify({ po: cu, lines: cuLines }, null, 2))
  console.log(`✓ sao lưu ${PO_CU} → ${file}`)

  for (const m of MA_MOI) {
    if (vt.has(m.key)) continue
    const r = await materialsService.create(nga, {
      name: m.name,
      unit: 'Thanh',
      spec: m.spec,
      group_name: NHOM,
      material_grade: 'D18',
      po_template: 'foam',
    })
    vt.set(m.key, r.id)
    console.log(`✓ tạo ${r.code} · ${m.name}`)
  }

  const input = poCreateSchema.parse({
    production_order_id: lsxId,
    supplier_id: NCC,
    template: 'foam',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    contract_no: HD,
    ...TERMS,
    lines: [
      { material_id: vt.get('u200'), qty_ordered: 3744, unit_price: 4_500, carton_basis: 'ctn', spec: '200x100x130', material_grade: 'D18', qty_demand: 1872, dm_per_sp: 2, note: '1/ 2240 Bàn CN Ibiza' }, // prettier-ignore
      { material_id: vt.get('u1200'), qty_ordered: 4380, unit_price: 26_400, carton_basis: 'ctn', spec: '1200x100x130', material_grade: 'D18', qty_demand: 2190, dm_per_sp: 2, note: '1/ 2240 Bàn CN Ibiza' }, // prettier-ignore
      { material_id: vt.get('goc'), qty_ordered: 7982, unit_price: 8_800, carton_basis: 'ctn', spec: '200x200x130', material_grade: 'D18', qty_demand: 1996, dm_per_sp: 4, note: '1/ 2240 Bàn CN Ibiza · tờ ghi SL đặt 7.982 (1.996 × 4 = 7.984)' }, // prettier-ignore
      { material_id: vt.get('ban'), qty_ordered: 3540, unit_price: 15_000, carton_basis: 'ctn', spec: 'Phi 720x720x20', material_grade: 'D18', qty_demand: 1770, dm_per_sp: 2, note: '1/ 1950 bàn tròn' }, // prettier-ignore
    ],
  })

  // Gỡ Số ĐH + HĐ khỏi PO-0088 TRƯỚC khi đơn mới mang nó (chống trùng), rồi gỡ 4 dòng.
  {
    const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: null, contract_no: null }).eq('id', cuPo.id) // prettier-ignore
    if (error) throw new Error(error.message)
  }
  {
    const { error } = await db()
      .from('supply_purchase_order_lines')
      .delete()
      .in('id', ids)
    if (error) throw new Error(error.message)
    console.log(`✓ ${PO_CU}: đã gỡ 4 dòng, bỏ trống Số ĐH + HĐ`)
  }

  const po = await posService.create(nga, input)
  const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id) // prettier-ignore
  if (error) throw new Error(error.message)
  console.log(`✓ ${po.code} (nháp) — người lập ${nga.name}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
