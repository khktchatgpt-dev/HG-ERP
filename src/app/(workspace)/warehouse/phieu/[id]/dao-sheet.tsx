'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, api, apiErrorText } from '@/lib/api'
import { Sheet, SheetActions, TextArea, useToast } from '@/components/kit'

const so = (n: number) => n.toLocaleString('vi-VN')

/**
 * HỘP ĐẢO PHIẾU — ghi ngược toàn bộ bút toán, bắt lý do (0161, `reverseDoc`).
 * Tách khỏi `PhieuChiTietScreen` (12/10/2026) khi màn thêm Sửa phiếu / Ghi kg;
 * logic giữ nguyên bản 16/09.
 */
export function DaoSheet({
  doc,
  tongQty,
  soDong,
  canhBao,
  onClose,
}: {
  doc: { id: string; code: string; kind: string }
  tongQty: number
  soDong: number
  /** Câu cảnh báo của `canDao` (đảo được nhưng có hệ quả cần biết). */
  canhBao?: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [lyDo, setLyDo] = useState('')
  const [dangChay, setDangChay] = useState(false)
  const laNhap = doc.kind === 'receipt'

  async function ghiDao() {
    if (!lyDo.trim()) return
    setDangChay(true)
    try {
      const out = await api<{ id: string; code: string }>(
        `/api/dept/warehouse/docs/${doc.id}/reverse`,
        { method: 'POST', body: { reason: lyDo.trim() } },
      )
      toast.success(`Đã lập phiếu đảo ${out.code}`)
      onClose()
      router.push(`/warehouse/phieu/${out.id}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? apiErrorText(e) : 'Không đảo được phiếu')
    } finally {
      setDangChay(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Đảo ${doc.code}`}
      subtitle="Ghi ngược toàn bộ bút toán của phiếu — không sửa, không xoá tờ cũ"
      stakes="nang"
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={ghiDao}
          confirmLabel="Ghi phiếu đảo"
          stakes="nang"
          busy={dangChay}
          disabled={!lyDo.trim()}
        />
      }
    >
      <div className="text-k-sm flex flex-col gap-3 p-[var(--gutter)]">
        <p className="text-[var(--ink-2)]">
          Hệ thống lập một phiếu {laNhap ? 'xuất' : 'nhập'} mới ghi ngược{' '}
          <b className="num">{so(tongQty)}</b> đơn vị trên {soDong} dòng. Tồn về đúng
          trạng thái trước khi ghi {doc.code}; đơn hàng và đợt giao liên quan tự lùi lại.
        </p>
        {canhBao && (
          <p className="rounded-[var(--radius)] border border-[var(--warn-line)] bg-[var(--warn-wash)] px-3 py-2 text-[var(--ink-2)]">
            {canhBao}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-k-label font-semibold tracking-[.04em] text-[var(--ink-2)] uppercase">
            Vì sao đảo — bắt buộc
          </span>
          <TextArea
            value={lyDo}
            onChange={setLyDo}
            rows={3}
            placeholder="Ví dụ: ghi nhầm mã vật tư, đã nhập lại bằng phiếu khác"
          />
          <span className="text-k-label text-[var(--ink-3)]">
            Câu này đi vào sổ và người đi soát sẽ đọc. Viết đủ để người khác hiểu mà không
            phải hỏi lại.
          </span>
        </label>
      </div>
    </Sheet>
  )
}
