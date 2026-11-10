'use client'

import { useRef } from 'react'
import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { byUnitText, sortByUnit } from '@/lib/khoi-luong'
import {
  cx,
  dmyFull,
  fmt,
  lockedJob,
  stageDraftSummary,
  teamsForStage,
} from './giao-to.shared'
import { LuoiGiaoTo } from './luoi-giao-to'
import { useGiaoTo, type GiaoToCtx, type GiaoToProps } from './useGiaoTo'

/**
 * GIAO TỔ & HẠN — dựng lại KHÔNG kit theo khuôn F (bản vẽ 10/11/2026,
 * https://claude.ai/artifact/3m3pok6LKJ96dyZncUAqYV, duyệt Q1–Q7). Thay
 * PlanEditor.tsx (kit tháng 8): một lưới dòng SP × công đoạn thay 8–37 thẻ,
 * hàng "Cả lệnh" áp xuống, thanh sửa ô dưới lưới, thanh chốt đáy (ngoại lệ
 * khuôn F), khối Khối lượng theo công đoạn làm đầu trang, nhật ký là tab.
 * API không đổi: lsxPlanSchema (Cả lệnh) + linePlanSchema (từng dòng).
 */
export function GiaoToScreen(props: GiaoToProps) {
  const d = useGiaoTo(props)
  const { data } = d
  const editorRef = useRef<HTMLSelectElement | null>(null)
  const lsx = data.lsx
  const stopN = d.chan.filter((b) => b.kind === 'stop').length
  const selCell = d.sel ? d.cellOf(d.sel) : null
  const selLine = d.sel?.line ? d.lineOf(d.sel.line) : null
  const selLock = d.sel?.line && selLine ? lockedJob(selLine, d.sel.stage) : null
  const selTeams = d.sel ? teamsForStage(data.teams, d.sel.stage) : []
  const selNeed = d.sel
    ? d.sel.line
      ? selLine?.needs[d.sel.stage]
      : data.khoi_luong.stages.find((s) => s.code === d.sel!.stage)?.by_unit
    : undefined
  const nhip = (() => {
    if (!selCell?.on || !selCell.start || !selCell.end || !selNeed?.length) return null
    const m = sortByUnit(selNeed)[0]
    const days = workingDays(selCell.start, selCell.end)
    return days > 0
      ? `≥ ${fmt(Math.ceil(m.needed / days))} ${m.unit}/ngày · ${days} ngày làm`
      : null
  })()

  return (
    <SxKhung label="Giao tổ & hạn">
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất › Giao tổ & hạn"
          title={lsx.code}
          ctx={
            <>
              {lsx.customer_name} · {fmt(data.lines.length)} dòng SP ·{' '}
              <b>{fmt(data.lines.reduce((a, l) => a + l.qty, 0))}</b>{' '}
              {data.lines[0]?.qty != null
                ? (data.khoi_luong.lines[0]?.unit ?? 'cái')
                : ''}{' '}
              · xuất <b>{lsx.ship_date ? dmyFull(lsx.ship_date) : '—'}</b>
              {lsx.order_codes.length > 1 && ` · ${fmt(lsx.order_codes.length)} đơn`}
            </>
          }
          actions={
            <ApNhom>
              <ApNut href={`/thongke/lsx/${lsx.id}`}>Hồ sơ lệnh</ApNut>
              <ApNut href={`/thongke/lo-trinh?lsx=${lsx.id}`}>Lộ trình công đoạn</ApNut>
            </ApNhom>
          }
        />
        <TabNgang
          label="Mục"
          tabs={[
            {
              key: 'ke_hoach',
              label: 'Kế hoạch',
              on: d.tab === 'ke_hoach',
              onClick: () => d.setTab('ke_hoach'),
            },
            {
              key: 'nhat_ky',
              label: 'Nhật ký điều chỉnh',
              n: data.history.length,
              on: d.tab === 'nhat_ky',
              onClick: () => d.setTab('nhat_ky'),
            },
          ]}
        />
        {d.loi && <div className="sx-err">{d.loi}</div>}
        {d.thongBao && !d.loi && (
          <div className="sx-note ok">
            {d.thongBao}
            <button type="button" className="lnk mut" onClick={() => d.setThongBao(null)}>
              Đóng
            </button>
          </div>
        )}
        {d.locked && (
          <div className="sx-note stop">
            Lệnh đã {lsx.status === 'completed' ? 'hoàn thành' : 'huỷ'} — kế hoạch chỉ còn
            để tra cứu.
          </div>
        )}
        {!props.canEdit && !d.locked && (
          <div className="sx-note">
            Chỉ xem — quyền <b>production.plan.manage</b> (Kế hoạch SX / quản đốc) mới sửa
            được.
          </div>
        )}

        {d.tab === 'ke_hoach' ? (
          <>
            <KhoiLuongDau d={d} />
            {data.lines.length === 0 ? (
              <div className="sx-rong">
                <b>Đơn không có dòng SP</b>
                <p>Lệnh này chưa gắn dòng sản phẩm nào nên không có gì để giao tổ.</p>
              </div>
            ) : (
              <LuoiGiaoTo d={d} editorRef={editorRef} />
            )}

            {/* Thanh sửa ô — chỉ hiện khi có ô đang chọn (10/11: bớt chữ hướng dẫn) */}
            {d.sel && selCell && (
              <div className="sx-ed" role="region" aria-label="Ô đang sửa">
                <>
                  <span className="k">Ô đang sửa</span>
                  <b>
                    {d.sel.line ? selLine?.product_code : 'Cả lệnh'} ·{' '}
                    {d.stageLabel(d.sel.stage)}
                  </b>
                  {!selCell.on && (
                    <span className="mut">
                      chưa trong lộ trình —{' '}
                      <button
                        type="button"
                        className="lnk"
                        onClick={() => d.toggle(d.sel!)}
                        disabled={!d.canEdit}
                      >
                        thêm công đoạn
                      </button>
                    </span>
                  )}
                  {selCell.on && (
                    <>
                      <span className="sep" />
                      <span className="k">Tổ</span>
                      <select
                        ref={editorRef}
                        value={selCell.team}
                        disabled={!d.canEdit}
                        className={cx(!selCell.team && selTeams.length > 1 && 'err')}
                        onChange={(e) => d.patch(d.sel!, { team: e.target.value })}
                        aria-label="Tổ phụ trách"
                      >
                        <option value="">
                          {selTeams.length === 1
                            ? `tự theo công đoạn (${selTeams[0].name})`
                            : selTeams.length > 1
                              ? '— chọn tổ —'
                              : '— tổ —'}
                        </option>
                        {[
                          ...selTeams,
                          ...data.teams.filter((t) => !selTeams.includes(t)),
                        ].map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.stage_code && t.stage_code !== d.sel!.stage
                              ? ` (${d.stageLabel(t.stage_code)})`
                              : ''}
                          </option>
                        ))}
                      </select>
                      <span className="k">Bắt đầu</span>
                      <input
                        type="date"
                        value={selCell.start}
                        disabled={!d.canEdit}
                        onChange={(e) => d.patch(d.sel!, { start: e.target.value })}
                        aria-label="Bắt đầu"
                      />
                      <span className="k">Kết thúc</span>
                      <input
                        type="date"
                        value={selCell.end}
                        disabled={!d.canEdit}
                        className={cx(
                          selCell.start &&
                            selCell.end &&
                            selCell.end < selCell.start &&
                            'err',
                        )}
                        onChange={(e) => d.patch(d.sel!, { end: e.target.value })}
                        aria-label="Kết thúc"
                      />
                      {nhip ? (
                        <span className="mut">{nhip}</span>
                      ) : selNeed?.length ? (
                        <span className="mut">cần {byUnitText(selNeed)}</span>
                      ) : null}
                      {selTeams.length > 1 && !selCell.team && (
                        <span className="warn">
                          {selTeams.length} tổ cùng công đoạn — chọn một
                        </span>
                      )}
                      <span className="sep" />
                      {d.sel.line ? (
                        <>
                          <button
                            type="button"
                            className="sx-btn"
                            disabled={!d.canEdit}
                            onClick={() => d.apCot(d.sel!)}
                          >
                            Áp cả cột {d.stageLabel(d.sel.stage)}
                          </button>
                          <button
                            type="button"
                            className="sx-btn"
                            disabled={!d.canEdit}
                            onClick={() => d.apDong(d.sel!)}
                          >
                            Hạn này cho cả dòng
                          </button>
                        </>
                      ) : (
                        <span className="mut">
                          áp xuống {fmt(d.diff.receiving)} dòng khi lưu
                        </span>
                      )}
                      <button
                        type="button"
                        className={cx('sx-btn', (selLock || !d.canEdit) && 'off')}
                        disabled={!!selLock || !d.canEdit}
                        title={selLock ? 'Việc đã chạy — không bỏ được' : undefined}
                        onClick={() => d.toggle(d.sel!)}
                      >
                        Bỏ
                      </button>
                    </>
                  )}
                </>
              </div>
            )}

            {/* Thanh chốt đáy */}
            <div className="sx-cb">
              <span className="cnt">
                {!d.dirty ? (
                  <span className="mut">Chưa có thay đổi</span>
                ) : (
                  <>
                    {d.diff.receiving > 0 && (
                      <>
                        <b>{fmt(d.diff.receiving)}</b> dòng nhận từ Cả lệnh
                      </>
                    )}
                    {d.diff.receiving > 0 && d.diff.lines.length > 0 && ' · '}
                    {d.diff.lines.length > 0 && (
                      <>
                        <b>{fmt(d.diff.lines.length)}</b> dòng sửa riêng ·{' '}
                        <b>{fmt(d.diff.changedCells)}</b> ô
                      </>
                    )}
                    {d.diff.activeTouched > 0 && (
                      <>
                        {' '}
                        · <b className="warn">{fmt(d.diff.activeTouched)}</b> việc đã chạy
                        bị đổi
                      </>
                    )}
                  </>
                )}
              </span>
              {d.dirty && d.chan.length > 0 && (
                <span className={d.chan[0].kind === 'stop' ? 'blk' : 'mut'}>
                  {d.chan[0].kind === 'stop' ? 'Chưa lưu được — ' : ''}
                  {d.chan[0].cell ? (
                    <button type="button" onClick={() => d.setSel(d.chan[0].cell!)}>
                      {d.chan[0].text}
                    </button>
                  ) : (
                    d.chan[0].text
                  )}
                  {d.chan.length > 1 && ` (+${d.chan.length - 1})`}
                </span>
              )}
              {d.diff.activeTouched > 0 && (
                <input
                  className="ly-do"
                  value={d.reason}
                  onChange={(e) => d.setReason(e.target.value)}
                  placeholder="Lý do điều chỉnh (bắt buộc) — VD: dời 3 ngày vì thiếu nhôm"
                  aria-label="Lý do điều chỉnh"
                />
              )}
              <span className="r">
                {data.lines.some((l) => l.jobs.length > 0) && (
                  <label>
                    <input
                      type="checkbox"
                      checked={d.overwrite}
                      onChange={(e) => d.setOverwrite(e.target.checked)}
                      disabled={!d.canEdit}
                    />
                    Ghi đè {fmt(data.lines.filter((l) => l.jobs.length > 0).length)} dòng
                    đã có KH
                  </label>
                )}
                <button
                  type="button"
                  className="sx-btn"
                  onClick={d.huy}
                  disabled={!d.dirty || d.busy}
                >
                  Huỷ nháp
                </button>
                <button
                  type="button"
                  className={cx(
                    'sx-btn',
                    stopN > 0 || !d.dirty || !d.canEdit ? 'off' : 'p',
                  )}
                  disabled={stopN > 0 || !d.dirty || !d.canEdit || d.busy}
                  onClick={d.luu}
                >
                  {d.busy ? 'Đang lưu…' : 'Lưu kế hoạch'}
                </button>
              </span>
            </div>
          </>
        ) : (
          <NhatKy d={d} />
        )}

        <ThanhTT
          left={
            <>Bấm ô để sửa · bấm đúp hoặc Space để tick · ←↑→↓ đi ô · Ctrl+Enter lưu</>
          }
        />
      </div>
    </SxKhung>
  )
}

