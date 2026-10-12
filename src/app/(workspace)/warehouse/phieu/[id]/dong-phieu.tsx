'use client'

import { nhanLyDo } from '@/lib/kho-ma-ly-do'
import { Cell, Code, Row, TFoot, THead, Table } from '@/components/kit'
import type { ChiTietPhieuNhap } from '@/modules/dept/supply/phieu-nhap-chi-tiet.repo'
import type { PhieuDong } from './PhieuChiTietScreen'

const so = (n: number) => n.toLocaleString('vi-VN')
const R = { textAlign: 'right' } as const

/**
 * Hai bảng dòng của chi tiết phiếu Kho. Cả hai là `Table` của kit — vùng cuộn
 * DUY NHẤT của màn, tiêu đề cột và chân tổng dính (luật màn hẹp 12/10/2026).
 *
 * `hep` (khung < 900px) ẩn cột bậc thấp — Kệ, Ghi chú, nhãn chữ của mã lý do —
 * thay vì cuộn ngang; ghi chú ẩn thì vẫn đọc được ở `title` của tên vật tư.
 */
export function BangDongKho({
  lines,
  kind,
  hep,
  soDongKiemKe,
}: {
  lines: PhieuDong[]
  kind: string
  hep: boolean
  soDongKiemKe: number
}) {
  const coDat = lines.some((l) => l.qty_ordered != null)
  const coLoai = lines.some((l) => (l.qty_rejected ?? 0) > 0)
  const tong = lines.reduce((s, l) => s + l.qty, 0)
  const tongLoai = lines.reduce((s, l) => s + (l.qty_rejected ?? 0), 0)
  // Biên bản kiểm kê chỉ sinh dòng LỆCH — gọi "Thực xuất" là nói sai bản chất.
  const nhanSL =
    kind === 'receipt' ? 'Thực nhập' : kind === 'issue' ? 'Thực xuất' : 'SL lệch'
  const truocSL = 5 + (coDat ? 1 : 0) // STT · Mã · Tên · ĐVT · Lý do (+ Theo ĐH)
  const sauSL = (coLoai ? 1 : 0) + (hep ? 0 : 2)
  return (
    <Table minWidth={hep ? 560 : 760}>
      <THead>
        <th style={{ width: 40 }}>STT</th>
        <th style={{ width: 104 }}>Mã VT</th>
        <th>Tên vật tư</th>
        <th style={{ width: 52 }}>ĐVT</th>
        <th style={{ width: hep ? 56 : 150 }}>Lý do</th>
        {coDat && <th style={{ ...R, width: 84 }}>Theo ĐH</th>}
        <th style={{ ...R, width: 90 }}>{nhanSL}</th>
        {coLoai && <th style={{ ...R, width: 70 }}>Loại</th>}
        {!hep && <th style={{ width: 90 }}>Kệ</th>}
        {!hep && <th style={{ width: 160 }}>Ghi chú</th>}
      </THead>
      <tbody>
        {lines.map((l, i) => (
          <Row key={l.id}>
            <Cell num>{i + 1}</Cell>
            <Cell>
              <Code>{l.material_code ?? '—'}</Code>
            </Cell>
            <Cell
              grow
              title={[l.material_name, hep ? l.note : null].filter(Boolean).join(' — ')}
            >
              {l.material_name ?? '—'}
            </Cell>
            <Cell muted>{l.material_unit ?? '—'}</Cell>
            <Cell
              title={
                l.ma_ly_do
                  ? (nhanLyDo(l.ma_ly_do) ?? undefined)
                  : 'Dòng ghi trước 15/09/2026 và loại chứng từ không suy được mã chắc chắn — đoán bừa là bịa một con số cho báo cáo.'
              }
            >
              {l.ma_ly_do ? (
                <span className="whitespace-nowrap">
                  <span className="num font-bold">{l.ma_ly_do}</span>
                  {!hep && (
                    <span className="text-k-label ml-1.5 text-[var(--ink-3)]">
                      {nhanLyDo(l.ma_ly_do)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[var(--ink-empty)]">chưa có mã</span>
              )}
            </Cell>
            {coDat && <Cell num>{l.qty_ordered != null ? so(l.qty_ordered) : '—'}</Cell>}
            <Cell num>{so(l.qty)}</Cell>
            {coLoai && (
              <Cell num>
                {l.qty_rejected > 0 ? (
                  <span className="text-[var(--stop)]">{so(l.qty_rejected)}</span>
                ) : (
                  ''
                )}
              </Cell>
            )}
            {!hep && <Cell muted>{l.shelf_location ?? '—'}</Cell>}
            {!hep && <Cell title={l.note ?? undefined}>{l.note ?? ''}</Cell>}
          </Row>
        ))}
      </tbody>
      <TFoot
        label={
          <td colSpan={truocSL}>
            Tổng {lines.length} dòng
            {soDongKiemKe > 0 && ` · biên bản kiểm kê ${soDongKiemKe} dòng đã đếm`}
          </td>
        }
        cells={
          <>
            <td className="num">{so(tong)}</td>
            {coLoai && <td className="num">{tongLoai > 0 ? so(tongLoai) : ''}</td>}
          </>
        }
        caveat={
          sauSL - (coLoai ? 1 : 0) > 0
            ? coLoai
              ? 'Cột Loại: QC trả về, chưa vào tồn'
              : 'Tổng không gồm hàng QC loại'
            : undefined
        }
        caveatSpan={hep ? undefined : 2}
      />
    </Table>
  )
}

export function BangDongNhap({
  dong,
  daDao,
  hep,
}: {
  dong: ChiTietPhieuNhap['dong']
  daDao: boolean
  hep: boolean
}) {
  const donVi = [...new Set(dong.map((d) => d.unit).filter(Boolean))]
  return (
    <Table minWidth={hep ? 560 : 760}>
      <THead>
        <th style={{ width: 36 }}>#</th>
        <th style={{ width: 104 }}>Mã</th>
        <th>Tên vật tư</th>
        <th style={{ width: 52 }}>ĐVT</th>
        <th style={{ ...R, width: 96 }}>Đặt (dòng đơn)</th>
        <th style={{ ...R, width: 120 }}>
          {daDao ? 'Đã nhận (đã đảo)' : 'Nhận phiếu này'}
        </th>
        <th style={{ width: 104 }}>Tình trạng</th>
        {!hep && <th style={{ width: 180 }}>Ghi chú</th>}
      </THead>
      <tbody>
        {dong.map((d, i) => (
          <Row key={d.id}>
            <Cell num>{i + 1}</Cell>
            <Cell>
              <Code>{d.code}</Code>
            </Cell>
            <Cell grow title={[d.name, hep ? d.note : null].filter(Boolean).join(' — ')}>
              {d.name}
            </Cell>
            <Cell muted>{d.unit}</Cell>
            <Cell num>
              {d.qty_ordered != null ? (
                so(d.qty_ordered)
              ) : (
                <span
                  className="text-[var(--ink-3)]"
                  title="Dòng đơn mua của dòng này đã bị gỡ khỏi đơn"
                >
                  đã gỡ
                </span>
              )}
            </Cell>
            <Cell num title={d.kg_can != null ? `${so(d.kg_can)} kg cân` : undefined}>
              <span
                className={daDao ? 'text-[var(--ink-3)] line-through' : 'font-semibold'}
              >
                {so(d.qty)}
              </span>
              {d.kg_can != null && (
                <span className="text-k-label ml-1 text-[var(--ink-3)]">
                  · {so(d.kg_can)} kg
                </span>
              )}
            </Cell>
            <Cell>
              {d.khoa ? (
                <span className="font-semibold text-[var(--warn)]">
                  Sai quy cách · khoá
                </span>
              ) : (
                'Đạt'
              )}
            </Cell>
            {!hep && <Cell title={d.note ?? undefined}>{d.note ?? ''}</Cell>}
          </Row>
        ))}
      </tbody>
      <TFoot
        label={
          <td colSpan={5}>
            {dong.length} dòng
            {donVi.length > 1
              ? ` · không cộng tổng vì khác ĐVT (${donVi.join(', ')})`
              : ''}
          </td>
        }
        cells={
          <td className="num">
            {donVi.length === 1
              ? `${so(dong.reduce((a, d) => a + d.qty, 0))} ${donVi[0]}`
              : ''}
          </td>
        }
        caveat="Không gồm đơn giá — tiền xem ở đơn mua"
        caveatSpan={hep ? 1 : 2}
      />
    </Table>
  )
}
