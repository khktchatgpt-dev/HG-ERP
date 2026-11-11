'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import {
  CHIPS,
  chuO,
  cotDai,
  cx,
  fmt,
  khop,
  lenhBatDau,
  maGon,
  mocHan,
  oToHan,
  sapXep,
  trangThai,
  viecKeTiep,
  type DsRow,
} from './danh-sach.shared'

/**
 * DANH SÁCH GIAO TỔ & HẠN — khuôn C, dựng lại KHÔNG kit theo bản vẽ 1
 * (11/11/2026, https://claude.ai/artifact/CAmsvjowophhfMkNmANiu9, duyệt Q1–Q6).
 *
 * Trả lời: "lệnh nào tôi giao được ngay, lệnh nào đang chờ người khác?". Thay
 * màn kit `PlanList` (5 ô KPI + 7 cột, trong đó Ưu tiên 17/17 = 0, Dự kiến
 * xong 17/17 = "—", "n/n công đoạn xong" không có sổ). Bỏ theo Q1–Q2–Q6; dải
 * "Tổ & hạn" theo công đoạn lệnh đi qua (Q3); lệnh chưa định hình giữ trong
 * bảng, mờ, nút "Nhắc KT ›" (Q4); lệnh định hình một phần ở "Chưa giao tổ"
 * (Q5). Mọi số đã tính ở server; client chỉ lọc + sắp.
 */
