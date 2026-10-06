import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { posRepo } from './pos.repo'
import { poAdjustmentsRepo } from './po-adjustments.repo'
import { poShipmentsRepo } from './po-shipments.repo'
import { suppliersRepo } from './supply.repo'
import { poRevisionLabel } from '@/lib/po-lsx-refs'
import { poLineAmount } from '@/lib/po-line'
import { shipmentAmount } from '@/lib/po-shipments'
import { poStampGuard } from '@/lib/po-stamp'
import { storage } from '@/modules/core/files/storage'

/**
 * DỮ LIỆU MỘT TỜ ĐƠN ĐẶT HÀNG — MỘT nguồn cho cả phiếu in (`/print/supply/[id]`)
 * lẫn file Excel (`pos/[id]/export`), 05/10/2026.
 *
 * Trước đây hai nơi tự nạp riêng và đã trôi khỏi nhau: Excel gõ cứng tiêu đề +
 * khối chữ ký (không theo mẫu chứng từ 0164, không có tên người lập), thiếu dòng
 * "Hẹn giao", thiếu lịch giao theo đợt. Người dùng in từ Excel ra một tờ khác
 * tờ in từ web. Nạp chung thì thêm gì vào phiếu là Excel có theo.
 *
 * Không gác quyền ở đây — trang in và route xuất tự gác đăng nhập như cũ.
 */
export async function loadPoPrint(id: string, opts: { withStamp?: boolean } = {}) {
  const po = await posRepo.findById(id)
  if (!po) return null
  const [lines, supplier, company, refs, tpl, rawShipments, adjs, creator, stampCfg] =
    await Promise.all([
      posRepo.listLines(id),
      suppliersRepo.findById(po.supplier_id),
      settingsService.getAll(),
      posRepo.printRefs(po),
      docTemplatesService.get('PO'),
      poShipmentsRepo.listByPo(id),
      poAdjustmentsRepo.listByPo(id),
      po.created_by ? usersRepo.findById(po.created_by) : Promise.resolve(null),
      // Excel KHÔNG nhận dấu: file sửa được thì dấu nằm trên số ai cũng đổi được.
      opts.withStamp ? settingsService.poStamp() : Promise.resolve(null),
    ])

  /*
   * DẤU + CHỮ KÝ GIÁM ĐỐC (06/10/2026) — luật ở lib/po-stamp. Ảnh nhúng thẳng
   * thành data URL, chỉ tải khi luật cho phép: đơn không đủ điều kiện thì ảnh
   * không bao giờ rời Storage. Tải hỏng thì in ô trống + nói lý do, không vỡ trang.
   */
  let stamp: { src: string } | null = null
  let stampNote: string | null = null
  if (opts.withStamp) {
    const g = poStampGuard(po, stampCfg, adjs, po.approver_name)
    if (g.ok && stampCfg) {
      const src = await storage.downloadDataUrl('private', stampCfg.path)
      if (src) stamp = { src }
      else stampNote = 'Không tải được ảnh dấu — in ra ký tay'
    } else if (!g.ok) {
      stampNote = g.reason
    }
  }

  /*
   * LỊCH GIAO (28/08): chỉ đợt còn sống; tiền đợt chia TỶ LỆ từ thành tiền dòng
   * (giá không đổi theo đợt — xem shipmentAmount, cùng phép tính với thẻ "Kế
   * hoạch giao" trên màn chi tiết, để giấy và màn khớp nhau).
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
  const shipments = rawShipments
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
  const creatorName = creator ? (creator.name ?? creator.email) : po.assignee_name

  return {
    company,
    tpl,
    shipments,
    stamp,
    stampNote,
    supplier,
    lines,
    // Đơn gộp nhiều LSX (0125): phiếu ghi "LSX 04.26.27 + 02.26.27" như sổ thật.
    po: {
      ...po,
      template: po.template ?? 'simple',
      lsx_code: refs.lsx_code,
      order_code: refs.order_code,
      revision_label: poRevisionLabel(adjs),
      creator_name: creatorName,
    },
  }
}
