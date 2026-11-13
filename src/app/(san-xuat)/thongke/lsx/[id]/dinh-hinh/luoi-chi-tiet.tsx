'use client'

import { Fragment, useState } from 'react'
import { componentRoute, isPurchasedGroup } from '@/lib/stage-route'
import { shortStageLabel } from '@/lib/stage-config'
import { cellId, cx, fmt, num, type Draft, type EditCol } from './dinh-hinh.shared'
import type { DinhHinhCtx } from './useDinhHinh'

/**
 * TAB CHI TIẾT — lưới nhập liệu (khuôn F) như Ghi sản lượng: hàng 26px, đầu /
 * chân dính, ô nhập nằm trong ô lưới, chặn tại chỗ. Cột "Lộ trình" chỉ đọc —
 * kết quả của tab bên (chụp từ SP hoặc suy theo nhóm) để soát ngay trên lưới.
 */
export function LuoiChiTiet({ d }: { d: DinhHinhCtx }) {
  const { p, cols, lines, byLine, editable } = d
  // NGOÀI KHUNG gập sẵn theo từng SP (13/11/2026, "Chỉ khung vào sổ"): gỗ, tấm,
  // nệm, bao bì, ngũ kim là hàng mua — không qua công đoạn nào. Dòng KHAI lộ
  // trình riêng thì vẫn bày (nó vào sổ).
  const [moNgoai, setMoNgoai] = useState<ReadonlySet<string>>(new Set())
  const laNgoai = (r: Draft) =>
    r.kind === 'part' &&
    isPurchasedGroup(r.group_code || null) &&
    !(r.stages && r.stages.length > 0)
  const nhomLabel = new Map(p.groups.map((g) => [g.code, g.label]))
  const fixedTail = 196 // cột Lộ trình
  const xoaW = 52 // cột Xoá — "Xoá?" lúc hỏi lại; lưới chỉ có ~1.100px khi sidebar mở
  const minW =
    cols.reduce((a, c) => a + (c.width || 160), 0) + fixedTail + (editable ? xoaW : 0)
  const nCols = cols.length + 1 + (editable ? 1 : 0)
  const tongCt = d.rows.reduce((a, r) => a + (num(r.qty_per_unit) ?? 0), 0)
  const tongKg = d.rows.reduce(
    (a, r) => a + (num(r.dm_kg) ?? 0) * (num(r.qty_per_unit) ?? 0),
    0,
  )
  const labelOf = (c: string) =>
    shortStageLabel(p.stageCfg.find((s) => s.code === c)?.label ?? c)
  const routeText = (r: Draft) => {
    if (isPurchasedGroup(r.group_code || null)) return null
    const st = componentRoute(undefined, {
      group_code: r.group_code || null,
      stages: r.stages,
      first_stage: r.first_stage,
      final_stage: r.final_stage,
    })
    return st.length ? st.map(labelOf).join(' → ') : '—'
  }

  return (
    <div className="sx-grid">
      <table className={cx('sx-tb', editable && 'sx-dh')} style={{ minWidth: minW }}>
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
          <col style={{ width: fixedTail }} />
          {editable && <col style={{ width: xoaW }} />}
        </colgroup>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.kind === 'num' ? 'r' : undefined}>
                {c.label}
                {c.required ? ' *' : ''}
              </th>
            ))}
            <th>
              Lộ trình<span className="u">tab bên · chỉ đọc</span>
            </th>
            {editable && <th className="c">Xoá</th>}
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
                Lệnh chưa có dòng sản phẩm — soạn dòng lệnh trước rồi mới định hình.
              </td>
            </tr>
          )}
          {lines.map((l) => {
            const rs = byLine.get(l.id) ?? []
            const nCum = rs.filter((r) => r.kind === 'assembly').length
            const trongCum = rs.filter(
              (r) => r.kind === 'part' && r.cluster.trim(),
            ).length
            const ngoai = rs.filter(laNgoai)
            const mua = ngoai.length
            const roi =
              rs.length -
              nCum -
              rs.filter((r) => r.kind === 'part' && r.cluster.trim() && !laNgoai(r))
                .length -
              mua
            const mo = moNgoai.has(l.id)
            const tomTat = [
              ...ngoai
                .reduce((m, r) => {
                  const k = nhomLabel.get(r.group_code) ?? (r.group_code || 'khác')
                  return m.set(k, (m.get(k) ?? 0) + 1)
                }, new Map<string, number>())
                .entries(),
            ]
              .map(([k, n]) => `${k} ${n}`)
              .join(' · ')
            return (
              <Fragment key={l.id}>
                <tr className="grp">
                  <td colSpan={Math.min(5, cols.length)} title={l.product_name}>
                    <span className="ma">{l.product_code}</span>
                    <span className="mut" style={{ fontWeight: 400 }}>
                      {' '}
                      · {l.product_name}
                    </span>{' '}
                    · × {fmt(l.qty)} {l.unit}
                  </td>
                  <td
                    colSpan={nCols - Math.min(5, cols.length)}
                    className={cx(rs.length === 0 && 'warn')}
                  >
                    {rs.length === 0 ? (
                      <span>
                        chưa định hình
                        {!l.has_profile &&
                          ' · SP chưa có định mức — Nạp từ BOM không ra dòng nào'}
                      </span>
                    ) : (
                      <span className="mut" style={{ fontWeight: 400 }}>
                        {rs.length} dòng · {nCum} cụm ·{' '}
                        {trongCum - ngoai.filter((r) => r.cluster.trim()).length} trong
                        cụm · {roi} rời · {mua} ngoài khung
                      </span>
                    )}
                    {editable && (
                      <button
                        type="button"
                        className="sx-btn sm vien"
                        style={{ marginLeft: 10 }}
                        onClick={() => d.addRow(l.id)}
                        title={`Thêm một dòng chi tiết vào ${l.product_code}`}
                      >
                        + Thêm dòng
                      </button>
                    )}
                  </td>
                </tr>
                {rs
                  .filter((r) => !laNgoai(r))
                  .map((r) => (
                    <Dong key={r.key} d={d} r={r} route={routeText(r)} />
                  ))}
                {ngoai.length > 0 && (
                  <tr className="grp2">
                    <td colSpan={nCols}>
                      <button
                        type="button"
                        className="lnk"
                        aria-expanded={mo}
                        onClick={() =>
                          setMoNgoai((s) => {
                            const n = new Set(s)
                            if (n.has(l.id)) n.delete(l.id)
                            else n.add(l.id)
                            return n
                          })
                        }
                      >
                        {mo ? '▾' : '▸'} Ngoài khung · {ngoai.length} dòng
                      </button>
                      <span className="mut" style={{ fontWeight: 400 }}>
                        {' '}
                        ({tomTat}) — hàng mua, không ghi sổ
                      </span>
                    </td>
                  </tr>
                )}
                {mo &&
                  ngoai.map((r) => <Dong key={r.key} d={d} r={r} route={routeText(r)} />)}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={Math.min(4, cols.length)}>
              {d.rows.length} dòng · {p.orderLines.length} SP ·{' '}
              {p.orderLines.filter((l) => (byLine.get(l.id) ?? []).length === 0).length}{' '}
              SP chưa định hình
            </td>
            {cols.slice(4).map((c) => (
              <td
                key={c.key}
                className={c.kind === 'num' ? 'r num' : undefined}
                title={c.key === 'dm_kg' ? 'Σ kg trên một bộ' : undefined}
              >
                {c.key === 'qty_per_unit'
                  ? `Σ ${fmt(tongCt)}`
                  : c.key === 'dm_kg'
                    ? fmt(Math.round(tongKg * 100) / 100)
                    : ''}
              </td>
            ))}
            <td
              colSpan={editable ? 2 : 1}
              className="mut"
              style={{ fontWeight: 400, whiteSpace: 'normal' }}
            >
              Σ kg = ĐM kg × CT/SP, chỉ dòng có ĐM
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Dong({ d, r, route }: { d: DinhHinhCtx; r: Draft; route: string | null }) {
  const { cols, editable, p } = d
  const rIdx = d.rowIdx.get(r.key) ?? 0
  const frameNoKg = r.group_code === 'FRAME' && !r.dm_kg.trim()
  const hoi = d.xoaCho === r.key
  return (
    <tr className={cx('d', hoi && 'xoa')}>
      {cols.map((c, cIdx) => {
        const id = cellId(r.key, c.key)
        const err = d.errCells.has(id)
        const warn = c.key === 'dm_kg' && frameNoKg
        const value = String(r[c.key] ?? '')
        return (
          <td
            key={c.key}
            className={cx('ed', c.kind === 'num' && 'r', err ? 'err' : warn && 'warn')}
            title={
              err
                ? 'Ô bắt buộc'
                : warn
                  ? 'Nhóm khung sắt/nhôm thường có ĐM kg — trống thì sổ không tính được khối lượng'
                  : undefined
            }
          >
            {c.key === 'cluster' && r.kind === 'assembly' && !editable ? (
              <span className="sx-cell">
                <span className="pill b">CỤM</span> {r.cluster}
              </span>
            ) : (
              <O
                id={id}
                col={c}
                value={value}
                prefix={c.key === 'cluster' && r.kind === 'assembly' ? 'CỤM' : undefined}
                groups={p.groups}
                disabled={!editable}
                onCommit={(v) => d.patch(r.key, { [c.key]: v } as Partial<Draft>)}
                cell={`${rIdx}:${cIdx}`}
                onKeyDown={d.onCellKey(rIdx, cIdx)}
                onPaste={d.onCellPaste(rIdx, cIdx)}
                ariaLabel={`${c.label} dòng ${rIdx + 1}`}
                placeholder={
                  err
                    ? c.key === 'name'
                      ? 'tên?'
                      : '> 0'
                    : c.key === 'qty_per_unit' && r.cum_chua_khai
                      ? 'chưa có'
                      : undefined
                }
              />
            )}
          </td>
        )
      })}
      <td
        className={cx(route == null ? 'out' : 'mut')}
        style={{ whiteSpace: 'normal', lineHeight: 1.25 }}
        title={route ?? 'hàng mua, không qua công đoạn'}
      >
        {route ?? 'hàng mua'}
      </td>
      {editable && (
        <td className="xo">
          <button
            type="button"
            className={cx('sx-xo', hoi && 'hoi')}
            onClick={() => d.xinXoa(r.key)}
            aria-label={
              hoi
                ? `Bấm lần nữa để xoá hẳn dòng ${r.name || rIdx + 1}`
                : `Xoá dòng ${r.name || rIdx + 1}`
            }
            title={
              hoi
                ? 'Bấm lần nữa để bỏ dòng khỏi bản nháp (vẫn Hoàn tác được tới khi Lưu)'
                : 'Xoá dòng — sẽ hỏi lại'
            }
          >
            {hoi ? 'Xoá?' : 'Xoá'}
          </button>
        </td>
      )}
    </tr>
  )
}

/** Một ô gõ: giữ chữ tại chỗ, chốt lúc rời ô; `key` theo giá trị để nhận đổi từ ngoài (dán, nạp). */
function O(p: {
  id: string
  col: EditCol
  value: string
  prefix?: string
  groups: { code: string; label: string }[]
  disabled: boolean
  onCommit: (v: string) => void
  cell: string
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  ariaLabel: string
  placeholder?: string
}) {
  return <OInner key={p.value} {...p} />
}

function OInner(p: Parameters<typeof O>[0]) {
  const [v, setV] = useState(p.value)
  if (p.col.kind === 'select') {
    return (
      <select
        id={p.id}
        className="sx-cell"
        value={p.value}
        disabled={p.disabled}
        onChange={(e) => p.onCommit(e.target.value)}
        data-cell={p.cell}
        onKeyDown={p.onKeyDown}
        aria-label={p.ariaLabel}
      >
        <option value="">— nhóm? —</option>
        {p.groups.map((g) => (
          <option key={g.code} value={g.code}>
            {g.label}
          </option>
        ))}
      </select>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center' }}>
      {p.prefix && (
        <span className="pill b" style={{ marginLeft: 6 }}>
          {p.prefix}
        </span>
      )}
      <input
        id={p.id}
        className={cx('sx-cell', p.col.kind === 'num' && 'num')}
        type="text"
        inputMode={p.col.kind === 'num' ? 'decimal' : undefined}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== p.value) p.onCommit(v)
        }}
        disabled={p.disabled}
        placeholder={p.placeholder}
        data-cell={p.cell}
        onKeyDown={p.onKeyDown}
        onPaste={p.onPaste}
        aria-label={p.ariaLabel}
      />
    </span>
  )
}
