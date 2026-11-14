'use client'

import { useRef, useState } from 'react'
import { apiErrorText } from '@/lib/api'
import { ngayGioVn } from '@/lib/date-vn'
import { khoaSauMoLai, ngaySau } from '@/lib/kho-kiem-ky'
import type { NhatKyKy } from '@/modules/dept/warehouse/nxt.repo'
import { HopThoai } from '../_erp/o-nhap'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const nhanThang = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`
const fmtTien = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
const TOI_THIEU = 10

/**
 * NHẬT KÝ CHỐT / MỞ LẠI KỲ (B3, 0300) — bảng dùng chung cho hộp Mở lại và hộp
 * Nhật ký. Mới → cũ; lý do chỉ có ở dòng mở lại.
 */
export function BangNhatKy({ ds }: { ds: readonly NhatKyKy[] }) {
  if (ds.length === 0)
    return <p className="nx-kk-sau">Chưa có lần chốt hay mở lại nào trên ERP.</p>
  return (
    <table className="nx-kk-tb" aria-label="Nhật ký chốt kỳ">
      <thead>
        <tr>
          <th>Lúc</th>
          <th>Việc</th>
          <th>Người</th>
          <th className="r">Tồn cuối</th>
          <th>Lý do</th>
        </tr>
      </thead>
      <tbody>
        {ds.map((d) => (
          <tr key={d.id}>
            <td className="kh-num">{ngayGioVn(d.created_at)}</td>
            <td className={d.action === 'reopen' ? 'kh-warn' : undefined}>
              {d.action === 'reopen' ? 'Mở lại' : 'Chốt'} {nhanThang(d.thang)}
            </td>
            <td>{d.ai ?? <span className="kh-empty">·</span>}</td>
            <td className="r kh-num">
              {d.gt_ton_cuoi == null ? (
                <span className="kh-empty">·</span>
              ) : (
                fmtTien(d.gt_ton_cuoi)
              )}
            </td>
            <td style={{ whiteSpace: 'normal' }}>
              {d.reason ?? <span className="kh-empty">·</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function NhatKyHop({
  ds,
  onClose,
}: {
  ds: readonly NhatKyKy[]
  onClose: () => void
}) {
  return (
    <HopThoai
      title="Nhật ký chốt kỳ"
      subtitle="Mỗi lần chốt hoặc mở lại một tháng của sổ kho — chỉ cộng thêm, không sửa."
      onClose={onClose}
      width={720}
      footer={
        <button type="button" className="kh-btn" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <BangNhatKy ds={ds} />
    </HopThoai>
  )
}

/**
 * MỞ LẠI THÁNG ĐÃ CHỐT (B3, bản vẽ https://claude.ai/artifact/6mgaRUw38AvLwCS1199P73
 * khung 6). Chỉ tháng chốt mới nhất (Q6), Kế toán trưởng (Q2), bắt lý do ≥ 10 ký
 * tự. Hộp nói trước hệ quả: ngày khoá lùi về đâu, Kho ghi được phiếu từ ngày nào.
 * Câu chặn ở chân hộp bấm được — đưa con trỏ về ô lý do. Lỗi máy chủ hiện TẠI CHỖ.
 */
export function MoLaiHop({
  thang,
  den,
  chot,
  thangDaChot,
  nhatKy,
  onClose,
  onMoLai,
}: {
  /** Tháng mở lại `YYYY-MM` — tháng chốt mới nhất. */
  thang: string
  /** Ngày khoá hiện tại (cuối tháng `thang`). */
  den: string
  /** Lần chốt đang có của tháng này — đầu hộp. */
  chot: { closed_at: string; closed_by: string | null }
  thangDaChot: readonly string[]
  nhatKy: readonly NhatKyKy[]
  onClose: () => void
  onMoLai: (lyDo: string) => Promise<void>
}) {
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const o = useRef<HTMLTextAreaElement>(null)
  const ngan = lyDo.trim().length < TOI_THIEU
  const khoaMoi = khoaSauMoLai(thang, thangDaChot)

  const veO = () => o.current?.focus()
  const gui = async () => {
    if (busy) return
    if (ngan) return veO()
    setBusy(true)
    setLoi(null)
    try {
      await onMoLai(lyDo.trim())
    } catch (e) {
      setLoi(apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <HopThoai
      title={`Mở lại tháng ${nhanThang(thang)}`}
      subtitle={`Chốt ${ngayGioVn(chot.closed_at)}${chot.closed_by ? ` · ${chot.closed_by}` : ''}`}
      onClose={onClose}
      width={640}
      footer={
        <>
          {loi ? (
            <span className="chua kh-stop" role="alert">
              Chưa mở được: {loi}
            </span>
          ) : ngan ? (
            <button type="button" className="chua kh-lnk kh-stop" onClick={veO}>
              Chưa mở được: ghi lý do (ít nhất {TOI_THIEU} ký tự)
            </button>
          ) : null}
          <button type="button" className="kh-btn" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={ngan || busy}
            onClick={() => void gui()}
          >
            {busy ? 'Đang mở lại…' : `Mở lại tháng ${nhanThang(thang)}`}
          </button>
        </>
      }
    >
      <ul className="nx-kk" aria-label="Sau khi mở lại">
        <li>
          <span aria-hidden>·</span>
          <span className="kq">Ngày khoá</span>
          <span>
            <span className="kh-num">{dmy(den)}</span> →{' '}
            {khoaMoi ? (
              <b className="kh-num">{dmy(khoaMoi)}</b>
            ) : (
              <b>hết khoá — sổ kho không còn tháng nào chốt</b>
            )}
          </span>
          <span />
        </li>
        <li>
          <span aria-hidden>·</span>
          <span className="kq">Kho</span>
          <span>
            {khoaMoi ? (
              <>
                Ghi được phiếu ngày từ <b className="kh-num">{dmy(ngaySau(khoaMoi))}</b>
              </>
            ) : (
              'Ghi được phiếu mọi ngày'
            )}
          </span>
          <span />
        </li>
        <li>
          <span aria-hidden>·</span>
          <span className="kq">Báo cáo</span>
          <span>
            Tháng {nhanThang(thang)} tính lại từ sổ, bỏ bản chốt — ghi bù xong thì chốt
            lại
          </span>
          <span />
        </li>
      </ul>

      <label
        className="nx-kk-k"
        htmlFor="mo-lai-ly-do"
        style={{ color: 'var(--kh-stop)' }}
      >
        Lý do mở lại *
      </label>
      <textarea
        id="mo-lai-ly-do"
        ref={o}
        className={ngan && lyDo ? 'kh-o need' : 'kh-o'}
        rows={3}
        maxLength={500}
        value={lyDo}
        onChange={(e) => {
          setLyDo(e.target.value)
          setLoi(null)
        }}
        placeholder="Vd: ghi bù phiếu xuất cho 09/26-27 - MX còn sót tháng 10"
        disabled={busy}
      />

      <div className="nx-kk-k">Nhật ký chốt kỳ</div>
      <BangNhatKy ds={nhatKy.slice(0, 8)} />
    </HopThoai>
  )
}
