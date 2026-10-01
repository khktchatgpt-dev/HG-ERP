/**
 * ĐƠN MUA SAU CHỮ KÝ — luật thuần cho bốn việc chủ dự án chốt 01/10/2026:
 * thu hồi chữ ký, gửi gấp ký bù, hỏi lại, yêu cầu xem lại.
 *
 * KHÔNG THÊM TRẠNG THÁI ĐƠN. Thu hồi chữ ký là một chuyển tiếp (approved →
 * pending_approval); gửi gấp là đơn đi thẳng sang ordered mà chưa có chữ ký;
 * câu hỏi là một CỜ trên đơn, không phải một bước. Chín trạng thái giữ nguyên
 * nên bộ lọc, nhãn, báo cáo không phải sửa.
 *
 * Thuần để test được mọi nhánh — service gọi đúng các hàm này, nút ở màn cũng
 * gọi đúng các hàm này, nên câu "vì sao không bấm được" ở nút và câu lỗi của
 * server luôn là một.
 */

export type Guard = { ok: true } | { ok: false; reason: string }

/** Đơn đã ra khỏi cửa — nhà cung cấp đang cầm bản này. */
export const SENT_STATUSES = ['ordered', 'confirmed', 'in_transit', 'partial', 'received'] // prettier-ignore

/**
 * THU HỒI CHỮ KÝ — đơn quay về chờ duyệt, KHÔNG về nháp (khác "Hạ về nháp" của
 * Cung ứng): thứ sai là quyết định của người ký, không phải số trên đơn.
 *
 * Chỉ khi chưa gửi NCC. Gửi rồi thì nhà cung cấp đang cầm bản có chữ ký — gỡ
 * chữ ký trên hệ thống không lấy lại được tờ đó; đường đúng là yêu cầu Cung
 * ứng điều chỉnh hoặc huỷ.
 */
export function canUnapprove(i: { status: string; receiptDocs: number }): Guard {
  if (i.status === 'pending_approval') return { ok: false, reason: 'Đơn đang chờ duyệt — chưa có chữ ký để thu hồi' } // prettier-ignore
  if (SENT_STATUSES.includes(i.status)) {
    return {
      ok: false,
      reason:
        'Đơn đã gửi nhà cung cấp — họ đang cầm bản có chữ ký. Dùng "Yêu cầu xem lại" để Cung ứng điều chỉnh hoặc huỷ đơn.',
    }
  }
  if (i.status !== 'approved') return { ok: false, reason: 'Chỉ thu hồi được chữ ký trên đơn đã duyệt, chưa gửi NCC' } // prettier-ignore
  if (i.receiptDocs > 0) return { ok: false, reason: 'Đơn đã có phiếu nhập kho — điều chỉnh bên Kho, không thu hồi chữ ký được' } // prettier-ignore
  return { ok: true }
}

/**
 * GỬI GẤP, KÝ BÙ SAU — đơn đi NCC trước khi có chữ ký.
 *
 * Đo 01/10/2026: 56/78 đơn đã gửi không có chữ ký trên hệ thống — ngoài đời
 * gửi trước rồi ký là chuyện thường. Thà mở một lối có tên, có lý do, có người
 * chịu trách nhiệm, còn hơn để nó tiếp tục xảy ra ngoài sổ.
 *
 * Chỉ trưởng phòng Cung ứng (chủ dự án chốt): mỗi lần đi tắt có MỘT người đứng
 * tên. Không giới hạn số tiền — việc gấp thật thường là đơn lớn; bù lại lý do
 * bắt buộc và đơn đỏ trong hộp ký của Giám đốc.
 */
export function canUrgentSend(i: {
  status: string
  isLead: boolean
  hasEta: boolean
  lineCount: number
}): Guard {
  if (!i.isLead) return { ok: false, reason: 'Chỉ trưởng phòng Cung ứng gửi gấp được — nhờ trưởng phòng bấm, hoặc gửi Giám đốc duyệt như thường' } // prettier-ignore
  if (i.status !== 'draft' && i.status !== 'pending_approval') {
    return {
      ok: false,
      reason: 'Chỉ gửi gấp đơn chưa được ký (nháp hoặc đang chờ duyệt)',
    }
  }
  if (i.lineCount === 0) return { ok: false, reason: 'Đơn chưa có dòng hàng nào' }
  if (!i.hasEta) return { ok: false, reason: 'Chưa có hẹn giao — khai ngày dự kiến trước, không thì không ai đo được NCC trễ hay đúng' } // prettier-ignore
  return { ok: true }
}

