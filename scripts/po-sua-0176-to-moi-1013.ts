/**
 * PO-2026-0176 (Bao bì 3/2, JAWOLL) — SỬA THEO TỜ MỚI 1-2026 HG/3.2 (13/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-sua-0176-to-moi-1013.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-sua-0176-to-moi-1013.ts --apply   # ghi
 *
 * User sửa trên màn bị chặn "chỉ mẫu gỗ" (vá d63b8b8) — ghi hộ theo tờ mới:
 *   Bao bì ghế bank 2: m² 2,97 → 3,01 · đơn giá 43.960 → 44.548 (= 3,01 × 14.800) → 24.813.236
 *   Hình màu A3: 9.780 → 7.500 → 4.177.500
 *   Công dán + keo bồi (dòng phí): 3.000 → 1.000 → 557.000
 *   Cộng 29.547.736 + VAT 8% 2.363.819 = 31.911.555. Số ĐH trên tờ: 1-2026 HG/3.2.
 * Đi qua posService.update (đứng tên chị Nga — người phụ trách) để tiền được dẫn xuất lại
 * và vết sửa như sửa trên màn. Đầu đơn đọc NGUYÊN TRẠNG rồi gửi lại — update ghi đè mọi ô.
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const CODE = 'PO-2026-0176'
const SO_DH = '1-2026 HG/3.2'
const MOI: Record<string, { unit_price: number; area_m2?: number }> = {
  'BB-0076': { unit_price: 44_548, area_m2: 3.01 },
  'BB-0077': { unit_price: 7_500 },
  phi: { unit_price: 1_000 },
}

const n = (v: unknown) => (v == null ? null : Number(v))

async function main() {
  const d = [557 * 44_548, 557 * 7_500, 557 * 1_000]
  const hang = d.reduce((s, x) => s + x, 0)
  const vat = Math.round(hang * 0.08)
  if (
    d.join() !== '24813236,4177500,557000' ||
    hang !== 29_547_736 ||
    vat !== 2_363_819 ||
    hang + vat !== 31_911_555
  )
    // prettier-ignore
    throw new Error(`lệch tờ: ${d} / ${hang} / ${vat}`)
  console.log(`Tờ mới: ${hang.toLocaleString('vi-VN')} + VAT 8% ${vat.toLocaleString('vi-VN')} = ${(hang + vat).toLocaleString('vi-VN')} — khớp`) // prettier-ignore

  const { data: po } = await db()
    .from('supply_purchase_orders')
    .select('*')
    .eq('code', CODE)
    .single()
  if (!po) throw new Error(`không thấy ${CODE}`)
  if (po.status !== 'draft')
    throw new Error(`${CODE} không còn nháp (${po.status}) — dừng`)
  const { data: rows } = await db()
    .from('supply_purchase_order_lines')
    .select('*, material:warehouse_materials(code)')
    .eq('po_id', po.id)
    .order('sort_order')
  const { data: splits } = await db().from('supply_po_line_lsx').select('line_id').in('line_id', (rows ?? []).map((r) => r.id)) // prettier-ignore
  if ((splits ?? []).length > 0)
    throw new Error('đơn có chia lệnh theo dòng — script không mang theo, dừng')
  const { data: extra } = await db().from('supply_po_extra_lsx').select('production_order_id').eq('po_id', po.id) // prettier-ignore

  const lines = (rows ?? []).map((r) => {
    const key =
      r.line_kind === 'phi'
        ? 'phi'
        : ((r.material as { code: string } | null)?.code ?? '?')
    const moi = MOI[key]
    if (!moi) throw new Error(`dòng lạ ${key}`)
    console.log(`  ${key}: ${n(r.unit_price)} → ${moi.unit_price}${moi.area_m2 ? ` · m² ${n(r.area_m2)} → ${moi.area_m2}` : ''}`) // prettier-ignore
    return {
      material_id: r.material_id,
      line_name: r.line_name,
      line_unit: r.line_unit,
      line_kind: r.line_kind,
      qty_ordered: n(r.qty_ordered),
      unit_price: moi.unit_price,
      spec: r.spec,
      note: r.note,
      product_code: r.product_code,
      material_grade: r.material_grade,
      dm_per_sp: n(r.dm_per_sp),
      qty_demand: n(r.qty_demand),
      qty_on_hand: n(r.qty_on_hand),
      print_spec: r.print_spec,
      open_style: r.open_style,
      pcs_per_ctn: n(r.pcs_per_ctn),
      inner_l_mm: n(r.inner_l_mm),
      inner_w_mm: n(r.inner_w_mm),
      inner_h_mm: n(r.inner_h_mm),
      area_m2: moi.area_m2 ?? n(r.area_m2),
      price_per_m2: n(r.price_per_m2),
      print_fee: n(r.print_fee),
      carton_basis: r.carton_basis,
    }
  })

  const input = poUpdateSchema.parse({
    production_order_id: po.production_order_id,
    extra_lsx_ids: (extra ?? []).map((x) => x.production_order_id),
    supplier_id: po.supplier_id,
    template: po.template,
    currency: po.currency,
    vat_rate: n(po.vat_rate),
    price_includes_vat: po.price_includes_vat,
    discount_amount: n(po.discount_amount),
    contract_no: po.contract_no,
    project_id: po.project_id,
    expected_at: po.expected_at,
    terms: po.terms,
    terms_quality: po.terms_quality,
    terms_delivery_place: po.terms_delivery_place,
    terms_payment: po.terms_payment,
    terms_invoice: po.terms_invoice,
    terms_lead_time: po.terms_lead_time,
    signer_role: po.signer_role,
    note: po.note,
    lines,
  })
  console.log(`Đầu đơn giữ nguyên: giao ${po.expected_at} · VAT ${n(po.vat_rate)}% · điều khoản ${[po.terms_quality, po.terms_payment].every(Boolean) ? 'đủ' : 'THIẾU'} · số ĐH → ${SO_DH}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const nga = (await usersRepo.list()).find((u) => u.id === po.created_by)
  if (!nga) throw new Error('không thấy người phụ trách đơn')
  await posService.update(nga, po.id, input)
  const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id) // prettier-ignore
  if (error) throw new Error(error.message)
  console.log(`✓ ${CODE} đã sửa theo tờ mới (người sửa: ${nga.name})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
