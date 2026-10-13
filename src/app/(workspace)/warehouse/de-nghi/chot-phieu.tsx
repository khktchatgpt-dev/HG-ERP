'use client'

import { useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { Sheet, SheetActions, TextArea, useToast } from '@/components/kit'

/**
 * CHỐT XONG phiếu đề nghị còn dòng thiếu mà không mua nữa (0238 · Q14) — bắt
 * lý do; phiếu khoá ở Xong, dòng thiếu ghi "chốt thiếu". Không nhập thêm được.
 */
export function ChotPhieuSheet({
  id,
  code,
  thieu,
  onClose,
  onDone,
}: {
  id: string
  code: string
  /** Các dòng còn thiếu, đã viết sẵn ("Que hàn 2.5 còn 5 kg") — để người chốt thấy mình bỏ gì. */
  thieu: string[]
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [ly, setLy] = useState('')
  const [busy, setBusy] = useState(false)
  const du = ly.trim().length >= 3

  async function chot() {
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/de-nghi/${id}/chot`, {
        method: 'POST',
        body: { reason: ly.trim() },
      })
      toast.success(`Đã chốt ${code}`, 'Phiếu sang Xong; dòng thiếu ghi "chốt thiếu".')
      onDone()
    } catch (e) {
      toast.error('Chốt không được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Chốt xong ${code}`}
      subtitle="Chốt rồi thì không nhập thêm theo phiếu này nữa — mua tiếp thì lập phiếu đề nghị mới."
      stakes="nang"
      width={540}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void chot()}
          confirmLabel="Chốt xong"
          cancelLabel="Thôi"
          stakes="nang"
          busy={busy}
          disabled={!du}
        />
      }
    >
      <div className="text-k-body flex flex-col gap-3">
        {thieu.length > 0 ? (
          <div>
            <span className="font-semibold">Còn thiếu {thieu.length} dòng:</span>
            <ul className="mt-1 list-disc pl-5 text-[var(--ink-2)]">
              {thieu.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : (
          <span className="text-[var(--ink-3)]">Chưa nhập dòng nào.</span>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Lý do chốt (bắt buộc)</span>
          <TextArea
            value={ly}
            onChange={setLy}
            rows={3}
            placeholder="VD: tiệm hết hàng, không mua nữa · đã dùng hàng tồn thay"
            aria-label="Lý do chốt xong"
          />
          {!du && (
            <span className="text-k-sm text-[var(--ink-3)]">Ghi ít nhất 3 ký tự.</span>
          )}
        </label>
      </div>
    </Sheet>
  )
}
