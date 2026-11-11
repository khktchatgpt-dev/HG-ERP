'use client'

import Link from 'next/link'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { useChiTieu, type ChiTieuCtx } from './useChiTieu'
import {
  cx,
  dm,
  dmy,
  fmt,
  keyOf,
  parseQty,
  rowTotal,
  THU,
  weekLabel,
  type Week,
} from './chi-tieu.shared'
import type { ChiTieuRow } from '@/modules/dept/production/targets.service'

/**
 * CHỈ TIÊU NGÀY — khuôn F, dựng lại KHÔNG kit theo bản vẽ 1 (11/11/2026,
 * https://claude.ai/artifact/Y5UN1RKu11M9aMHW1hdCL1, duyệt Q1–Q7).
 *
 * Trả lời: "tuần này mỗi tổ phải ra bao nhiêu mỗi ngày — và chỗ nào tôi muốn
 * nói khác số máy suy?". Thay màn kit TargetsGrid (một ngày × 13 tổ × 12 công
 * đoạn = 156 ô, 10 ô có nghĩa, 0 dòng sau ba tháng). Một hàng là một tổ ở công
 * đoạn của nó (Q1–Q2), ô trống bày số suy mờ làm placeholder (Q3), ngày đã qua
 * chỉ đọc đạt / chỉ tiêu (Q4), Σ cộng ngang theo hàng, không cộng dọc (Q5),
 * "→ tuần" + dán Excel thay "áp dụng đến ngày" (Q7). Màn Kế hoạch tuần cũ gộp
 * vào đây và xoá (Q6).
 */
