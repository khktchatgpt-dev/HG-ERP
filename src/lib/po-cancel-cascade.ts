/**
 * HUỶ ĐƠN KHÁCH → LỆNH BỊ HUỶ → ĐƠN MUA XỬ LÝ THẾ NÀO. Logic thuần, có test.
 *
 * Bản đầu (orders.service.cancel, P3) chỉ nhìn cột `production_order_id` của đơn
 * mua và tự huỷ mọi đơn chưa gửi NCC. Nó KHÔNG biết đơn mua gộp nhiều lệnh
 * (0125, `supply_po_extra_lsx`) — đo 27/09/2026 có 3 đơn gộp lệnh 10:
 *   · huỷ khách của LỆNH CHÍNH → huỷ luôn cả đơn gộp, mất phần hàng lệnh kia
 *     vẫn cần (PO-0097 bao bì 3/2 phục vụ cả lệnh 09 lẫn 10);
 *   · huỷ khách của LỆNH GỘP → không thấy đơn, không ai được báo;
 *   · đơn NHÁP → bỏ quên, treo trên một lệnh đã chết.
 *
 * Luật mới — chỉ TỰ HUỶ khi chắc chắn không làm hại ai:
 *   · đơn phục vụ DUY NHẤT lệnh bị huỷ + chưa gửi NCC (chờ duyệt / đã duyệt) → huỷ;
 *   · mọi trường hợp còn lại còn sống → Cung ứng XỬ LÝ TAY, kèm câu nói rõ việc.
 * Đơn đã nhận đủ / đã huỷ / đã đóng → không đụng.
 */

export type CascadePo = {
  id: string
  code: string
  status: string
  production_order_id: string | null
  /** Lệnh gộp thêm (0125). */
  extra_lsx_ids: string[]
}

export type CascadeAction =
  | { id: string; code: string; action: 'cancel' }
  | { id: string; code: string; action: 'manual'; why: string }

const UNSENT = ['pending_approval', 'approved']
const SENT = ['ordered', 'confirmed', 'in_transit', 'partial']

export function planPoCascade(
  pos: CascadePo[],
  cancelledLsxId: string,
  lsxCode: (id: string) => string,
): CascadeAction[] {
  const out: CascadeAction[] = []
  for (const po of pos) {
    const lsxIds = [
      ...new Set(
        [po.production_order_id, ...po.extra_lsx_ids].filter((x): x is string => !!x),
      ),
    ]
    if (!lsxIds.includes(cancelledLsxId)) continue
    const alive =
      po.status === 'draft' || UNSENT.includes(po.status) || SENT.includes(po.status)
    if (!alive) continue

    const others = lsxIds.filter((x) => x !== cancelledLsxId)
    const gone = lsxCode(cancelledLsxId)
    if (others.length > 0) {
      const mainGone = po.production_order_id === cancelledLsxId
      out.push({
        id: po.id,
        code: po.code,
        action: 'manual',
        why:
          `gộp cả lệnh ${others.map(lsxCode).join(' + ')} — giảm phần của lệnh ${gone} hay giữ lại` +
          (mainGone
            ? `; lệnh chính đã huỷ, chuyển ${lsxCode(others[0])} lên làm lệnh chính`
            : '') +
          (SENT.includes(po.status) ? '; đơn đã gửi NCC, báo NCC nếu giảm' : ''),
      })
      continue
    }
    if (po.status === 'draft') {
      out.push({ id: po.id, code: po.code, action: 'manual', why: 'đơn nháp — xoá hoặc chuyển sang lệnh khác' }) // prettier-ignore
    } else if (UNSENT.includes(po.status)) {
      out.push({ id: po.id, code: po.code, action: 'cancel' })
    } else {
      out.push({ id: po.id, code: po.code, action: 'manual', why: 'đã gửi NCC — báo NCC huỷ hoặc giảm' }) // prettier-ignore
    }
  }
  return out
}
