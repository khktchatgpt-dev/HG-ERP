'use client'

import './ban-lam-viec.css'
import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, Boxes } from 'lucide-react'
import { nhanHen, type NhomViec } from '@/lib/kho-ban-lam-viec'
import { ApNhom, ApNut, DauTrang, KhoKhung, ThanhTT } from './_erp/khung'

export type DongHangVe = {
  po_id: string
  code: string
  ncc: string | null
  hen: string | null
  phu_trach: string | null
  /** Form nhận hàng, đã chọn đợt kế tiếp như nút Nhận ở Hàng về. */
  href: string
}

export type DongLenh = {
  id: string
  code: string
  khach: string | null
  con: number
  ship_date: string | null
}

const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const ngayDai = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${THU[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}
const nf = (n: number) => n.toLocaleString('vi-VN')

/**
 * BÀN LÀM VIỆC KHO — khuôn A (B8a, bản vẽ BLV-1 duyệt 19/10/2026). Câu màn trả
 * lời: "hôm nay Kho phải làm gì trước?". Ô việc phẳng (không thẻ nổi), bấm mở
 * đúng màn đã lọc; hai bảng việc gấp có nút làm ngay.
 */
export function BanLamViecScreen({
  today,
  nhom,
  hangVe,
  conGap,
  lenh,
  conLenh,
}: {
  today: string
  nhom: NhomViec[]
  hangVe: DongHangVe[]
  /** Đơn quá hẹn / hôm nay không vừa bảng. */
  conGap: number
  lenh: DongLenh[]
  conLenh: number
}) {
  return (
    <KhoKhung label="Bàn làm việc Kho">
      <DauTrang
        title="Bàn làm việc"
        ctx={ngayDai(today)}
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<ArrowDownToLine size={15} aria-hidden />}
                href="/warehouse/nhap"
              >
                Nhận hàng
              </ApNut>
              <ApNut
                icon={<ArrowUpFromLine size={15} aria-hidden />}
                href="/warehouse/xuat"
              >
                Xuất kho
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut icon={<Boxes size={15} aria-hidden />} href="/warehouse/ton">
                Tồn kho
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <div className="blv-cuon">
        {nhom.map((g) => (
          <section key={g.key} className="blv-nhom" aria-labelledby={`blv-${g.key}`}>
            <h2 id={`blv-${g.key}`}>{g.ten}</h2>
            <div className="blv-o">
              {g.o.map((o) => (
                <Link
                  key={o.key}
                  href={o.href}
                  className="blv-tile"
                  aria-label={`${o.t}: ${o.n}`}
                >
                  <span className={`n ${o.tone}`}>{nf(o.n)}</span>
                  <span className="t">{o.t}</span>
                  <span className="s">{o.s}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className="blv-cot">
          <section aria-labelledby="blv-ve">
            <h3 id="blv-ve">
              <span>Hàng về quá hẹn và hôm nay</span>
              <Link href="/warehouse/nhap" className="kh-lnk">
                Mở Hàng về
              </Link>
            </h3>
            {hangVe.length === 0 ? (
              <p className="blv-rong">
                Không đơn nào quá hẹn hay hẹn về hôm nay. Xem các đơn sắp về ở Hàng về.
              </p>
            ) : (
              <table className="kh-tb blv-tb" aria-label="Hàng về quá hẹn và hôm nay">
                <colgroup>
                  <col style={{ width: 112 }} />
                  <col />
                  <col style={{ width: 118 }} />
                  <col style={{ width: 92 }} />
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Đơn</th>
                    <th className="an-hep">NCC</th>
                    <th>Hẹn</th>
                    <th className="an-hep">Phụ trách</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {hangVe.map((r) => {
                    const h = nhanHen(r.hen, today)
                    return (
                      <tr key={r.po_id}>
                        <td className="kh-ma">{r.code}</td>
                        <td className="an-hep" title={r.ncc ?? undefined}>
                          {r.ncc ?? '—'}
                        </td>
                        <td
                          className={`kh-num xd ${h.tone === 'stop' ? 'kh-stop' : h.tone === 'warn' ? 'kh-warn' : ''}`}
                        >
                          {h.chu}
                        </td>
                        <td className="kh-mut xd an-hep" title={r.phu_trach ?? undefined}>
                          {r.phu_trach ?? '—'}
                        </td>
                        <td>
                          <Link
                            href={r.href}
                            className="kh-btn"
                            aria-label={`Nhận hàng ${r.code}`}
                          >
                            Nhận
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                  {conGap > 0 && (
                    <tr>
                      <td colSpan={5} className="kh-mut">
                        … và {conGap} đơn khác ở Hàng về
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>
          <section aria-labelledby="blv-lenh">
            <h3 id="blv-lenh">
              <span>Lệnh cần ghi xuất</span>
              <Link href="/warehouse/ton?xem=lenh" className="kh-lnk">
                Tồn kho › Theo lệnh
              </Link>
            </h3>
            {lenh.length === 0 ? (
              <p className="blv-rong">
                Không lệnh nào còn hàng chưa ghi xuất. Hàng mua cho lệnh đã xuất hết.
              </p>
            ) : (
              <table className="kh-tb blv-tb" aria-label="Lệnh cần ghi xuất">
                <colgroup>
                  <col />
                  <col style={{ width: 92 }} />
                  <col style={{ width: 112 }} />
                  <col style={{ width: 100 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Lệnh</th>
                    <th
                      className="r"
                      title="Số mã đã về cho lệnh, kho còn hàng, chưa ghi xuất"
                    >
                      Còn ở kho
                    </th>
                    <th>Hạn xuất</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {lenh.map((l) => {
                    const h = nhanHen(l.ship_date, today)
                    const quaHan = h.tone === 'stop'
                    return (
                      <tr key={l.id}>
                        <td className="xd" title={l.khach ?? undefined}>
                          <span className="kh-ma">{l.code}</span>
                        </td>
                        <td className="r kh-num">{nf(l.con)} mã</td>
                        <td
                          className={`kh-num xd ${quaHan ? 'kh-stop' : h.tone === 'warn' ? 'kh-warn' : ''}`}
                        >
                          {quaHan ? `${h.chu.slice(0, 5)} · quá hạn` : h.chu}
                        </td>
                        <td>
                          <Link
                            href={`/warehouse/xuat?lsx=${l.id}`}
                            className="kh-btn"
                            aria-label={`Ghi xuất cho lệnh ${l.code}`}
                          >
                            Ghi xuất
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                  {conLenh > 0 && (
                    <tr>
                      <td colSpan={4} className="kh-mut">
                        … và {conLenh} lệnh khác
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

      <ThanhTT
        left="Ô 0 vẫn hiện, chữ nhạt — hết việc là tốt · bấm ô mở đúng màn đã lọc"
        right="Số tính lúc mở trang · F5 để tính lại"
      />
    </KhoKhung>
  )
}
