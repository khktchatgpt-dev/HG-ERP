'use client'

import { Fragment } from 'react'
import { cx, fmt, pct, type Line, type Row, type Stage } from './ho-so-lenh.shared'
import type { HoSoLenhCtx } from './useHoSoLenh'

/**
 * BẢNG ĐỒNG BỘ BA TẦNG × CÔNG ĐOẠN (S3). Dòng SP (bộ) → cụm / thành phẩm →
 * chi tiết; cột = công đoạn có mặt trong lệnh, đầu cột ghi bậc đếm (chi tiết ·
 * cụm · bộ). Ô ngoài lộ trình gạch chéo. Ô = đạt luỹ kế, kèm "tồn N" khi còn
 * hàng chưa giao đi. Bấm ô → dải NĂM CON SỐ dưới bảng. Chi tiết trong cụm gấp
 * mặc định: một dòng tóm tắt "N chi tiết — phôi x%".
 */
export function BangDongBo({ d }: { d: HoSoLenhCtx }) {
  const { data, lines } = d
  const stages = data.stages
  const nCols = 3 + stages.length + 1
  const minW = 250 + 40 + 66 + stages.length * 72 + 104
  const levelLabel: Record<Stage['count_level'], string> = {
    part: 'chi tiết',
    cluster: 'cụm',
    unit: 'bộ',
  }
  const tongDongBo = lines.reduce((a, l) => a + l.synced_sets, 0)
  const tongDat = lines.reduce((a, l) => a + l.qty, 0)

  return (
    <div className="sx-grid">
      <table className="sx-tb" style={{ minWidth: minW }}>
        <colgroup>
          <col style={{ width: 250 }} />
          <col style={{ width: 40 }} />
          <col style={{ width: 66 }} />
          {stages.map((s) => (
            <col key={s.code} style={{ width: 72 }} />
          ))}
          <col style={{ width: 104 }} />
        </colgroup>
        <thead>
          <tr>
            <th>SP / cụm / chi tiết</th>
            <th className="r">ĐM</th>
            <th className="r">Cần</th>
            {stages.map((s) => (
              <th
                key={s.code}
                className="r"
                title={`${s.label} — đếm bằng ${levelLabel[s.count_level]}`}
              >
                {s.label}
                <span className="u">{levelLabel[s.count_level]}</span>
              </th>
            ))}
            <th className="r" title="MIN qua các bộ phận đầu ra cuối, theo BỘ">
              Đồng bộ
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td
                colSpan={nCols}
                className="mut"
                style={{ height: 60, textAlign: 'center' }}
              >
                {d.chiDinhHinh
                  ? 'Chưa dòng nào được định hình — tắt "Chỉ dòng đã định hình" để thấy mọi dòng, hoặc Định hình từ BOM'
                  : 'Lệnh không có dòng SP nào'}
              </td>
            </tr>
          )}
          {lines.map((l) => (
            <DongSp key={l.order_line_id} d={d} l={l} stages={stages} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>
              {d.soDinhHinh} / {data.lines.length} dòng đã định hình
            </td>
            <td></td>
            <td className="r num">{fmt(tongDat)}</td>
            <td colSpan={stages.length} className="mut" style={{ fontWeight: 400 }}>
              % theo SP = đạt ÷ cần (theo mảnh) · Đồng bộ = MIN qua các công đoạn (theo
              bộ) · ô = đạt luỹ kế · (tồn chưa giao)
            </td>
            <td className="r num">
              {fmt(tongDongBo)} / {fmt(tongDat)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DongSp({ d, l, stages }: { d: HoSoLenhCtx; l: Line; stages: Stage[] }) {
  // % theo MẢNH per công đoạn: Σ đạt ÷ Σ cần qua mọi dòng của SP có công đoạn đó.
  const pctStage = (code: string) => {
    let need = 0
    let done = 0
    for (const r of l.rows) {
      const c = r.cells[code]
      if (!c) continue
      need += r.total_needed
      done += Math.min(c.done, r.total_needed)
    }
    return need > 0 ? pct(done, need) : null
  }
  const top = l.rows.filter((r) => r.parent_id == null)
  return (
    <>
      <tr className="grp">
        <td title={l.product_name}>
          <span className="ma">{l.product_code}</span>
          <span className="mut" style={{ fontWeight: 400 }}>
            {' '}
            · {l.product_name}
          </span>
        </td>
        <td></td>
        <td className="r num">
          {fmt(l.qty)} {l.unit}
        </td>
        {stages.map((s) => {
          const v = pctStage(s.code)
          return (
            <td
              key={s.code}
              className={cx('r num', v == null && 'out', v === '0%' && 'empty')}
            >
              {v == null ? '–' : v}
            </td>
          )
        })}
        <td className={cx('r num', !l.has_components && 'warn')}>
          {l.has_components ? `${fmt(l.synced_sets)} / ${fmt(l.qty)}` : 'chưa định hình'}
        </td>
      </tr>
      {top.map((r) => (
        <Fragment key={r.id}>
          <DongCum d={d} l={l} r={r} stages={stages} />
          {r.tier === 'cluster' && (
            <ChiTietTrongCum d={d} l={l} parent={r} stages={stages} />
          )}
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
  const kids = l.rows.filter((x) => x.parent_id === r.id)
  const open = d.bung.has(r.id)
  return (
    <tr className={r.tier === 'part' ? 't3' : 't2'}>
      <td title={r.name}>
        {r.tier === 'cluster' && kids.length > 0 && (
          <button
            type="button"
            className="tg"
            onClick={() => d.toggleBung(r.id)}
            aria-label={open ? 'Gấp chi tiết' : 'Bung chi tiết'}
          >
            {open ? '▾' : '▸'}
          </button>
        )}
        {r.name}
        {r.tier === 'finish' && <span className="mut"> (bộ)</span>}
        {r.is_virtual && r.tier === 'cluster' && (
          <span className="pill m">mặc nhiên</span>
        )}
        {r.tier === 'cluster' && <span className="mut"> · {fmt(r.qty_per_unit)}/SP</span>}
      </td>
      <td className="r num">{fmt(r.qty_per_unit)}</td>
      <td className="r num">{fmt(r.total_needed)}</td>
      {stages.map((s) => (
        <O key={s.code} d={d} l={l} r={r} stage={s.code} />
      ))}
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

function ChiTietTrongCum({
  d,
  l,
  parent,
  stages,
}: {
  d: HoSoLenhCtx
  l: Line
  parent: Row
  stages: Stage[]
}) {
  const kids = l.rows.filter((x) => x.parent_id === parent.id)
  if (kids.length === 0) return null
  if (d.bung.has(parent.id)) {
    return (
      <>
        {kids.map((k) => (
          <DongCum key={k.id} d={d} l={l} r={k} stages={stages} />
        ))}
      </>
    )
  }
  // Gấp: một dòng tóm tắt — % theo mảnh của các chi tiết, ô cụm là "–".
  const sum = (code: string) => {
    let need = 0
    let done = 0
    let has = false
    for (const k of kids) {
      const c = k.cells[code]
      if (!c) continue
      has = true
      need += k.total_needed
      done += Math.min(c.done, k.total_needed)
    }
    return has ? pct(done, need) : null
  }
  const names = kids
    .slice(0, 3)
    .map((k) => k.name)
    .join(' · ')
  return (
    <tr className="t3">
      <td colSpan={3} title={kids.map((k) => k.name).join(', ')}>
        <button
          type="button"
          className="tg"
          onClick={() => d.toggleBung(parent.id)}
          aria-label="Bung chi tiết"
        >
          ▸
        </button>
        {kids.length} chi tiết — {names}
        {kids.length > 3 && ` (+${kids.length - 3})`}
      </td>
      {stages.map((s) => {
        const v = sum(s.code)
        return (
          <td
            key={s.code}
            className={cx(
              'r num',
              v == null ? 'out' : v === '100%' ? 'ok' : v === '0%' && 'empty',
            )}
          >
            {v ?? '–'}
          </td>
        )
      })}
      <td className="r num mut">
        {fmt(
          Math.min(
            ...kids.map((k) =>
              k.qty_per_unit > 0 ? Math.floor(k.done_final / k.qty_per_unit) : 0,
            ),
          ),
        )}
      </td>
    </tr>
  )
}

function O({ d, l, r, stage }: { d: HoSoLenhCtx; l: Line; r: Row; stage: string }) {
  const c = r.cells[stage]
  if (!c) return <td className="out">–</td>
  const sel = d.pick?.row_id === r.id && d.pick.stage === stage
  const du = r.total_needed > 0 && c.done >= r.total_needed
  return (
    <td
      className={cx(
        'r num cell',
        sel && 'sel',
        du && 'ok',
        c.done === 0 && !du && 'empty',
      )}
      onClick={() => d.setPick({ line_id: l.order_line_id, row_id: r.id, stage })}
      title={`${r.name} · ${d.stageLabel(stage)}: xong ${fmt(c.done)} · đã giao ${fmt(c.shipped)} · tồn ${fmt(c.on_hand)}`}
    >
      {fmt(c.done)}
      {c.on_hand > 0 && r.tier !== 'part' && (
        <span className={cx('pill', c.shipped > 0 ? 'w' : 'm')}>
          tồn {fmt(c.on_hand)}
        </span>
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
