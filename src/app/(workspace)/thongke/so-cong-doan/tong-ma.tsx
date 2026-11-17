'use client'

import Link from 'next/link'
import type { ScdTongMa } from '@/lib/so-cong-doan'
import { cx, fmt } from '../da-ghi/so-da-ghi.shared'

/**
 * BẢNG TỔNG THEO MÃ SP của Sổ công đoạn — mỗi (lệnh × mã) một hàng: bao nhiêu chi tiết,
 * cần bao nhiêu, đã làm bao nhiêu, còn thiếu, tháng này ghi bao nhiêu. Cùng số với lưới
 * chi tiết (cộng từ chính các hàng đó) nên hai chế độ xem không lệch nhau.
 */
export function TongMa({
  rows,
  tenThang,
  moChiTiet,
}: {
  rows: ScdTongMa[]
  tenThang: string
  /** Bấm một mã → sang lưới chi tiết, lọc đúng mã đó. */
  moChiTiet: (code: string | null) => void
}) {
  const sum = (f: (r: ScdTongMa) => number) => rows.reduce((a, r) => a + f(r), 0)
  return (
    <div className="sx-grid">
      <table className="sx-tb">
        <thead>
          <tr>
            <th>Lệnh</th>
            <th>Mã SP</th>
            <th>Tên</th>
            <th className="r">Chi tiết</th>
            <th className="r">Cần</th>
            <th className="r">Đã làm</th>
            <th className="r">Còn</th>
            <th className="r">%</th>
            <th className="r">Ghi {tenThang}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.can > 0 ? Math.round((r.da_lam / r.can) * 100) : null
            return (
              <tr key={`${r.lsx_id}|${r.code ?? ''}`} className="r">
                <td>
                  <Link href={`/thongke/lsx/${r.lsx_id}`} className="ma lnk">
                    {r.lsx_code}
                  </Link>
                </td>
                <td className="num">
                  <button type="button" className="lnk" onClick={() => moChiTiet(r.code)}>
                    {r.code ?? '—'}
                  </button>
                </td>
                <td className="mut">{r.ten}</td>
                <td
                  className="r num"
                  title={`${r.xong}/${r.so_ct} chi tiết đã làm đủ cần${r.khong_so ? ` · ${r.khong_so} hàng sổ cũ không còn trên Hồ sơ lệnh (không tính vào Cần)` : ''}`}
                >
                  {fmt(r.so_ct)}
                </td>
                <td className="r num">{fmt(r.can)}</td>
                <td className="r num">{fmt(r.da_lam)}</td>
                <td className={cx('r num', r.con === 0 ? 'ok' : r.con > 0 ? 'warn' : 'stop')}>
                  {r.con === 0 ? 'đủ' : r.con > 0 ? fmt(r.con) : `+${fmt(-r.con)}`}
                </td>
                <td className="r num">{pct == null ? '' : `${pct}%`}</td>
                <td className="r num">{fmt(r.thang)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>{rows.length} mã SP</td>
            <td className="r num">{fmt(sum((r) => r.so_ct))}</td>
            <td className="r num">{fmt(sum((r) => r.can))}</td>
            <td className="r num">{fmt(sum((r) => r.da_lam))}</td>
            <td className="r num">{fmt(sum((r) => r.con))}</td>
            <td />
            <td className="r num">{fmt(sum((r) => r.thang))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
