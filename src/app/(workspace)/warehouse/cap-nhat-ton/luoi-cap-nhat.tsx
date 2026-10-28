'use client'

import { useRef, useState } from 'react'
import {
  LY_DO_CAP_NHAT,
  chenh,
  docSoThucTe,
  hoiLenh,
  laXuatBu,
  lyDoCua,
  nhanLyDoCapNhat,
  type DauCapNhat,
  type DongCapNhat,
  type LoiDong,
  type MaLyDoCapNhat,
  type TomTatCapNhat,
} from '@/lib/kho-cap-nhat-ton'
import { useBeRong } from '@/lib/use-be-rong'
import { OChu } from '../_erp/o-nhap'
import { BU_LOI, HoiLenh } from './hoi-lenh'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/**
 * Ô SỐ THỰC TẾ. Khác `OSo` của khung ở một chỗ có lý do: chữ gõ sai ("12a") vẫn
 * nằm nguyên trong ô cho người gõ thấy mà sửa — `OSo` đổi chữ lạ thành 0, và ở
 * màn này 0 là "kệ hết hàng", một con số ghi được. Trống = chưa gõ (null).
 */
function OThucTe({
  id,
  value,
  onCommit,
  label,
  need,
  disabled,
}: {
  id: string
  value: number | null
  onCommit: (v: number | null) => void
  label: string
  need: boolean
  disabled: boolean
}) {
  const hien = value != null && Number.isFinite(value) ? fmt(value) : null
  const [text, setText] = useState(hien ?? '')
  const [seen, setSeen] = useState(value)
  if (!Object.is(seen, value)) {
    setSeen(value)
    // Giá trị từ ngoài đổi (bỏ dòng, làm mới) thì vẽ lại; NaN là chữ đang gõ — giữ.
    if (value == null || hien != null) setText(hien ?? '')
  }
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={need ? 'kh-o num need' : 'kh-o num'}
      value={text}
      placeholder="gõ số"
      aria-label={label}
      aria-invalid={need || undefined}
      disabled={disabled}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(docSoThucTe(text))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) onCommit(docSoThucTe(text))
      }}
    />
  )
}

function OChenh({ r }: { r: DongCapNhat }) {
  const c = chenh(r)
  if (c == null) return <span className="kh-empty">—</span>
  if (Math.abs(c) < 1e-9) return <span className="kh-mut">khớp</span>
  if (c > 0) return <span className="kh-ok">+{fmt(c)}</span>
  return (
    <span
      className={laXuatBu(r) ? 'kh-warn' : 'kh-stop'}
      title={laXuatBu(r) ? 'Ghi thành phiếu xuất bù cho lệnh' : 'Ghi thiếu khi kiểm kê'}
    >
      −{fmt(-c)}
    </span>
  )
}

/**
 * LƯỚI CẬP NHẬT SỐ THỰC TẾ — Kho lối ERP, không kit. Bản vẽ C1: # · Mã · Tên ·
 * ĐVT · Trên máy · Thực tế · Chênh · Lý do. Hàng phụ dưới dòng hỏi "tổ đã lấy
 * hay hỏng / mất" (Q3) và nói lỗi TẠI CHỖ sau khi đã bấm ghi.
 */
