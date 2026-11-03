'use client'

import { Fragment } from 'react'
import { cx, dmy, fmt } from './ho-so-lenh.shared'
import type { HoSoLenhCtx } from './useHoSoLenh'

/**
 * KẾ HOẠCH TỔ & HẠN — là TAB của hồ sơ, không phải màn riêng (đã từ chối ba
 * lần dựng thực thể "KH-xxx"). Mỗi dòng SP × công đoạn (production_jobs): tổ,
 * hạn bắt đầu / kết thúc, trạng thái. Sửa tại chỗ, lưu từng dòng; việc đã chạy
 * mà đổi tổ / hạn thì bắt lý do (nhật ký 0169).
 */
export function TabKeHoach({ d }: { d: HoSoLenhCtx }) {
  const { data, p } = d
  const byLine = new Map<string, typeof data.jobs>()
  for (const j of [...data.jobs].sort((a, b) => a.seq - b.seq)) {
    byLine.set(j.production_order_line_id, [
      ...(byLine.get(j.production_order_line_id) ?? []),
      j,
    ])
  }
  const STATUS: Record<string, string> = {
    todo: 'chưa bắt đầu',
    doing: 'đang làm',
    done: 'xong',
  }
  if (data.jobs.length === 0) {
    return (
      <div className="sx-rong">
        <b>Lệnh chưa lên kế hoạch công đoạn</b>
        <p>
          Kế hoạch = lộ trình công đoạn per dòng SP + tổ + hạn. Chưa có thì tab Đồng bộ
          vẫn đếm được theo lộ trình suy từ hồ sơ SP, nhưng không ai biết việc trễ hạn hay
          chưa.
        </p>
        <a className="sx-btn p" href={`/kehoach-sx/${data.lsx.id}`}>
          Lên kế hoạch ở Kế hoạch SX
        </a>
      </div>
    )
  }
  return (
    <div className="sx-grid">
      <table className="sx-tb" style={{ minWidth: 900 }}>
        <colgroup>
          <col style={{ width: 240 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 170 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 110 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>SP</th>
            <th>Công đoạn</th>
            <th>Tổ</th>
            <th>Bắt đầu</th>
            <th>Hạn xong</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l) => {
            const jobs = byLine.get(l.order_line_id) ?? []
            if (!jobs.length) return null
            return (
              <Fragment key={l.order_line_id}>
                <tr className="grp">
                  <td colSpan={7}>
                    <span className="ma">{l.product_code}</span>
                    <span className="mut" style={{ fontWeight: 400 }}>
                      {' '}
                      · {l.product_name} · {fmt(l.qty)} {l.unit}
                    </span>
                  </td>
                </tr>
                {jobs.map((j) => {
                  const x = d.jobDraft(j)
                  const dirty = d.jobDirty(j)
                  const tre =
                    j.status !== 'done' &&
                    !!j.planned_end &&
                    j.planned_end.slice(0, 10) < data.today
                  return (
                    <tr key={j.id} className="d">
                      <td></td>
                      <td>{d.stageLabel(j.stage)}</td>
                      <td className={cx(p.canPlan && 'ed')}>
                        {p.canPlan ? (
                          <select
                            className="sx-cell"
                            value={x.team}
                            onChange={(e) =>
                              d.patchJob(j.id, { team: e.target.value }, j)
                            }
                            aria-label={`Tổ ${d.stageLabel(j.stage)}`}
                          >
                            <option value="">— chưa giao tổ —</option>
                            {data.teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                                {t.stage_code === j.stage ? ' ★' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          (j.team_name ?? <span className="empty">chưa giao tổ</span>)
                        )}
                      </td>
                      <td className={cx(p.canPlan && 'ed')}>
                        {p.canPlan ? (
                          <input
                            className="sx-cell num"
                            type="date"
                            value={x.start}
                            onChange={(e) =>
                              d.patchJob(j.id, { start: e.target.value }, j)
                            }
                            aria-label="Bắt đầu"
                          />
                        ) : j.planned_start ? (
                          <span className="num">{dmy(j.planned_start)}</span>
                        ) : (
                          <span className="empty">—</span>
                        )}
                      </td>
                      <td className={cx(p.canPlan && 'ed', tre && 'warn')}>
                        {p.canPlan ? (
                          <input
                            className="sx-cell num"
                            type="date"
                            value={x.end}
                            onChange={(e) => d.patchJob(j.id, { end: e.target.value }, j)}
                            aria-label="Hạn xong"
                          />
                        ) : j.planned_end ? (
                          <span className="num">{dmy(j.planned_end)}</span>
                        ) : (
                          <span className="empty">—</span>
                        )}
                      </td>
                      <td
                        className={cx(
                          j.status === 'done'
                            ? 'ok'
                            : tre
                              ? 'warn'
                              : j.status === 'todo'
                                ? 'mut'
                                : undefined,
                        )}
                      >
                        {STATUS[j.status] ?? j.status}
                        {tre && ' · trễ'}
                      </td>
                      <td>
                        {dirty && (
                          <>
                            {j.status !== 'todo' && (
                              <input
                                className="sx-in"
                                value={x.reason}
                                onChange={(e) =>
                                  d.patchJob(j.id, { reason: e.target.value }, j)
                                }
                                placeholder="lý do đổi (việc đã chạy)"
                                aria-label="Lý do"
                                style={{ width: 200, marginRight: 6 }}
                              />
                            )}
                            <button
                              type="button"
                              className="lnk"
                              onClick={() => d.luuJob(j)}
                              disabled={d.busy}
                            >
                              Lưu
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7}>
              {data.jobs.length} việc ·{' '}
              {data.jobs.filter((j) => j.status === 'done').length} xong · {d.jobsTre} trễ
              hạn
              <span className="mut" style={{ fontWeight: 400 }}>
                {' '}
                · công đoạn tự “xong” khi sổ ghi đủ số — không ai bấm tay
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
