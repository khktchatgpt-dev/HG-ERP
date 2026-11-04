'use client'

import Link from 'next/link'
import { useState } from 'react'
import { isUnshaped, needsRoute, type ShapingRow } from '@/lib/shaping-status'

/**
 * DANH SÁCH LỆNH của màn Lộ trình công đoạn (bản vẽ 3, 04/11/2026): bảng khuôn C
 * trọn chiều ngang, không khung cuộn con, không cắt chữ. Chip lọc đếm bằng ĐÚNG
 * vị từ mà bảng lọc (`VIEWS` dưới) — bấm chip ra đúng số dòng. Badge menu = chip
 * "Còn cụm chưa khai" (`needsRoute`, cùng hàm nav-badges).
 */
type ViewId = 'can' | 'cho' | 'chua' | 'xong' | 'all'
const VIEWS: { id: ViewId; label: string; test: (r: ShapingRow) => boolean }[] = [
  { id: 'can', label: 'Còn cụm chưa khai', test: needsRoute },
  {
    id: 'cho',
    label: 'Chờ Kỹ thuật nạp định mức',
    test: (r) => !needsRoute(r) && isUnshaped(r) && r.lines_missing_bom > 0,
  },
  {
    id: 'chua',
    label: 'Chưa nạp bảng',
    test: (r) => !needsRoute(r) && isUnshaped(r) && r.lines_missing_bom === 0,
  },
  { id: 'xong', label: 'Xong', test: (r) => !needsRoute(r) && !isUnshaped(r) },
  { id: 'all', label: 'Tất cả', test: () => true },
]

export function BangLenh({ rows, canEdit }: { rows: ShapingRow[]; canEdit: boolean }) {
  const [view, setView] = useState<ViewId>(rows.some(needsRoute) ? 'can' : 'all')
  const test = VIEWS.find((v) => v.id === view)!.test
  const shown = rows.filter(test)
  const dmy = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'
  const n = (id: ViewId) => rows.filter(VIEWS.find((v) => v.id === id)!.test).length

  return (
    <>
      <div className="sx-hc" role="tablist" aria-label="Lọc lệnh">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={['c', view === v.id && 'on'].filter(Boolean).join(' ')}
            onClick={() => setView(v.id)}
          >
            {v.label} <b>{n(v.id)}</b>
          </button>
        ))}
      </div>
      <div className="sx-grid">
        <table className="sx-tb" style={{ minWidth: 980 }}>
          <colgroup>
            <col style={{ width: 170 }} />
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Lệnh</th>
              <th>Khách</th>
              <th className="r">Hạn xuất</th>
              <th className="r">Dòng SP</th>
              <th>Lộ trình cụm</th>
              <th>Bảng chi tiết (Kỹ thuật)</th>
              <th>Tổ &amp; hạn</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="mut"
                  style={{ height: 56, textAlign: 'center' }}
                >
                  Không có lệnh nào trong nhóm này.
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const can = needsRoute(r)
              const trong = isUnshaped(r)
              const choKT = r.lines_missing_bom > 0
              return (
                <tr key={r.lsx.id}>
                  <td>
                    <Link href={`/thongke/lo-trinh?lsx=${r.lsx.id}`} className="lnk ma">
                      {r.lsx.code}
                    </Link>
                  </td>
                  <td title={r.lsx.customer_name}>{r.lsx.customer_name}</td>
                  <td className="r num">{dmy(r.lsx.ship_date)}</td>
                  <td className="r num">{r.line_count}</td>
                  <td>
                    {trong ? (
                      <span className="mut">—</span>
                    ) : r.cluster_count === 0 ? (
                      <span className="mut">BOM phẳng · cụm mặc nhiên</span>
                    ) : can ? (
                      <>
                        <i className="sx-dot w" />
                        {r.cluster_unrouted}/{r.cluster_count} cụm chưa khai
                      </>
                    ) : (
                      <>
                        <i className="sx-dot g" />
                        {r.cluster_count} cụm đã khai
                      </>
                    )}
                  </td>
                  <td>
                    {trong && choKT ? (
                      <>
                        <i className="sx-dot w" />
                        chờ Kỹ thuật {r.lines_missing_bom}/{r.line_count} SP
                      </>
                    ) : trong ? (
                      <>
                        <i className="sx-dot m" />
                        có định mức, mở là nạp
                      </>
                    ) : choKT ? (
                      <span>
                        {r.component_count} dòng ·{' '}
                        <span className="warn">
                          {r.lines_missing_bom} SP chờ Kỹ thuật
                        </span>
                      </span>
                    ) : (
                      <span className="mut">
                        {r.component_count} dòng · {r.cluster_count} cụm
                      </span>
                    )}
                  </td>
                  <td className="mut">
                    {r.jobs_total > 0 ? `${r.jobs_total} việc` : 'chưa giao tổ'}
                  </td>
                  <td>
                    <Link href={`/thongke/lo-trinh?lsx=${r.lsx.id}`} className="lnk">
                      {can && canEdit
                        ? 'Khai lộ trình ›'
                        : trong && !choKT
                          ? 'Mở ›'
                          : 'Xem ›'}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>
                {n('can')} còn cụm chưa khai · {n('cho')} chờ Kỹ thuật · {n('chua')} chưa
                nạp bảng · {n('xong')} xong
              </td>
              <td colSpan={4} className="mut" style={{ fontWeight: 400 }}>
                cụm chưa khai = chạy theo mặc định nhóm vật tư, vẫn ghi sổ được · bảng chi
                tiết tự nạp lúc duyệt lệnh
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
