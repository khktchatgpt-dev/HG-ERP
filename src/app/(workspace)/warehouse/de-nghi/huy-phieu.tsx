'use client'

import { useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { Sheet, SheetActions, TextArea, useToast } from '@/components/kit'

/**
 * Huỷ phiếu đề nghị (nháp / chờ duyệt) — bắt lý do, KHÔNG xoá: phiếu ở lại sổ
 * với nhãn "Đã huỷ" để ai hỏi "tờ hôm đó đâu" còn tra được (0236 · Đ1).
 */
export function HuyPhieuSheet({
  id,
  code,
  onClose,
  onDone,
}: {
  id: string
  code: string
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [ly, setLy] = useState('')
  const [busy, setBusy] = useState(false)
  const du = ly.trim().length >= 3

  async function huy() {
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/de-nghi/${id}/huy`, {
        method: 'POST',
        body: { reason: ly.trim() },
      })
      toast.success(`Đã huỷ ${code}`, 'Phiếu vẫn còn trong sổ với nhãn "Đã huỷ".')
      onDone()
    } catch (e) {
      toast.error('Huỷ không được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Huỷ phiếu ${code}`}
      subtitle="Phiếu không bị xoá — ở lại sổ đề nghị với nhãn Đã huỷ và lý do."
      stakes="nang"
      width={520}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void huy()}
          confirmLabel="Huỷ phiếu"
          cancelLabel="Thôi"
          stakes="nang"
          busy={busy}
          disabled={!du}
        />
      }
    >
      <label className="text-k-body flex flex-col gap-1">
        <span className="font-semibold">Lý do huỷ (bắt buộc)</span>
        <TextArea
          value={ly}
          onChange={setLy}
          rows={3}
          placeholder="VD: lập trùng với phiếu khác · không cần mua nữa"
          aria-label="Lý do huỷ phiếu"
        />
        {!du && (
          <span className="text-k-sm text-[var(--ink-3)]">Ghi ít nhất 3 ký tự.</span>
        )}
      </label>
    </Sheet>
  )
}
