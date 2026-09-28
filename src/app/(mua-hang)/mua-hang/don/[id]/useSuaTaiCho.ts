import { useState } from 'react'
import type { useRouter } from 'next/navigation'
import type { useToast } from '@/components/kit'
import type { ShipmentLite } from './nhan-hang'
import {
  dateEditState,
  diffShipments,
  focusDauDon,
  plannedColumns,
  saveSuaTaiCho,
  shipDiffCount,
  shipmentsPreflight,
  suaTaiChoPreflight,
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
 * CHẾ ĐỘ SỬA TẠI CHỖ của đơn đã ra khỏi nháp (B1 + B2, 28/09/2026) — một nút
 * Sửa mở hẹn giao · điều khoản · số HĐ · ghi chú · ĐỢT GIAO (lưới) cùng lúc,
 * một nút Lưu ghi theo phần. Tách khỏi `useDonChungTu` (đã chạm trần 1.697
 * dòng); luật thuần ở `sua-tai-cho.ts`, có test.
 */
export function useSuaTaiCho(a: {
  po: { id: string; status: string; expected_at: string | null } | null
  header: HeaderLike
  shipments: ShipmentLite[]
  poLines: { id?: string | null; material_name: string; qty_ordered: number }[]
  noteOver: number
  termsEdit: boolean
  setTermsEdit: (v: boolean) => void
  setHeadOpen: (v: boolean) => void
  goTo: (id: string) => void
  resetHeader: () => void
  setBusy: (v: boolean) => void
  toast: ReturnType<typeof useToast>
  router: ReturnType<typeof useRouter>
}) {
  const [editReason, setEditReason] = useState('')
  const [shipCols, setShipCols] = useState<ShipCol[]>([])
  const lines = a.poLines.map((l) => ({ id: l.id, name: l.material_name, qty_ordered: l.qty_ordered })) // prettier-ignore

  const dateEdit = dateEditState(a.po, a.header.expectedAt, a.termsEdit)
  const shipErrors = a.termsEdit ? shipmentsPreflight(shipCols, lines, a.shipments) : []
  const shipDiff = a.termsEdit ? diffShipments(shipCols, lines, a.shipments) : { edits: [], adds: [], cancels: [] } // prettier-ignore

  /** Vào chế độ Sửa; `focus` = aria-label ô cần con trỏ (chip đầu trang bấm vào). */
  function startEdit(focus?: string) {
    if (!a.po) return
    // Nạp lại header từ bản đang lưu — không sửa trên số cũ của một lượt trước.
    a.resetHeader()
    setShipCols(plannedColumns(a.shipments, lines))
    a.setTermsEdit(true)
    a.setHeadOpen(true)
    // Bố cục đọc: khối Đầu đơn nằm GẤP ở mục Tổng quan — mở mục, mở khối, cuộn tới.
    a.goTo('dau-don')
    if (focus) focusDauDon(focus)
  }

  /** Bỏ sửa: trả mọi ô về đúng bản đang lưu. */
  function cancelTermsEdit() {
    a.setTermsEdit(false)
    setEditReason('')
    setShipCols([])
    a.resetHeader()
  }

  async function saveTerms() {
    if (!a.po) return
    const pre = suaTaiChoPreflight(a.noteOver, dateEdit, a.header.expectedAt) ?? shipErrors[0] ?? null // prettier-ignore
    if (pre) return a.toast.warning('Chưa lưu được', pre)
    a.setBusy(true)
    const r = await saveSuaTaiCho(a.po.id, a.header, dateEdit, editReason, shipDiff)
    a.setBusy(false)
    if (r.ok) {
      a.toast.success('Đã lưu', r.detail)
      a.setTermsEdit(false)
      setEditReason('')
      setShipCols([])
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