export function ChiTieuScreen({ week, canEdit }: { week: Week; canEdit: boolean }) {
  const d = useChiTieu(week, canEdit)
  const { days, today, rows } = week
  const wk = weekLabel(days)
  const inWeek = today >= days[0] && today <= days[6]

  return (
    <SxKhung label="Chỉ tiêu ngày">
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất › Kế hoạch chuẩn bị"
          title="Chỉ tiêu ngày"
          ctx={
            <>
              tuần <b>{wk.khoang}</b> · {fmt(rows.length)} tổ · <b>{fmt(d.typed)}</b>
              {' ô đã giao · số suy từ Giao tổ & hạn'}
            </>
          }
          actions={
            <ApNhom>
              <ApNut href="/kehoach-sx">Giao tổ &amp; hạn</ApNut>
              <ApNut href="/production">Vào việc</ApNut>
              <ApNut href="/thongke/bao-cao">Báo cáo</ApNut>
            </ApNhom>
          }
        />

        <div className="sx-hc" aria-label="Chọn tuần">
          <button type="button" className="c" onClick={() => d.goWeek(-1)}>
            ‹ tuần trước
          </button>
          <span className="c on">
            <b>Tuần {wk.so}</b> · {wk.khoang}
          </span>
          <button type="button" className="c" onClick={() => d.goWeek(1)}>
            tuần sau ›
          </button>
          {!inWeek && (
            <button type="button" className="c" onClick={d.goToday}>
              Hôm nay
            </button>
          )}
          <span className="sp">
            {canEdit
              ? 'gõ số rồi Tab · Ctrl+V dán vùng từ Excel · trống = dùng số suy · 0 = tổ làm việc khác'
              : 'trống = dùng số suy · 0 = tổ làm việc khác'}
          </span>
        </div>

        {(week.jobs_with_end === 0 || week.stages_without_team.length > 0) && (
          <div className="sx-note">
            {week.jobs_with_end === 0 && (
              <span>
                Số suy trống cả tuần: <b>0 việc có hạn</b> —{' '}
                <Link href="/kehoach-sx" className="lnk">
                  Giao tổ &amp; hạn ›
                </Link>{' '}
                trước, số suy tự hiện.
              </span>
            )}
            {week.stages_without_team.length > 0 && (
              <span>
                {fmt(week.stages_without_team.length)} công đoạn chưa có tổ:{' '}
                <b>{week.stages_without_team.join(' · ')}</b> —{' '}
                <Link href="/production/cau-hinh/cong-doan" className="lnk">
                  Cấu hình công đoạn ›
                </Link>
              </span>
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <Rong
            tieuDe="Chưa tổ nào gắn công đoạn"
            lyDo="Chỉ tiêu ghi theo (tổ × công đoạn của tổ). Gắn công đoạn cho từng tổ xong là hàng tự hiện."
            tiep={
              <Link href="/production/cau-hinh/cong-doan" className="sx-btn">
                Cấu hình công đoạn
              </Link>
            }
          />
        ) : (
          <div className="sx-grid">
            <table className="sx-tb sx-ct" style={{ minWidth: 1060 }}>
              <colgroup>
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                {days.map((x) => (
                  <col key={x} style={{ width: 86 }} />
                ))}
                <col style={{ width: 92 }} />
                <col style={{ width: 70 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="pin">Tổ</th>
                  <th>Công đoạn · đơn vị</th>
                  {days.map((x, i) => (
                    <th key={x} className={cx('r', x === today && 'today')}>
                      {THU[i]}
                      <span className="u">
                        {dm(x)}
                        {x === today ? ' · hôm nay' : x < today ? ' · đã qua' : ''}
                      </span>
                    </th>
                  ))}
                  <th className="r">
                    Σ tuần<span className="u">chỉ tiêu</span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <Hang key={`${r.team_id}|${r.stage}`} d={d} r={r} idx={i} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pin">{fmt(rows.length)} tổ</td>
                  <td
                    colSpan={days.length + 3}
                    className="mut"
                    style={{ fontWeight: 400 }}
                  >
                    không cộng dọc theo ngày — chi tiết, cụm, bộ là ba đơn vị · Σ tuần
                    cộng ngang từng hàng
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <ThanhChot d={d} />

        <ThanhTT
          left="Vào việc, Tổ hôm nay, Báo cáo đọc đúng số này: ô có gõ thắng số suy, kể cả 0"
          right={
            week.teams_without_stage.length > 0
              ? `${fmt(week.teams_without_stage.length)} tổ không gắn công đoạn không bày: ${week.teams_without_stage.join(' · ')}`
              : undefined
          }
        />
      </div>
    </SxKhung>
  )
}

function Hang({ d, r, idx }: { d: ChiTieuCtx; r: ChiTieuRow; idx: number }) {
  const { days, today } = d.week
  const tot = rowTotal(r, days, d.draft, d.derived)
  const errKeys = new Set(d.blk.map((b) => b.key))
  const coSo = days.some(
    (x) => x >= today && (d.draft[keyOf(r.team_id, r.stage, x)] ?? '').trim() !== '',
  )
  return (
    <tr className="d">
      <td className="pin" style={{ fontWeight: 600 }}>
        {r.team_name}
      </td>
      <td>
        {r.stage_label} <span className="mut">· {r.unit}</span>
      </td>
      {days.map((x, c) => {
        const k = keyOf(r.team_id, r.stage, x)
        if (x < today) {
          const done = d.done.get(k)
          const sv = d.saved.get(k)
          return (
            <td
              key={x}
              className="ro"
              title={`${THU[c]} ${dmy(x)}: đạt ${fmt(done ?? 0)} / chỉ tiêu ${sv == null ? 'không giao' : fmt(sv)}`}
            >
              <b>{fmt(done ?? 0)}</b>{' '}
              <span className="m">/ {sv == null ? '—' : fmt(sv)}</span>
            </td>
          )
        }
        const v = d.draft[k] ?? ''
        const suy = d.derived.get(k)
        const q = parseQty(v)
        return (
          <td
            key={x}
            className={cx(
              'ed',
              x === today && 'today',
              v.trim() !== '' && 'go',
              q === 0 && 'nghi',
              errKeys.has(k) && 'err',
            )}
          >
            <input
              className="sx-cell num suy"
              type="text"
              inputMode="decimal"
              value={v}
              placeholder={suy != null && suy > 0 ? `≈${fmt(Math.round(suy))}` : '—'}
              disabled={!d.canEdit}
              onChange={(e) => d.setCell(k, e.target.value)}
              data-cell={`${idx}:${c}`}
              data-key={k}
              onKeyDown={d.onCellKey(idx, c)}
              onPaste={d.onCellPaste(idx, c)}
              aria-label={`${r.team_name} ${THU[c]} ${dmy(x)}`}
              title={
                suy != null && suy > 0
                  ? `Số suy ${fmt(suy)} ${r.unit}/ngày từ Giao tổ & hạn — gõ để nói khác`
                  : undefined
              }
            />
          </td>
        )
      })}
      <td className={cx('r num', tot.empty && 'empty')}>
        {tot.empty ? '—' : `${tot.approx ? '≈' : ''}${fmt(tot.sum)}`}
      </td>
      <td>
        {d.canEdit && coSo && (
          <button
            type="button"
            className="lnk"
            onClick={() => d.fill(r)}
            title="Chép ô đầu tiên có số sang các ngày còn trống của hàng"
          >
            → tuần
          </button>
        )}
      </td>
    </tr>
  )
}

function ThanhChot({ d }: { d: ChiTieuCtx }) {
  const { days } = d.week
  const b = d.blk[0]
  const coTheLuu = d.canEdit && !b && d.dirtyDays.length > 0 && !d.busy
  return (
    <div className="sx-cb">
      {!d.canEdit ? (
        <span className="mut">Bạn xem được nhưng không sửa — quyền Kế hoạch SX</span>
      ) : b ? (
        <span className="blk">
          {b.text}
          <button type="button" className="lnk" onClick={() => d.focusKey(b.key)}>
            sửa ô ›
          </button>
        </span>
      ) : d.dirtyDays.length === 0 ? (
        d.msg ? (
          <span className={d.msg.ok ? 'ok' : 'blk'}>{d.msg.text}</span>
        ) : (
          <span className="mut">Chưa đổi ô nào</span>
        )
      ) : d.msg && !d.msg.ok ? (
        <span className="blk">{d.msg.text}</span>
      ) : (
        <span className="sum">
          <b>{fmt(d.dirtyCells)}</b> ô đổi · ghi {fmt(d.dirtyDays.length)} ngày (
          {d.dirtyDays.map((x) => THU[days.indexOf(x)]).join(' · ')}) — ô trống không ghi,
          ngày đã qua không đụng
        </span>
      )}
      {d.canEdit && (
        <span className="sp">
          {d.dirtyDays.length > 0 && (
            <button type="button" className="sx-btn" onClick={d.bo} disabled={d.busy}>
              Bỏ
            </button>
          )}
          <button
            type="button"
            className="sx-btn p"
            onClick={() => void d.save()}
            disabled={!coTheLuu}
            aria-busy={d.busy || undefined}
          >
            {d.busy ? 'Đang lưu…' : `Lưu tuần ${weekLabel(days).khoang}`}
          </button>
        </span>
      )}
    </div>
  )
}