export function GiaoToDanhSachScreen({
  rows,
  stages,
  initialChip,
  today,
}: {
  rows: DsRow[]
  stages: { code: string; label: string }[]
  initialChip: string
  /** yyyy-mm-dd theo giờ VN, tính ở server — client không đọc đồng hồ máy. */
  today: string
}) {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState(initialChip)

  const counts = useMemo(
    () => Object.fromEntries(CHIPS.map((c) => [c.id, rows.filter(c.test).length])),
    [rows],
  )
  const shown = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test ?? (() => true)
    return sapXep(rows.filter((r) => test(r) && khop(r, q)))
  }, [rows, q, chip])

  const labelOf = (code: string) => stages.find((s) => s.code === code)?.label ?? code
  const cot = useMemo(() => cotDai(shown, stages), [shown, stages])
  const tongBo = shown.reduce((a, r) => a + r.sets_needed, 0)
  // Cùng vị từ với ô bước 4 ở Vào việc (`duongDiCuaLenh`: jobs_total === 0).
  const chuaDu = rows.filter((r) => r.jobs_total === 0).length
  const batDau = lenhBatDau(rows)
  const chipLabel = CHIPS.find((c) => c.id === chip)?.label ?? ''

  return (
    <SxKhung label="Giao tổ và hạn">
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất › Kế hoạch chuẩn bị"
          title="Giao tổ & hạn"
          ctx={
            <>
              <b>{fmt(rows.length)}</b> lệnh đang chạy · hôm nay <b>{dmy(today)}</b> ·{' '}
              <b>{fmt(chuaDu)}</b> chưa đủ tổ &amp; hạn
            </>
          }
          actions={
            <ApNhom>
              <ApNut href="/thongke/lenh">Lệnh sản xuất</ApNut>
              <ApNut href="/kehoach-sx/chi-tieu">Chỉ tiêu ngày</ApNut>
              <ApNut href="/thongke/lo-trinh">Lộ trình công đoạn</ApNut>
            </ApNhom>
          }
        />

        <div className="sx-hc" role="tablist" aria-label="Trạng thái">
          <label className="c srch">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã lệnh, khách, số đơn…"
              aria-label="Tìm lệnh"
            />
          </label>
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={chip === c.id}
              className={cx('c', chip === c.id && 'on', counts[c.id] === 0 && 'z')}
              onClick={() => setChip(c.id)}
            >
              {c.label} <b>{fmt(counts[c.id] ?? 0)}</b>
              {c.note && <span className="u">{c.note}</span>}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <Rong
            tieuDe={
              q.trim() ? 'Không lệnh nào khớp ô tìm' : `Không lệnh nào ở “${chipLabel}”`
            }
            lyDo={
              q.trim()
                ? `Không lệnh nào khớp “${q.trim()}”. Ô tìm soi mã lệnh, tên khách và số đơn.`
                : chip === 'du'
                  ? 'Chưa lệnh nào có đủ tổ và hạn cho mọi công đoạn.'
                  : 'Con số trên chip là 0 nên bảng trống đúng, không phải hỏng.'
            }
            tiep={
              !q.trim() && batDau ? (
                <p>
                  Bắt đầu từ lệnh trễ hạn xuất nhất:{' '}
                  <Link href={`/kehoach-sx/${batDau.id}`} className="lnk">
                    {maGon(batDau.code)} — giao tổ ›
                  </Link>{' '}
                  <span className="mut">
                    ({fmt(batDau.lines_shaped)}/{fmt(batDau.line_count)} dòng có bảng,{' '}
                    {fmt(batDau.stages.length)} công đoạn, {fmt(batDau.sets_needed)} bộ)
                  </span>
                </p>
              ) : (
                <button
                  type="button"
                  className="sx-btn"
                  onClick={() => {
                    setQ('')
                    setChip('all')
                  }}
                >
                  Xem tất cả lệnh
                </button>
              )
            }
          />
        ) : (
          <div className="sx-grid">
            {/* 1.260px: cột "Việc kế tiếp" ≥ 300px để câu thường một dòng; ở 1280 trừ
                sidebar gập (~1.220) cuộn ~40px, cột Lệnh ghim trái. */}
            <table className="sx-tb" style={{ minWidth: 1280 }}>
              <colgroup>
                <col style={{ width: 160 }} />
                <col style={{ width: 184 }} />
                <col style={{ width: 176 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: Math.max(120, cot.length * 16 + 48) }} />
                <col />
                <col style={{ width: 118 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="pin">Lệnh</th>
                  <th>Khách</th>
                  <th>Hạn xuất</th>
                  <th className="r">Dòng SP</th>
                  <th className="r">Bộ đặt</th>
                  <th>Tổ &amp; hạn theo công đoạn</th>
                  <th>Việc kế tiếp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <Dong key={r.id} r={r} cot={cot} labelOf={labelOf} today={today} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pin">Cộng {fmt(shown.length)} lệnh</td>
                  <td colSpan={3}></td>
                  <td className="r num">{tongBo > 0 ? fmt(tongBo) : '—'}</td>
                  <td colSpan={3} className="mut" style={{ fontWeight: 400 }}>
                    bộ đặt chỉ cộng dòng đã định hình · trễ hạn xuất xếp trước, rồi hạn
                    gần nhất
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <ThanhTT
          left={
            <>
              Chưa giao tổ &amp; hạn <b>{fmt(chuaDu)}</b> — cùng số với ô bước 4 ở Vào
              việc
            </>
          }
          right="ô = công đoạn lệnh đi qua · xanh = đủ tổ + hạn · vàng = thiếu tổ hoặc hạn · trống = chưa giao · sọc = không đi qua"
        />
      </div>
    </SxKhung>
  )
}

const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

function Dong({
  r,
  cot,
  labelOf,
  today,
}: {
  r: DsRow
  cot: string[]
  labelOf: (code: string) => string
  today: string
}) {
  const tt = trangThai(r)
  const han = mocHan(r.ship_date, today)
  const v = viecKeTiep(r, today, labelOf)
  const orders = r.order_codes
  const dongTone =
    r.lines_shaped > 0 && r.lines_shaped < r.line_count
      ? 'warn'
      : r.lines_shaped === 0
        ? 'mut'
        : null
  return (
    <tr className={cx('d', tt === 'cho_kt' && 'dim')}>
      <td
        className="pin"
        title={
          orders.length
            ? `${r.code} · ${fmt(orders.length)} đơn: ${orders.join(' · ')}`
            : r.code
        }
      >
        <Link href={`/kehoach-sx/${r.id}`} className="lnk ma">
          {r.code}
        </Link>
      </td>
      <td title={r.customer_name}>{r.customer_name}</td>
      <td
        className={cx(
          'num',
          han.tone === 'stop' && 'stop',
          han.tone === 'warn' && 'warn',
        )}
      >
        {han.text}
      </td>
      <td className={cx('r num', dongTone)}>
        {fmt(r.lines_shaped)}/{fmt(r.line_count)}
      </td>
      <td className={cx('r num', r.sets_needed === 0 && 'empty')}>
        {r.sets_needed > 0 ? fmt(r.sets_needed) : '—'}
      </td>
      <td>
        {tt === 'cho_kt' ? (
          <span className="mut">
            {r.lines_missing_bom > 0
              ? 'chưa có bảng chi tiết'
              : 'có định mức, chưa nạp bảng'}
          </span>
        ) : (
          <>
            <span className="sx-tz" role="img" aria-label={tomTatDai(r, cot, labelOf)}>
              {cot.map((s) => {
                const o = oToHan(r, s)
                return (
                  <i
                    key={s}
                    className={o === 'empty' ? undefined : o}
                    title={`${labelOf(s)}: ${TEN_O[o]}`}
                  >
                    {o === 'ok'
                      ? '✓'
                      : o === 'half'
                        ? '◐'
                        : o === 'empty'
                          ? chuO(labelOf(s))
                          : ''}
                  </i>
                )
              })}
            </span>
            <span className="mut num">
              {r.jobs_total === 0
                ? `0/${fmt(r.stages.length)}`
                : `${fmt(r.plan_stages.filter((p) => p.no_team === 0 && p.no_end === 0).length)}/${fmt(r.stages.length)}`}
            </span>
          </>
        )}
      </td>
      <td className="wrap" title={v.text}>
        <i
          className={cx(
            'sx-dot',
            v.tone === 'stop'
              ? 'r'
              : v.tone === 'warn'
                ? 'w'
                : v.tone === 'done'
                  ? 'g'
                  : undefined,
          )}
        />
        {v.text}
        {v.link && (
          <>
            {' '}
            <Link href={v.link.href} className="lnk">
              {v.link.label}
            </Link>
          </>
        )}
      </td>
      <td>
        <Link href={v.nut.href} className="lnk">
          {v.nut.label}
        </Link>
      </td>
    </tr>
  )
}

const TEN_O = {
  na: 'không đi qua',
  empty: 'chưa giao',
  half: 'thiếu tổ hoặc hạn',
  ok: 'đủ tổ và hạn',
} as const

function tomTatDai(r: DsRow, cot: string[], labelOf: (c: string) => string): string {
  return cot
    .map((s) => [s, oToHan(r, s)] as const)
    .filter(([, o]) => o !== 'na')
    .map(([s, o]) => `${labelOf(s)} ${TEN_O[o]}`)
    .join(', ')
}
