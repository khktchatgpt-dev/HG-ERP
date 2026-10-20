/**
 * NHẬP KHO HỘ ĐƠN BÌ NHỰA HÀ BÍCH PO-2026-0110 — 30/09/2026.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-nhap-kho-habich-0930.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-nhap-kho-habich-0930.ts --apply   # ghi
 *
 * Chị Nga báo hàng đã về nhưng chưa kịp xử lý đơn trên hệ thống; yêu cầu "cho
 * nhập kho luôn, anh Hào đang quản lý kho".
 *
 * 1. Đơn còn NHÁP → ghi hộ đã ký duyệt (Vũ Phương Thảo) + đã gửi NCC, đúng khuôn
 *    `po-import-habich-lsx0626-0930.mjs --da-gui` (approval_events + status
 *    'ordered'). Phiếu nhập chỉ nhận được đơn đã gửi (RECEIVABLE).
 * 2. Lập PHIẾU NHẬP bằng CHÍNH `stockService.createReceiptDoc` — đứng tên Lê Khắc
 *    Hào (wh1) — để service tự lo khu tiếp nhận, trạng thái kiểm, giá vốn dòng,
 *    tính lại trạng thái đơn (BR-08). Không ghi thẳng bảng movement.
 *    Số lượng = số Kg trên tờ đơn (chưa có số cân riêng); lệch thì Kho lập phiếu
 *    điều chỉnh/đảo trên app. Event bus không đăng ký trong script → không phát
 *    thông báo (việc ghi hộ, báo lại là nhiễu).
 */
import { db } from '@/server/db'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import type { User } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const PO_CODE = 'PO-2026-0110'
const KEEPER_EMAIL = 'wh1@hoanggia.de' // Lê Khắc Hào — quản lý kho
const APPROVER_EMAIL = 'ketoan2@hoanggia.de' // Vũ Phương Thảo
const DOC_DATE = '2026-09-30'

async function main() {
  const sb = db()
  const one = async (email: string) => {
    const { data, error } = await sb.from('users').select('*').eq('email', email).single()
    if (error || !data) throw new Error(`không thấy ${email}`)
    return data as User
  }
  const [keeper, approver] = await Promise.all([one(KEEPER_EMAIL), one(APPROVER_EMAIL)])
  const { data: po, error } = await sb
    .from('supply_purchase_orders')
    .select(
      'id, code, status, assigned_to, created_by, supplier_doc_no, sup:supply_suppliers(name)',
    )
    .eq('code', PO_CODE)
    .single()
  if (error || !po) throw new Error(`không thấy ${PO_CODE}`)
  const { data: lines, error: le } = await sb
    .from('supply_purchase_order_lines')
    .select(
      'id, material_id, qty_ordered, unit_price, sort_order, m:warehouse_materials(code, name, unit)',
    )
    .eq('po_id', po.id)
    .order('sort_order')
  if (le || !lines?.length) throw new Error('đơn không có dòng')

  const supName = (po.sup as unknown as { name: string } | null)?.name ?? ''
  console.log(`${po.code} · ${supName} · ${po.supplier_doc_no} · trạng thái ${po.status}`)
  if (po.status === 'draft')
    console.log(`  → ghi hộ: ${approver.name} ký duyệt · đã gửi NCC`)
  else if (po.status !== 'ordered' && po.status !== 'confirmed')
    throw new Error(`Đơn đang "${po.status}" — không nhập hộ bằng script`)
  console.log(`  → phiếu nhập ngày ${DOC_DATE}, người lập ${keeper.name}:`)
  for (const l of lines) {
    const m = l.m as unknown as { code: string; name: string; unit: string }
    console.log(`     ${m.code} ${m.name.padEnd(18)} ${l.qty_ordered} ${m.unit}`)
  }
  if (!APPLY) {
    console.log('\n(dò khô — thêm --apply để ghi)')
    return
  }

  if (po.status === 'draft') {
    const now = Date.now()
    const at = (m: number) => new Date(now + m * 60_000).toISOString()
    const reason =
      'Ghi hộ 30/09/2026: đơn đã ký và gửi NCC ngoài hệ thống, hàng đã về. Ngày ký thật không ghi được nên mốc là lúc ghi hộ.'
    const { error: ee } = await sb.from('approval_events').insert([
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'submitted', actor_id: po.assigned_to ?? po.created_by, created_at: at(0), reason: 'Ghi hộ 30/09/2026 — đơn đã trình ký ngoài hệ thống.' }, // prettier-ignore
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'approved', actor_id: approver.id, created_at: at(1), reason }, // prettier-ignore
    ])
    if (ee) throw new Error(`nhật ký duyệt: ${ee.message}`)
    const { error: ue } = await sb
      .from('supply_purchase_orders')
      .update({
        status: 'ordered',
        approved_by: approver.id,
        approved_at: at(1),
        ordered_at: at(2),
      })
      .eq('id', po.id)
      .eq('status', 'draft')
    if (ue) throw new Error(`trạng thái đơn: ${ue.message}`)
    console.log(`✓ ${po.code} đã ký duyệt + đã gửi NCC (ghi hộ)`)
  }

  const res = await stockService.createReceiptDoc(keeper, {
    po_id: po.id,
    counterparty: supName,
    supplier_doc_no: po.supplier_doc_no,
    doc_date: DOC_DATE,
    note: 'Nhập hộ 30/09/2026 theo chỉ đạo — hàng đã về trước khi đơn được xử lý trên hệ thống. Số lượng theo Kg trên tờ đơn.',
    lines: lines.map((l) => ({
      material_id: l.material_id as string,
      qty: Number(l.qty_ordered),
      po_line_id: l.id,
    })),
  })
  console.log(`✓ Phiếu nhập ${res.code} · đơn → ${res.po_status}`)
  for (const s of res.stock_after)
    console.log(
      `     ${s.code} ${s.name.padEnd(18)} +${s.received} → tồn ${s.on_hand} ${s.unit}`,
    )
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
