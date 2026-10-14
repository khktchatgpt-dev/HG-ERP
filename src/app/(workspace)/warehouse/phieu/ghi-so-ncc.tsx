'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'

/** Lý do ghi vào vết sửa — đủ ≥ 3 ký tự `docInfoSchema` đòi, nói đúng việc đã làm. */
export const LY_DO_BO_SUNG_SO_NCC = 'Bổ sung số phiếu giao NCC'

/**
 * GHI SỐ PHIẾU NCC NGAY TRONG Ô CỦA DÒNG SỔ (Kho lối ERP · B4, bản vẽ K-4 — thay
 * hộp riêng của Kho đợt 2 · B2b). 88 phiếu nhập thiếu số này (đo 14/10/2026): gõ
 * số, Enter là lưu và con trỏ xuống ô của phiếu kế tiếp — chép một xấp tờ giao
 * hàng không phải mở hộp nào.
 *
 * Gọi ĐÚNG route sửa thông tin (`PATCH docs/[id]/thong-tin`): không đổi tồn, vết
 * trước → sau vào Trao đổi của đơn mua. Server vẫn là người quyết (phiếu đã đảo,
 * không theo đơn…) — từ chối thì nói lý do ngay dưới ô.
 */
export function OSoNcc({
  doc,
  onXong,
}: {
  doc: { id: string; code: string }
  /** Lưu xong (để màn đưa con trỏ xuống dòng sau). */
  onXong?: () => void
}) {
  const router = useRouter()
  const [so, setSo] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [daLuu, setDaLuu] = useState<string | null>(null)
  /** Số vừa thử mà server từ chối — rời ô không gửi lại đúng số đó. */
  const [daThu, setDaThu] = useState<string | null>(null)

  async function luu() {
    const v = so.trim()
    if (!v || busy) return
    setBusy(true)
    setLoi(null)
    setDaThu(v)
    try {
      await api(`/api/dept/warehouse/docs/${doc.id}/thong-tin`, {
        method: 'PATCH',
        body: { supplier_doc_no: v, reason: LY_DO_BO_SUNG_SO_NCC },
      })
      setDaLuu(v)
      onXong?.()
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (daLuu) return <span className="kh-num kh-ok">{daLuu}</span>
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'block' }}>
      <input
        data-so-ncc={doc.id}
        className="kh-o mono nen"
        value={so}
        maxLength={60}
        disabled={busy}
        placeholder="chưa ghi — gõ rồi Enter"
        aria-label={`Số phiếu giao NCC của ${doc.code}`}
        title="Số in trên tờ giao hàng NCC đưa kèm — Kế toán đối chiếu công nợ bằng số này. Không đổi tồn."
        onChange={(e) => setSo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void luu()
          }
          if (e.key === 'Escape') setSo('')
        }}
        onBlur={() => so.trim() && so.trim() !== daThu && void luu()}
      />
      {busy && <span className="kh-hint">đang lưu…</span>}
      {loi && <span className="kh-hint stop">{loi}</span>}
    </span>
  )
}
