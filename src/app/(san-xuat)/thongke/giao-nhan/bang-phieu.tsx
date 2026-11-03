'use client'

import { Fragment } from 'react'
import { cx, dmy, fmt, num, STATUS_LABEL, type Doc } from './giao-nhan.shared'
import type { GiaoNhanCtx } from './useGiaoNhan'

/**
 * Hộp phiếu — một lưới dính đầu/chân, gom theo lệnh, mỗi dòng phiếu một hàng.
 * Tab "Chờ tôi nhận": cột Nhận gõ được, chênh ≠ 0 bắt lý do tại chỗ; hành động
 * đứng ở dòng đầu của phiếu. Phiếu đã nhận không sửa — chỉ Đảo.
 */
export function BangPhieu({ d }: { d: GiaoNhanCtx }) {
  const { docs, tab, teamId } = d
  const byLsx = new Map<string, Doc[]>()
  for (const x of docs) byLsx.set(x.lsx_id, [...(byLsx.get(x.lsx_id) ?? []), x])
  const choNhan = tab === 'cho_nhan'
  // Chân bảng: Giao cộng mọi phiếu đang bày; Nhận và Chênh CHỈ cộng dòng đã có số
  // nhận (đang gõ ở tab chờ nhận, hoặc đã xác nhận) — phiếu chưa nhận không phải
  // "chênh −100", nó chưa có số để so.
  let tongGiao = 0
  let tongNhan = 0
  let tongChenh = 0
  for (const x of docs) {
    for (const l of x.lines) {
      tongGiao += l.qty
      const r = choNhan ? num(d.draftOf(l.id, l.qty).received) : l.received_qty
      if (r == null) continue
      tongNhan += r
      tongChenh += r - l.qty
    }
  }
  tongChenh = Math.round(tongChenh * 100) / 100

  return (
    <div className="sx-grid">
      <table className="sx-tb" style={{ minWidth: 1040 }}>
        <colgroup>
          <col style={{ width: 118 }} />
          <col style={{ width: 54 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 230 }} />
          <col style={{ width: 62 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 170 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Phiếu</th>
            <th>Ngày</th>
            <th>Từ → đến</th>
            <th>SP · dòng</th>
            <th className="r">Giao</th>
            <th className="r">Nhận</th>
            <th className="r">Chênh</th>
            <th>Lý do chênh</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && (
            <tr>
              <td colSpan={9} className="mut" style={{ height: 60, textAlign: 'center' }}>
                {tab === 'cho_nhan'
                  ? `Không có phiếu nào chờ ${d.team?.name ?? 'tổ này'} nhận — tổ giao chưa lập phiếu, hoặc đổi tổ ở đầu trang`
                  : tab === 'da_giao'
                    ? `${d.team?.name ?? 'Tổ này'} chưa có phiếu nào đang chờ tổ khác nhận — bấm "Lập phiếu giao"`
                    : 'Chưa có phiếu nào trong mục này'}
              </td>
            </tr>
          )}
          {[...byLsx.entries()].map(([lsxId, list]) => (
            <Fragment key={lsxId}>
              <tr>
                <td
                  colSpan={9}
                  style={{ background: 'var(--sx-raised)', fontWeight: 600 }}
                >
                  <span className="ma">{list[0].lsx_code}</span>
                  <span className="mut" style={{ fontWeight: 400 }}>
                    {' '}
                    · {list[0].customer_name}
                    {list[0].ship_date && ` · hạn xuất ${dmy(list[0].ship_date)}`}
                  </span>
                </td>
              </tr>
              {list.map((x) => (
                <Phieu
                  key={x.id}
                  d={d}
                  x={x}
                  choNhan={choNhan && x.to_team_id === teamId}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              {docs.length} phiếu
              <span className="mut" style={{ fontWeight: 400 }}>
                {' '}
                ·{' '}
                {choNhan
                  ? 'cột Nhận là số đang gõ, chưa xác nhận'
                  : 'chỉ cộng phiếu đang bày'}
              </span>
            </td>
            <td className="r num">{fmt(tongGiao)}</td>
            <td className="r num">{fmt(tongNhan)}</td>
            <td className="r num">
              {tongChenh === 0
                ? '0'
                : tongChenh > 0
                  ? `+${fmt(tongChenh)}`
                  : `−${fmt(-tongChenh)}`}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Phieu({ d, x, choNhan }: { d: GiaoNhanCtx; x: Doc; choNhan: boolean }) {
  const dao = x.reverses_doc_id != null
  const thieu = choNhan ? d.thieuLyDo(x) : null
  const chenh = choNhan && d.coChenh(x)
  const myOut = x.status === 'da_giao' && !dao && x.from_team_id === d.teamId
  const canDao =
    x.status === 'da_nhan' &&
    !dao &&
    (x.from_team_id === d.teamId || x.to_team_id === d.teamId)
  return (
    <>
      {x.lines.map((l, i) => {
        const nh = d.draftOf(l.id, l.qty)
        const received = choNhan ? num(nh.received) : (l.received_qty ?? null)
        const diff = received == null ? null : Math.round((received - l.qty) * 100) / 100
        const err = choNhan && diff !== 0 && !nh.reason.trim()
        return (
          <tr key={l.id} className="d">
            <td className="ma" title={x.note ?? undefined}>
              {i === 0 && (
                <>
                  {x.doc_no}
                  {dao && <span className="pill m">đảo {x.reverses_doc_no}</span>}
                  {x.status === 'da_huy' && <span className="pill m">huỷ</span>}
                </>
              )}
            </td>
            <td className="num">{i === 0 ? dmy(x.entry_date).slice(0, 5) : ''}</td>
            <td title={`${d.teamName(x.from_team_id)} → ${d.teamName(x.to_team_id)}`}>
              {i === 0 && `${d.stageLabel(x.from_stage)} → ${d.stageLabel(x.to_stage)}`}
            </td>
            <td
              title={`${l.product_code} · ${l.cluster ? `${l.cluster} · ` : ''}${l.name}`}
            >
              <span className="ma">{l.product_code}</span> ·{' '}
              {l.cluster && <span className="mut">{l.cluster} · </span>}
              {l.name}
            </td>
            <td className="r num">{fmt(l.qty)}</td>
            <td
              className={cx('r', choNhan ? 'ed' : 'num', choNhan && diff !== 0 && 'warn')}
            >
              {choNhan ? (
                <input
                  className="sx-cell num"
                  type="text"
                  inputMode="decimal"
                  value={nh.received}
                  onChange={(e) => d.patchNhan(l.id, { received: e.target.value })}
                  aria-label={`SL nhận ${l.name}`}
                />
              ) : received == null ? (
                <span className="empty">—</span>
              ) : (
                fmt(received)
              )}
            </td>
            <td
              className={cx(
                'r num',
                diff ? (diff < 0 ? 'stop' : 'warn') : diff === 0 && 'empty',
              )}
            >
              {diff == null
                ? ''
                : diff === 0
                  ? '0'
                  : diff > 0
                    ? `+${fmt(diff)}`
                    : `−${fmt(-diff)}`}
            </td>
            <td className={choNhan ? cx('ed', err && 'err') : undefined}>
              {choNhan ? (
                <input
                  className="sx-cell"
                  type="text"
                  value={nh.reason}
                  onChange={(e) => d.patchNhan(l.id, { reason: e.target.value })}
                  placeholder={diff !== 0 ? 'bắt buộc khi chênh' : ''}
                  aria-label={`Lý do chênh ${l.name}`}
                />
              ) : (
                (l.diff_reason ??
                (x.status === 'da_huy' ? x.cancel_reason : dao ? x.note : ''))
              )}
            </td>
            <td>
              {i === 0 &&
                (choNhan ? (
                  <>
                    {!chenh && (
                      <button
                        type="button"
                        className="lnk"
                        onClick={() => d.nhanDu(x)}
                        disabled={d.busy}
                      >
                        Nhận đủ
                      </button>
                    )}
                    {chenh && (
                      <button
                        type="button"
                        className="lnk"
                        onClick={() => d.xacNhan(x)}
                        disabled={d.busy || !!thieu}
                        title={
                          thieu ? `"${thieu.name}" chênh mà chưa ghi lý do` : undefined
                        }
                      >
                        Xác nhận
                      </button>
                    )}
                  </>
                ) : myOut ? (
                  <button
                    type="button"
                    className="lnk mut"
                    onClick={() => d.setHoi({ kind: 'huy', doc: x, reason: '' })}
                  >
                    Huỷ
                  </button>
                ) : canDao ? (
                  <button
                    type="button"
                    className="lnk mut"
                    onClick={() => d.setHoi({ kind: 'dao', doc: x, reason: '' })}
                  >
                    Đảo
                  </button>
                ) : (
                  <span className="mut">
                    {STATUS_LABEL[x.status]}
                    {x.received_at && ` ${dmy(x.received_at).slice(0, 5)}`}
                  </span>
                ))}
            </td>
          </tr>
        )
      })}
    </>
  )
}
