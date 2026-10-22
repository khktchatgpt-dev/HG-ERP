'use client'

/**
 * CÔNG NHẬP TAY — khối A (bản vẽ duyệt 22/10/2026, PYQ1Dw2W…, Q1–Q6 theo đề xuất). Người không
 * chấm công: Nhân sự nhập số công + giờ tăng ca mỗi kỳ; còn người trống thì chưa chốt kỳ được.
 * Rời ô là ghi (mỗi lần ghi một dòng ở Dòng thời gian). Kiểm tại chỗ bằng `kiemNhap` — cùng
 * hàm server dùng. Khối B (công cộng thêm ngoài máy) là bước sau.
 */

import { useState } from 'react'
import { Btn, Empty, NumInput, Tag, TextInput } from '@/components/kit'
import { cn } from '@/lib/utils'
import { docSo, kiemNhap, soNgayKy } from '@/lib/cham-cong/cong-nhap-tay'
import type { KyCongCtx, KyCongTrang } from './useKyCong'
import { lucVn, so } from './ky.shared'
import { TD, TH } from './ngan-to'

type Dong = KyCongTrang['khongCham'][number]
const R = { textAlign: 'right' as const }
const soO = (n: number | null) => (n == null ? '' : so(n, 2))

export function NganNhapTay({ d }: { d: KyCongCtx }) {
  const { k } = d
  const sua = d.mo && k.quyen.nhapTay
  const ngayKy = soNgayKy(k.tu, k.den)
  const chua = k.khongCham.filter((x) => x.cong == null).length
  if (!k.khongCham.length)
    return (
      <Empty
        headline="Kỳ này không có ai được đánh dấu “không chấm công”"
        reason="Khối này chỉ dành cho người không quẹt máy (Bảo vệ, Tài xế, Kinh doanh…) — hồ sơ của họ mang dấu “không chấm công”."
        next="Có người không quẹt máy thì đánh dấu ở Nhân viên › hồ sơ › Công việc, rồi quay lại đây nhập công."
      />
    )
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
        <div className="text-k-sm max-w-[80ch] text-[var(--ink-2)]">
          <b className="text-[var(--ink)]">A · Người không chấm công.</b> Công nhập ở đây
          thay cho “đủ công chuẩn” trước đây. Ô trống = chưa nhập, chặn chốt kỳ. Tăng ca
          nhập bằng <b>giờ</b>, tính hệ số khung 16h–19h.
        </div>
        <span className="flex-1" />
        {sua && chua > 0 && (
          <Btn onClick={d.dienGoiY} busy={d.busy === 'goi-y'}>
            Điền gợi ý cho {chua} ô trống
          </Btn>
        )}
      </div>
      {!d.mo && (
        <div className="text-k-sm border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
          Kỳ đã chốt{k.ky?.lanChot ? ` lần ${k.ky.lanChot}` : ''} — công nhập tay khoá
          theo bản chốt. Muốn sửa thì xin mở lại kỳ (menu ⋯ ở góc trên).
        </div>
      )}
      {d.mo && !k.quyen.nhapTay && (
        <div className="text-k-sm border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
          Chỉ xem — nhập công do Phòng Hành Chính Nhân Sự làm.
        </div>
      )}
      <div className="min-h-0 overflow-auto">
        <table className="text-k-sm w-full border-separate border-spacing-0">
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
              <th className={TH}>Kiểm</th>
            </tr>
          </thead>
          <tbody>
            {k.khongCham.map((x) => (
              <HangNhap key={x.ma} x={x} d={d} sua={sua} ngayKy={ngayKy} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                className={cn(TD, 'bg-[var(--surface-raised)] font-semibold')}
                colSpan={4}
              >
                {k.khongCham.length} người · {k.khongCham.length - chua} đã nhập
              </td>
              <td
                className={cn(TD, 'num bg-[var(--surface-raised)] font-semibold')}
                style={R}
              >
                {so(
                  k.khongCham.reduce((s, x) => s + (x.cong ?? 0), 0),
                  2,
                )}
              </td>
              <td
                className={cn(TD, 'num bg-[var(--surface-raised)] font-semibold')}
                style={R}
              >
                {so(
                  k.khongCham.reduce((s, x) => s + (x.tcGio ?? 0), 0),
                  2,
                )}
              </td>
              <td
                className={cn(TD, 'bg-[var(--surface-raised)] text-[var(--ink-3)]')}
                colSpan={2}
              >
                {chua ? `Tổng không gồm ${chua} người chưa nhập` : 'Đủ người — chốt được'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function HangNhap({
  x,
  d,
  sua,
  ngayKy,
}: {
  x: Dong
  d: KyCongCtx
  sua: boolean
  ngayKy: number
}) {
  // Lỗi của lần gõ vừa rồi (chưa gửi đi) — server cũng kiểm lại bằng cùng hàm.
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
    await d.nhapTay(v)
  }

  const chuaNhap = x.cong == null
  return (
    <tr className={cn((loi || (chuaNhap && d.mo)) && 'bg-[var(--stop-wash)]')}>
      <td className={cn(TD, 'num text-[var(--ink-3)]')} style={{ textAlign: 'left' }}>
        {x.ma}
      </td>
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
            placeholder={String(x.ngayLamViec)}
            disabled={dangGhi}
            onCommit={(s) => ghi({ cong: docSo(s) })}
            className={cn(loi && 'border-[var(--stop)]')}
          />
        ) : (
          <span className="num block" style={R}>
            {chuaNhap ? '—' : soO(x.cong)}
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
            disabled={dangGhi || chuaNhap}
            placeholder={chuaNhap ? 'nhập công trước' : ''}
            onCommit={(s) => ghi({ ghiChu: s.trim() || null })}
          />
        ) : (
          <span className="text-[var(--ink-2)]">{x.ghiChu ?? ''}</span>
        )}
      </td>
      <td className={cn(TD, 'whitespace-normal')}>
        {loi ? (
          <span className="text-k-sm text-[var(--stop)]">{loi} — chưa lưu</span>
        ) : chuaNhap ? (
          <span className="text-k-sm text-[var(--stop)]">
            Chưa nhập công{d.mo ? ' — chặn chốt kỳ' : ''}
          </span>
        ) : kiem.canhBao ? (
          <span className="text-k-sm text-[var(--warn)]">{kiem.canhBao}</span>
        ) : (
          <Tag tone="done">đã nhập</Tag>
        )}
        {!chuaNhap && x.nguoiSua && (
          <span className="text-k-label block text-[var(--ink-3)]">
            {x.nguoiSua} · {lucVn(x.lucSua)}
          </span>
        )}
      </td>
    </tr>
  )
}
