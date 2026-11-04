'use client'

import { Fragment } from 'react'
import { componentRoute, isPurchasedGroup } from '@/lib/stage-route'
import { COUNT_LEVEL_SHORT, shortStageLabel } from '@/lib/stage-config'
import { cx, fmt, num, type Draft } from './dinh-hinh.shared'
import type { DinhHinhCtx } from './useDinhHinh'

/**
 * MA TRẬN LỘ TRÌNH THEO CỤM — kế hoạch sửa RIÊNG LỆNH (bản vẽ 3, 04/11/2026).
 * Trọn chiều ngang: 260 + 50 + 40 + 12×56 = 1.022px vừa 1280 với sidebar 240,
 * tiêu đề cột xuống dòng thay vì cắt. Ba ký hiệu: ✓ đậm = khai riêng lệnh, ✓ mờ
 * = theo hồ sơ SP / nhóm vật tư, ô trống = ngoài lộ trình (rê chuột hiện +, bấm
 * để thêm); · = bậc chi tiết, cụm không đi qua. Ghi `production_components.
 * stages`; hồ sơ SP nhận theo khi Lưu. Dòng cụm chỉ mang nửa "cụm"; chi tiết
 * trong cụm đi theo nửa "chi tiết" (✓ mờ, không bấm). BOM phẳng (không dòng
 * cụm) thì không có gì để khai — cụm mặc nhiên lo.
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
  // Bản chụp lúc mở: Ô nào đổi so với lộ trình hiệu lực lúc mở thì viền xanh cho
  // tới khi Lưu — từng ô, không phải cả hàng (dòng mới thêm chưa có bản chụp thì
  // so với lộ trình suy theo nhóm).
  const goc = new Map(p.initialRows.map((r, i) => [i, r.stages ?? null]))
  const gocRoute = (r: Draft) =>
    componentRoute(undefined, {
      group_code: r.group_code || null,
      stages: goc.get(Number(r.key.replace(/^r/, '')) - 1) ?? null,
      first_stage: r.first_stage,
      final_stage: r.final_stage,
    })

  return (
    <div className="sx-grid">
      <table className="sx-tb" style={{ minWidth: 260 + 50 + 40 + stageCfg.length * 56 }}>
        <colgroup>
          <col style={{ width: 260 }} />
          <col style={{ width: 50 }} />
          <col style={{ width: 40 }} />
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
                className="wrap"
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
                        khai
                      </span>
                    )}
                    {rs.length === 0 && (
                      <span className="warn" style={{ fontWeight: 400 }}>
                        {' '}
                        — chờ Kỹ thuật nạp định mức, chưa có cụm
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
                  const gocSt = gocRoute(r)
                  return (
                    <Fragment key={r.key}>
                      <tr className="t2">
                        <td title={r.name}>
                          <b>{r.cluster || r.name}</b>
                          {khai ? (
                            <>
                              <i className="sx-dot b" style={{ marginLeft: 8 }} />
                              <span className="mut">khai riêng</span>
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
                          ) : (
                            <>
                              <i className="sx-dot w" style={{ marginLeft: 8 }} />
                              <span className="mut">chưa khai — theo nhóm</span>
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
                                className="c lk"
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
                              doi={on !== gocSt.includes(s.code)}
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
                            return (
                              <td key={s.code} className="c">
                                {on && <span className="sym-ro xs">✓</span>}
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
                  const gocSt = gocRoute(r)
                  return (
                    <tr key={r.key} className="t2">
                      <td title={r.name}>
                        {r.name}
                        <span className="mut"> · rời{khai ? ' · khai riêng' : ''}</span>
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
                          doi={st.includes(s.code) !== gocSt.includes(s.code)}
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
                      <td key={s.code} className="c"></td>
                    ))}
                  </tr>
                )}
                {rs.length > 0 && (
                  <tr className="t2">
                    <td>Thành phẩm (bộ)</td>
                    <td className="r num">1</td>
                    <td className="r num">—</td>
                    {stageCfg.map((s) => (
                      <td key={s.code} className="c">
                        {finish.includes(s.code) && <span className="sym-ro">✓</span>}
                      </td>
                    ))}
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              {d.nCum} cụm ·{' '}
              {d.rows.filter((r) => r.kind === 'assembly' && r.stages != null).length}{' '}
              khai riêng ·{' '}
              {d.rows.filter((r) => r.kind === 'assembly' && r.stages == null).length}{' '}
              theo nhóm
            </td>
            <td colSpan={stageCfg.length} className="mut" style={{ fontWeight: 400 }}>
              thứ tự chạy = thứ tự danh mục · hồ sơ SP cập nhật theo khi Lưu · lệnh khác
              không đổi
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
  doi,
  editable,
  label,
  onToggle,
}: {
  on: boolean
  khai: boolean
  doi: boolean
  editable: boolean
  label: string
  onToggle: () => void
}) {
  if (!editable) {
    return (
      <td className="c">
        {on && <span className={cx('sym-ro', !khai && 'xs')}>✓</span>}
      </td>
    )
  }
  return (
    <td className="c">
      <button
        type="button"
        className={cx('tg', 'sym', !on && 'o', on && !khai && 'xs', doi && 'n')}
        aria-pressed={on}
        aria-label={`${label}: ${on ? (khai ? 'đi qua — khai riêng lệnh' : 'đi qua theo mặc định') : 'ngoài lộ trình — bấm để thêm'}`}
        title={
          on && !khai
            ? 'mặc định từ hồ sơ SP / nhóm — bấm để ghi đè cho lệnh này'
            : on
              ? 'khai riêng lệnh — bấm để bỏ'
              : 'ngoài lộ trình — bấm để thêm'
        }
        onClick={onToggle}
      >
        {on ? '✓' : ''}
      </button>
    </td>
  )
}
