'use client'

import Link from 'next/link'
import { nhanLyDo } from '@/lib/kho-ma-ly-do'
import type { NxtChiTiet, NxtDong } from '@/modules/dept/warehouse/nxt.service'
import { dmy, fmtSl, fmtTien } from './bao-cao.shared'

/**
 * THẺ KHO CỦA MÃ TRONG KỲ — mở ngay dưới dòng (bản vẽ NXT-1): tồn đầu → từng
 * dòng sổ theo ngày chứng từ → tồn cuối, cột tồn luỹ kế. Dòng đảo phiếu bày số
 * ÂM ở phía của phiếu gốc (Q3), đúng như cột trên lưới đang cộng.
 *
 * Cuối thẻ là phép tính đơn giá bình quân nguyên văn (luật "số nào không kiểm
 * được thì không ai tin").
 */
export function TheKho({
  r,
  dong,
  tien,
}: {
  r: NxtDong
  dong: NxtChiTiet[]
  tien: boolean
}) {
  // Tồn luỹ kế tính trước khi vẽ (không gán lại biến trong lúc render).
  const ds = gopPhieu(dong)
  const luyKe = ds.reduce<number[]>((acc, d) => {
    const truoc = acc.length ? acc[acc.length - 1] : r.ton_dau
    acc.push(Math.round((truoc + (d.nhap ?? 0) - (d.xuat ?? 0)) * 1000) / 1000)
    return acc
  }, [])
  return (
    <div className="nx-the">
      <div className="dau">
        <b>{r.code} · thẻ kho trong kỳ</b>
        <span className="kh-mut">
          {ds.length < dong.length
            ? `${ds.length} dòng (gộp từ ${dong.length} dòng sổ cùng phiếu)`
            : `${dong.length} dòng sổ`}{' '}
          · ngày theo chứng từ · đảo phiếu trừ vào cột của phiếu gốc
        </span>
      </div>
      <div className="bang">
        <table>
          <thead>
            <tr>
              <th>Ngày CT</th>
              <th>Số phiếu</th>
              <th>Lý do</th>
              <th>Diễn giải</th>
              <th className="r">Nhập</th>
              <th className="r">Xuất</th>
              <th className="r">Tồn luỹ kế</th>
              {tien && <th className="r">Đơn giá dòng</th>}
            </tr>
          </thead>
          <tbody>
            <tr className="mut">
              <td colSpan={6}>Tồn đầu kỳ</td>
              <td className="r kh-num">{fmtSl(r.ton_dau)}</td>
              {tien && <td />}
            </tr>
            {ds.map((d, i) => {
              const luy = luyKe[i]
              const phia = d.nhap != null ? 'n' : d.xuat != null ? 'x' : ''
              return (
                <tr key={d.id}>
                  <td className="kh-num">{dmy(d.ngay)}</td>
                  <td>
                    {d.doc_id ? (
                      <Link
                        href={`/warehouse/phieu/${d.doc_id}`}
                        className="kh-lnk kh-num"
                      >
                        {d.doc_code}
                      </Link>
                    ) : (
                      <span className="kh-mut">không phiếu</span>
                    )}
                  </td>
                  <td>
                    {d.ma ? (
                      <span
                        className={`nx-ma ${phia}${d.suy ? 'suy' : ''}`}
                        title={`${nhanLyDo(d.ma)}${d.suy ? ' — mã suy ra (dòng cũ không ghi mã)' : ''}`} // prettier-ignore
                      >
                        {d.ma}
                      </span>
                    ) : (
                      <span className="kh-mut">—</span>
                    )}
                  </td>
                  <td className="dg">
                    {d.dien_giai ?? <span className="kh-mut">—</span>}
                  </td>
                  <td className="r kh-num">
                    {d.nhap != null && (
                      <span className={d.nhap < 0 ? 'nx-am' : undefined}>
                        {fmtSl(d.nhap)}
                      </span>
                    )}
                  </td>
                  <td className="r kh-num">
                    {d.xuat != null && (
                      <span className={d.xuat < 0 ? 'nx-am' : undefined}>
                        {fmtSl(d.xuat)}
                      </span>
                    )}
                  </td>
                  <td className={`r kh-num${luy < -1e-9 ? 'nx-am' : ''}`}>
                    {fmtSl(luy)}
                  </td>
                  {tien && (
                    <td className="r kh-num kh-mut">
                      {d.gia == null ? '' : fmtTien(d.gia)}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr className="mut">
              <td colSpan={6}>Tồn cuối kỳ</td>
              <td className={`r kh-num kh-b${r.ton_cuoi < 0 ? 'nx-am' : ''}`}>
                {fmtSl(r.ton_cuoi)}
              </td>
              {tien && <td />}
            </tr>
          </tbody>
        </table>
      </div>
      {tien && <CongThuc r={r} />}
    </div>
  )
}

/**
 * Gộp các dòng sổ LIỀN NHAU cùng phiếu + cùng cột + cùng giá (một phiếu nhập nhiều
 * dòng cùng mã — PNK-2026-0073 có hàng chục dòng BAO0483), cùng ý `gopPhieu` ở Tồn kho.
 */
function gopPhieu(dong: NxtChiTiet[]): NxtChiTiet[] {
  const out: NxtChiTiet[] = []
  for (const d of dong) {
    const t = out[out.length - 1]
    if (t && d.doc_id && t.doc_id === d.doc_id && t.cot === d.cot && t.gia === d.gia) {
      out[out.length - 1] = {
        ...t,
        nhap: t.nhap == null ? null : t.nhap + (d.nhap ?? 0),
        xuat: t.xuat == null ? null : t.xuat + (d.xuat ?? 0),
      }
    } else out.push({ ...d })
  }
  return out
}

function CongThuc({ r }: { r: NxtDong }) {
  if (r.don_gia == null) {
    return (
      <div className="nx-why">
        Chưa lần nhập nào của mã này có giá — đơn giá và giá trị để trống, không tính là
        0. Điền giá ở dòng đơn mua (hoặc phiếu nhập ngoài đơn) rồi xem lại.
      </div>
    )
  }
  if (!r.bq) {
    return (
      <div className="nx-why">
        Kỳ này không có lần nhập có giá → dùng lại đơn giá bình quân kỳ trước ={' '}
        {fmtTien(r.don_gia)} ₫/{r.unit}
      </div>
    )
  }
  return (
    <div className="nx-why">
      Đơn giá BQ = (giá trị tồn đầu + giá trị nhập có giá) ÷ (SL tồn đầu + SL nhập có giá)
      = {fmtTien(r.bq.tu)} ÷ {fmtSl(Math.round(r.bq.mau * 1000) / 1000)} ={' '}
      <b>{fmtTien(r.don_gia)}</b> ₫/{r.unit}
      {r.thieu_gia > 0 &&
        ` · không gồm ${r.thieu_gia}/${r.lan_mua} lần nhập chưa có giá (định giá theo bình quân)`}
    </div>
  )
}
