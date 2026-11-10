'use client'

import { useRef } from 'react'
import {
  columnUnit,
  cx,
  fmt,
  lockedJob,
  needCellText,
  spanText,
  teamsForStage,
  type CellKey,
} from './giao-to.shared'
import type { GiaoToCtx } from './useGiaoTo'

/**
 * LƯỚI dòng SP × công đoạn (khuôn F). Hàng đầu "Cả lệnh" dính dưới tiêu đề; ô
 * là <button> ba dòng: tick + tổ · hạn · cần. Ô nhận từ Cả lệnh (chưa lưu) tô
 * nghiêng xanh; ô sửa riêng chữ thẳng; ô gạch chéo = dòng không đi qua công
 * đoạn. Việc đã chạy: tick đen, không bỏ được.
 */
export function LuoiGiaoTo({
  d,
  editorRef,
}: {
  d: GiaoToCtx
  editorRef: React.RefObject<HTMLSelectElement | null>
}) {
  const { data, cols } = d
  const tb = useRef<HTMLTableElement>(null)
  const tongSl = data.lines.reduce((a, l) => a + l.qty, 0)
  const chuaKh = data.lines.filter((l) => l.jobs.length === 0).length
  const totals = (stage: string) => {
    const by = d.data.khoi_luong.stages.find((s) => s.code === stage)
    return by ? needCellText(by.by_unit) : ''
  }
  const errCells = new Set(
    d.chan.filter((b) => b.cell).map((b) => `${b.cell!.line ?? ''}|${b.cell!.stage}`),
  )
  const isSel = (k: CellKey) => d.sel && d.sel.line === k.line && d.sel.stage === k.stage
  const focusEditor = () => editorRef.current?.focus()

  return (
    <div className="sx-grid">
      <table
        ref={tb}
        className="sx-tb sx-pl"
        style={{ minWidth: 230 + 56 + cols.length * 97 }}
        onKeyDown={(e) => d.onKey(e, focusEditor)}
      >
        <colgroup>
          <col style={{ width: 230 }} />
          <col style={{ width: 56 }} />
          {cols.map((c) => (
            <col key={c.code} style={{ width: 97 }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="pin">Dòng SP</th>
            <th className="r">SL</th>
            {cols.map((c) => (
              <th
                key={c.code}
                title={`${c.label} · đơn vị: ${columnUnit(data, c.code) || '—'}`}
              >
                {c.label}
                <span className="u">{columnUnit(data, c.code) || ' '}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Hàng Cả lệnh (Q1) */}
          <tr className="all">
            <td className="pin sp">
              <div>Cả lệnh</div>
              <div className="ten">
                {d.overwrite
                  ? `ghi đè cả ${fmt(data.lines.length)} dòng`
                  : `áp xuống ${fmt(chuaKh)} dòng chưa có KH`}
              </div>
            </td>
            <td className="r num" style={{ padding: '0 8px' }}>
              {fmt(tongSl)}
            </td>
            {cols.map((c) => {
              const key: CellKey = { line: null, stage: c.code }
              const cell = d.cellOf(key)
              const team = d.teamName(cell.team || null)
              const nTeams = teamsForStage(data.teams, c.code).length
              return (
                <td
                  key={c.code}
                  className={cx(isSel(key) && 'sel', errCells.has(`|${c.code}`) && 'err')}
                >
                  <button
                    type="button"
                    className="o"
                    disabled={!d.canEdit}
                    onClick={() => d.setSel(key)}
                    onDoubleClick={() => d.toggle(key)}
                    title={`Cả lệnh · ${c.label}${cell.on ? '' : ' — bấm đúp hoặc Space để tick'}`}
                  >
                    <span className={cx('l1', cell.on && !team && nTeams > 1 && 'w')}>
                      <i
                        className={cx('tick', cell.on && 'on')}
                        onClick={(e) => {
                          e.stopPropagation()
                          d.toggle(key)
                        }}
                      />
                      {cell.on ? (team ?? (nTeams > 1 ? 'chọn tổ' : 'tự theo CĐ')) : ''}
                    </span>
                    <span className="l2">
                      {cell.on ? spanText(cell.start, cell.end) || 'chưa hạn' : '—'}
                    </span>
                    <span className="l3">{totals(c.code)}</span>
                  </button>
                </td>
              )
            })}
          </tr>

          {data.lines.map((l) => {
            const coViec = l.jobs.length > 0
            const chay = l.jobs.some((j) => j.status !== 'todo')
            return (
              <tr key={l.order_line_id} className="d">
                <td
                  className="pin sp"
                  title={`${l.product_code} · ${l.product_name}${l.group_title ? ` · ${l.group_title}` : ''}`}
                >
                  <div>
                    <span className="ma">{l.product_code}</span>
                    {coViec && (
                      <i
                        className={cx('dotj', chay && 'g')}
                        title={chay ? 'có việc đang chạy' : 'đã có kế hoạch'}
                      />
                    )}
                  </div>
                  <div className={cx('ten', !l.default_route && 'warn')}>
                    {l.default_route
                      ? l.product_name
                      : 'chưa định hình — không biết số chi tiết'}
                  </div>
                </td>
                <td className="r num" style={{ padding: '0 8px' }}>
                  {fmt(l.qty)}
                </td>
                {cols.map((c) => {
                  const key: CellKey = { line: l.order_line_id, stage: c.code }
                  const e = d.eff(l.order_line_id, c.code)
                  const lock = lockedJob(l, c.code)
                  const passes =
                    c.code in l.needs ||
                    l.jobs.some((j) => j.stage === c.code) ||
                    !l.default_route
                  const need = needCellText(l.needs[c.code])
                  const team = d.teamName(e.cell.team || null)
                  const nTeams = teamsForStage(data.teams, c.code).length
                  const badDate =
                    e.cell.on && e.cell.start && e.cell.end && e.cell.end < e.cell.start
                  return (
                    <td
                      key={c.code}
                      className={cx(
                        !passes && !e.cell.on && 'x',
                        e.source === 'all' && 'pre',
                        isSel(key) && 'sel',
                        errCells.has(`${l.order_line_id}|${c.code}`) && 'err',
                      )}
                    >
                      <button
                        type="button"
                        className="o"
                        disabled={!d.canEdit}
                        onClick={() => d.setSel(key)}
                        onDoubleClick={() => d.toggle(key)}
                        title={
                          lock
                            ? `${c.label} đã ${lock.status === 'done' ? 'xong' : 'đang làm'} — không bỏ được; đổi tổ/hạn phải ghi lý do`
                            : `${l.product_code} · ${c.label}${need ? ` · cần ${need}` : ''}`
                        }
                      >
                        <span
                          className={cx('l1', e.cell.on && !team && nTeams > 1 && 'w')}
                        >
                          <i
                            className={cx('tick', e.cell.on && 'on', lock && 'lock')}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              d.toggle(key)
                            }}
                          />
                          {e.cell.on
                            ? (team ??
                              (nTeams > 1
                                ? 'chọn tổ'
                                : nTeams === 1
                                  ? teamsForStage(data.teams, c.code)[0].name.replace(
                                      /^Tổ /,
                                      '',
                                    )
                                  : 'tự theo CĐ'))
                            : passes
                              ? ''
                              : '–'}
                        </span>
                        <span
                          className={cx(
                            'l2',
                            e.cell.on && !spanText(e.cell.start, e.cell.end) && 'w',
                            badDate && 's',
                          )}
                        >
                          {e.cell.on
                            ? spanText(e.cell.start, e.cell.end) || 'chưa hạn'
                            : ''}
                        </span>
                        <span className={cx('l3', !need && !l.default_route && 'mut')}>
                          {need || (!l.default_route && passes ? '?' : '')}
                        </span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="pin">
              {fmt(data.lines.length)} dòng · {fmt(data.lines.length - chuaKh)} có kế
              hoạch
              {data.khoi_luong.unshaped > 0 &&
                ` · ${fmt(data.khoi_luong.unshaped)} chưa định hình`}
            </td>
            <td className="r num">{fmt(tongSl)}</td>
            {cols.map((c) => (
              <td key={c.code} className="num">
                {totals(c.code)}
                {data.khoi_luong.unshaped > 0 && c.code === cols[0]?.code && (
                  <span className="mut"> + ?</span>
                )}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