export function LuoiCapNhat({
  rows,
  dau,
  loi,
  daThu,
  patch,
  xoa,
  tong,
  busy,
}: {
  rows: DongCapNhat[]
  dau: DauCapNhat
  loi: LoiDong[]
  daThu: boolean
  patch: (i: number, p: Partial<DongCapNhat>) => void
  xoa: (i: number) => void
  tong: TomTatCapNhat
  busy: boolean
}) {
  const khung = useRef<HTMLDivElement>(null)
  const rong = useBeRong(khung)
  const hep = rong > 0 && rong < 900
  const loiCua = (i: number) => (daThu ? loi.filter((l) => l.i === i) : [])

  return (
    <div ref={khung} className="kh-grid">
      <table className="kh-tb" aria-label="Mã cập nhật số thực tế">
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: hep ? 92 : 108 }} />
          <col />
          <col style={{ width: 56 }} />
          <col style={{ width: hep ? 82 : 96 }} />
          <col style={{ width: hep ? 100 : 116 }} />
          <col style={{ width: hep ? 76 : 92 }} />
          <col style={{ width: hep ? 160 : 210 }} />
          <col style={{ width: 48 }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th className="r" title="Tồn trên máy lúc thêm dòng — máy tính lại lúc ghi">
              Trên máy
            </th>
            <th className="r">Thực tế</th>
            <th className="r">Chênh</th>
            <th>Lý do</th>
            <th aria-label="Bỏ dòng" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const ls = loiCua(i)
            const sai = ls.some((l) => ['chua_go', 'so_sai', 'so_am'].includes(l.reason))
            const ly = lyDoCua(r, dau)
            const hoi = hoiLenh(r)
            const c = chenh(r)
            return [
              <tr key={r.material_id} className="d f">
                <td className="kh-num kh-mut">{i + 1}</td>
                <td className="kh-ma">{r.code}</td>
                <td title={r.name}>{r.name}</td>
                <td className="kh-mut">{r.unit}</td>
                <td className="r kh-num">{fmt(r.tren_may)}</td>
                <td className="r go">
                  <OThucTe
                    id={`cn-tt-${i}`}
                    value={r.thuc_te}
                    // Đổi số đếm thì máy chia lại phần xuất bù (bỏ số gõ tay cũ).
                    onCommit={
                      (v) =>
                      patch(i, Object.is(v, r.thuc_te) ? { thuc_te: v } : { thuc_te: v, bu_go: null }) // prettier-ignore
                    }
                    label={`Thực tế ${r.code}`}
                    need={sai}
                    disabled={busy}
                  />
                </td>
                <td className="r kh-num">
                  <OChenh r={r} />
                </td>
                <td className="go">
                  <select
                    id={`cn-ly-${i}`}
                    className="kh-o"
                    value={r.ly_do}
                    onChange={(e) =>
                      patch(i, { ly_do: e.target.value as MaLyDoCapNhat | '' })
                    }
                    aria-label={`Lý do ${r.code}`}
                    disabled={busy}
                  >
                    <option value="">
                      Theo lý do chung · {nhanLyDoCapNhat(dau.ly_do_chung)}
                    </option>
                    {LY_DO_CAP_NHAT.map((x) => (
                      <option key={x.ma} value={x.ma}>
                        {x.nhan}
                      </option>
                    ))}
                  </select>
                  {ly === 'khac' && (
                    <OChu
                      id={`cn-gc-${i}`}
                      value={r.ghi_chu}
                      onCommit={(v) => patch(i, { ghi_chu: v })}
                      placeholder="bắt buộc: ghi rõ vì sao"
                      label={`Ghi chú ${r.code}`}
                      tone={
                        ls.some((l) => l.reason === 'thieu_ghi_chu') ? 'need' : undefined
                      }
                      disabled={busy}
                      className="cn-gc"
                    />
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="mo"
                    style={{ width: 'auto', color: 'var(--kh-stop)' }}
                    onClick={() => xoa(i)}
                    aria-label={`Bỏ dòng ${r.code}`}
                    disabled={busy}
                  >
                    Bỏ
                  </button>
                </td>
              </tr>,
              hoi && c != null && (
                <tr key={`${r.material_id}-hoi`} className="cn-sub">
                  <td />
                  <td colSpan={8}>
                    <HoiLenh
                      r={r}
                      onDoi={(p) => patch(i, p)}
                      ten={`cn-cd-${i}`}
                      idGoc={`cn-bu-${i}`}
                      need={ls.some((l) => BU_LOI.includes(l.reason))}
                      busy={busy}
                    />
                  </td>
                </tr>
              ),
              ls.length > 0 && (
                <tr key={`${r.material_id}-loi`} className="cn-sub">
                  <td />
                  <td colSpan={8}>
                    <div className="cn-loi" role="alert">
                      {ls.map((l) => l.message.replace(/^dòng \d+ /, '')).join(' · ')}
                    </div>
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>
              Tổng · {tong.dong} mã · số theo ĐVT từng mã, không cộng dồn
            </td>
            <td colSpan={3} style={{ fontWeight: 400 }}>
              khớp {tong.khop} · thừa {tong.thua} · thiếu {tong.thieu} · xuất bù{' '}
              {tong.xuat_bu}
              {tong.chua_go > 0 ? ` · chưa gõ ${tong.chua_go}` : ''}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