/** Khối Khối lượng theo công đoạn — dòng tổ & hạn theo NHÁP (Q3). */
function KhoiLuongDau({ d }: { d: GiaoToCtx }) {
  const k = d.data.khoi_luong
  if (k.stages.length === 0) {
    return (
      <div className="sx-kl">
        <div className="sx-kl-h">
          <b>Khối lượng theo công đoạn</b>
          <span className="warn">
            chưa có bảng chi tiết — vẫn giao tổ được, nhưng không biết phôi phải cắt bao
            nhiêu
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className={cx('sx-kl', d.klGap && 'gap')}>
      <div className="sx-kl-h">
        <button
          type="button"
          className="lnk"
          onClick={() => d.setKlGap(!d.klGap)}
          title={
            k.not_traversed.length > 0
              ? `Không đi qua: ${k.not_traversed.join(' · ')}`
              : undefined
          }
        >
          {d.klGap ? '▸' : '▾'} <b>Khối lượng theo công đoạn</b>
        </button>
        {!d.klGap && (
          <span className="mut">tổ &amp; hạn theo nháp — chữ xanh là chưa lưu</span>
        )}
      </div>
      <div className="sx-kl-row" role="list">
        {k.stages.map((s) => {
          const units = sortByUnit(s.by_unit)
          const t = stageDraftSummary(d.data, d.draft, s.code, d.overwrite)
          return (
            <button
              key={s.code}
              type="button"
              role="listitem"
              className={cx(
                'sx-kc',
                d.sel?.line == null && d.sel?.stage === s.code && 'sel',
              )}
              onClick={() => d.setSel({ line: null, stage: s.code })}
              title={`${s.label}: ${byUnitText(units)} — bấm để sửa hàng Cả lệnh`}
            >
              <span className="st">
                {s.label} <i>{s.index}</i>
              </span>
              <span className="n">
                {fmt(units[0]?.needed ?? 0)}
                <small>{units[0]?.unit}</small>
              </span>
              {units.slice(1).map((u) => (
                <span key={u.unit} className="n sec">
                  {fmt(u.needed)}
                  <small>{u.unit}</small>
                </span>
              ))}
              <span
                className={cx('dt', t.tone === 'warn' && 'w')}
                style={t.tone === 'draft' ? { color: 'var(--sx-act)' } : undefined}
              >
                {t.text}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NhatKy({ d }: { d: GiaoToCtx }) {
  const { data } = d
  const lineName = (id: string | null) =>
    id == null
      ? 'CẢ LỆNH'
      : (data.lines.find((l) => l.order_line_id === id)?.product_code ?? '(dòng đã gỡ)')
  const fieldLabel = { team: 'tổ', planned_start: 'bắt đầu', planned_end: 'hạn' } as const
  const val = (field: string, v: string | null) =>
    field === 'team'
      ? v == null
        ? '(tự theo công đoạn)'
        : (d.teamName(v) ?? '?')
      : v
        ? dmyFull(v)
        : '—'
  if (data.history.length === 0)
    return (
      <div className="sx-rong">
        <b>Chưa có điều chỉnh nào</b>
        <p>
          Mỗi lần lưu kế hoạch ghi một dòng: ai, lúc nào, thêm / bỏ công đoạn gì, đổi tổ
          hay hạn nào, vì sao.
        </p>
      </div>
    )
  return (
    <div className="sx-grid">
      <table className="sx-tb">
        <colgroup>
          <col style={{ width: 130 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 150 }} />
          <col />
          <col style={{ width: 260 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Lúc</th>
            <th>Ai</th>
            <th>Phạm vi</th>
            <th>Đổi gì</th>
            <th>Lý do</th>
          </tr>
        </thead>
        <tbody>
          {data.history.map((h) => (
            <tr key={h.id} className="d">
              <td className="num">
                {new Date(h.created_at).toLocaleString('vi-VN', { hour12: false })}
              </td>
              <td>{h.actor_name ?? '?'}</td>
              <td>
                {h.production_order_line_id ? (
                  <span className="ma">{lineName(h.production_order_line_id)}</span>
                ) : (
                  lineName(null)
                )}
              </td>
              <td
                title={[
                  ...h.changes.added.map((s) => `+ ${d.stageLabel(s)}`),
                  ...h.changes.removed.map((s) => `− ${d.stageLabel(s)}`),
                  ...h.changes.changed.map(
                    (c) =>
                      `${d.stageLabel(c.stage)}: ${fieldLabel[c.field]} ${val(c.field, c.from)} → ${val(c.field, c.to)}`,
                  ),
                ].join(' · ')}
              >
                {h.changes.added.length > 0 && (
                  <span className="ok">
                    + {h.changes.added.map(d.stageLabel).join(' · ')}{' '}
                  </span>
                )}
                {h.changes.removed.length > 0 && (
                  <span className="stop">
                    − {h.changes.removed.map(d.stageLabel).join(' · ')}{' '}
                  </span>
                )}
                {h.changes.changed.map((c, i) => (
                  <span key={i}>
                    {d.stageLabel(c.stage)}: {fieldLabel[c.field]} {val(c.field, c.from)}{' '}
                    → {val(c.field, c.to)}
                    {i < h.changes.changed.length - 1 && ' · '}
                  </span>
                ))}
              </td>
              <td className={cx(!h.reason && 'mut')}>{h.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Số ngày làm việc (bỏ CN) trong [start..end] — cùng quy ước paceForWindow. */
function workingDays(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  let n = 0
  for (let t = a.getTime(); t <= b.getTime(); t += 86_400_000)
    if (new Date(t).getDay() !== 0) n++
  return n
}
