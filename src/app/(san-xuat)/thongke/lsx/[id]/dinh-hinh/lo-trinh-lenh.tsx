'use client'

import { Fragment, useState } from 'react'
import { componentRoute, isPurchasedGroup } from '@/lib/stage-route'
import { COUNT_LEVEL_SHORT, shortStageLabel } from '@/lib/stage-config'
import { cx, fmt, num, type Draft } from './dinh-hinh.shared'
import type { DinhHinhCtx } from './useDinhHinh'

/**
 * MA TRẬN LỘ TRÌNH THEO CỤM của SP đang chọn (bản vẽ 4, 04/11/2026). Trọn chiều
 * ngang 260 + 50 + 40 + 12×56 = 1.022px; tiêu đề cột xuống dòng. Ba ký hiệu:
 * ✓ đậm = khai riêng lệnh, ✓ mờ = theo hồ sơ SP / nhóm vật tư, ô trống = ngoài
 * lộ trình (rê chuột hiện +); · = bậc chi tiết, cụm không đi qua.
 *
 * Chỉ bày thứ cần quyết: dòng cụm luôn mở; chi tiết RỜI theo nhóm gập thành MỘT
 * dòng tóm tắt (✓ mờ = hợp lộ trình của chúng), "mở từng dòng" khi cần ghi đè;
 * chi tiết rời đã khai riêng luôn hiện. Dòng "Thành phẩm" bỏ — chặng thành phẩm
 * là của cấu hình, nói ở chân bảng. Nút "Áp cho cụm cùng tên ở n SP khác" chép
 * lộ trình cụm sang các SP khác của lệnh.
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
  const finish = stageCfg.filter((s) => s.meta.count_level === 'unit')
  // Bản chụp lúc mở: ô nào đổi so với lộ trình hiệu lực lúc mở thì viền xanh.
  const goc = new Map(p.initialRows.map((r, i) => [i, r.stages ?? null]))
  const gocRoute = (r: Draft) =>
    componentRoute(undefined, {
      group_code: r.group_code || null,
      stages: goc.get(Number(r.key.replace(/^r/, '')) - 1) ?? null,
      first_stage: r.first_stage,
      final_stage: r.final_stage,
    })
  // Dòng SP nào đang mở từng chi tiết rời (mặc định gập).
  const [moRoi, setMoRoi] = useState<Set<string>>(() => new Set())
  const toggleRoi = (lineId: string) =>
    setMoRoi((s) => {
      const n = new Set(s)
      if (n.has(lineId)) n.delete(lineId)
      else n.add(lineId)
      return n
    })

  const toggle = (r: Draft, code: string) => {
    const st = routeOf(r)
    d.setStages(
      r.key,
      sortStages(st.includes(code) ? st.filter((x) => x !== code) : [...st, code]),
    )
  }

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
            const roiKhai = roi.filter((r) => r.stages != null)
            const roiNhom = roi.filter((r) => r.stages == null)
            const mua = rs.filter((r) => isPurchasedGroup(r.group_code || null))
            const mo = moRoi.has(l.id)
            const hopRoi = new Set(roiNhom.flatMap((r) => routeOf(r)))
            return (
              <Fragment key={l.id}>
                {lines.length > 1 && (
                  <tr className="grp">
                    <td colSpan={nCols} title={l.product_name}>
                      <span className="ma">{l.product_code}</span>
                      <span className="mut" style={{ fontWeight: 400 }}>
                        {' '}
                        · {l.product_name} · × {fmt(l.qty)} {l.unit}
                      </span>
                    </td>
                  </tr>
                )}
                {rs.length === 0 && (
                  <tr>
                    <td
                      colSpan={nCols}
                      className="mut"
                      style={{ height: 48, textAlign: 'center' }}
                    >
                      {l.has_profile
                        ? 'Hồ sơ có định mức nhưng bảng chưa nạp vào lệnh — mở “Bảng chi tiết ↗” bấm Nạp từ BOM.'
                        : 'Chờ Kỹ thuật nạp định mức — chưa có cụm để khai. Không gõ tay ở đây: bảng chi tiết là của Kỹ thuật.'}
                    </td>
                  </tr>
                )}
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
                  const anhEm = d.anhEmCum(r.key).length
                  return (
                    <Fragment key={r.key}>
                      <tr className="t2">
                        <td title={r.name}>
                          <b>{r.cluster || r.name}</b>
                          <i
                            className={cx('sx-dot', khai ? 'b' : 'w')}
                            style={{ marginLeft: 8 }}
                          />
                          <span className="mut">
                            {khai ? 'khai riêng' : 'chưa khai — theo nhóm'}
                          </span>
                          {editable && khai && (
                            <button
                              type="button"
                              className="lnk"
                              style={{ marginLeft: 8 }}
                              onClick={() => d.setStages(r.key, null)}
                            >
                              về mặc định
                            </button>
                          )}
                          {editable && khai && anhEm > 0 && (
                            <button
                              type="button"
                              className="lnk"
                              style={{ marginLeft: 8 }}
                              title="Chép lộ trình cụm này sang cụm cùng tên ở các SP khác của lệnh"
                              onClick={() => d.apChoCumCungTen(r.key)}
                            >
                              áp cho {anhEm} SP khác
                            </button>
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
                              onToggle={() => toggle(r, s.code)}
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
                {roiNhom.length > 0 && !mo && (
                  <tr className="sum">
                    <td
                      title={roiNhom
                        .map((r) => `${r.name} ×${r.qty_per_unit}`)
                        .join(' · ')}
                    >
                      <b>{roiNhom.length} chi tiết rời</b>
                      <span className="mut"> · theo nhóm vật tư</span>
                      {editable && (
                        <button
                          type="button"
                          className="lnk"
                          style={{ marginLeft: 8 }}
                          onClick={() => toggleRoi(l.id)}
                        >
                          mở từng dòng
                        </button>
                      )}
                    </td>
                    <td className="r num"></td>
                    <td className="r num">{roiNhom.length}</td>
                    {stageCfg.map((s) => (
                      <td key={s.code} className="c">
                        {hopRoi.has(s.code) && <span className="sym-ro xs">✓</span>}
                      </td>
                    ))}
                  </tr>
                )}
                {(mo ? roi : roiKhai).map((r) => {
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
                          onToggle={() => toggle(r, s.code)}
                        />
                      ))}
                    </tr>
                  )
                })}
                {mo && roiNhom.length > 0 && (
                  <tr className="sum">
                    <td colSpan={nCols}>
                      <button
                        type="button"
                        className="lnk"
                        onClick={() => toggleRoi(l.id)}
                      >
                        gập chi tiết rời theo nhóm
                      </button>
                    </td>
                  </tr>
                )}
                {mua.length > 0 && (
                  <tr className="sum">
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
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              {lines.reduce(
                (a, l) =>
                  a +
                  (byLine.get(l.id) ?? []).filter((r) => r.kind === 'assembly').length,
                0,
              )}{' '}
              cụm · chặng thành phẩm{' '}
              {finish.map((s) => shortStageLabel(s.label)).join(' → ')} theo cấu hình
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
