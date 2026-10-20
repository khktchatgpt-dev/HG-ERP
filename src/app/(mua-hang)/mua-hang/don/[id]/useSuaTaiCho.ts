import { useState } from 'react'
import type { useRouter } from 'next/navigation'
import type { useToast } from '@/components/kit'
import {
  dateEditState,
  focusDauDon,
  saveSuaTaiCho,
  suaTaiChoPreflight,
  type AdjustResult,
} from './sua-tai-cho'

type HeaderLike = {
  expectedAt: string
  contractNo: string
  terms: { quality: string; delivery_place: string; payment: string; invoice: string; lead_time: string } // prettier-ignore
  signerRole: string
  note: string
}

/**
 * CHẾ ĐỘ SỬA TẠI CHỖ của đơn đã ra khỏi nháp (B1 + B2 + B3, 28/09/2026) — một
 * nút Sửa mở hẹn giao · điều khoản · số HĐ · ghi chú · DÒNG HÀNG (theo luật
 * điều chỉnh, khi bước cho phép) cùng lúc — đợt giao KHÔNG còn ở đây (07/10/2026,
 * sửa ở hộp Giao nhận của Theo dõi đơn hàng); một nút Lưu ghi theo
 * phần. Tách khỏi `useDonChungTu` (đã chạm trần 1.697 dòng); luật thuần ở
 * `sua-tai-cho.ts`, có test.
 *
 * `adjust` là cầu sang máy điều chỉnh sẵn có của hook lớn (`adjPlan`, hộp lý do,
 * `POST …/adjustments`): `can` = bước này sửa được dòng; `pending` = đã đổi
 * dòng/thuế/chiết khấu; `blocked` = câu chặn của `planAdjustment`; `askReason`
 * mở hộp lý do (bắt buộc ≥ 5 ký tự — server cũng đòi); `post` chỉ gọi route.
 */
export function useSuaTaiCho(a: {
  po: { id: string; status: string; expected_at: string | null } | null
  header: HeaderLike
  noteOver: number
  termsEdit: boolean
  setTermsEdit: (v: boolean) => void
  setHeadOpen: (v: boolean) => void
  goTo: (id: string) => void
  resetHeader: () => void
  setBusy: (v: boolean) => void
  toast: ReturnType<typeof useToast>
  router: ReturnType<typeof useRouter>
  adjust: {
    can: boolean
    start: () => void
    finish: () => void
    pending: boolean
    blocked: string | null
    askReason: () => void
    post: () => Promise<AdjustResult>
  }
}) {
  const [editReason, setEditReason] = useState('')
  const dateEdit = dateEditState(a.po, a.header.expectedAt, a.termsEdit)

  /** Vào chế độ Sửa; `focus` = aria-label ô cần con trỏ (chip đầu trang bấm vào). */
  function startEdit(focus?: string) {
    if (!a.po) return
    // Nạp lại header từ bản đang lưu — không sửa trên số cũ của một lượt trước.
    a.resetHeader()
    if (a.adjust.can) a.adjust.start()
    a.setTermsEdit(true)
    a.setHeadOpen(true)
    // Bố cục đọc: khối Đầu đơn nằm GẤP ở mục Tổng quan — mở mục, mở khối, cuộn tới.
    a.goTo('dau-don')
    if (focus) focusDauDon(focus)
  }

  /** Bỏ phần sửa hẹp (hẹn giao, điều khoản) — phần dòng hàng do `cancelEdit` của hook lớn trả lại. */
  function cancelTermsEdit() {
    a.setTermsEdit(false)
    setEditReason('')
    a.resetHeader()
  }

  /**
   * Lưu tất cả. Có đổi dòng hàng thì phải có lý do điều chỉnh: lần bấm đầu mở
   * hộp lý do (`askReason`), hộp xác nhận gọi lại với `fromSheet = true`.
   */
  async function saveTerms(fromSheet = false) {
    if (!a.po) return
    const pre =
      suaTaiChoPreflight(a.noteOver, dateEdit, a.header.expectedAt) ??
      (a.adjust.pending ? a.adjust.blocked : null)
    if (pre) return a.toast.warning('Chưa lưu được', pre)
    if (a.adjust.pending && !fromSheet) return a.adjust.askReason()
    a.setBusy(true)
    const r = await saveSuaTaiCho(a.po.id, a.header, dateEdit, editReason, a.adjust.pending ? a.adjust.post : null) // prettier-ignore
    a.setBusy(false)
    if (r.ok) {
      a.toast.success('Đã lưu', r.detail)
      a.setTermsEdit(false)
      setEditReason('')
      a.adjust.finish()
      a.router.refresh()
    } else {
      a.toast.error(r.title, r.detail)
      if (r.dateSaved) a.router.refresh()
    }
  }

  return {
    editReason,
    setEditReason,
    dateEdit,
    startEdit,
    cancelTermsEdit,
    saveTerms,
  } as const
}
