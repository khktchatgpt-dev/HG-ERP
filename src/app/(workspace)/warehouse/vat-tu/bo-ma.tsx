'use client'

import { useEffect, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { usageTotal, type MaterialUsage } from '@/lib/material-usage'
import { HopThoai } from '../_erp/o-nhap'

const so = (n: number) => n.toLocaleString('vi-VN')

/**
 * NGỪNG DÙNG / XOÁ MÃ — bản của Kho (B7c, bản vẽ K-5e
 * https://claude.ai/artifact/FZeQh7hzZPTFtQFYYZsrFB, duyệt 14/10/2026).
 *
 * Cùng luật, cùng API với Mua hàng (`bo-ma.tsx` bên đó), giao diện riêng của Kho:
 *   · Đếm chỗ mã đang nằm bằng `GET …/usage` — ĐÚNG hàm service dùng để chặn xoá
 *     (số là lời hứa).
 *   · Đã dùng ở đâu đó → chỉ NGỪNG DÙNG, bắt lý do ≥ 3 ký tự (`POST …/active`).
 *     Mã biến khỏi ô tìm khi nhập / xuất / soạn đơn mới; tồn, phiếu, đơn cũ giữ.
 *   · Chưa dùng ở đâu → XOÁ HẲN (`DELETE …/[id]`), xác nhận một lần, không hoàn
 *     tác; sổ vết vẫn giữ dòng "đã xoá" (0221).
 * Nút xác nhận dùng màu hành động như mọi nút — đỏ là màu vòng đời dữ liệu, không
 * lên nút (nguyên tắc 5).
 */
export function BoMaHop({
  m,
  onClose,
  onDone,
}: {
  m: { id: string; code: string; name: string }
  onClose: () => void
  /** `xoa` = mã đã xoá (bỏ khỏi lưới); `ngung` = đã ngừng dùng. */
  onDone: (kieu: 'xoa' | 'ngung', cau: string) => void
}) {
  const [usage, setUsage] = useState<MaterialUsage | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)
  const [daThu, setDaThu] = useState(false)

  useEffect(() => {
    let live = true
    api<{ usage: MaterialUsage }>(`/api/dept/warehouse/materials/${m.id}/usage`)
      .then((r) => live && setUsage(r.usage))
      .catch((e) => live && setLoi(`Không đếm được chỗ dùng mã: ${apiErrorText(e)}`))
    return () => {
      live = false
    }
  }, [m.id])

  const daDung = usage != null && usageTotal(usage) > 0
  const thieuLyDo = lyDo.trim().length < 3

  async function lam() {
    if (!usage || busy) return
    setDaThu(true)
    if (daDung && thieuLyDo) return
    setBusy(true)
    setLoi(null)
    try {
      if (daDung) {
        await api(`/api/dept/warehouse/materials/${m.id}/active`, {
          method: 'POST',
          body: { active: false, reason: lyDo.trim() },
        })
        onDone('ngung', `Đã ngừng dùng ${m.code} — tồn, phiếu, đơn cũ giữ nguyên; xem lại ở tab “Ngừng dùng”.`) // prettier-ignore
      } else {
        await api(`/api/dept/warehouse/materials/${m.id}`, { method: 'DELETE' })
        onDone('xoa', `Đã xoá ${m.code} — sổ vết vẫn giữ dòng “đã xoá”.`)
      }
    } catch (e) {
      setLoi(apiErrorText(e))
      setBusy(false)
    }
  }

  const o = (n: number, t: string) => (
    <div style={{ padding: '6px 10px', borderRight: '1px solid var(--kh-hair)' }}>
      <span className="kh-mut" style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t}</span>
      <span className={n > 0 ? 'kh-num kh-b' : 'kh-num kh-mut'} style={{ fontSize: 17 }}>{so(n)}</span>
    </div>
  ) // prettier-ignore

  return (
    <HopThoai
      title={usage == null ? `Bỏ mã ${m.code}` : daDung ? `Ngừng dùng ${m.code}` : `Xoá mã ${m.code}`}
      subtitle={m.name}
      onClose={onClose}
      width={580}
      footer={
        <>
          <span style={{ marginRight: 'auto', fontSize: 12.5 }}>
            {loi ? (
              <span className="kh-stop" role="alert">{loi}</span>
            ) : daDung && thieuLyDo && daThu ? (
              <span className="kh-stop">Ghi lý do ngừng dùng (ít nhất 3 ký tự)</span>
            ) : null}
          </span>
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            disabled={usage == null || busy}
            aria-disabled={(daDung && thieuLyDo) || undefined}
            onClick={() => void lam()}
          >
            {busy ? 'Đang ghi…' : daDung ? 'Ngừng dùng' : usage ? 'Xoá mã' : 'Đang đếm…'}
          </button>
        </>
      } // prettier-ignore
    >
      {usage == null ? (
        !loi && <p className="kh-mut">Đang đếm chỗ mã đang nằm…</p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Mã đang có mặt ở"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', border: '1px solid var(--kh-line)' }}
          >
            {o(usage.stock, 'Dòng sổ kho')}
            {o(usage.po, 'Dòng đơn mua')}
            {o(usage.bom, 'Dòng định mức')}
            {o(usage.prices + usage.other + (usage.de_nghi ?? 0), 'Giá NCC · kế hoạch · đề nghị')}
          </div>
          {daDung ? (
            <>
              <div className="kh-hau" style={{ borderLeftColor: 'var(--kh-stop)', background: 'var(--kh-stop-wash)' }}>
                Đã dùng ở <b>{so(usageTotal(usage))} chỗ</b> → <b>không xoá được</b> (xoá là
                mất dấu vết). Ngừng dùng: mã ẩn khỏi ô tìm khi nhập, xuất, soạn đơn mới;
                tồn và lịch sử giữ nguyên. Dùng lại được bất cứ lúc nào.
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="kh-mut" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: daDung && thieuLyDo && daThu ? 'var(--kh-stop)' : undefined }}>
                  Lý do ngừng dùng · bắt buộc
                </span>
                <textarea
                  className={daThu && thieuLyDo ? 'kh-o need' : 'kh-o'}
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="vd: trùng mã khác, gộp về mã đó · NCC ngừng sản xuất · đổi quy cách"
                />
              </label>
            </>
          ) : (
            <div className="kh-hau" style={{ borderLeftColor: 'var(--kh-act)', background: 'var(--kh-act-wash)' }}>
              Mã <b className="kh-num">{m.code}</b> <b>chưa dùng ở đâu</b> — xoá hẳn khỏi danh
              mục. <b>Không hoàn tác.</b> Sổ vết vẫn ghi “đã xoá” theo mã.
            </div>
          )}
        </>
      )}
    </HopThoai>
  ) // prettier-ignore
}
