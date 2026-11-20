'use client'

import './lo-trinh.css'
import { cx, shortStageLabel, type LoTrinhProps, type PartRow } from './lo-trinh.shared'
import { useLoTrinh, type LoTrinhCtx } from './useLoTrinh'

/**
 * LỘ TRÌNH SẢN PHẨM — màn C2 của bản vẽ 03/11/2026 (không kit).
 *
 * Ma trận: hàng = cụm (đánh x được) · chi tiết trong cụm (x mờ, đi theo nửa
 * "chi tiết" của cụm, không bấm) · chi tiết rời theo nhóm vật tư (x mờ = suy,
 * bấm là ghi đè từng dòng) · ngũ kim (hàng mua, không đi qua công đoạn) ·
 * thành phẩm (đọc từ cấu hình công đoạn). Cột = công đoạn, dưới tên là bậc
 * đếm. Ô ngoài lộ trình gạch chéo, bấm vào là thêm. Thứ tự chạy = thứ tự danh
 * mục; không kéo thả. 12 cột × 56px + 3 cột đầu = 1.030px, vừa màn 1280 không
 * cuộn ngang (chủ dự án chê bản đầu cắt chữ + hai thanh cuộn, 03/11).
 */
const LEVEL_SHORT: Record<string, string> = { part: 'ct', cluster: 'cụm', unit: 'bộ' }

