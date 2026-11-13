'use client'

import { Fragment } from 'react'
import { laHangMua, pctText, tenCum, tenNgan, tienDo } from '@/lib/ho-so-lenh'
import { cx, daysLeft, dmy, fmt, type Line, type Row, type Stage } from './ho-so-lenh.shared'
import type { HoSoLenhCtx } from './useHoSoLenh'

/**
 * BẢNG TIẾN ĐỘ — ĐỢT → MÃ HÀNG → CỤM × công đoạn (bản vẽ gọn 12/11/2026,
 * https://claude.ai/artifact/T2otDmrhZce8LZSmow3itu, duyệt Q1–Q7).
 *
 * - Q1: gom theo ĐỢT — lệnh GIGA là 5 đợt × 8 mã hàng, bảng cũ bày 35 dòng mã
 *   hàng không ghi đợt nên một mã lặp 4–5 lần không phân biệt được.
 * - Q2: hàng mua (chi tiết không qua công đoạn nào) không bày — 328/537 dòng.
 * - Q4: ô chưa làm là "·" mờ; "–" gạch chéo là ngoài lộ trình.
 * - Q5: không dòng "Thành phẩm (bộ)" (lắp ráp → hoàn thiện nằm trên dòng mã
 *   hàng); dòng cụm GỘP luôn dòng tóm tắt chi tiết phôi của nó.
 * Mã hàng gập sẵn; bấm mở ra cụm, bấm cụm ra chi tiết. Bấm ô số → dải năm con
 * số (cùng hàm với Ghi sản lượng và Giao nhận).
 */
