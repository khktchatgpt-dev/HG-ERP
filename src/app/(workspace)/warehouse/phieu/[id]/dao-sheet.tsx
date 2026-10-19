'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, api, apiErrorText } from '@/lib/api'
import { HopThoai } from '../../_erp/o-nhap'

const so = (n: number) => n.toLocaleString('vi-VN')

/**
 * HỘP ĐẢO PHIẾU — ghi ngược toàn bộ bút toán, bắt lý do (0161, `reverseDoc`).
 * Viết lại không kit (Kho lối ERP · B6); logic giữ nguyên bản 16/09.
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
  const [lyDo, setLyDo] = useState('')
  const [dangChay, setDangChay] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const laNhap = doc.kind === 'receipt'

  async function ghiDao() {
    if (!lyDo.trim()) return
    setDangChay(true)
    setLoi(null)
    try {
      const out = await api<{ id: string; code: string }>(
        `/api/dept/warehouse/docs/${doc.id}/reverse`,
        { method: 'POST', body: { reason: lyDo.trim() } },
      )
      onClose()
      router.push(`/warehouse/phieu/${out.id}`)
      router.refresh()
    } catch (e) {
      setLoi(e instanceof ApiError ? apiErrorText(e) : 'Không đảo được phiếu')
      setDangChay(false)
    }
  }

  return (
    <HopThoai
      title={`Đảo ${doc.code}`}
      subtitle="Ghi ngược toàn bộ bút toán của phiếu — không sửa, không xoá tờ cũ"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            disabled={!lyDo.trim() || dangChay}
            onClick={() => void ghiDao()}
            style={lyDo.trim() && !dangChay ? { background: 'var(--kh-stop)', borderColor: 'var(--kh-stop)' } : undefined} // prettier-ignore
          >
            {dangChay ? 'Đang ghi…' : 'Ghi phiếu đảo'}
          </button>
        </>
      }
    >
      <p>
        Hệ thống lập một phiếu {laNhap ? 'xuất' : 'nhập'} mới ghi ngược{' '}
        <b className="kh-num">{so(tongQty)}</b> đơn vị trên {soDong} dòng. Tồn về đúng
        trạng thái trước khi ghi {doc.code}; đơn hàng và đợt giao liên quan tự lùi lại.
      </p>
      {canhBao && <div className="kh-hau">{canhBao}</div>}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="kh-mut" style={{ fontSize: 11, fontWeight: 700 }}>
          VÌ SAO ĐẢO — BẮT BUỘC
        </span>
        <textarea
          className="kh-o"
          value={lyDo}
          onChange={(e) => setLyDo(e.target.value)}
          rows={3}
          placeholder="Ví dụ: ghi nhầm mã vật tư, đã nhập lại bằng phiếu khác"
          aria-label="Lý do đảo phiếu"
        />
        <span className="kh-mut" style={{ fontSize: 12 }}>
          Câu này đi vào sổ và người đi soát sẽ đọc. Viết đủ để người khác hiểu mà không
          phải hỏi lại.
        </span>
      </label>
      {loi && <span className="kh-stop">{loi}</span>}
    </HopThoai>
  )
}
