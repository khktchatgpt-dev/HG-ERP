'use client'

import { STATUS_LABEL as PBS_STATUS, type EntryDocStatus } from '@/lib/entry-doc-flow'
import { cx, dmy, fmt } from './ho-so-lenh.shared'
import type { HoSoLenhCtx } from './useHoSoLenh'

const PGT_STATUS: Record<string, string> = {
  da_giao: 'chờ nhận',
  da_nhan: 'đã nhận',
  da_huy: 'đã huỷ',
}

/**
 * PHIẾU của lệnh: PBS (báo sản lượng) và PGT (giao tổ). Phiếu nháp PBS ghi chính
 * thức hoặc xoá (xác nhận hai nhịp); phiếu nào cũng in được. PGT chỉ xem ở đây
 * — nhận / huỷ / đảo làm ở màn Giao nhận.
 */
export function TabPhieu({ d }: { d: HoSoLenhCtx }) {
  const { data, p } = d
  return (
    <div className="sx-grid">
      <table className="sx-tb" style={{ minWidth: 980 }}>
        <colgroup>
          <col style={{ width: 118 }} />
          <col style={{ width: 60 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 60 }} />
          <col style={{ width: 60 }} />
          <col style={{ width: 110 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Phiếu</th>
            <th>Ngày</th>
            <th>Công đoạn</th>
            <th>Tổ</th>
            <th className="r">Đạt / giao</th>
            <th className="r">Phế</th>
            <th className="r">Sửa</th>
            <th>Trạng thái</th>
            <th>Ghi chú · thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr className="grp">
            <td colSpan={9}>Phiếu báo sản lượng (PBS) · {data.pbs.length}</td>
          </tr>
          {data.pbs.length === 0 && (
            <tr>
              <td colSpan={9} className="mut" style={{ textAlign: 'center' }}>
                Chưa ai ghi sản lượng cho lệnh — mỗi lượt Ghi sản lượng sinh một phiếu có
                số.
              </td>
            </tr>
          )}
          {data.pbs.map((x) => {
            const st = x.status as EntryDocStatus
            const nhap = st === 'nhap' || st === 'tu_choi'
            return (
              <tr key={x.id} className="d">
                <td className="ma">{x.doc_no}</td>
                <td className="num">{dmy(x.entry_date)}</td>
                <td>{d.stageLabel(x.stage)}</td>
                <td
                  title={
                    x.labor_hours
                      ? `Ca ${x.shift ?? '—'} · ${x.worker_count} CN × ${fmt(x.hours_per_worker ?? 0)} giờ = ${fmt(x.labor_hours)} giờ công`
                      : 'Chưa ghi giờ công'
                  }
                >
                  {x.team_name ?? <span className="empty">—</span>}
                  {x.labor_hours ? (
                    <span className="mut num">
                      {' '}
                      · {x.worker_count}×{fmt(x.hours_per_worker ?? 0)}h
                    </span>
                  ) : (
                    nhap && <span className="warn"> · chưa giờ công</span>
                  )}
                </td>
                <td className="r num">{fmt(x.total_qty)}</td>
                <td className={cx('r num', x.total_defect > 0 ? 'warn' : 'empty')}>
                  {fmt(x.total_defect)}
                </td>
                <td className={cx('r num', x.total_rework > 0 ? 'warn' : 'empty')}>
                  {fmt(x.total_rework)}
                </td>
                <td
                  className={cx(
                    st === 'da_xac_nhan' ? 'ok' : st === 'tu_choi' ? 'stop' : 'mut',
                  )}
                >
                  {PBS_STATUS[st] ?? st}
                </td>
                <td title={x.note ?? undefined}>
                  {x.note && <span className="mut">{x.note} · </span>}
                  <a
                    className="lnk mut"
                    href={`/print/phieu-sx/${x.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    In
                  </a>
                  {p.canRecord && nhap && (
                    <>
                      {d.gioPhieu?.id === x.id && (
                        // Giờ công TẠI CHỖ (0296): số chính thức phải có giờ.
                        <span className="sx-gio" style={{ marginLeft: 8 }}>
                          <input
                            className="sx-in num"
                            value={d.gioPhieu.cn}
                            onChange={(e) =>
                              d.setGioPhieu({ ...d.gioPhieu!, cn: e.target.value })
                            }
                            placeholder="số CN"
                            aria-label={`Số công nhân phiếu ${x.doc_no}`}
                            inputMode="numeric"
                            style={{ width: 58 }}
                          />
                          {' × '}
                          <input
                            className="sx-in num"
                            value={d.gioPhieu.gio}
                            onChange={(e) =>
                              d.setGioPhieu({ ...d.gioPhieu!, gio: e.target.value })
                            }
                            placeholder="giờ"
                            aria-label={`Giờ mỗi người phiếu ${x.doc_no}`}
                            inputMode="decimal"
                            style={{ width: 48 }}
                          />
                        </span>
                      )}
                      <button
                        type="button"
                        className="lnk"
                        style={{ marginLeft: 8 }}
                        onClick={() => d.pbsChinhThuc(x)}
                        disabled={d.busy}
                      >
                        Ghi chính thức
                      </button>
                      {d.gioPhieu?.id === x.id && d.gioPhieuLoi && (
                        <span className="warn" style={{ marginLeft: 6 }}>
                          {d.gioPhieuLoi}
                        </span>
                      )}
                      <button
                        type="button"
                        className={cx('lnk', d.xoaHoi === x.id ? 'stop' : 'mut')}
                        style={{ marginLeft: 8 }}
                        onClick={() => d.pbsXoa(x.id, x.doc_no)}
                        disabled={d.busy}
                      >
                        {d.xoaHoi === x.id ? 'Bấm lần nữa để xoá' : 'Xoá'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
          <tr className="grp">
            <td colSpan={9}>Phiếu giao tổ (PGT) · {data.pgt.length}</td>
          </tr>
          {data.pgt.length === 0 && (
            <tr>
              <td colSpan={9} className="mut" style={{ textAlign: 'center' }}>
                Chưa có phiếu giao tổ nào — lập ở màn Giao nhận. Không bắt buộc: ghi sổ
                vẫn được, phiếu làm “tồn tại công đoạn” có nghĩa.
              </td>
            </tr>
          )}
          {data.pgt.map((x) => {
            const giao = x.lines.reduce((a, l) => a + l.qty, 0)
            const nhan = x.lines.reduce((a, l) => a + (l.received_qty ?? 0), 0)
            return (
              <tr key={x.id} className="d">
                <td className="ma">
                  {x.doc_no}
                  {x.reverses_doc_no && (
                    <span className="pill m">đảo {x.reverses_doc_no}</span>
                  )}
                </td>
                <td className="num">{dmy(x.entry_date)}</td>
                <td>
                  {d.stageLabel(x.from_stage)} → {d.stageLabel(x.to_stage)}
                </td>
                <td>
                  {d.teamName(x.from_team_id) ?? '—'} → {d.teamName(x.to_team_id) ?? '—'}
                </td>
                <td className="r num">
                  {fmt(giao)}
                  {x.status === 'da_nhan' && nhan !== giao && (
                    <span className="pill w">nhận {fmt(nhan)}</span>
                  )}
                </td>
                <td className="r empty">—</td>
                <td className="r empty">—</td>
                <td
                  className={cx(
                    x.status === 'da_nhan'
                      ? 'ok'
                      : x.status === 'da_huy'
                        ? 'stop'
                        : 'warn',
                  )}
                >
                  {PGT_STATUS[x.status] ?? x.status}
                </td>
                <td title={x.note ?? undefined}>
                  {x.lines.map((l) => `${l.name} ${fmt(l.qty)}`).join(' · ')}
                  {x.cancel_reason && (
                    <span className="mut"> · huỷ: {x.cancel_reason}</span>
                  )}
                  {x.lines.some((l) => l.diff_reason) && (
                    <span className="mut">
                      {' '}
                      · chênh:{' '}
                      {x.lines
                        .map((l) => l.diff_reason)
                        .filter(Boolean)
                        .join('; ')}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={9}>
              {data.pbs.length} PBS · {data.pgt.length} PGT
              <span className="mut" style={{ fontWeight: 400 }}>
                {' '}
                · xoá chỉ với PBS nháp; PGT không xoá, chỉ huỷ / đảo ở màn Giao nhận
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
