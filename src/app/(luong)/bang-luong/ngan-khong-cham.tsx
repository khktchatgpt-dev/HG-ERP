'use client'

/**
 * NGƯỜI KHÔNG CHẤM CÔNG trên bảng lương (chủ dự án 23/10/2026): "trường hợp đặc biệt bên kế
 * toán xử lý, thường lương tháng". Ô công trống = đủ lương tháng cho phần kỳ còn làm (vào /
 * nghỉ giữa kỳ tự cắt); người quản lý lương nhập công / giờ tăng ca khi khác thoả thuận.
 * Rời ô là ghi; sửa xong bấm Tính lại. Kiểm tại chỗ bằng `kiemNhap` — cùng hàm server dùng.
 * Nhân sự không nhập, kỳ công không chặn chốt vì nhóm này.
 */

import { useState } from 'react'
import { Empty, NumInput, Tag, TextInput } from '@/components/kit'
import { cn } from '@/lib/utils'
import { docSo, kiemNhap, soNgayKy } from '@/lib/cham-cong/cong-nhap-tay'
import type { BangLuongCtx } from './useBangLuong'
import { R, lucVn, so, TD, TF, TH, type BangLuongTrang } from './bang-luong.shared'

type Dong = BangLuongTrang['khongCham'][number]
const soO = (n: number | null) => (n == null ? '' : so(n, 2))

