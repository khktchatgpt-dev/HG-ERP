'use client'

import { Fragment } from 'react'
import { componentRoute, isPurchasedGroup } from '@/lib/stage-route'
import { COUNT_LEVEL_SHORT, shortStageLabel } from '@/lib/stage-config'
import { cx, fmt, num, type Draft } from './dinh-hinh.shared'
import type { DinhHinhCtx } from './useDinhHinh'

/**
 * TAB LỘ TRÌNH THEO CỤM — kế hoạch sửa RIÊNG LỆNH (bản vẽ B, 03/11/2026).
 * Cùng ma trận x của tab Lộ trình hồ sơ SP, ghi `production_components.stages`
 * của lệnh này; hồ sơ SP và lệnh khác không đổi. Thứ tự ưu tiên khi đếm: kế
 * hoạch lệnh → bản chụp này → khai ở SP → nhóm vật tư. Dòng cụm chỉ mang nửa
 * "cụm"; chi tiết trong cụm đi theo nửa "chi tiết" (x mờ, không bấm). BOM phẳng
 * (không dòng cụm) thì không có gì để khai — cụm mặc nhiên lo.
 */
export function LoTrinhLenh({ d }: { d: DinhHinhCtx }) {
  const { p, lines, byLine, editable } = d
  const stageCfg = p.stageCfg
  const order = new Map(stageCfg.map((s, i) => [s.code, i]))
  const sortStages = (xs: string[]) =>
    [...new Set(xs)].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
  const routeOf = (r: Draft) =>
    componentRoute(undefined, {
      group_code: r.group_code || null,
      stages: r.stages,
      first_stage: r.first_stage,
      final_stage: r.final_stage,
    })
  const nCols = 3 + stageCfg.length
  const finish = stageCfg.filter((s) => s.meta.count_level === 'unit').map((s) => s.code)

  return (
    <div className="sx-grid">
      <table className="sx-tb" style={{ minWidth: 250 + 52 + 44 + stageCfg.length * 56 }}>
        <colgroup>
          <col style={{ width: 250 }} />
          <col style={{ width: 52 }} />
          <col style={{ width: 44 }} />
          {stageCfg.map((s) => (
            <col key={s.code} style={{ width: 56 }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Cụm / chi tiết rời</th>
            <th className="r">SL/SP</th>
            <th className="r">CT</th>
            {stageCfg.map((s) => (
              <th
                key={s.code}
                style={{ textAlign: 'center' }}
                title={`${s.label} — đếm bằng ${COUNT_LEVEL_SHORT[s.meta.count_level]}`}
              >
                {shortStageLabel(s.label)}
                <span className="u">{COUNT_LEVEL_SHORT[s.meta.count_level]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const rs = byLine.get(l.id) ?? []
            const cum = rs.filter((r) => r.kind === 'assembly')
            const roi = rs.filter(
              (r) =>
                r.kind !== 'assembly' &&
                !r.cluster.trim() &&
                !isPurchasedGroup(r.group_code || null),
            )
            const mua = rs.filter((r) => isPurchasedGroup(r.group_code || null))
            return (
              <Fragment key={l.id}>
                <tr className="grp">
                  <td colSpan={nCols} title={l.product_name}>
                    <span className="ma">{l.product_code}</span>
                    <span className="mut" style={{ fontWeight: 400 }}>
                      {' '}
                      · {l.product_name} · × {fmt(l.qty)} {l.unit}
                    </span>
                    {rs.length > 0 && cum.length === 0 && (
                      <span className="mut" style={{ fontWeight: 400 }}>
                        {' '}
                        — BOM phẳng: từ hàn trở đi đếm bằng cụm mặc nhiên, không có gì để
                        khai; muốn khai riêng thì thêm dòng CỤM ở tab Chi tiết
                      </span>
                    )}
                    {rs.length === 0 && (
                      <span className="warn" style={{ fontWeight: 400 }}>
                        {' '}
                        — chưa định hình
                      </span>
                    )}
                  </td>
                </tr>
                {cum.map((r) => {
                  const members = rs.filter(
                    (x) =>
                      x.kind === 'part' &&
                      x.cluster.trim() &&
                      x.cluster.trim() === r.cluster.trim(),
                  )
                  const st = routeOf(r)
                  const khai = r.stages != null
                  return (
                    <Fragment key={r.key}>
                      <tr className="t2">
                        <td title={r.name}>
                          <b>{r.cluster || r.name}</b>
                          {khai && (
                            <>
                              <span className="mut"> · đã khai riêng</span>
                              {editable && (
                                <button
                                  type="button"
                                  className="lnk"
                                  style={{ marginLeft: 8 }}
                                  onClick={() => d.setStages(r.key, null)}
                                >
                                  về mặc định
                                </button>
                              )}
                            </>
                          )}
                        </td>
                        <td className="r num">{num(r.qty_per_unit) ?? '—'}</td>
                        <td className="r num">{members.length}</td>
                        {stageCfg.map((s) => {
                          const on = st.includes(s.code)
                          if (s.meta.count_level === 'part' && !on)
                            return (
                              <td
                                key={s.code}
                                className="empty"
                                style={{ textAlign: 'center' }}
                                title="Bậc chi tiết — chi tiết trong cụm tự đi"
                              >
                                ·
                              </td>
                            )
                          return (
                            <O
                              key={s.code}
                              on={on}
                              khai={khai}
                              editable={editable}
                              label={`${r.cluster || r.name} · ${s.label}`}
                              onToggle={() =>
                                d.setStages(
                                  r.key,
                                  sortStages(
                                    on ? st.filter((x) => x !== s.code) : [...st, s.code],
                                  ),
                                )
                              }
                            />
                          )
                        })}
                      </tr>
                      {members.length > 0 && (
                        <tr className="t3">
                          <td
                            colSpan={3}
                            title={members
                              .map((m) => `${m.name} ×${m.qty_per_unit}`)
                              .join(' · ')}
                          >
                            {members
                              .map((m) => `${m.name} ×${m.qty_per_unit}`)
                              .join(' · ')}
                          </td>
                          {stageCfg.map((s) => {
                            const on = members.some((m) => routeOf(m).includes(s.code))
                            return on ? (
                              <td
                                key={s.code}
                                className="x"
                                style={{ textAlign: 'center' }}
                              >
                                <span className="mut">x</span>
                              </td>
                            ) : (
                              <td key={s.code} className="out">
                                –
                              </td>
                            )
                          })}
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {roi.map((r) => {
                  const st = routeOf(r)
                  const khai = r.stages != null
                  return (
                    <tr key={r.key} className="t2">
                      <td title={r.name}>
                        {r.name}
                        <span className="mut">
                          {' '}
                          · rời{khai ? ' · đã khai riêng' : ''}
                        </span>
                        {khai && editable && (
                          <button
                            type="button"
                            className="lnk"
                            style={{ marginLeft: 8 }}
                            onClick={() => d.setStages(r.key, null)}
                          >
                            về mặc định
                          </button>
                        )}
                      </td>
                      <td className="r num">{num(r.qty_per_unit) ?? '—'}</td>
                      <td className="r num"></td>
                      {stageCfg.map((s) => (
                        <O
                          key={s.code}
                          on={st.includes(s.code)}
                          khai={khai}
                          editable={editable}
                          label={`${r.name} · ${s.label}`}
                          onToggle={() =>
                            d.setStages(
                              r.key,
                              sortStages(
                                st.includes(s.code)
                                  ? st.filter((x) => x !== s.code)
                                  : [...st, s.code],
                              ),
                            )
                          }
                        />
                      ))}
                    </tr>
                  )
                })}
                {mua.length > 0 && (
                  <tr className="t2">
                    <td className="mut" title={mua.map((m) => m.name).join(' · ')}>
                      Ngũ kim ({mua.length}) · hàng mua, không qua công đoạn
                    </td>
                    <td></td>
                    <td className="r num">{mua.length}</td>
                    {stageCfg.map((s) => (
                      <td key={s.code} className="out">
                        –
                      </td>
                    ))}
                  </tr>
                )}
                {rs.length > 0 && (
                  <tr className="t2">
                    <td>Thành phẩm (bộ)</td>
                    <td className="r num">1</td>
                    <td className="r num">—</td>
                    {stageCfg.map((s) =>
                      finish.includes(s.code) ? (
                        <td
                          key={s.code}
                          className="x"
                          style={{ textAlign: 'center', fontWeight: 700 }}
                        >
                          x
                        </td>
                      ) : (
                        <td key={s.code} className="out">
                          –
                        </td>
                      ),
                    )}
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              {d.nCum} cụm · {d.rows.filter((r) => r.stages != null).length} dòng khai
              riêng lệnh
            </td>
            <td colSpan={stageCfg.length} className="mut" style={{ fontWeight: 400 }}>
              x đậm = khai riêng lệnh · x mờ = theo hồ sơ SP / nhóm vật tư · ô gạch chéo
              bấm để thêm · · = bậc chi tiết · hồ sơ SP không đổi, lệnh khác không đổi
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function O({
  on,
  khai,
  editable,
  label,
  onToggle,
}: {
  on: boolean
  khai: boolean
  editable: boolean
  label: string
  onToggle: () => void
}) {
  if (!editable) {
    return on ? (
      <td className="x" style={{ textAlign: 'center', fontWeight: khai ? 700 : 400 }}>
        <span className={cx(!khai && 'mut')}>x</span>
      </td>
    ) : (
      <td className="out">–</td>
    )
  }
  return (
    <td className={cx('cell', !on && 'out')} style={{ padding: 0, textAlign: 'center' }}>
      <button
        type="button"
        className="tg"
        style={{
          width: '100%',
          height: 26,
          padding: 0,
          fontWeight: on && khai ? 700 : 500,
          color: on ? (khai ? 'var(--sx-ink)' : 'var(--sx-ink3)') : 'var(--sx-empty)',
        }}
        aria-pressed={on}
        aria-label={`${label}: ${on ? (khai ? 'đi qua' : 'đi qua (mặc định)') : 'ngoài lộ trình — bấm để thêm'}`}
        title={
          on && !khai
            ? 'mặc định từ hồ sơ SP / nhóm — bấm để ghi đè cho lệnh này'
            : undefined
        }
        onClick={onToggle}
      >
        {on ? 'x' : '–'}
      </button>
    </td>
  )
}
