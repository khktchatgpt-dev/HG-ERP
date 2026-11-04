'use client'

import Link from 'next/link'
import { isUnshaped, needsRoute, type ShapingRow } from '@/lib/shaping-status'

/**
 * CỘT TRÁI của màn Lộ trình công đoạn gộp: mọi lệnh đang chạy, lệnh còn cụm
 * chưa khai xếp trước, bấm là ma trận bên phải đổi theo (`?lsx=`). Nhãn đếm bằng
 * đúng `shapingOverview` mà badge menu dùng.
 */
export function DanhSachLenh({
  rows,
  selected,
}: {
  rows: ShapingRow[]
  selected: string | null
}) {
  const dmy = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      : '—'
  return (
    <div>
      <div className="sx-mh">Lệnh đang chạy</div>
      <ul className="sx-ls">
        {rows.map((r) => {
          const can = needsRoute(r)
          const trong = isUnshaped(r)
          const choKT = r.lines_missing_bom > 0
          return (
            <li key={r.lsx.id}>
              <Link
                href={`/thongke/lo-trinh?lsx=${r.lsx.id}`}
                className={[r.lsx.id === selected && 'on', !can && 'dim']
                  .filter(Boolean)
                  .join(' ')}
                title={`${r.lsx.code} · ${r.lsx.customer_name} · hạn xuất ${dmy(r.lsx.ship_date)}`}
              >
                <span className="m">
                  {r.lsx.code}
                  <span className="d">{dmy(r.lsx.ship_date)}</span>
                </span>
                <span className="k">
                  {r.lsx.customer_name} · {r.line_count} SP
                  {can ? (
                    <span className="pill w">
                      {r.cluster_unrouted}/{r.cluster_count} cụm chưa khai
                    </span>
                  ) : trong && choKT ? (
                    <span className="pill m">chờ Kỹ thuật {r.lines_missing_bom} SP</span>
                  ) : trong ? (
                    <span className="pill m">chưa có bảng</span>
                  ) : r.cluster_count === 0 ? (
                    <span className="pill m">BOM phẳng</span>
                  ) : (
                    <span className="pill d">xong</span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
