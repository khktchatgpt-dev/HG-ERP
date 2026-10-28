'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { ISSUE_KINDS, ISSUE_KIND_LABEL, type IssueKind } from '@/lib/po-tracking'
import { thanSuCo, TU_CHOI_NHAN } from '@/lib/kho-hang-ve'
import { CHO_GHI_HANG_KHOA } from '@/lib/kho-phieu-nhap'
import { HopThoai } from '../_erp/o-nhap'
import type { HangCuaDonData } from './tai-hang-cua-don'

const NHAN = { fontWeight: 600, color: 'var(--kh-ink2)', fontSize: 12.5 } as const
const COT = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } as const

/**
 * BÁO SỰ CỐ GIAO HÀNG — giao diện RIÊNG của Kho (Kho đợt 2 · Bước 3, bản vẽ B3-2
 * https://claude.ai/artifact/WLinMQm3FQ1T7NVufZQHjS, duyệt 12/10/2026).
 *
 * Lấp hai lỗ đo được: (1) Kho TỪ CHỐI NHẬN cả lô thì không lập phiếu → không để
 * lại dấu vết; (2) sổ sự cố không báo ai. Câu hỏi ĐẦU là "có nhận lô này không"
 * vì nó quyết định hệ quả; từ chối thì mô tả mang chữ `[Từ chối nhận]` (Q1 — lựa
 * chọn, không phải loại sự cố mới).
 *
 * Ghi vào sổ sự cố của đơn qua route có sẵn `POST pos/[id]/issues` (quyền
 * `supply.po_issue.manage` đã cho Kho); server phát `po.issue_recorded` → người
 * phụ trách đơn nhận thông báo (0231). Không đổi tồn, không đổi đơn. Kho KHÔNG
 * đóng sự cố (Q4) — đó là việc của Cung ứng sau khi làm việc với NCC.
 *
 * Ô gõ thô cập nhật từng phím (nút Báo mở ngay khi gõ). Viết lại không kit (Kho
 * lối ERP · B6).
 */
