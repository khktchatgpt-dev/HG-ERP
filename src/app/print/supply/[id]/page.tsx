import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { PoPrintSheet } from '../PoPrintSheet'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { poLineAmount } from '@/lib/po-line'
import { shipmentAmount } from '@/lib/po-shipments'

/**
 * In ĐƠN ĐẶT HÀNG đã lưu — trang này chỉ NẠP DỮ LIỆU.
 *
 * Toàn bộ cách dựng tờ phiếu nằm ở `PoPrintSheet`, dùng chung với nút "Xem trước
 * phiếu in" trên form soạn đơn. Hai bản dựng riêng thì bản xem trước sẽ trôi
 * khỏi bản in thật, và người dùng tin vào thứ không phải cái sẽ gửi NCC.
 */
export default async function PoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const po = await posRepo.findById(id)
  if (!po) redirect('/planning/pos')
  const [lines, supplier, company, extraLsx, tpl, rawShipments] = await Promise.all([
    posRepo.listLines(id),
    suppliersRepo.findById(po.supplier_id),
    settingsService.getAll(),
    posRepo.listExtraLsx(id),
    docTemplatesService.get('PO'),
    poShipmentsRepo.listByPo(id),
  ])

  /*
   * LỊCH GIAO cho phiếu in (28/08): chỉ đợt còn sống; tiền đợt chia TỶ LỆ từ
   * thành tiền dòng (giá không đổi theo đợt — xem shipmentAmount, cùng phép
   * tính với thẻ "Kế hoạch giao" trên màn chi tiết, để giấy và màn khớp nhau).
   */
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const moneyByLine = new Map(
    lines.map((l) => [
      l.id,
      {
        amount: l.unit_price != null ? poLineAmount(l) : null,
        qty_ordered: l.qty_ordered,
        approx: l.price_basis === 'unit2',
      },
    ]),
  )
  const printShipments = rawShipments
    .filter((sh) => sh.status !== 'cancelled')
    .map((sh) => ({
      seq: sh.seq,
      expected_date: sh.expected_date,
      lines: sh.lines.map((l) => {
        const ref = lineById.get(l.po_line_id)
        const m = shipmentAmount([{ po_line_id: l.po_line_id, qty: l.qty }], moneyByLine)
        return {
          name: ref?.material_name ?? ref?.line_name ?? '?',
          qty: l.qty,
          unit: ref?.material_unit ?? ref?.line_unit ?? '',
          amount: m.priced ? m.amount : null,
        }
      }),
    }))
  /*
   * Tên NGƯỜI LẬP dưới nét ký. Ưu tiên người soạn đơn; đơn nạp từ dữ liệu cũ
   * không có `created_by` thì lấy người phụ trách (0128) — thà đúng một người
   * đang cầm đơn còn hơn để trống nét ký trên tờ gửi NCC.
   */
  const creator = po.created_by ? await usersRepo.findById(po.created_by) : null
  const creatorName = creator ? (creator.name ?? creator.email) : po.assignee_name

  // Đơn gộp nhiều LSX (0125): phiếu ghi "LSX 04.26.27 + 02.26.27" như sổ thật.
  const lsxCode =
    [po.lsx_code, ...extraLsx.map((e) => e.code)].filter(Boolean).join(' + ') || null

  return (
    <PoPrintSheet
      company={company}
      tpl={tpl}
      shipments={printShipments}
      po={{
        ...po,
        template: po.template ?? 'simple',
        lsx_code: lsxCode,
        creator_name: creatorName,
      }}
      supplier={supplier}
      lines={lines}
      exportHref={`/api/dept/supply/pos/${id}/export`}
    />
  )
}
