'use client'

import { cx, fmt, num } from './giao-nhan.shared'
import type { GiaoNhanCtx } from './useGiaoNhan'

/**
 * Bảng LẬP PHIẾU GIAO (cột phải). Từ = tổ đang đứng + công đoạn của nó; Đến =
 * tổ nhận (gợi theo công đoạn kế tiếp trên lộ trình); lưới dòng của lệnh có
 * xong · đã giao · tồn; "Giao nay" gõ tay. Giao vượt tồn chỉ cảnh báo.
 */
export function LapPhieu({ d }: { d: GiaoNhanCtx }) {
  const { p } = d
  const hasStage = !!d.fromStage
  return (
    <div>
      <div className="sx-mh">
        Lập phiếu giao
        <b>từ {d.team?.name ?? '— chọn tổ —'}</b>
        <button
          type="button"
          className="lnk mut"
          style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}
          onClick={() => d.setMoForm(false)}
        >
          Đóng
        </button>
      </div>
      <div className="sx-blk">
        <div className="sx-row">
          <span className="mut" style={{ width: 44 }}>
            Từ
          </span>
          <b>{d.team?.name ?? '—'}</b>
          <select
            className="sx-sel"
            value={d.fromStage}
            onChange={(e) => d.doiFromStage(e.target.value)}
            aria-label="Công đoạn giao"
          >
            <option value="">— công đoạn —</option>
            {p.stages.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sx-row">
          <span className="mut" style={{ width: 44 }}>
            Đến
          </span>
          <select
            className="sx-sel"
            value={d.toTeamId}
            onChange={(e) => d.setToTeamId(e.target.value)}
            aria-label="Tổ nhận"
            style={{ minWidth: 170 }}
          >
            <option value="">— chọn tổ nhận —</option>
            {p.teams
              .filter((t) => t.id !== d.teamId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.stage_code
                    ? ` · ${d.stageLabel(t.stage_code)}`
                    : ' · chưa gắn công đoạn'}
                </option>
              ))}
          </select>
          {d.toStage && <span className="mut">→ {d.stageLabel(d.toStage)}</span>}
        </div>
        <div className="sx-row">
          <span className="mut" style={{ width: 44 }}>
            Lệnh
          </span>
          <select
            className="sx-sel"
            value={d.lsxId}
            onChange={(e) => d.doiLenh(e.target.value)}
            aria-label="Lệnh"
            style={{ minWidth: 170 }}
          >
            {p.lsx.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.customer_name}
              </option>
            ))}
          </select>
        </div>
        <div className="sx-row">
          <span className="mut" style={{ width: 44 }}>
            Ngày
          </span>
          <input
            className="sx-in ma"
            type="date"
            value={d.date}
            max={p.today}
            onChange={(e) => d.setDate(e.target.value)}
            aria-label="Ngày giao"
          />
          <input
            className="sx-in"
            value={d.note}
            onChange={(e) => d.setNote(e.target.value)}
            placeholder="ghi chú phiếu"
            aria-label="Ghi chú phiếu"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {!hasStage ? (
        <div className="sx-fine">
          Tổ này chưa gắn công đoạn nào — chọn công đoạn ở ô “Từ”, hoặc gán ở Cấu hình ›
          Công đoạn.
        </div>
      ) : d.nguonLoi ? (
        <div className="sx-err">{d.nguonLoi}</div>
      ) : d.nguon == null ? (
        <div className="sx-fine">Đang tải dòng của lệnh…</div>
      ) : d.nguon.length === 0 ? (
        <div className="sx-fine">
          Lệnh này không có dòng nào đi qua <b>{d.stageLabel(d.fromStage)}</b> — chọn công
          đoạn khác ở ô “Từ”, hoặc xem lộ trình của lệnh ở Lộ trình công đoạn.
        </div>
      ) : (
        <table className="sx-tb" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col />
            <col style={{ width: 58 }} />
            <col style={{ width: 62 }} />
            <col style={{ width: 70 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Dòng · SP</th>
              <th className="r">Xong</th>
              <th className="r">Đã giao</th>
              <th className="r">Giao nay</th>
            </tr>
          </thead>
          <tbody>
            {d.nguon.map((r) => {
              const v = d.giao[r.component_id] ?? ''
              const over = num(v) > r.on_hand
              return (
                <tr key={r.component_id} className="d">
                  <td
                    title={`${r.product_code} · ${r.cluster ? `${r.cluster} · ` : ''}${r.name} · tồn ${fmt(r.on_hand)}`}
                  >
                    {r.cluster && <span className="mut">{r.cluster} · </span>}
                    {r.name} <span className="ma mut">{r.product_code}</span>
                  </td>
                  <td className={cx('r num', r.done === 0 && 'empty')}>{fmt(r.done)}</td>
                  <td className={cx('r num', r.shipped === 0 && 'empty')}>
                    {fmt(r.shipped)}
                  </td>
                  <td
                    className={cx('r ed', over && 'warn')}
                    title={
                      over
                        ? `Vượt tồn ${fmt(r.on_hand)} — vẫn gửi được, kiểm lại`
                        : undefined
                    }
                  >
                    <input
                      className="sx-cell num"
                      type="text"
                      inputMode="decimal"
                      value={v}
                      placeholder={r.on_hand > 0 ? fmt(r.on_hand) : ''}
                      onChange={(e) =>
                        d.setGiao((g) => ({ ...g, [r.component_id]: e.target.value }))
                      }
                      aria-label={`Giao ${r.name}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                Giao ≤ xong − đã giao
                <span className="mut" style={{ fontWeight: 400 }}>
                  {' '}
                  (vượt: cảnh báo)
                </span>
              </td>
              <td className="r num">{fmt(d.tongGiao)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="sx-cb">
        <span className="sum">
          <b>{d.dongGiao.length}</b> dòng · <b>{fmt(d.tongGiao)}</b>
          {d.vuotTon.length > 0 && (
            <span className="warn"> · {d.vuotTon.length} dòng vượt tồn</span>
          )}
        </span>
        {d.guiWhy && <span className="sx-why">{d.guiWhy}</span>}
        <span className="sp">
          <button
            type="button"
            className="sx-btn p"
            onClick={d.guiPhieu}
            disabled={!!d.guiWhy || d.busy}
            aria-busy={d.busy || undefined}
          >
            {d.busy ? 'Đang gửi…' : 'Gửi phiếu'}
          </button>
        </span>
      </div>
      <div className="sx-fine">
        <b>Sau khi gửi:</b> {d.toTeam?.name ?? 'tổ nhận'} thấy ở “Chờ tôi nhận”; chưa nhận
        thì tổ giao huỷ được; đã nhận thì chỉ đảo bằng phiếu ngược, có lý do.
      </div>
    </div>
  )
}
