'use client'

import { nhanLyDo } from '@/lib/kho-ma-ly-do'
import type { ChiTietPhieuNhap } from '@/modules/dept/supply/phieu-nhap-chi-tiet.repo'
import type { PhieuDong } from './PhieuChiTietScreen'

const so = (n: number) => n.toLocaleString('vi-VN')

/**
 * Hai bảng dòng của chi tiết phiếu Kho (Kho lối ERP · B6, không kit) — vùng cuộn
 * DUY NHẤT của màn, tiêu đề cột và chân tổng dính. `hep` (khung < 900px) ẩn cột
 * bậc thấp (Kệ, Ghi chú, nhãn chữ mã lý do) thay vì cuộn ngang; ghi chú ẩn vẫn
 * đọc được ở `title` của tên vật tư.
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
  const truocSL = 5 + (coDat ? 1 : 0)
  const sau = (coLoai ? 1 : 0) + (hep ? 0 : 2)
  return (
    <div className="kh-grid">
      <table className="kh-tb" aria-label="Dòng của phiếu">
        <colgroup>
          <col style={{ width: 44 }} />
          <col style={{ width: 104 }} />
          <col />
          <col style={{ width: 56 }} />
          <col style={{ width: hep ? 60 : 170 }} />
          {coDat && <col style={{ width: 92 }} />}
          <col style={{ width: 100 }} />
          {coLoai && <col style={{ width: 76 }} />}
          {!hep && <col style={{ width: 90 }} />}
          {!hep && <col style={{ width: 180 }} />}
        </colgroup>
        <thead>
          <tr>
            <th>STT</th>
            <th>Mã VT</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th>Lý do</th>
            {coDat && <th className="r">Theo ĐH</th>}
            <th className="r">{nhanSL}</th>
            {coLoai && <th className="r">Loại</th>}
            {!hep && <th>Kệ</th>}
            {!hep && <th>Ghi chú</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} className="d f">
              <td className="kh-num kh-mut">{i + 1}</td>
              <td className="kh-ma">{l.material_code ?? '—'}</td>
              <td
                title={[l.material_name, hep ? l.note : null].filter(Boolean).join(' — ')}
              >
                {l.material_name ?? '—'}
              </td>
              <td className="kh-mut">{l.material_unit ?? '—'}</td>
              <td
                title={
                  l.ma_ly_do
                    ? (nhanLyDo(l.ma_ly_do) ?? undefined)
                    : 'Dòng ghi trước 15/09/2026 và loại chứng từ không suy được mã chắc chắn — đoán bừa là bịa một con số cho báo cáo.'
                }
              >
                {l.ma_ly_do ? (
                  <>
                    <span className="kh-tag">{l.ma_ly_do}</span>
                    {!hep && <span className="kh-mut">{nhanLyDo(l.ma_ly_do)}</span>}
                  </>
                ) : (
                  <span className="kh-empty">chưa có mã</span>
                )}
              </td>
              {coDat && (
                <td className="r kh-num">
                  {l.qty_ordered != null ? so(l.qty_ordered) : '—'}
                </td>
              )}
              <td className="r kh-num kh-b">{so(l.qty)}</td>
              {coLoai && (
                <td className="r kh-num kh-stop">
                  {l.qty_rejected > 0 ? so(l.qty_rejected) : ''}
                </td>
              )}
              {!hep && <td className="kh-mut">{l.shelf_location ?? '—'}</td>}
              {!hep && <td title={l.note ?? undefined}>{l.note ?? ''}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={truocSL}>
              Tổng {lines.length} dòng
              {soDongKiemKe > 0 && ` · biên bản kiểm kê ${soDongKiemKe} dòng đã đếm`}
            </td>
            <td className="r kh-num">{so(tong)}</td>
            {coLoai && <td className="r kh-num">{tongLoai > 0 ? so(tongLoai) : ''}</td>}
            {sau - (coLoai ? 1 : 0) > 0 && (
              <td colSpan={sau - (coLoai ? 1 : 0)} style={{ fontWeight: 400 }}>
                {coLoai
                  ? 'Cột Loại: QC trả về, chưa vào tồn'
                  : 'Tổng không gồm hàng QC loại'}
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
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
    <div className="kh-grid">
      <table className="kh-tb" aria-label="Hàng nhập của phiếu">
        <colgroup>
          <col style={{ width: 40 }} />
          <col style={{ width: 104 }} />
          <col />
          <col style={{ width: 56 }} />
          <col style={{ width: 128 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 150 }} />
          {!hep && <col style={{ width: 200 }} />}
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th className="r">Đặt (dòng đơn)</th>
            <th className="r">{daDao ? 'Đã nhận (đã đảo)' : 'Nhận phiếu này'}</th>
            <th>Tình trạng</th>
            {!hep && <th>Ghi chú</th>}
          </tr>
        </thead>
        <tbody>
          {dong.map((d, i) => (
            <tr key={d.id} className="d f">
              <td className="kh-num kh-mut">{i + 1}</td>
              <td className="kh-ma">{d.code}</td>
              <td title={[d.name, hep ? d.note : null].filter(Boolean).join(' — ')}>
                {d.name}
              </td>
              <td className="kh-mut">{d.unit}</td>
              <td className="r kh-num">
                {d.qty_ordered != null ? (
                  so(d.qty_ordered)
                ) : (
                  <span
                    className="kh-mut"
                    title="Dòng đơn mua của dòng này đã bị gỡ khỏi đơn"
                  >
                    đã gỡ
                  </span>
                )}
              </td>
              <td
                className="r kh-num"
                title={d.kg_can != null ? `${so(d.kg_can)} kg cân` : undefined}
              >
                <span
                  className={daDao ? 'kh-mut' : 'kh-b'}
                  style={daDao ? { textDecoration: 'line-through' } : undefined}
                >
                  {so(d.qty)}
                </span>
                {d.kg_can != null && <span className="kh-mut"> · {so(d.kg_can)} kg</span>}
              </td>
              <td>
                {d.khoa ? <span className="kh-warn">Sai quy cách · khoá</span> : 'Đạt'}
              </td>
              {!hep && <td title={d.note ?? undefined}>{d.note ?? ''}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>
              {dong.length} dòng
              {donVi.length > 1
                ? ` · không cộng tổng vì khác ĐVT (${donVi.join(', ')})`
                : ''}
            </td>
            <td className="r kh-num">
              {donVi.length === 1
                ? `${so(dong.reduce((a, d) => a + d.qty, 0))} ${donVi[0]}`
                : ''}
            </td>
            <td colSpan={hep ? 1 : 2} style={{ fontWeight: 400 }}>
              Không gồm đơn giá — tiền xem ở đơn mua
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
