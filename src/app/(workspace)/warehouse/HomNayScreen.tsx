'use client'

import './hom-nay.css'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { nhanHen, type KhoiViec, type ViecDo } from '@/lib/kho-ban-lam-viec'
import { DauTrang, KhoKhung, ThanhTT } from './_erp/khung'

export type DongHangVe = {
  po_id: string
  code: string
  ncc: string | null
  hen: string | null
  /** Form nhận hàng, đã chọn đợt kế tiếp như nút Nhận ở màn Nhận hàng. */
  href: string
}

export type DongLenh = {
  id: string
  code: string
  con: number
  ship_date: string | null
}

const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const ngayDai = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${THU[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}
const nf = (n: number) => n.toLocaleString('vi-VN')
const AN_HUONG_DAN = 'kho-an-huong-dan'

/**
 * HÔM NAY — khuôn A (B2 "Kho cho người mới", bản vẽ A1, duyệt 27/10/2026). Câu
 * màn trả lời: "hôm nay tôi làm gì trước?". Bốn khối việc phẳng (không thẻ nổi),
 * mỗi khối vài con số bấm được + MỘT nút; dải "Lần đầu dùng?" chỉ bốn việc
 * chính, ẩn được (nhớ trên máy này); "Việc còn dở" nói việc đã bắt đầu.
 */
export function HomNayScreen({
  today,
  nguoi,
  laTruong,
  khoi,
  hangVe,
  lenh,
  dangDo,
}: {
  today: string
  nguoi: string
  laTruong: boolean
  khoi: KhoiViec[]
  /** Đơn quá hẹn / hẹn hôm nay, tối đa 3 — dưới khối Nhận hàng. */
  hangVe: DongHangVe[]
  /** Lệnh còn hàng chưa ghi xuất, tối đa 3 — dưới khối Xuất cho tổ. */
  lenh: DongLenh[]
  dangDo: ViecDo[]
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  // Ẩn sẵn tới khi đọc được localStorage — người đã ẩn không thấy dải nháy lên.
  const [huongDan, setHuongDan] = useState(false)
  useEffect(() => {
    let an = false
    try {
      an = localStorage.getItem(AN_HUONG_DAN) === '1'
    } catch {
      /* localStorage bị chặn — vẫn hiện hướng dẫn */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage sau hydrate
    setHuongDan(!an)
  }, [])
  const anHuongDan = () => {
    setHuongDan(false)
    try {
      localStorage.setItem(AN_HUONG_DAN, '1')
    } catch {
      /* không nhớ được — chỉ ẩn trong phiên */
    }
  }

  const traTon = (e: React.FormEvent) => {
    e.preventDefault()
    const t = q.trim()
    router.push(t ? `/warehouse/ton?q=${encodeURIComponent(t)}` : '/warehouse/ton')
  }

  return (
    <KhoKhung label="Hôm nay">
      <DauTrang
        title="Hôm nay"
        ctx={`${ngayDai(today)} · ${nguoi}${laTruong ? ' · trưởng kho' : ''}`}
      />

      <div className="hn-cuon">
        {huongDan && (
          <div className="hn-huong" role="note" aria-label="Hướng dẫn nhanh">
            <b>Lần đầu dùng?</b>
            <ol>
              <li>
                Hàng NCC tới → <Link href="/warehouse/nhap">Nhận hàng</Link>
              </li>
              <li>
                Tổ tới lấy → <Link href="/warehouse/xuat">Xuất hàng</Link>
              </li>
              <li>
                Hỏi còn bao nhiêu → <Link href="/warehouse/ton">Tồn kho</Link>
              </li>
              <li>
                Số máy lệch kệ →{' '}
                <Link href="/warehouse/cap-nhat-ton">Cập nhật số thực tế</Link>
              </li>
            </ol>
            <button type="button" className="kh-lnk" onClick={anHuongDan}>
              Ẩn
            </button>
          </div>
        )}

        <div className="hn-viec">
          {khoi.map((k) => (
            <section key={k.key} className="hn-khoi" aria-labelledby={`hn-${k.key}`}>
              <h2 id={`hn-${k.key}`}>
                {k.ten}
                <span>{k.phu}</span>
              </h2>
              <div className="hn-so">
                {k.so.map((s) => (
                  <Link key={s.key} href={s.href} aria-label={`${s.t}: ${s.n}`}>
                    <span className={`n ${s.tone}`}>{nf(s.n)}</span>
                    <span className="t">{s.t}</span>
                  </Link>
                ))}
              </div>

              {k.key === 'tra' && (
                <form className="hn-tim" role="search" onSubmit={traTon}>
                  <input
                    id="hn-tim"
                    className="kh-o"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Gõ mã hoặc tên vật tư rồi Enter"
                    aria-label="Tra tồn theo mã hoặc tên vật tư"
                    autoComplete="off"
                  />
                  <button type="submit" className="kh-btn p">
                    Tra
                  </button>
                </form>
              )}

              {k.key === 'nhan' && hangVe.length > 0 && (
                <ul className="hn-gap" aria-label="Đơn quá hẹn và hẹn về hôm nay">
                  {hangVe.map((r) => {
                    const h = nhanHen(r.hen, today)
                    return (
                      <li key={r.po_id}>
                        <span className="kh-ma">{r.code}</span>
                        <span className="ten" title={r.ncc ?? undefined}>
                          {r.ncc ?? '—'}
                        </span>
                        <span
                          className={`kh-num ${h.tone === 'stop' ? 'kh-stop' : h.tone === 'warn' ? 'kh-warn' : ''}`}
                        >
                          {h.chu}
                        </span>
                        <Link
                          href={r.href}
                          className="kh-lnk"
                          aria-label={`Nhận hàng ${r.code}`}
                        >
                          Nhận
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              {k.key === 'xuat' && lenh.length > 0 && (
                <ul className="hn-gap" aria-label="Lệnh còn hàng chưa ghi xuất">
                  {lenh.map((l) => {
                    const h = nhanHen(l.ship_date, today)
                    return (
                      <li key={l.id}>
                        <span className="kh-ma">{l.code}</span>
                        <span className="ten kh-num">{nf(l.con)} mã còn ở kho</span>
                        <span
                          className={`kh-num ${h.tone === 'stop' ? 'kh-stop' : h.tone === 'warn' ? 'kh-warn' : ''}`}
                        >
                          {h.tone === 'stop' ? 'quá hạn xuất' : `xuất ${h.chu}`}
                        </span>
                        <Link
                          href={`/warehouse/xuat?lsx=${l.id}`}
                          className="kh-lnk"
                          aria-label={`Ghi xuất cho lệnh ${l.code}`}
                        >
                          Ghi xuất
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}

              {(k.nut || k.nhac) && (
                <div className="hn-cuoi">
                  {k.nut && (
                    <Link
                      href={k.nut.href}
                      className={k.key === 'cap-nhat' ? 'kh-btn' : 'kh-btn p'}
                    >
                      {k.nut.chu}
                    </Link>
                  )}
                  {k.nhac && <span className="kh-warn">{k.nhac}</span>}
                </div>
              )}
              {k.key === 'cap-nhat' && (
                <p className="hn-mo-ta">
                  Gõ số đếm được của vài mã — máy tự tính phần thừa / thiếu và ghi một
                  phiếu kiểm kê có tên người ghi, lý do.
                </p>
              )}
            </section>
          ))}
        </div>

        <section className="hn-do" aria-labelledby="hn-do">
          <h2 id="hn-do">Việc còn dở</h2>
          {dangDo.length === 0 ? (
            <p className="kh-mut">
              Chưa có việc nào đang dở. Đợt kiểm kê đang đếm, lần cập nhật chờ duyệt, đề
              nghị mua nháp sẽ hiện ở đây để làm tiếp.
            </p>
          ) : (
            <ul>
              {dangDo.map((d) => (
                <li key={d.key}>
                  <Link href={d.href} className="kh-lnk">
                    {d.chu}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ThanhTT
        left="Số tính lúc mở trang · F5 để tính lại · số 0 chữ nhạt — hết việc là tốt"
        right="Phiếu đã ghi, báo cáo, kiểm kê định kỳ ở nhóm Sổ sách trên menu"
      />
    </KhoKhung>
  )
}
