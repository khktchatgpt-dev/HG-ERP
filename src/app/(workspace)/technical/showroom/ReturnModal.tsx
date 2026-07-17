'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import {
  SAMPLE_CONDITION_LABEL,
  SAMPLE_CONDITIONS,
  type SampleCondition,
} from '@/modules/dept/technical/samples.schema'
import { BTN_GHOST, BTN_PRIMARY, Field, INPUT } from './SampleCreateModal'

/**
 * Ghi trả. Tình trạng lúc nhận lại là thứ QUYẾT ĐỊNH mẫu về showroom hay đi sửa
 * — nên bắt chọn, không cho mặc định trôi qua.
 */
export function ReturnModal({
  loanId,
  sampleCode,
  onClose,
}: {
  loanId: string
  sampleCode: string
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [condition, setCondition] = useState<SampleCondition>('good')
  const [note, setNote] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/api/dept/technical/loans/${loanId}/return`, {
        method: 'POST',
        body: { returned_condition: condition, note: note || null },
      })
      toast.success(
        'Đã ghi trả',
        condition === 'damaged' ? `${sampleCode} — chuyển sang đang sửa` : sampleCode,
      )
      onClose()
      router.refresh()
    } catch (e) {
      toast.error('Ghi trả thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Ghi trả — ${sampleCode}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Tình trạng lúc nhận lại *">
          <select
            value={condition}
            onChange={(e) => setCondition(e.currentTarget.value as SampleCondition)}
            className={INPUT}
          >
            {SAMPLE_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {SAMPLE_CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>

        {condition === 'damaged' && (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            Mẫu hỏng sẽ chuyển sang <b>Đang sửa</b> thay vì về showroom — tránh đem cho
            mượn tiếp.
          </p>
        )}

        <Field label="Ghi chú">
          <textarea
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            rows={2}
            placeholder="Xước mặt bàn, thiếu ốc…"
            className={INPUT}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Huỷ
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy && <Spinner size={12} />}
            {busy ? 'Đang ghi…' : 'Ghi trả'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
