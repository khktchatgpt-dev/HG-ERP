'use client'

import Link from 'next/link'
import { GIU_DUYET_THAY_NGAY, tienVn } from '@/lib/cho-xem'
import { ngayGioVn } from '@/lib/date-vn'
import type { ChoXemCtx } from './useChoXem'

/** Tab "GĐ duyệt khi tôi chưa xem" — giữ 7 ngày, chỉ xem (Q4). */
export function LuoiDuyetThay({ d }: { d: ChoXemCtx }) {
  const rows = d.box.duyet_thay
  if (rows.length === 0)
    return (
      <div
        className="hk-empty"
        style={{ flex: 1, padding: '14px 16px', textAlign: 'left' }}
      >
        {GIU_DUYET_THAY_NGAY} ngày qua Giám đốc không duyệt đơn nào khi anh chưa xem.
      </div>
    )
  return (
    <div className="hk-grid">
      <table className="hk-tb" aria-label="Đơn Giám đốc duyệt khi trưởng phòng chưa xem">
        <colgroup>
          <col style={{ width: 136 }} />
          <col style={{ width: 160 }} />
          <col />
          <col style={{ width: 146 }} />
          <col style={{ width: 170 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 140 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Nhà cung cấp</th>
            <th>Mua gì</th>
            <th>Lệnh</th>
            <th>GĐ duyệt</th>
            <th className="r">Sau khi gửi</th>
            <th className="r">Giá trị (gồm VAT)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={x.id} className={i % 2 ? 'd z' : 'd'}>
              <td>
                <Link href={x.href} className="hk-ma">
                  {x.code}
                </Link>
              </td>
              <td className="hk-b">{x.ncc}</td>
              <td title={[x.loai, ...x.materials].filter(Boolean).join(' · ')}>
                {[x.loai, x.materials.slice(0, 2).join(', ')]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </td>
              <td className="hk-mut">{x.lsx ?? 'Ngoài lệnh'}</td>
              <td>
                {x.by_name ?? '—'} ·{' '}
                <span className="hk-num">{ngayGioVn(x.at).slice(0, 16)}</span>
              </td>
              <td className="r hk-warn">
                {x.sau_phut == null
                  ? '—'
                  : x.sau_phut < 60
                    ? `${x.sau_phut} phút`
                    : `${Math.round(x.sau_phut / 60)} giờ`}
              </td>
              <td className="r hk-num hk-b">{tienVn(x.value, x.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7}>
              {rows.length} đơn trong {GIU_DUYET_THAY_NGAY} ngày · bấm mã để mở đơn, ghi
              trao đổi nếu thấy vướng
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
