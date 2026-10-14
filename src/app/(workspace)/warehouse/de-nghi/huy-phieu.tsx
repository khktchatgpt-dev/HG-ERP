'use client'

import { useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { HopThoai } from '../_erp/o-nhap'

/**
 * HỘP BẮT LÝ DO dùng chung cho Huỷ phiếu / Chốt xong của phiếu đề nghị (Kho lối
 * ERP · B5, không kit). Lý do ≥ 3 ký tự; server từ chối thì nói ngay trong hộp.
 */
export function HopLyDo({
  title,
  subtitle,
  route,
  nhanNut,
  nhanO,
  placeholder,
  truoc,
  onClose,
  onDone,
}: {
  title: string
  subtitle: string
  /** POST route nhận `{ reason }`. */
  route: string
  nhanNut: string
  nhanO: string
  placeholder: string
  /** Khối nói trước khi hỏi lý do (danh sách dòng thiếu…). */
  truoc?: React.ReactNode
  onClose: () => void
  /** Gọi với câu báo kết quả để màn hiện tại chỗ. */
  onDone: (bao: string) => void
}) {
  const [ly, setLy] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const du = ly.trim().length >= 3

  async function gui() {
    setBusy(true)
    setLoi(null)
    try {
      await api(route, { method: 'POST', body: { reason: ly.trim() } })
      onDone(`${title} xong.`)
    } catch (e) {
      setLoi(apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <HopThoai
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            disabled={!du || busy}
            onClick={() => void gui()}
            style={{ background: du && !busy ? 'var(--kh-stop)' : undefined, borderColor: du && !busy ? 'var(--kh-stop)' : undefined }} // prettier-ignore
          >
            {busy ? 'Đang lưu…' : nhanNut}
          </button>
        </>
      }
    >
      {truoc}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 600 }}>{nhanO} (bắt buộc)</span>
        <textarea
          className="kh-o"
          value={ly}
          onChange={(e) => setLy(e.target.value)}
          rows={3}
          placeholder={placeholder}
          aria-label={nhanO}
        />
        {!du && (
          <span className="kh-mut" style={{ fontSize: 12 }}>
            Ghi ít nhất 3 ký tự.
          </span>
        )}
      </label>
      {loi && <span className="kh-stop">{loi}</span>}
    </HopThoai>
  )
}

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
  onDone: (bao: string) => void
}) {
  return (
    <HopLyDo
      title={`Huỷ phiếu ${code}`}
      subtitle="Phiếu không bị xoá — ở lại sổ đề nghị với nhãn Đã huỷ và lý do."
      route={`/api/dept/warehouse/de-nghi/${id}/huy`}
      nhanNut="Huỷ phiếu"
      nhanO="Lý do huỷ phiếu"
      placeholder="VD: lập trùng với phiếu khác · không cần mua nữa"
      onClose={onClose}
      onDone={() => onDone(`Đã huỷ ${code} — phiếu vẫn còn trong sổ với nhãn "Đã huỷ".`)}
    />
  )
}