export function LoTrinhScreen(p: LoTrinhProps) {
  const d = useLoTrinh(p)
  const { stages } = p
  const codes = stages.map((s) => s.code)
  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

  const roi = p.parts.filter((x) => !x.cluster_id && !d.isPurchasedGroup(x.group_code))
  const mua = p.parts.filter((x) => !x.cluster_id && d.isPurchasedGroup(x.group_code))
  const nhomRoi = [...new Set(roi.map((x) => x.group_code))]
  const trongCum = p.parts.filter((x) => x.cluster_id).length

  const luuWhy = !p.canEdit
    ? (p.chiDoc ?? (p.locked ? 'Hồ sơ đã khoá' : 'Bạn không có quyền sửa định mức'))
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

  // Dải "đếm bằng" từ cấu hình, gom theo bậc liền nhau: phôi ct · hàn→sơn cụm · lắp ráp→h.thiện bộ
  const demBang = (() => {
    const out: string[] = []
    let i = 0
    while (i < stages.length) {
      const lv = stages[i].meta.count_level
      let j = i
      while (j + 1 < stages.length && stages[j + 1].meta.count_level === lv) j++
      const a = shortStageLabel(stages[i].label)
      const b = shortStageLabel(stages[j].label)
      out.push(`${i === j ? a : `${a}→${b}`} ${LEVEL_SHORT[lv]}`)
      i = j + 1
    }
    return out.join(' · ')
  })()

  return (
    <div className="lt" aria-label="Lộ trình sản phẩm">
      <div className="lt-ph">
        <h2>Lộ trình</h2>
        <span className="ctx">
          <b>{p.productCode}</b> · {p.clusters.length} cụm · {roi.length} chi tiết rời ·{' '}
          {mua.length} ngũ kim
          {p.routeSource && (
            <>
              {' '}
              ·{' '}
              {p.routeSource.source.startsWith('lsx:') ? (
                <>
                  cập nhật từ lệnh <b>{p.routeSource.source.slice(4)}</b>
                </>
              ) : (
                'khai tay'
              )}{' '}
              {new Date(p.routeSource.at).toLocaleDateString('vi-VN')}
            </>
          )}
          {p.bomRev != null && (
            <>
              {' '}
              · rev <b>{p.bomRev}</b>
            </>
          )}
        </span>
        <div className="lt-ap" role="toolbar" aria-label="Thao tác">
          <div>
            {d.dirty && (
              <Nut onClick={d.huy} why={null}>
                Huỷ
              </Nut>
            )}
            <Nut primary onClick={d.luu} why={luuWhy} busy={d.busy}>
              Lưu lộ trình
            </Nut>
          </div>
        </div>
      </div>
      {p.chiDoc && (
        <div className="lt-note" role="note">
          <b>Chỉ đọc.</b> {p.chiDoc}{' '}
          <a href="/thongke/lo-trinh" className="lnk">
            Mở Lộ trình công đoạn
          </a>
        </div>
      )}
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
          <i className="o" /> ngoài lộ trình — bấm để thêm
        </span>
        <span>
          x mờ = suy theo nhóm vật tư (cụm chưa khai, chi tiết rời) — bấm là ghi đè
        </span>
        <span>Đếm bằng (từ cấu hình): {demBang}</span>
      </div>
      <div className="lt-grid">
        <table className="lt-tb" aria-label="Ma trận cụm × công đoạn">
          <colgroup>
            <col style={{ width: 250 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 44 }} />
            {stages.map((s) => (
              <col key={s.code} style={{ width: 56 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Cụm / chi tiết</th>
              <th className="r">SL/SP</th>
              <th className="r">CT</th>
              {stages.map((s) => (
                <th
                  key={s.code}
                  className="c"
                  title={`${s.label} — đếm bằng ${LEVEL_SHORT[s.meta.count_level]}`}
                >
                  {shortStageLabel(s.label)}
                  <span className="u">{LEVEL_SHORT[s.meta.count_level]}</span>
                </th>
              ))}
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
                  members={members}
                  st={st}
                  khai={khai}
                  suy={suy}
                  rong={rong}
                  partStages={split.part}
                  codes={codes}
                  title={
                    members.length === 0
                      ? `${c.name} — cụm chưa có chi tiết nào`
                      : `${c.name} — chi tiết: ${split.part.map(labelOf).join(' → ') || '—'} · cụm: ${
                          split.cluster.map(labelOf).join(' → ') || '—'
                        }`
                  }
                  canEdit={p.canEdit}
                />
              )
            })}

            {nhomRoi.map((g) => (
              <GroupRows
                key={g}
                d={d}
                label={`Chi tiết rời — ${p.groupLabels[g] ?? g} (${roi.filter((x) => x.group_code === g).length}) · suy theo nhóm ${g}`}
                groupRoute={d.routeForGroup(g)}
                parts={roi.filter((x) => x.group_code === g)}
                codes={codes}
                canEdit={p.canEdit}
              />
            ))}

            {mua.length > 0 && (
              <tr className="sub">
                <td title={mua.map((x) => x.part_name).join(' · ')}>
                  Ngũ kim ({mua.length}) · hàng mua, không qua công đoạn
                </td>
                <td className="r num"></td>
                <td className="r num">{mua.length}</td>
                {codes.map((s) => (
                  <td key={s} className="out">
                    –
                  </td>
                ))}
              </tr>
            )}

            <tr className="grp">
              <td title="Bốn bước đếm theo bộ lấy từ cấu hình công đoạn — không khai ở đây">
                Thành phẩm (bộ)
              </td>
              <td className="r num">1</td>
              <td className="r num">—</td>
              {codes.map((s) =>
                d.counting.finish.includes(s) ? (
                  <td key={s} className="x">
                    <button
                      type="button"
                      className="lt-x"
                      disabled
                      aria-label={`${labelOf(s)}: đi qua (theo cấu hình công đoạn)`}
                    >
                      x
                    </button>
                  </td>
                ) : (
                  <td key={s} className="out">
                    –
                  </td>
                ),
              )}
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
              <td colSpan={stages.length} className="mut" style={{ fontWeight: 400 }}>
                Ghép ở{' '}
                <b className="ma">{d.counting.join ? labelOf(d.counting.join) : '—'}</b> ·
                cụm chưa khai thì chi tiết dừng trước đó, cụm chạy từ đó — như cũ · thành
                phẩm đếm bằng bộ từ cấu hình
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="lt-sb">
        <span>
          Thứ tự chạy = thứ tự danh mục công đoạn · sửa bậc đếm ở Sản xuất › Cấu hình ›
          Công đoạn · lệnh đã định hình giữ bản chụp, muốn áp thì &quot;Định hình
          lại&quot; ở lệnh
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

/**
 * Một ô của ma trận. Đang đi qua → "x" (đậm khi người khai, mờ khi suy); ngoài
 * lộ trình → nền gạch chéo với "–" mờ, bấm vào là thêm. Không sửa được → tĩnh.
 */
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
  onToggle?: () => void
  canEdit: boolean
}) {
  if (!canEdit || !onToggle) {
    if (!on) return <td className="out">–</td>
    return (
      <td className="x">
        <button
          type="button"
          className={cx('lt-x', !khai && 's')}
          disabled
          aria-label={`${label}: đi qua${khai ? '' : ' (suy)'}`}
        >
          x
        </button>
      </td>
    )
  }
  return (
    <td className={cx('x', !on && 'out')}>
      <button
        type="button"
        className={cx('lt-x', on ? !khai && 's' : 'e')}
        aria-pressed={on}
        aria-label={`${label}: ${on ? (khai ? 'đi qua' : 'đi qua (suy)') : 'ngoài lộ trình — bấm để thêm'}`}
        title={on && !khai ? 'suy theo nhóm vật tư — bấm để ghi đè' : undefined}
        onClick={onToggle}
      >
        {on ? 'x' : '–'}
      </button>
    </td>
  )
}

function ClusterRows({
  d,
  id,
  name,
  qty,
  members,
  st,
  khai,
  suy,
  rong,
  partStages,
  codes,
  title,
  canEdit,
}: {
  d: LoTrinhCtx
  id: string
  name: string
  qty: number | null
  members: PartRow[]
  st: string[]
  khai: boolean
  suy: string[]
  rong: boolean
  /** Nửa "chi tiết" của lộ trình cụm — chi tiết trong cụm đi qua đúng các bước này. */
  partStages: string[]
  codes: string[]
  title: string
  canEdit: boolean
}) {
  return (
    <>
      <tr className={cx('grp', rong && 'bad')}>
        <td title={title}>
          {name}
          {khai && (
            <>
              {' '}
              <span className="mut" style={{ fontWeight: 400 }}>
                · đã khai
              </span>
              {canEdit && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="lt-lnk"
                    onClick={() => d.veMacDinh(id)}
                  >
                    về mặc định
                  </button>
                </>
              )}
            </>
          )}
        </td>
        <td className={cx('r num', qty == null && 'warn')}>{qty ?? '—'}</td>
        <td className="r num">{members.length}</td>
        {codes.map((s) => (
          <XCell
            key={s}
            on={st.includes(s)}
            khai={khai}
            label={`${name} · ${s}`}
            canEdit={canEdit}
            onToggle={() => d.toggle(id, suy, s)}
          />
        ))}
      </tr>
      {members.length > 0 && (
        <tr className="mem">
          <td
            title={`${members.map((m) => `${m.part_name} ×${m.qty}`).join(' · ')} — chi tiết trong cụm đi theo nửa "chi tiết" của lộ trình cụm`}
            colSpan={3}
          >
            &nbsp;&nbsp;{members.map((m) => `${m.part_name} ×${m.qty}`).join(' · ')}
          </td>
          {codes.map((s) => (
            <XCell
              key={s}
              on={partStages.includes(s)}
              khai={false}
              label={`chi tiết ${name} · ${s}`}
              canEdit={false}
            />
          ))}
        </tr>
      )}
    </>
  )
}

