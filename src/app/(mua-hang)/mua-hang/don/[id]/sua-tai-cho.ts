import { api, apiErrorText } from '@/lib/api'
import { canReschedule } from '@/lib/po-reschedule'
import { dmy } from './don-chung-tu.shared'

/**
 * SỬA TẠI CHỖ đơn đã ra khỏi nháp (B1, 28/09/2026 — artboard 14).
 *
 * Trước đó một tờ đơn có BỐN cửa sửa (Điều chỉnh · Sửa điều khoản · Đổi hẹn giao
 * · Thêm đợt), ba cửa nằm trong "⋯"; đổi hẹn giao bắt ghi lý do, và kết quả đo
 * được là 53/85 đơn đã gửi trống hạn giao, 0 vết đổi hẹn. Nay MỘT nút "Sửa" mở
 * hẹn giao + điều khoản + số HĐ + người ký + ghi chú cùng lúc; Lưu ghi theo PHẦN
 * bằng các route sẵn có (dời hẹn → điều khoản), server không đổi.
 *
 * File thuần (không React) để test được: luật hẹn giao đổi được khi nào, lưu
 * theo phần và câu báo khi hỏng giữa chừng.
 */

export type DateEdit = {
  /** Bước này đổi hẹn giao được không (`canReschedule`). */
  ok: boolean
  /** Vì sao khoá — nói ngay cạnh ô. */
  why?: string
  /** Ngày đang lưu (YYYY-MM-DD), '' = chưa hẹn. */
  current: string
  /** Người dùng đã đổi ngày so với bản đang lưu. */
  changed: boolean
}

export function dateEditState(
  po: { status: string; expected_at: string | null } | null,
  expectedAt: string,
  editing: boolean,
): DateEdit {
  const current = po?.expected_at ? po.expected_at.slice(0, 10) : ''
  const guard = po
    ? canReschedule(po.status)
    : { ok: false as const, reason: 'Lưu đơn trước' }
  return {
    ok: guard.ok,
    why: guard.ok ? undefined : guard.reason,
    current,
    changed: editing && guard.ok && expectedAt !== current,
  }
}

/** Chặn TRƯỚC khi gọi server — trả câu người đọc được, hoặc null nếu lưu được. */
export function suaTaiChoPreflight(
  noteOver: number,
  date: DateEdit,
  expectedAt: string,
): string | null {
  if (noteOver > 0) return `Ghi chú dài hơn mức cho phép ${noteOver} ký tự`
  if (date.changed && !expectedAt)
    return 'Hạn giao đang trống — chọn ngày, hoặc bấm Thôi để giữ ngày cũ'
  return null
}

type HeaderLike = {
  expectedAt: string
  contractNo: string
  terms: { quality: string; delivery_place: string; payment: string; invoice: string; lead_time: string } // prettier-ignore
  signerRole: string
  note: string
}

/* ĐỢT GIAO KHÔNG CÒN SỬA Ở ĐÂY (07/10/2026, chủ dự án chốt "một nơi"): lưới
   chia đợt của B2 coi đợt "xe tới / đã nhận" là khoá nên đơn về một phần ăn lỗi
   "vượt SL đặt" (PO-2026-0084). Mọi việc đợt giao — thêm, sửa, dời, lấy trước,
   tách theo phiếu nhập — làm ở hộp Giao nhận trên Theo dõi đơn hàng. */

/** Kết quả một lần áp dụng điều chỉnh — phần server trả về sau `POST …/adjustments`. */
export type AdjustResult = { seq: number; delta_total: number }

export type SaveOutcome =
  | { ok: true; detail: string }
  | { ok: false; title: string; detail: string; dateSaved: boolean }

/**
 * Lưu theo PHẦN, mỗi phần một route sẵn có: dời hẹn (kéo đợt chưa giao theo, ghi
 * vết) TRƯỚC, điều khoản, điều chỉnh dòng hàng (B3 — đổi SL đặt trước để đợt
 * giao kiểm theo số mới). Không có giao dịch
 * gộp, nên hỏng giữa chừng phải nói rõ phần nào đã vào — người dùng biết mình
 * còn phải làm gì.
 *
 * `adjust` = hàm gọi `POST …/adjustments` (đã gói lý do + dòng) — chỉ truyền khi
 * có thay đổi dòng hàng; không có thì bỏ qua, không hỏi lý do.
 */
export async function saveSuaTaiCho(
  poId: string,
  h: HeaderLike,
  date: DateEdit,
  reason: string,
  adjust?: (() => Promise<AdjustResult>) | null,
): Promise<SaveOutcome> {
  let dateSaved = false
  let termsSaved = false

  let adjDone: AdjustResult | null = null
  try {
    if (date.changed) {
      await api(`/api/dept/supply/pos/${poId}/reschedule`, {
        method: 'POST',
        body: { expected_at: h.expectedAt, reason: reason.trim() },
      })
      dateSaved = true
    }
    const t = (v: string) => v.trim() || null
    await api(`/api/dept/supply/pos/${poId}/terms`, {
      method: 'PATCH',
      body: {
        contract_no: t(h.contractNo),
        terms_quality: t(h.terms.quality),
        terms_delivery_place: t(h.terms.delivery_place),
        terms_payment: t(h.terms.payment),
        terms_invoice: t(h.terms.invoice),
        terms_lead_time: t(h.terms.lead_time),
        signer_role: t(h.signerRole),
        note: t(h.note),
      },
    })
    termsSaved = true
    if (adjust) adjDone = await adjust()
    const parts = [
      dateSaved
        ? `hẹn giao ${dmy(date.current) || 'chưa hẹn'} → ${dmy(h.expectedAt)}`
        : null,
      'điều khoản · ghi chú',
      adjDone ? `điều chỉnh lần ${adjDone.seq} (phát sinh ${fmtSigned(adjDone.delta_total)})` : null, // prettier-ignore
    ].filter(Boolean)
    return { ok: true, detail: `Đã ghi: ${parts.join(' · ')}` }
  } catch (e) {
    const done = [dateSaved && 'hẹn giao', termsSaved && 'điều khoản', adjDone && `điều chỉnh lần ${adjDone.seq}`].filter(Boolean) // prettier-ignore
    return {
      ok: false,
      title: done.length
        ? `Đã ghi ${done.join(', ')} — phần còn lại CHƯA lưu`
        : 'Không lưu được',
      detail: apiErrorText(e),
      dateSaved: dateSaved || termsSaved || !!adjDone,
    }
  }
}

const fmtSigned = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}`

/**
 * Đưa con trỏ vào một ô của khối Đầu đơn theo `aria-label` — chip đầu trang bấm
 * vào là tới đúng ô. Hai nhịp vẽ: mục menu đổi rồi khối mới mở; ô chỉ có sau đó.
 */
export function focusDauDon(label: string): void {
  const find = () =>
    document.querySelector<HTMLElement>(
      `#dau-don [aria-label="${label}"], #dau-don [aria-label="${label} — ngày"]`,
    )
  requestAnimationFrame(() => requestAnimationFrame(() => find()?.focus()))
}
