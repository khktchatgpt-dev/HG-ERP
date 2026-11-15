'use client'

import { Fragment, useState } from 'react'
import { bamCaNhom, demQua } from '@/lib/lo-trinh-nhom'
import {
  componentRoute,
  isNgoaiKhung,
  isPurchasedGroup,
  routeForGroup,
} from '@/lib/stage-route'
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
  // Nhóm chi tiết rời nào đang mở từng dòng (mặc định gập) — khoá `dòng SP|nhóm`.
  const [moRoi, setMoRoi] = useState<Set<string>>(() => new Set())
  const toggleRoi = (k: string) =>
    setMoRoi((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const nhomLabel = new Map(p.groups.map((g) => [g.code, g.label]))
  const macDinhOf = (r: Draft) => routeForGroup(r.group_code || null)
  const giongNhau = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((x) => b.includes(x))

  /**
   * MỘT NHÓM CHI TIẾT RỜI (bản vẽ 15/11/2026 QR43i6tr…): dòng tóm tắt bấm được —
   * ô công đoạn tick / bỏ cho cả nhóm (Q2), "mở từng dòng" để sửa riêng; nhóm có
   * dòng khai riêng thì có "áp cho n đợt khác cùng mã" (Q4). Dùng cho khung rời và
   * ngoài khung (gỗ, nệm, tấm… — trước đó bị gộp vào "Ngũ kim", không ô tick).
   */
  const nhomRoi = (lineId: string, loai: 'khung' | 'ngoai', ds: Draft[]) => {
    if (ds.length === 0) return null
    const k = `${lineId}|${loai}`
    const mo = moRoi.has(k)
    const dongs = ds.map((r) => ({
      key: r.key,
      route: routeOf(r),
      macDinh: macDinhOf(r),
    }))
    const nKhai = ds.filter((r) => r.stages != null).length
    const nhoms = [...new Set(ds.map((r) => r.group_code || ''))]
    const tenNhom = (c: string) => (nhomLabel.get(c) ?? c).toLocaleLowerCase('vi')
    const tieuDe =
      loai === 'khung'
        ? `${ds.length} chi tiết ${nhoms.length === 1 && nhoms[0] === 'FRAME' ? 'khung' : 'rời'}`
        : nhoms.length === 1
          ? `${ds.length} chi tiết ${tenNhom(nhoms[0])}`
          : `${ds.length} chi tiết ngoài khung`
    const phu =
      nKhai > 0
        ? `${nKhai}/${ds.length} khai riêng`
        : loai === 'khung'
          ? 'theo nhóm vật tư'
          : nhoms.length === 1
            ? 'ngoài khung · chưa qua công đoạn nào'
            : `${nhoms.map((c) => `${tenNhom(c)} ${ds.filter((r) => (r.group_code || '') === c).length}`).join(' · ')} · chưa qua công đoạn nào`
    const dot = editable && nKhai > 0 ? d.capDotKhac(ds.map((r) => r.key)) : null
    const dongBo =
      dot != null && dot.cap.every(([s, t]) => giongNhau(routeOf(s), routeOf(t)))
    return (
      <Fragment key={k}>
        <tr className="sum">
          <td title={ds.map((r) => `${r.name} ×${r.qty_per_unit}`).join(' · ')}>
            <b>{tieuDe}</b>
            {nKhai > 0 && <i className="sx-dot b" style={{ marginLeft: 8 }} />}
            <span className="mut"> · {phu}</span>
            <button
              type="button"
              className="lnk"
              style={{ marginLeft: 8 }}
              onClick={() => toggleRoi(k)}
              aria-expanded={mo}
            >
              {mo ? 'gập' : 'mở từng dòng'}
            </button>
          </td>
          <td className="r num"></td>
          <td className="r num">{ds.length}</td>
          {stageCfg.map((s) => {
            const qua = demQua(dongs, s.code)
            const doi = ds.some(
              (r) => routeOf(r).includes(s.code) !== gocRoute(r).includes(s.code),
            )
            const txt = qua === 0 ? '' : qua === ds.length ? '✓' : `${qua}/${ds.length}`
            const cls = cx(
              qua === 0 && 'o',
              qua === ds.length && nKhai === 0 && 'xs',
              qua > 0 && qua < ds.length && 'part',
              doi && 'n',
            )
            if (!editable)
              return (
                <td key={s.code} className="c">
                  {txt && (
                    <span className={cx('sym-ro', nKhai === 0 && 'xs')}>{txt}</span>
                  )}
                </td>
              )
            return (
              <td key={s.code} className="c">
                <button
                  type="button"
                  className={cx('tg', 'sym', cls)}
                  aria-label={`${tieuDe} · ${s.label}: ${qua}/${ds.length} chi tiết đi qua — bấm để ${qua === ds.length ? 'bỏ' : 'thêm'} cho cả nhóm`}
                  title={`Bấm để ${qua === ds.length ? 'bỏ' : 'thêm'} ${s.label} cho cả ${ds.length} chi tiết`}
                  onClick={() => d.setStagesMany(bamCaNhom(dongs, s.code, sortStages))}
                >
                  {txt}
                </button>
              </td>
            )
          })}
        </tr>
        {mo &&
          ds.map((r) => {
            const st = routeOf(r)
            const khai = r.stages != null
            const gocSt = gocRoute(r)
            return (
              <tr key={r.key} className="t2">
                <td title={r.name}>
                  {r.name}
                  <span className="mut">
                    {' '}
                    · {loai === 'khung' ? 'rời' : tenNhom(r.group_code || '')}
                    {khai ? ' · khai riêng' : ''}
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
                    doi={st.includes(s.code) !== gocSt.includes(s.code)}
                    editable={editable}
                    label={`${r.name} · ${s.label}`}
                    onToggle={() => toggle(r, s.code)}
                  />
                ))}
              </tr>
            )
          })}
        {dot && dot.dot > 0 && (
          <tr className="sum">
            <td colSpan={nCols} style={{ paddingLeft: 22 }}>
              {dongBo ? (
                <span className="mut">✓ {dot.dot} đợt khác cùng mã đã giống đợt này</span>
              ) : (
                <>
                  <button
                    type="button"
                    className="lnk"
                    onClick={() => d.apChoDotCungMa(ds.map((r) => r.key))}
                  >
                    áp cho {dot.dot} đợt khác cùng mã
                  </button>
                  <span className="mut">
                    {' '}
                    · chép lộ trình nhóm này sang các đợt còn lại
                  </span>
                </>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

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
            const roiTatCa = rs.filter((r) => r.kind !== 'assembly' && !r.cluster.trim())
            const roi = roiTatCa.filter((r) => !isPurchasedGroup(r.group_code || null))
            // Gỗ, nệm, tấm… rời: nhóm riêng có ô tick (Q1); chỉ ngũ kim / bao bì / tem là hàng mua.
            const ngoai = roiTatCa.filter((r) => isNgoaiKhung(r.group_code || null))
            const mua = rs.filter(
              (r) => isPurchasedGroup(r.group_code || null) && !ngoai.includes(r),
            )
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
                {nhomRoi(l.id, 'khung', roi)}
                {nhomRoi(l.id, 'ngoai', ngoai)}
                {mua.length > 0 && (
                  <tr className="sum">
                    <td className="mut" title={mua.map((m) => m.name).join(' · ')}>
                      Hàng mua ({mua.length}) · ngũ kim, bao bì, tem — không qua công đoạn
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
              thứ tự chạy = thứ tự danh mục · cụm ghi ngược hồ sơ SP khi Lưu · chi tiết
              rời chỉ áp cho lệnh này
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
