import { useState } from 'react'
import type { useRouter } from 'next/navigation'
import type { useToast } from '@/components/kit'
import type { ShipmentLite } from './nhan-hang'
import {
  dateEditState,
  diffShipments,
  focusDauDon,
  plannedColumns,
  remapShipCols,
  saveSuaTaiCho,
  shipDiffCount,
  shipmentsPreflight,
  suaTaiChoPreflight,
  type AdjustResult,
  type ShipCol,
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
 * nút Sửa mở hẹn giao · điều khoản · số HĐ · ghi chú · ĐỢT GIAO (lưới) · DÒNG
 * HÀNG (theo luật điều chỉnh, khi bước cho phép) cùng lúc; một nút Lưu ghi theo
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
  shipments: ShipmentLite[]
  /** Dòng đang bày trên lưới (đã sửa nếu đang điều chỉnh); `key` bền theo dòng để cột đợt đi theo. */
  poLines: {
    id?: string | null
    key: string
    material_name: string
    qty_ordered: number
  }[]
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
  const [shipCols, setShipCols] = useState<ShipCol[]>([])
  const lines = a.poLines.map((l) => ({ id: l.id, name: l.material_name, qty_ordered: l.qty_ordered })) // prettier-ignore

  // Cột đợt khoá theo chỉ số dòng; dòng hàng bị bỏ/thêm thì dời cột theo DÒNG.
  const keys = a.poLines.map((l) => l.key).join('\u0001')
  const [keysSeen, setKeysSeen] = useState(keys)
  if (keys !== keysSeen) {
    setKeysSeen(keys)
    if (shipCols.length > 0)
      setShipCols(remapShipCols(shipCols, keysSeen.split('\u0001'), keys.split('\u0001')))
  }

  const dateEdit = dateEditState(a.po, a.header.expectedAt, a.termsEdit)
  const shipErrors = a.termsEdit ? shipmentsPreflight(shipCols, lines, a.shipments) : []
  const shipDiff = a.termsEdit ? diffShipments(shipCols, lines, a.shipments) : { edits: [], adds: [], cancels: [] } // prettier-ignore

  /** Vào chế độ Sửa; `focus` = aria-label ô cần con trỏ (chip đầu trang bấm vào). */
  function startEdit(focus?: string) {
    if (!a.po) return
    // Nạp lại header từ bản đang lưu — không sửa trên số cũ của một lượt trước.
    a.resetHeader()
    setShipCols(plannedColumns(a.shipments, lines))
    if (a.adjust.can) a.adjust.start()
    a.setTermsEdit(true)
    a.setHeadOpen(true)
    // Bố cục đọc: khối Đầu đơn nằm GẤP ở mục Tổng quan — mở mục, mở khối, cuộn tới.
    a.goTo('dau-don')
    if (focus) focusDauDon(focus)
  }

  /** Bỏ phần sửa hẹp (hẹn giao, điều khoản, đợt) — phần dòng hàng do `cancelEdit` của hook lớn trả lại. */
  function cancelTermsEdit() {
    a.setTermsEdit(false)
    setEditReason('')
    setShipCols([])
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
      shipErrors[0] ??
      (a.adjust.pending ? a.adjust.blocked : null)
    if (pre) return a.toast.warning('Chưa lưu được', pre)
    if (a.adjust.pending && !fromSheet) return a.adjust.askReason()
    a.setBusy(true)
    const r = await saveSuaTaiCho(a.po.id, a.header, dateEdit, editReason, shipDiff, a.adjust.pending ? a.adjust.post : null) // prettier-ignore
    a.setBusy(false)
    if (r.ok) {
      a.toast.success('Đã lưu', r.detail)
      a.setTermsEdit(false)
      setEditReason('')
      setShipCols([])
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
    // Tên khác `shipCols` của lúc SOẠN (cũng nằm trong ctx) — hai lưới, hai state.
    editCols: shipCols,
    setEditCols: setShipCols,
    shipErrors,
    shipChanges: shipDiffCount(shipDiff),
    startEdit,
    cancelTermsEdit,
    saveTerms,
  } as const
}