export function NganKhongCham({ d }: { d: BangLuongCtx }) {
  const { b } = d
  const sua = d.nhap && b.quyen.chay
  const ngayKy = b.ky ? soNgayKy(b.ky.tu, b.ky.den) : 31
  const daNhap = b.khongCham.filter((x) => x.cong != null).length
  if (!b.khongCham.length)
    return (
      <Empty
        headline="Kỳ này không có ai được đánh dấu “không chấm công”"
        reason="Mục này dành cho người không quẹt máy (văn phòng, bảo vệ, tài xế, bếp…) — hồ sơ nhân viên của họ mang dấu “không chấm công”, lương tháng."
        next="Nhân sự đánh dấu ở hồ sơ nhân viên; bảng lương tự trả đủ lương tháng, ai khác thì nhập ở đây."
      />
    )
  return (
    <div className="flex min-h-0 flex-col overflow-auto bg-[var(--surface-card)]">
      <div className="text-k-sm border-b border-[var(--line)] px-[var(--gutter)] py-2 text-[var(--ink-2)]">
        <b className="text-[var(--ink)]">Lương tháng, không theo máy.</b> Ô công trống =
        đủ lương tháng cho phần kỳ còn làm. Chỉ nhập khi khác: số công thật, giờ tăng ca
        (tính hệ số khung 16h–19h). Nhập xong bấm <b>Tính lại</b>.
        {!d.nhap && ' Bảng đã gửi duyệt — rút về nháp để sửa.'}
        {d.nhap && !b.quyen.chay && ' Chỉ xem — người quản lý lương nhập.'}
      </div>
      <table
        className="text-k-sm w-full border-separate border-spacing-0"
        style={{ minWidth: 980 }}
      >
        <thead>
          <tr>
            <th className={TH}>Mã</th>
            <th className={TH}>Họ tên</th>
            <th className={TH}>Tổ</th>
            <th className={TH} style={R}>
              Ngày làm việc
            </th>
            <th className={TH} style={{ ...R, width: 96 }}>
              Công
            </th>
            <th className={TH} style={{ ...R, width: 96 }}>
              Giờ tăng ca
            </th>
            <th className={TH} style={{ minWidth: 200 }}>
              Ghi chú
            </th>
            <th className={TH} style={{ minWidth: 220 }}>
              Tính lương theo
            </th>
          </tr>
        </thead>
        <tbody>
          {b.khongCham.map((x) => (
            <Hang key={x.ma} x={x} d={d} sua={sua} ngayKy={ngayKy} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={TF} colSpan={4}>
              {b.khongCham.length} người · {daNhap} nhập số riêng ·{' '}
              {b.khongCham.length - daNhap} đủ lương tháng
            </td>
            <td className={cn(TF, 'num')} style={R}>
              {so(
                b.khongCham.reduce((s, x) => s + (x.cong ?? 0), 0),
                2,
              )}
            </td>
            <td className={cn(TF, 'num')} style={R}>
              {so(
                b.khongCham.reduce((s, x) => s + (x.tcGio ?? 0), 0),
                2,
              )}
            </td>
            <td className={TF} colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Hang({
  x,
  d,
  sua,
  ngayKy,
}: {
  x: Dong
  d: BangLuongCtx
  sua: boolean
  ngayKy: number
}) {
  const [loi, setLoi] = useState<string | null>(null)
  const dangGhi = d.busy === `nhap:${x.ma}`
  const kiem = kiemNhap(
    { cong: x.cong, tcGio: x.tcGio },
    { soNgayKy: ngayKy, ngayLamViec: x.ngayLamViec },
  )

  async function ghi(p: {
    cong?: number | null
    tcGio?: number | null
    ghiChu?: string | null
  }) {
    const v = {
      ma: x.ma,
      cong: p.cong !== undefined ? p.cong : x.cong,
      tcGio: p.tcGio !== undefined ? p.tcGio : x.tcGio,
      ghiChu: p.ghiChu !== undefined ? p.ghiChu : x.ghiChu,
    }
    const kq = kiemNhap(
      { cong: v.cong, tcGio: v.tcGio },
      { soNgayKy: ngayKy, ngayLamViec: x.ngayLamViec },
    )
    if (kq.loi) {
      setLoi(kq.loi)
      return
    }
    setLoi(null)
    if (v.cong === x.cong && v.tcGio === x.tcGio && v.ghiChu === x.ghiChu) return
    await d.nhapCong(v)
  }

  const macDinh = x.cong == null
  return (
    <tr className={cn(loi && 'bg-[var(--stop-wash)]')}>
      <td className={cn(TD, 'num text-[var(--ink-3)]')}>{x.ma}</td>
      <td className={TD}>{x.ten}</td>
      <td className={cn(TD, 'text-[var(--ink-2)]')}>{x.to ?? '—'}</td>
      <td className={cn(TD, 'num text-[var(--ink-2)]')} style={R}>
        {x.ngayLamViec}
      </td>
      <td className={cn(TD, 'py-0.5')}>
        {sua ? (
          <NumInput
            aria-label={`Công của ${x.ten}`}
            value={soO(x.cong)}
            disabled={dangGhi}
            placeholder="đủ"
            onCommit={(s) => ghi({ cong: docSo(s) })}
            className={cn(loi && 'border-[var(--stop)]')}
          />
        ) : (
          <span className="num block" style={R}>
            {macDinh ? '—' : soO(x.cong)}
          </span>
        )}
      </td>
      <td className={cn(TD, 'py-0.5')}>
        {sua ? (
          <NumInput
            aria-label={`Giờ tăng ca của ${x.ten}`}
            value={soO(x.tcGio)}
            disabled={dangGhi}
            onCommit={(s) => ghi({ tcGio: docSo(s) })}
          />
        ) : (
          <span className="num block" style={R}>
            {x.tcGio ? soO(x.tcGio) : ''}
          </span>
        )}
      </td>
      <td className={cn(TD, 'py-0.5')}>
        {sua ? (
          <TextInput
            label={`Ghi chú của ${x.ten}`}
            value={x.ghiChu ?? ''}
            disabled={dangGhi || macDinh}
            placeholder={macDinh ? 'nhập công trước' : ''}
            onCommit={(s) => ghi({ ghiChu: s.trim() || null })}
          />
        ) : (
          <span className="text-[var(--ink-2)]">{x.ghiChu ?? ''}</span>
        )}
      </td>
      <td className={cn(TD, 'whitespace-normal')}>
        {loi ? (
          <span className="text-k-sm text-[var(--stop)]">{loi} — chưa lưu</span>
        ) : macDinh ? (
          <Tag>đủ lương tháng</Tag>
        ) : kiem.canhBao ? (
          <span className="text-k-sm text-[var(--warn)]">{kiem.canhBao}</span>
        ) : (
          <Tag tone="done">số Kế toán nhập</Tag>
        )}
        {!macDinh && x.nguoiSua && (
          <span className="text-k-label block text-[var(--ink-3)]">
            {x.nguoiSua} · {lucVn(x.lucSua)}
          </span>
        )}
      </td>
    </tr>
  )
}