/** Đơn gửi gấp còn chờ chữ ký bù — đúng một định nghĩa cho hộp ký và màn ký. */
export function isAwaitingLateSign(p: {
  status: string
  urgent_sent_at?: string | null
  approved_at?: string | null
}): boolean {
  return !!p.urgent_sent_at && !p.approved_at && p.status !== 'cancelled'
}

export function canSignLate(p: {
  status: string
  urgent_sent_at?: string | null
  approved_at?: string | null
}): Guard {
  if (!p.urgent_sent_at) return { ok: false, reason: 'Đơn này không gửi gấp — duyệt theo đường thường' } // prettier-ignore
  if (p.approved_at) return { ok: false, reason: 'Đơn đã có chữ ký' }
  if (p.status === 'cancelled') return { ok: false, reason: 'Đơn đã huỷ' }
  return { ok: true }
}

/**
 * CÂU HỎI CỦA GIÁM ĐỐC — cùng một cơ chế, hai tên theo chỗ đơn đang đứng:
 *  · chờ duyệt (hoặc chờ ký bù) → "Hỏi lại": chưa quyết, cần thêm thông tin;
 *  · đã ký / đã gửi            → "Yêu cầu xem lại": đã quyết, nay thấy vướng.
 * Nháp và đơn đã huỷ thì không hỏi: nháp chưa tới bàn ký, huỷ thì hết chuyện.
 */
export type QuestionKind = 'ask' | 'review'

export function questionKindFor(p: {
  status: string
  urgent_sent_at?: string | null
  approved_at?: string | null
}): QuestionKind | null {
  if (p.status === 'draft' || p.status === 'cancelled') return null
  if (p.status === 'pending_approval' || isAwaitingLateSign(p)) return 'ask'
  return 'review'
}

export const QUESTION_LABEL: Record<QuestionKind, string> = {
  ask: 'Hỏi lại',
  review: 'Yêu cầu xem lại',
}

/**
 * "HIỆN Ở ĐÂU" của một đơn đã qua bàn ký — cột ở Lịch sử ký. Nói kèm việc còn
 * làm được với chữ ký: chưa gửi thì "thu hồi được", gửi gấp thì "chờ ký bù".
 */
export function poWhereNow(
  p: { status: string; urgent_sent_at?: string | null; approved_at?: string | null },
  statusLabel: Record<string, string>,
): string {
  if (isAwaitingLateSign(p)) return `${statusLabel[p.status] ?? p.status} · chờ ký bù`
  if (p.status === 'approved') return 'Chưa gửi NCC · thu hồi được'
  if (p.status === 'draft') return 'Đã về nháp'
  return statusLabel[p.status] ?? p.status
}

/** Một câu hỏi của Giám đốc + các câu trả lời — dùng chung server và màn. */
export type PoQuestionThread = {
  id: string
  kind: QuestionKind
  body: string
  author_id: string
  author_name: string | null
  created_at: string
  resolved_at: string | null
  resolved_how: 'answered' | 'decided' | 'closed' | null
  answers: { id: string; body: string; author_name: string | null; created_at: string }[]
}

/**
 * CHẾ ĐỘ ĐẦU MÀN KÝ — đơn đang ở đâu so với chữ ký. Màn ký đổi dải đầu theo
 * đây (po-approval-bands.tsx); để ở lib cho server, màn và test dùng chung.
 *   decide · late (gửi gấp chờ ký bù) · signed (đã ký, chưa gửi) · sent ·
 *   received · draft · cancelled
 */
export type SignMode = 'decide' | 'late' | 'signed' | 'sent' | 'received' | 'draft' | 'cancelled' // prettier-ignore

export function signModeFor(p: {
  status: string
  urgent_sent_at?: string | null
  approved_at?: string | null
}): SignMode {
  if (p.status === 'cancelled') return 'cancelled'
  if (isAwaitingLateSign(p)) return 'late'
  if (p.status === 'pending_approval') return 'decide'
  if (p.status === 'draft') return 'draft'
  if (p.status === 'approved') return 'signed'
  if (p.status === 'received') return 'received'
  return 'sent'
}
