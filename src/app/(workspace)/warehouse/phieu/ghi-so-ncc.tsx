'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { Sheet, SheetActions, useToast } from '@/components/kit'

/** Lý do ghi vào vết sửa — đủ ≥ 3 ký tự `docInfoSchema` đòi, nói đúng việc đã làm. */
export const LY_DO_BO_SUNG_SO_NCC = 'Bổ sung số phiếu giao NCC'

/**
 * GHI SỐ PHIẾU NCC NGAY TẠI DÒNG SỔ (Kho đợt 2 · Bước 2b, bản vẽ B2-1).
 *
 * 87 phiếu nhập thiếu số này (đo 12/10/2026) — việc lặp lại nhiều nhất của rổ,
 * nên không bắt mở phiếu rồi mở hộp Sửa phiếu đầy đủ. Gọi ĐÚNG route sửa thông
 * tin (`PATCH docs/[id]/thong-tin`): không đổi tồn, vết trước → sau vào Trao đổi
 * của đơn mua. Server vẫn là người quyết (phiếu đã đảo, không theo đơn…).
 */
export function GhiSoNccSheet({
  doc,
  onClose,
}: {
  doc: { id: string; code: string; po_code: string | null }
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [so, setSo] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  async function luu() {
    if (!so.trim()) return
    setBusy(true)
    setLoi(null)
    try {
      await api(`/api/dept/warehouse/docs/${doc.id}/thong-tin`, {
        method: 'PATCH',
        body: { supplier_doc_no: so.trim(), reason: LY_DO_BO_SUNG_SO_NCC },
      })
      toast.success(`Đã ghi số phiếu NCC cho ${doc.code}`)
      onClose()
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Ghi số phiếu NCC · ${doc.code}`}
      subtitle={doc.po_code ? `Nhập cho ${doc.po_code} — không đổi tồn` : 'Không đổi tồn'}
      stakes="nhe"
      width={420}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={luu}
          confirmLabel="Lưu số phiếu"
          busy={busy}
          disabled={!so.trim()}
        />
      }
    >
      <form
        className="text-k-sm flex flex-col gap-3 p-[var(--gutter)]"
        onSubmit={(e) => {
          e.preventDefault()
          void luu()
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-[var(--ink-2)]">Số phiếu giao của NCC</span>
          {/* Ô thô cập nhật TỪNG PHÍM — kit `TextInput` chốt lúc rời ô nên nút Lưu
              không mở khi đang gõ (cùng lý do với hộp Sửa phiếu, 02/10). */}
          <input
            value={so}
            onChange={(e) => setSo(e.target.value)}
            aria-label="Số phiếu giao của NCC"
            placeholder="Số in trên tờ giao hàng NCC đưa kèm"
            maxLength={60}
            autoFocus
            className="num h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)]"
          />
        </label>
        <p className="text-[var(--ink-3)]">
          Kế toán đối chiếu công nợ bằng số này. Vết sửa ghi “{LY_DO_BO_SUNG_SO_NCC}” vào
          lịch sử phiếu và Trao đổi của đơn.
        </p>
        {loi && <p className="font-semibold text-[var(--stop)]">{loi}</p>}
      </form>
    </Sheet>
  )
}
