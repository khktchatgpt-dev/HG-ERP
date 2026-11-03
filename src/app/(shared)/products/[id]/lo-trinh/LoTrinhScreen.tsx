'use client'

import './lo-trinh.css'
import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'
import type { LoTrinhProps, PartRow } from './lo-trinh.shared'
import { useLoTrinh, type LoTrinhCtx } from './useLoTrinh'

/**
 * LỘ TRÌNH SẢN PHẨM — màn C2 của bản vẽ 03/11/2026 (không kit).
 *
 * Ma trận: hàng = cụm (đánh x được) · chi tiết rời theo nhóm vật tư (x mờ = suy,
 * bấm là ghi đè) · ngũ kim (hàng mua, không đi qua công đoạn) · thành phẩm
 * (đọc từ cấu hình công đoạn). Cột = công đoạn, dưới tên là bậc đếm.
 * Thứ tự chạy = thứ tự danh mục; không kéo thả.
 */
export function LoTrinhScreen(p: LoTrinhProps) {
  const d = useLoTrinh(p)
  const { stages } = p
  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

  const roi = p.parts.filter((x) => !x.cluster_id && !d.isPurchasedGroup(x.group_code))
  const mua = p.parts.filter((x) => !x.cluster_id && d.isPurchasedGroup(x.group_code))
  const nhomRoi = [...new Set(roi.map((x) => x.group_code))]
  const trongCum = p.parts.filter((x) => x.cluster_id).length

  const luuWhy = !p.canEdit
    ? p.locked
      ? 'Hồ sơ đã khoá'
      : 'Bạn không có quyền sửa định mức'
    : !d.dirty
      ? 'Chưa đổi gì'
      : d.cumRong.length
        ? `${d.cumRong[0].name} chưa tick công đoạn nào — bỏ hết là cụm biến mất khỏi sổ`
        : d.doiRong.length
          ? `${d.doiRong[0].part_name} chưa tick công đoạn nào — về mặc định nếu không gia công`
          : null

  if (p.clusters.length === 0 && roi.length === 0) {
    return (
      <div className="lt" aria-label="Lộ trình sản phẩm">
        <div className="lt-rong">
          <b>Chưa có định mức để khai lộ trình</b>
          Nhập định mức ở tab Định mức (hoặc đọc từ file BOM) trước — lộ trình đi theo cụm
          và chi tiết của định mức.
        </div>
      </div>
    )
  }

  return (
    <div className="lt" aria-label="Lộ trình sản phẩm">
      <div className="lt-ph">
        <h2>Lộ trình</h2>
        <span className="ctx">
          <b>{p.productCode}</b> · {p.clusters.length} cụm · {roi.length} chi tiết rời ·{' '}
          {mua.length} ngũ kim
          {p.bomRev != null && (
            <>
              {' '}
              · rev <b>{p.bomRev}</b>
            </>
          )}
        </span>
        <div className="lt-ap" role="toolbar" aria-label="Thao tác">
          <div>
            <Nut onClick={d.huy} why={d.dirty ? null : 'Chưa đổi gì'}>
              Huỷ
            </Nut>
            <Nut primary onClick={d.luu} why={luuWhy} busy={d.busy}>
              Lưu lộ trình
            </Nut>
          </div>
        </div>
      </div>
      {d.loi && (
        <div className="lt-note stop" role="alert">
          <b>Chưa lưu được:</b> {d.loi}
        </div>
      )}
      {!d.loi && d.thongBao && (
        <div className="lt-note ok" role="status">
          {d.thongBao}
        </div>
      )}
      <div className="lt-leg">
        <span>
          <i className="s" /> x = đi qua
        </span>
        <span>
          <i className="o" /> ngoài lộ trình
        </span>
        <span>x mờ = suy theo nhóm vật tư — bấm là ghi đè cho đúng dòng đó</span>
        <span>
          Lệnh đã định hình giữ bản chụp của nó — muốn áp thì &quot;Định hình lại&quot; ở
          lệnh
        </span>
      </div>
      <div className="lt-grid">
        <table className="lt-tb" aria-label="Ma trận cụm × công đoạn">
          <colgroup>
            <col style={{ width: 260 }} />
            <col style={{ width: 54 }} />
            <col style={{ width: 44 }} />
            {stages.map((s) => (
              <col key={s.code} style={{ width: 58 }} />
            ))}
            <col style={{ width: 230 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Cụm / chi tiết</th>
              <th className="r">SL/SP</th>
              <th className="r">CT</th>
              {stages.map((s) => (
                <th key={s.code} className="c" title={s.label}>
                  {s.label}
                  <span className="u">
                    {COUNT_LEVEL_LABEL[s.meta.count_level].replace(' (cái)', '')}
                  </span>
                </th>
              ))}
              <th>Tách theo bậc đếm</th>
            </tr>
          </thead>
          <tbody>
            {p.clusters.map((c) => {
              const suy = d.suyCum(c.id)
              const { stages: st, khai } = d.hieuLuc(c.id, suy)
              const members = d.partsByCluster.get(c.id) ?? []
              const rong = khai && st.length === 0
              const split = d.chia(st)
              return (
                <ClusterRows
                  key={c.id}
                  d={d}
                  id={c.id}
                  name={c.name}
                  qty={c.qty_per_product}
                  ct={members.length}
                  members={members}
                  st={st}
                  khai={khai}
                  suy={suy}
                  rong={rong}
                  stagesAll={stages.map((s) => s.code)}
                  tach={
                    members.length === 0
                      ? 'cụm chưa có chi tiết nào'
                      : st.length === 0
                        ? '—'
                        : `chi tiết: ${split.part.map(labelOf).join(' → ') || '—'} · cụm: ${
                            split.cluster.map(labelOf).join(' → ') || '—'
                          }`
                  }
                  canEdit={p.canEdit}
                />
              )
            })}

            {nhomRoi.map((g) => {
              const xs = roi.filter((x) => x.group_code === g)
              return (
                <GroupRows
                  key={g}
                  d={d}
                  label={`Chi tiết rời — ${p.groupLabels[g] ?? g} (${xs.length}) · suy theo nhóm ${g}`}
                  parts={xs}
                  stagesAll={stages.map((s) => s.code)}
                  canEdit={p.canEdit}
                />
              )
            })}

            {mua.length > 0 && (
              <tr className="sub">
                <td title={mua.map((x) => x.part_name).join(' · ')}>
                  Ngũ kim ({mua.length}) · hàng mua, không qua công đoạn
                </td>
                <td className="r num"></td>
                <td className="r num">{mua.length}</td>
                {stages.map((s) => (
                  <td key={s.code} className="out">
                    –
                  </td>
                ))}
                <td className="mut">không vào sổ sản lượng</td>
              </tr>
            )}

            <tr className="grp">
              <td>Thành phẩm (bộ)</td>
              <td className="r num">1</td>
              <td className="r num">—</td>
              {stages.map((s) =>
                d.counting.finish.includes(s.code) ? (
                  <td key={s.code} className="x">
                    <button
                      type="button"
                      className="lt-x"
                      disabled
                      aria-label={`${s.label}: đi qua (theo cấu hình công đoạn)`}
                    >
                      x
                    </button>
                  </td>
                ) : (
                  <td key={s.code} className="out">
                    –
                  </td>
                ),
              )}
              <td className="mut">từ cấu hình công đoạn — đếm bằng bộ</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                {p.clusters.length} cụm · {trongCum} chi tiết trong cụm · {roi.length} rời
              </td>
              <td colSpan={2} className={d.cumRong.length ? 'warn' : undefined}>
                {d.cumRong.length ? `${d.cumRong.length} cụm trống` : ''}
              </td>
              <td colSpan={stages.length + 1} className="mut" style={{ fontWeight: 400 }}>
                Ghép ở{' '}
                <b className="ma">{d.counting.join ? labelOf(d.counting.join) : '—'}</b> ·
                cụm chưa khai thì chi tiết dừng trước đó, cụm chạy từ đó — như cũ
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="lt-sb">
        <span>
          Thứ tự chạy = thứ tự danh mục công đoạn · sửa bậc đếm ở Sản xuất › Cấu hình ›
          Công đoạn
        </span>
        <span className="r">
          {d.dirty ? (
            <span className="warn">Đang sửa — chưa lưu</span>
          ) : (
            'technical_product_clusters.stages'
          )}
        </span>
      </div>
    </div>
  )
}

function Nut({
  children,
  onClick,
  primary,
  why,
  busy,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  why?: string | null
  busy?: boolean
}) {
  const cls = primary ? 'lt-btn p' : 'lt-btn'
  if (why)
    return (
      <>
        <span className={cls} aria-disabled="true" role="button" tabIndex={0}>
          {children}
        </span>
        <span className="lt-why">{why}</span>
      </>
    )
  return (
    <button type="button" className={cls} onClick={onClick} aria-busy={busy || undefined}>
      {busy ? 'Đang lưu…' : children}
    </button>
  )
}

function XCell({
  on,
  khai,
  label,
  onToggle,
  canEdit,
}: {
  on: boolean
  khai: boolean
  label: string
  onToggle: () => void
  canEdit: boolean
}) {
  if (!on && !khai && !canEdit) return <td className="out">–</td>
  const cls = `lt-x${on ? (khai ? '' : ' s') : ' e'}`
  return (
    <td className={on ? 'x' : 'x'}>
      <button
        type="button"
        className={cls}
        disabled={!canEdit}
        aria-pressed={on}
        aria-label={`${label}: ${on ? (khai ? 'đi qua' : 'đi qua (suy)') : 'không'}`}
        title={on && !khai ? 'suy theo nhóm vật tư — bấm để ghi đè' : undefined}
        onClick={onToggle}
      >
        {on ? 'x' : '·'}
      </button>
    </td>
  )
}

function ClusterRows({
  d,
  id,
  name,
  qty,
  ct,
  members,
  st,
  khai,
  suy,
  rong,
  stagesAll,
  tach,
  canEdit,
}: {
  d: LoTrinhCtx
  id: string
  name: string
  qty: number | null
  ct: number
  members: PartRow[]
  st: string[]
  khai: boolean
  suy: string[]
  rong: boolean
  stagesAll: string[]
  tach: string
  canEdit: boolean
}) {
  return (
    <>
      <tr className={`grp${rong ? 'bad' : ''}`}>
        <td title={name}>
          {name}
          {khai && canEdit && (
            <>
              {' '}
              <button type="button" className="lt-lnk" onClick={() => d.veMacDinh(id)}>
                về mặc định
              </button>
            </>
          )}
        </td>
        <td className={`r num${qty == null ? 'warn' : ''}`}>{qty ?? '—'}</td>
        <td className="r num">{ct}</td>
        {stagesAll.map((s) => (
          <XCell
            key={s}
            on={st.includes(s)}
            khai={khai}
            label={`${name} · ${s}`}
            canEdit={canEdit}
            onToggle={() => d.toggle(id, suy, s)}
          />
        ))}
        <td className="mut" title={tach}>
          {tach}
        </td>
      </tr>
      {members.length > 0 && (
        <tr className="mem">
          <td
            title={members.map((m) => `${m.part_name} ×${m.qty}`).join(' · ')}
            colSpan={3}
          >
            &nbsp;&nbsp;{members.map((m) => `${m.part_name} ×${m.qty}`).join(' · ')}
          </td>
          <td colSpan={stagesAll.length + 1} className="mut">
            chi tiết trong cụm đi theo nửa &quot;chi tiết&quot; của cụm
          </td>
        </tr>
      )}
    </>
  )
}

function GroupRows({
  d,
  label,
  parts,
  stagesAll,
  canEdit,
}: {
  d: LoTrinhCtx
  label: string
  parts: PartRow[]
  stagesAll: string[]
  canEdit: boolean
}) {
  return (
    <>
      <tr className="sub">
        <td title={label}>{label}</td>
        <td className="r num"></td>
        <td className="r num">{parts.length}</td>
        <td colSpan={stagesAll.length + 1} className="mut">
          mỗi dòng tự khai; chưa khai thì suy theo nhóm
        </td>
      </tr>
      {parts.map((x) => {
        const suy = [...d.routeForGroup(x.group_code)]
        const { stages: st, khai } = d.hieuLuc(x.id, suy)
        const rong = khai && st.length === 0
        return (
          <tr key={x.id} className={rong ? 'bad' : undefined}>
            <td title={x.part_name}>
              &nbsp;&nbsp;{x.part_name}
              {khai && canEdit && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="lt-lnk"
                    onClick={() => d.veMacDinh(x.id)}
                  >
                    về mặc định
                  </button>
                </>
              )}
            </td>
            <td className="r num">{x.qty}</td>
            <td className="r num"></td>
            {stagesAll.map((s) => (
              <XCell
                key={s}
                on={st.includes(s)}
                khai={khai}
                label={`${x.part_name} · ${s}`}
                canEdit={canEdit}
                onToggle={() => d.toggle(x.id, suy, s)}
              />
            ))}
            <td className="mut">{khai ? 'khai riêng' : 'suy theo nhóm'}</td>
          </tr>
        )
      })}
    </>
  )
}
