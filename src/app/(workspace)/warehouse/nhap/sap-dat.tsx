'use client'

import { Fragment } from 'react'
import { poTemplateShort } from '@/lib/po-template'
import { tenNccGon } from '@/lib/theo-doi-loc'
import { ngay } from '@/lib/kho-hang-ve'
import { ngayChoXacNhan, type SapDatRow } from '@/lib/kho-lich-hang-ve'

/** Lý do khoá Nhận hàng khi đang chọn một đơn sắp đặt — nói ai gỡ được. */
export const lyDoSapDat = (s: SapDatRow) =>
  `NCC chưa xác nhận trên máy — ${s.owner_name ?? 'người phụ trách'} (Cung ứng) bấm “NCC xác nhận” thì đơn lên lịch và nhận được`

/**
 * KHỐI SẮP ĐẶT trong lưới Nhận hàng (27/10/2026, bản vẽ N3; chủ dự án: "Kho chỉ
 * nắm thông tin, không can thiệp"). Đơn GĐ đã duyệt mà NCC chưa xác nhận: nhóm
 * cuối lưới, chữ mờ, cùng bộ cột với đơn đang về. KHÔNG có đường nhận hàng hay
 * báo gì — bấm mã đơn chỉ mở hộp "Hàng của đơn" để xem dòng hàng.
 */
export function NhomSapDat({
  rows,
  today,
  soCot,
  hep,
  gon,
  hienLenh,
  chon,
  onChon,
  onXem,
}: {
  rows: SapDatRow[]
  today: string
  soCot: number
  hep: boolean
  gon: boolean
  hienLenh: boolean
  chon: string | null
  onChon: (id: string) => void
  onXem: (id: string) => void
}) {
  if (rows.length === 0) return null
  return (
    <Fragment>
      <tr className="grp c-mut">
        <td colSpan={soCot}>
          <span className="ten">Sắp đặt</span> · <b className="kh-num">{rows.length}</b>{' '}
          đơn · GĐ đã duyệt, NCC chưa xác nhận — chỉ xem, chưa nhận được
        </td>
      </tr>
      {rows.map((s) => {
        const cho = ngayChoXacNhan(s.approved_at, today)
        const on = s.po_id === chon
        return (
          <tr
            key={s.po_id}
            className={on ? 'd mo on' : 'd mo'}
            tabIndex={0}
            aria-selected={on}
            onClick={() => onChon(s.po_id)}
          >
            <td className="kh-num">
              {s.expected_at ? (
                <span title="Ngày dự kiến ghi trên đơn — NCC chưa xác nhận">
                  {ngay(s.expected_at, today)}
                </span>
              ) : (
                <span>chưa hẹn</span>
              )}
            </td>
            {!hep && (
              <td className="r">
                <span className="kh-empty">·</span>
              </td>
            )}
            <td>
              <button
                type="button"
                className="kh-lnk"
                title="Xem hàng của đơn"
                onClick={(e) => {
                  e.stopPropagation()
                  onChon(s.po_id)
                  onXem(s.po_id)
                }}
              >
                {s.po_code}
              </button>
            </td>
            {hienLenh && (
              <td title={[s.lsx_code, ...s.extra_lsx].filter(Boolean).join(', ')}>
                <span className="kh-num">{s.lsx_code ?? '— ngoài lệnh'}</span>
                {s.extra_lsx.length > 0 && <span> +{s.extra_lsx.length}</span>}
              </td>
            )}
            <td title={s.supplier_name}>
              {tenNccGon(s.supplier_name)}
              {hep && (
                <span style={{ display: 'block', fontSize: 11.5 }}>
                  {s.lsx_code ?? 'ngoài lệnh'}
                  {s.owner_name && ` · ${s.owner_name}`}
                </span>
              )}
            </td>
            {!gon && <td>{poTemplateShort(s.template) ?? s.template}</td>}
            {/* Cột Đợt khung < 1100px chỉ 130px: nói gọn, câu đủ ở title + dòng nhóm. */}
            <td
              title={`Chờ NCC xác nhận${s.approved_at ? ` từ khi GĐ duyệt ${ngay(s.approved_at, today)}` : ''}`}
            >
              {gon ? 'chờ' : 'chờ NCC xác nhận'}
              {cho != null && (
                <span className="kh-num">
                  {gon ? ' ' : ' · '}
                  {cho} ngày
                </span>
              )}
            </td>
            <td className="kh-num">{s.lines_total} dòng</td>
            {!hep && (
              <td className="ten-nguoi" title={s.owner_name ?? undefined}>
                {s.owner_name ?? '—'}
              </td>
            )}
          </tr>
        )
      })}
    </Fragment>
  )
}