export function BaoSuCoSheet({
  data,
  onClose,
}: {
  /* Chỉ những trường hộp dùng — để form nhận hàng mở được hộp bằng dữ liệu nó có
     sẵn, không phải nạp lại cả "Hàng của đơn" (26/10/2026). */
  data: {
    po: Pick<HangCuaDonData['po'], 'id' | 'code' | 'supplier_name' | 'lsx_code' | 'assignee_name'> // prettier-ignore
    lines: Pick<HangCuaDonData['lines'][number], 'id' | 'code' | 'name' | 'unit'>[]
  }
  onClose: () => void
}) {
  const router = useRouter()
  const { po, lines } = data
  const [tuChoi, setTuChoi] = useState(false)
  const [kind, setKind] = useState<IssueKind | null>(null)
  const [lineId, setLineId] = useState('')
  const [qty, setQty] = useState('')
  const [moTa, setMoTa] = useState('')
  const [busy, setBusy] = useState(false)
  const [loiServer, setLoiServer] = useState<string | null>(null)

  /** Đã bấm Báo mà còn thiếu — câu chặn đổi sang màu cảnh báo. */
  const [daThu, setDaThu] = useState(false)
  const oLoai = useRef<HTMLSpanElement>(null)
  const oSl = useRef<HTMLInputElement>(null)
  const oMoTa = useRef<HTMLTextAreaElement>(null)

  const kq = thanSuCo({ kind, tuChoi, poLineId: lineId || null, qty, moTa })
  const chan = 'loi' in kq ? kq.loi : null
  const dong = lines.find((l) => l.id === lineId) ?? null
  const nguoi = po.assignee_name ?? 'người phụ trách đơn'

  /*
    K3 (28/10/2026, chạy kịch bản thử Kho): nút Báo từng khoá cứng (`disabled`) —
    mở hộp ra là nút xám, bấm không phản hồi, câu "thiếu gì" chỉ hiện SAU khi đã
    chọn / gõ. Nay câu chặn đứng cạnh nút ngay từ đầu; bấm khi còn thiếu thì câu
    đổi màu và con trỏ nhảy tới đúng chỗ phải điền (cùng thứ tự với `thanSuCo`).
  */
  function bam() {
    if (busy) return
    if (!chan) return void bao()
    setDaThu(true)
    if (!kind) oLoai.current?.querySelector('button')?.focus()
    else if (moTa.trim().length < 5) oMoTa.current?.focus()
    else oSl.current?.focus()
  }

  async function bao() {
    if (!('body' in kq)) return
    setBusy(true)
    setLoiServer(null)
    try {
      await api(`/api/dept/supply/pos/${po.id}/issues`, { method: 'POST', body: kq.body })
      onClose()
      router.refresh()
    } catch (e) {
      setLoiServer(apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <HopThoai
      title={`Báo sự cố giao hàng · ${po.code}`}
      subtitle={[po.supplier_name, po.lsx_code, po.assignee_name && `phụ trách ${po.assignee_name}`].filter(Boolean).join(' · ')} // prettier-ignore
      onClose={onClose}
      width={580}
      footer={
        <>
          {chan && (
            <span
              className={daThu ? 'chua kh-stop' : 'chua kh-mut'}
              role={daThu ? 'alert' : undefined}
              style={daThu ? { fontWeight: 600 } : undefined}
            >
              Chưa báo được: {chan}
            </span>
          )}
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={!!chan || busy || undefined}
            onClick={bam}
          >
            {busy ? 'Đang báo…' : 'Báo sự cố'}
          </button>
        </>
      }
    >
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault()
          bam()
        }}
      >
        <fieldset style={{ ...COT, border: 0, margin: 0, padding: 0, gap: 6 }}>
          <legend style={{ ...NHAN, marginBottom: 4 }}>Lô hàng này</legend>
          {(
            [
              [false, 'Đã nhận / sẽ nhận phần dùng được', CHO_GHI_HANG_KHOA ? 'Phần đạt nhận bằng form nhận hàng; phần sai chọn “Sai quy cách” ở đó để hàng vào kệ khoá.' : 'Chỉ nhập phần đạt ở form nhận hàng. Phần sai KHÔNG nhập — ghi loại + số lượng ở đây để Cung ứng làm việc với NCC.'], // prettier-ignore
              [true, 'Từ chối nhận cả lô', 'Xe chở về lại. Không lập phiếu nhập, tồn không đổi. Cung ứng hẹn NCC giao lại.'], // prettier-ignore
            ] as const
          ).map(([v, ten, cau]) => (
            <label
              key={String(v)}
              style={{
                display: 'flex',
                gap: 8,
                padding: '7px 10px',
                cursor: 'pointer',
                border: `1px solid ${tuChoi === v ? 'var(--kh-act)' : 'var(--kh-line)'}`,
                background: tuChoi === v ? 'var(--kh-act-wash)' : 'var(--kh-card)',
              }}
            >
              <input
                type="radio"
                name="lo-hang"
                checked={tuChoi === v}
                onChange={() => setTuChoi(v)}
              />
              <span>
                <b>{ten}</b>
                <span className="kh-mut" style={{ display: 'block', fontSize: 12 }}>
                  {cau}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset style={{ ...COT, border: 0, margin: 0, padding: 0 }}>
          <legend style={{ ...NHAN, marginBottom: 4 }}>Loại sự cố</legend>
          <span ref={oLoai} className="kh-loc-nho" style={{ flexWrap: 'wrap' }}>
            {ISSUE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {ISSUE_KIND_LABEL[k]}
              </button>
            ))}
          </span>
        </fieldset>

        <span
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 8 }}
        >
          <label style={COT}>
            <span style={NHAN}>Dòng hàng (không bắt buộc)</span>
            <select
              className="kh-o"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
            >
              <option value="">— cả đơn / không rõ dòng —</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code ?? '—'} · {l.name}
                </option>
              ))}
            </select>
          </label>
          <label style={COT}>
            <span style={NHAN}>Số lượng{dong ? ` (${dong.unit})` : ''}</span>
            <input
              ref={oSl}
              className="kh-o num"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="không bắt buộc"
            />
          </label>
        </span>

        <label style={COT}>
          <span style={NHAN}>Mô tả · bắt buộc</span>
          <textarea
            ref={oMoTa}
            className="kh-o"
            value={moTa}
            onChange={(e) => setMoTa(e.target.value)}
            rows={3}
            maxLength={950}
            placeholder="Thấy gì, bao nhiêu, đã làm gì (chụp ảnh, trả xe…)"
          />
        </label>

        <div
          className="kh-hau"
          style={{ borderLeftColor: 'var(--kh-act)', background: 'var(--kh-act-wash)' }}
        >
          Ghi vào <b>sổ sự cố của {po.code}</b>
          {tuChoi && (
            <>
              {' '}
              với chữ <span className="kh-num">{TU_CHOI_NHAN}</span> ở đầu mô tả
            </>
          )}
          , và <b>báo cho {nguoi}</b> (Cung ứng) để làm việc với NCC. Tồn kho và trạng
          thái đơn không đổi.
        </div>
        {loiServer && <p className="kh-stop">{loiServer}</p>}
      </form>
    </HopThoai>
  )
}