export function BangDongBo({ d }: { d: HoSoLenhCtx }) {
  const { data, dots, lines } = d
  const stages = data.stages
  const nCols = 2 + stages.length + 1
  const minW = 240 + 68 + stages.length * 74 + 122
  const levelLabel: Record<Stage['count_level'], string> = {
    part: 'chi tiết',
    cluster: 'cụm',
    unit: 'bộ',
  }
  const tongCan = lines.reduce((a, l) => a + l.qty, 0)
  const tongDongBo = lines.reduce((a, l) => a + l.synced_sets, 0)
  const unit = lines[0]?.unit ?? 'cái'

  return (
    <div className="sx-grid">
      <table className="sx-tb sx-td" style={{ minWidth: minW }}>
        <colgroup>
          <col />
          <col style={{ width: 68 }} />
          {stages.map((s) => (
            <col key={s.code} style={{ width: 74 }} />
          ))}
          <col style={{ width: 122 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Đợt · mã hàng · cụm</th>
            <th className="r">Cần</th>
            {stages.map((s) => (
              <th
                key={s.code}
                data-stage-col={s.code}
                className={cx('r stg', d.congDoanChon === s.code && 'colsel')}
                title={`${s.label} — đếm bằng ${levelLabel[s.count_level]}`}
              >
                {tenNgan(s.label)}
                <span className="u">{levelLabel[s.count_level]}</span>
              </th>
            ))}
            <th
              className="r"
              title="Số bộ đã đủ chi tiết — bộ phận thiếu nhất kéo xuống (trước 12/11 gọi là 'đồng bộ')"
            >
              Đủ bộ
            </th>
          </tr>
        </thead>
        <tbody>
          {dots.length === 0 && (
            <tr>
              <td colSpan={nCols} className="mut" style={{ height: 52 }}>
                {d.tim || d.dotLoc ? (
                  <>
                    Không mã hàng, cụm hay chi tiết nào khớp “{d.tim}”{' '}
                    <button
                      type="button"
                      className="lnk"
                      onClick={() => {
                        d.setTim('')
                        d.setDotLoc('')
                      }}
                    >
                      Bỏ lọc
                    </button>
                  </>
                ) : (
                  'Lệnh chưa có dòng mã hàng nào'
                )}
              </td>
            </tr>
          )}
          {dots.map((dot) => {
            const gap = d.dotGap.has(dot.id)
            const rows = dot.lines.flatMap((l) => l.rows)
            const left = daysLeft(dot.ship_date, data.today)
            return (
              <Fragment key={dot.id || 'khac'}>
                {(dots.length > 1 || data.groups.length > 1) && (
                  <tr className="dot">
                    <td>
                      <button
                        type="button"
                        className="tg"
                        onClick={() => d.toggleDot(dot.id)}
                        aria-label={gap ? `Mở ${dot.title}` : `Gập ${dot.title}`}
                        aria-expanded={!gap}
                      >
                        {gap ? '▸' : '▾'}
                      </button>
                      {dot.title}
                      <span className="mut">
                        {dot.ship_date && <> · xuất {dmy(dot.ship_date)}</>}
                        {left != null && (
                          <span className={cx(left < 0 ? 'stop' : left <= 7 && 'warn')}>
                            {' '}
                            · {left < 0 ? `trễ ${-left} ngày` : `còn ${left} ngày`}
                          </span>
                        )}{' '}
                        · {dot.lines.length} mã hàng
                      </span>
                    </td>
                    <td className="r num">{fmt(dot.qty)}</td>
                    {stages.map((s) => (
                      <OPct key={s.code} d={d} v={tienDo(rows, s.code)} stage={s.code} />
                    ))}
                    <td className="r num">
                      {fmt(dot.synced)} / {fmt(dot.qty)}
                    </td>
                  </tr>
                )}
                {!gap &&
                  dot.lines.map((l) => <DongSp key={l.order_line_id} d={d} l={l} stages={stages} />)}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>
              {dots.length > 1 && `${dots.length} đợt · `}
              {lines.length} mã hàng
            </td>
            <td className="r num">{fmt(tongCan)}</td>
            <td colSpan={stages.length}></td>
            <td className="r num">
              {fmt(tongDongBo)} / {fmt(tongCan)} <span className="mut">{unit}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Ô % theo mảnh (dòng đợt / mã hàng / cụm tóm chi tiết) — "·" khi chưa làm. */
function OPct({
  d,
  v,
  stage,
}: {
  d: HoSoLenhCtx
  v: { done: number; need: number } | null
  stage: string
}) {
  const colsel = d.congDoanChon === stage && 'colsel'
  if (v == null)
    return (
      <td className={cx('out', colsel)} title="ngoài lộ trình">
        –
      </td>
    )
  if (v.done === 0)
    return (
      <td className={cx('r num empty', colsel)} title={`chưa làm · cần ${fmt(v.need)}`}>
        ·
      </td>
    )
  const full = v.done >= v.need
  return (
    <td
      className={cx('r num pb', full && 'ok', colsel)}
      title={`${fmt(v.done)} / ${fmt(v.need)}`}
    >
      {pctText(v.done, v.need)}
      <i>
        <s style={{ width: `${Math.min(100, Math.round((v.done / v.need) * 100))}%` }} />
      </i>
    </td>
  )
}

/** Dòng con hiển thị được: bỏ hàng mua (Q2) và dòng thành phẩm (Q5). */
const conBay = (r: Row) => r.tier !== 'finish' && !laHangMua(r)

function DongSp({ d, l, stages }: { d: HoSoLenhCtx; l: Line; stages: Stage[] }) {
  const open = d.spOpen(l.order_line_id)
  const top = l.rows.filter((r) => r.parent_id == null && conBay(r))
  return (
    <>
      <tr className={cx('spr', open && 'mo')}>
        <td title={`${l.product_code} · ${l.product_name}`}>
          {l.has_components ? (
            <button
              type="button"
              className="tg"
              onClick={() => d.toggleSp(l.order_line_id)}
              aria-label={open ? 'Gập mã hàng' : 'Mở mã hàng'}
              aria-expanded={open}
            >
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className="tg" aria-hidden="true" />
          )}
          <span className="ma">{l.product_code}</span>{' '}
          <span className="mut">{l.product_name}</span>
        </td>
        <td className="r num">{fmt(l.qty)}</td>
        {stages.map((s) =>
          l.has_components ? (
            <OPct key={s.code} d={d} v={tienDo(l.rows, s.code)} stage={s.code} />
          ) : (
            <td key={s.code} className="out" />
          ),
        )}
        <td className="r num">
          {l.has_components ? (
            `${fmt(l.synced_sets)} / ${fmt(l.qty)}`
          ) : (
            <span className="warn">chưa định hình</span>
          )}
        </td>
      </tr>
      {open &&
        top.map((r) => (
          <Fragment key={r.id}>
            <DongCum d={d} l={l} r={r} stages={stages} />
            {r.tier === 'cluster' &&
              d.bung.has(r.id) &&
              l.rows
                .filter((k) => k.parent_id === r.id && conBay(k))
                .map((k) => <DongCum key={k.id} d={d} l={l} r={k} stages={stages} />)}
          </Fragment>
        ))}
    </>
  )
}

function DongCum({
  d,
  l,
  r,
  stages,
}: {
  d: HoSoLenhCtx
  l: Line
  r: Row
  stages: Stage[]
}) {
  const kids =
    r.tier === 'cluster' ? l.rows.filter((x) => x.parent_id === r.id && conBay(x)) : []
  const open = d.bung.has(r.id)
  const isKid = r.parent_id != null
  return (
    <tr className={isKid ? 'l3' : 'l2'}>
      <td
        title={`${r.name}${r.is_virtual ? ' — cụm mặc nhiên: cả khung ghép một lần' : ''}`}
      >
        {kids.length > 0 ? (
          <button
            type="button"
            className="tg"
            onClick={() => d.toggleBung(r.id)}
            aria-label={open ? 'Gập chi tiết' : 'Bung chi tiết'}
            aria-expanded={open}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tg" aria-hidden="true" />
        )}
        {r.tier === 'cluster' ? tenCum(r.name) : r.name}
        <span className="mut">
          {' '}
          · {fmt(r.qty_per_unit)}/SP
          {kids.length > 0 && ` · ${kids.length} chi tiết`}
        </span>
      </td>
      <td className="r num">{fmt(r.total_needed)}</td>
      {stages.map((s) =>
        r.cells[s.code] ? (
          <O key={s.code} d={d} l={l} r={r} stage={s.code} />
        ) : (
          // Cụm không đếm ở công đoạn này (vd phôi) → % của các chi tiết của nó.
          <OPct key={s.code} d={d} v={kids.length ? tienDo(kids, s.code) : null} stage={s.code} />
        ),
      )}
      <td className="r num">
        {r.tier === 'part' ? (
          <span className="mut">
            {r.qty_per_unit > 0 ? fmt(Math.floor(r.done_final / r.qty_per_unit)) : '—'}
          </span>
        ) : (
          fmt(r.done_final)
        )}
      </td>
    </tr>
  )
}

/** Ô SỐ (cụm / chi tiết) — bấm ra năm con số; "·" khi chưa làm. */
function O({ d, l, r, stage }: { d: HoSoLenhCtx; l: Line; r: Row; stage: string }) {
  const c = r.cells[stage]
  const colsel = d.congDoanChon === stage
  const sel = d.pick?.row_id === r.id && d.pick.stage === stage
  const du = r.total_needed > 0 && c.done >= r.total_needed
  return (
    <td
      className={cx('r num cell', sel && 'sel', colsel && 'colsel', du && 'ok', c.done === 0 && !du && 'empty')}
      onClick={() => d.setPick({ line_id: l.order_line_id, row_id: r.id, stage })}
      title={`${r.name} · ${d.stageLabel(stage)}: xong ${fmt(c.done)} / ${fmt(r.total_needed)} · đã giao ${fmt(c.shipped)} · tồn ${fmt(c.on_hand)} — bấm xem năm con số`}
    >
      {c.done === 0 ? '·' : fmt(c.done)}
      {c.on_hand > 0 && r.tier !== 'part' && (
        <span className={cx('pill', c.shipped > 0 ? 'w' : 'm')}>tồn {fmt(c.on_hand)}</span>
      )}
    </td>
  )
}

/** Dải NĂM CON SỐ của ô đang chọn — không nhét 5 số vào từng ô. */
export function DaiNamSo({ d }: { d: HoSoLenhCtx }) {
  const { pick, data } = d
  if (!pick) return null
  const l = data.lines.find((x) => x.order_line_id === pick.line_id)
  const r = l?.rows.find((x) => x.id === pick.row_id)
  const c = r?.cells[pick.stage]
  if (!l || !r || !c) return null
  const job = d.jobOf(l.order_line_id, pick.stage)
  const idx = r.route.indexOf(pick.stage)
  const next = r.route[idx + 1] ?? null
  const nextCell = next ? r.cells[next] : null
  const pbs = data.pbs.filter((x) => x.stage === pick.stage).length
  const pgtOut = data.pgt.filter(
    (x) =>
      x.from_stage === pick.stage &&
      !x.reverses_doc_id &&
      x.status !== 'da_huy' &&
      x.lines.some((ln) => ln.component_id === r.id),
  )
  return (
    <div className="sx-drill" role="status">
      <span className="k">Ô đang chọn</span>
      <span>
        <span className="ma">{l.product_code}</span> · {r.name} ·{' '}
        <b style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
          {d.stageLabel(pick.stage)}
        </b>
        {job?.team_name && <span className="mut"> · {job.team_name}</span>}
      </span>
      <span>
        <span className="k">Xong</span>
        <b>{fmt(c.done)}</b>
      </span>
      <span>
        <span className="k">Đã giao đi</span>
        <b>{fmt(c.shipped)}</b>
        {pgtOut.length > 0 && (
          <span className="mut">
            {' '}
            (
            {pgtOut
              .map(
                (x) =>
                  `${x.doc_no} ${fmt(x.lines.find((ln) => ln.component_id === r.id)?.qty ?? 0)}${x.status === 'da_giao' ? ' chờ nhận' : ''}`,
              )
              .join(' · ')}
            )
          </span>
        )}
      </span>
      <span>
        <span className="k">Tồn tại {d.stageLabel(pick.stage).toLowerCase()}</span>
        <b>{fmt(c.on_hand)}</b>
      </span>
      {next && nextCell && (
        <>
          <span>
            <span className="k">{d.stageLabel(next)} đã nhận</span>
            <b>{nextCell.received == null ? '—' : fmt(nextCell.received)}</b>
            {nextCell.received_estimated && (
              <span className="mut"> (≈ chưa có phiếu, lấy số xong ở đây)</span>
            )}
          </span>
          <span>
            <span className="k">Khả dụng ở {d.stageLabel(next).toLowerCase()}</span>
            <b>{nextCell.available == null ? '—' : fmt(nextCell.available)}</b>
          </span>
        </>
      )}
      <span className="mut">
        phế luỹ kế {fmt(c.defect)} · sửa lại {fmt(c.rework)} · {pbs} phiếu PBS ở công đoạn
        này
      </span>
      <button type="button" className="lnk mut x" onClick={() => d.setPick(null)}>
        Đóng
      </button>
    </div>
  )
}