function GroupRows({
  d,
  label,
  groupRoute,
  parts,
  codes,
  canEdit,
}: {
  d: LoTrinhCtx
  label: string
  groupRoute: readonly string[]
  parts: PartRow[]
  codes: string[]
  canEdit: boolean
}) {
  return (
    <>
      <tr className="sub">
        <td title={`${label} — mỗi dòng tự khai; chưa khai thì suy theo nhóm`}>
          {label}
        </td>
        <td className="r num"></td>
        <td className="r num">{parts.length}</td>
        {codes.map((s) => (
          <XCell
            key={s}
            on={groupRoute.includes(s)}
            khai={false}
            label={`nhóm · ${s}`}
            canEdit={false}
          />
        ))}
      </tr>
      {parts.map((x) => {
        const suy = [...d.routeForGroup(x.group_code)]
        const { stages: st, khai } = d.hieuLuc(x.id, suy)
        const rong = khai && st.length === 0
        return (
          <tr key={x.id} className={cx(rong && 'bad')}>
            <td title={`${x.part_name}${khai ? ' — khai riêng' : ' — suy theo nhóm'}`}>
              &nbsp;&nbsp;{x.part_name}
              {khai && (
                <>
                  {' '}
                  <span className="mut">· khai riêng</span>
                  {canEdit && (
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
                </>
              )}
            </td>
            <td className="r num">{x.qty}</td>
            <td className="r num"></td>
            {codes.map((s) => (
              <XCell
                key={s}
                on={st.includes(s)}
                khai={khai}
                label={`${x.part_name} · ${s}`}
                canEdit={canEdit}
                onToggle={() => d.toggle(x.id, suy, s)}
              />
            ))}
          </tr>
        )
      })}
    </>
  )
}
