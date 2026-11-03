'use client'

import { dmVn } from './phan-cong.shared'
import { tinhTrang } from './pc-viec'
import type { PhanCongCtx } from './usePhanCong'

/**
 * LƯỚI VIỆC (bản vẽ 3): mỗi việc MỘT hàng — mã · việc (+ GẤP) · người · hạn · tình
 * trạng · số tệp. Mô tả, kết quả, lý do trả lại nằm ở ngăn phải, không chen vào dòng.
 * Bấm dòng = chọn; mũi tên lên/xuống đổi dòng. Đầu cột và chân lưới dính.
 */
export function LuoiViec({ d }: { d: PhanCongCtx }) {
  const giao = d.tab === 'giao'
  const rows = d.rows
  const cho = rows.filter((t) => t.status === 'submitted').length
  const tre = rows.filter((t) => t.overdue_days > 0).length

  function phim(e: React.KeyboardEvent<HTMLTableSectionElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const i = rows.findIndex((t) => t.id === d.chon?.id)
    const j = Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))
    if (rows[j]) {
      d.chonDong(rows[j].id)
      document.getElementById(`pc-dong-${rows[j].id}`)?.focus()
    }
  }

  if (rows.length === 0) {
    const coLoc = d.q.trim() || d.phong
    return (
      <div className="pc-grid">
        <p className="pc-rong">
          {coLoc ? (
            <>
              Không có việc khớp bộ lọc.{' '}
              <button
                type="button"
                className="lnk"
                onClick={() => {
                  d.setQ('')
                  d.setPhong('')
                }}
              >
                Bỏ lọc
              </button>
            </>
          ) : giao ? (
            (d.dem.giao?.n ?? 0) === 0 && d.locGiao === 'open' ? (
              <>Chưa giao việc nào. Bấm “+ Giao việc” ở góc trên.</>
            ) : (
              <>Không có việc ở mục này — chọn tình trạng khác.</>
            )
          ) : (
            <>Không có việc ở mục này — chọn tình trạng khác.</>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="pc-grid">
      <table className="pc-tb" aria-label={giao ? 'Việc tôi giao' : 'Việc của tôi'}>
        <colgroup>
          <col style={{ width: 96 }} />
          <col />
          <col style={{ width: 168 }} />
          <col style={{ width: 60 }} />
          <col style={{ width: 104 }} />
          <col style={{ width: 46 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Việc</th>
            <th>{giao ? 'Người nhận' : 'Người giao'}</th>
            <th className="r">Hạn</th>
            <th>Tình trạng</th>
            <th className="r">Tệp</th>
          </tr>
        </thead>
        <tbody onKeyDown={phim}>
          {rows.map((t) => {
            const on = t.id === d.chon?.id
            const tt = tinhTrang(t)
            const nguoi = giao ? t.assignee_name : t.assigner_name
            return (
              <tr
                key={t.id}
                id={`pc-dong-${t.id}`}
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => d.chonDong(t.id)}
              >
                <td className="ma">{t.task_code}</td>
                <td title={t.title}>
                  {t.title}
                  {t.priority === 'urgent' && <span className="gap">GẤP</span>}
                </td>
                <td
                  title={`${nguoi ?? ''}${giao && t.department_name ? ` · ${t.department_name}` : ''}`}
                >
                  {nguoi ?? '—'}
                </td>
                <td className="r num">{t.due_date ? dmVn(t.due_date) : '—'}</td>
                <td className={`st ${tt.tone}`}>{tt.label}</td>
                <td className="r num">
                  {t.file_count > 0 ? t.file_count : <span className="mut">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>
              {rows.length} việc · {cho} chờ duyệt · {tre} trễ hạn
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
