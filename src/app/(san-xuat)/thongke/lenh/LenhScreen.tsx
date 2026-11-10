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
import { isStale } from '@/lib/lsx-holder'
import { VIEWS } from './views'
import {
  cx,
  daysBetween,
  dmy,
  dueText,
  fmt,
  snagOf,
  stripOf,
  type SnagGo,
} from './lenh.shared'
import type { OverviewRow } from '@/modules/dept/production/jobs.service'

/**
 * LỆNH SẢN XUẤT — khuôn C, dựng lại KHÔNG kit theo bản vẽ 1 (06/11/2026,
 * https://claude.ai/artifact/1p2dxqkXRUpg5cZU4AaSjy, duyệt cả sáu đề xuất).
 *
 * Trả lời: "trong các lệnh đang chạy, cái nào cần tôi động vào?". Nguồn số
 * `jobsService.overview` — cùng hàm với Tình hình xưởng, nên ô việc bên đó dẫn
 * `?view=` sang đây ra đúng chừng ấy dòng. Chip lọc đếm bằng ĐÚNG hàm lọc
 * (`views.ts`).
 *
 * Ba chỗ sửa so với màn kit cũ: cột "Vướng gì" kèm link tới màn gỡ (Q1); mỗi
 * lệnh đúng MỘT hàng 26px — mã đơn chỉ ở tooltip + ô tìm (Q2); chú giải dải 12
 * ô công đoạn ở thanh trạng thái (Q3). Cột Lệnh ghim trái khi cuộn ngang (Q5);
 * bảng cần 1.480px, ở 1280 cuộn ~400px — chấp nhận (Q6).
 */

/** Màn gỡ của từng câu vướng (lenh.shared `SnagGo`) → href. */
function goHref(go: SnagGo, id: string): string {
  switch (go) {
    case 'vat-tu':
      // Khu Sản xuất chưa có màn vật tư theo lệnh (xem lenh.shared `SnagGo`).
      return `/thongke/lsx/${id}`
    case 'lo-trinh':
      return `/thongke/lo-trinh?lsx=${id}`
    case 'giao-to':
      return `/kehoach-sx?lsx=${id}`
    case 'ghi-so':
      return `/thongke/ghi?lsx=${id}`
    default:
      return `/thongke/lsx/${id}`
  }
}

export function LenhScreen({
  rows,
  stages,
  canRecord,
  initialView,
  today,
}: {
  rows: OverviewRow[]
  stages: { code: string; label: string }[]
  canRecord: boolean
  /** Khung nhìn mở sẵn khi tới từ một ô việc (?view=). */
  initialView?: string
  /** yyyy-mm-dd theo giờ VN, tính ở server — client không đọc đồng hồ máy. */
  today: string
}) {
  const [q, setQ] = useState('')
  const [view, setView] = useState(initialView ?? 'all')

  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.id, rows.filter(v.test).length])),
    [rows],
  )
  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const test = VIEWS.find((v) => v.id === view)?.test ?? (() => true)
    return rows.filter(
      (r) =>
        test(r) &&
        (!kw ||
          `${r.lsx.code} ${r.lsx.customer_name} ${r.lsx.order_codes.join(' ')}`
            .toLowerCase()
            .includes(kw)),
    )
  }, [rows, q, view])

  const totalSets = shown.reduce((a, r) => a + r.qty_needed, 0)
  const doneSets = shown.reduce((a, r) => a + r.qty_done, 0)
  const pctAll = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : null

  return (
    <SxKhung bare label="Lệnh sản xuất">
      <div className="sx-body">
        <DauTrang
          title="Lệnh sản xuất"
          ctx={
            <>
              <b>{fmt(rows.length)}</b> lệnh đang chạy · hôm nay <b>{dmy(today)}</b>
            </>
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/production">Vào việc</ApNut>
                <ApNut href="/thongke/lo-trinh">Lộ trình công đoạn</ApNut>
                <ApNut href="/kehoach-sx">Giao tổ &amp; hạn</ApNut>
              </ApNhom>
              {canRecord && (
                <ApNhom>
                  <ApNut primary href="/thongke/ghi">
                    Ghi sản lượng
                  </ApNut>
                </ApNhom>
              )}
            </>
          }
        />

        <div className="sx-hc" role="tablist" aria-label="Khung nhìn">
          <label className="c srch">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã lệnh, khách, số đơn…"
              aria-label="Tìm lệnh"
            />
          </label>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              className={cx('c', view === v.id && 'on', counts[v.id] === 0 && 'z')}
              onClick={() => setView(v.id)}
            >
              {v.label} <b>{fmt(counts[v.id] ?? 0)}</b>
            </button>
          ))}
          <span className="sp">
            chip đếm bằng đúng hàm lọc · cùng số với ô việc ở Tình hình xưởng
          </span>
        </div>

        {shown.length === 0 ? (
          <Rong
            tieuDe="Không có lệnh nào ở khung nhìn này"
            lyDo={
              q.trim()
                ? `Không lệnh nào khớp “${q.trim()}”. Ô tìm soi mã lệnh, tên khách và số đơn.`
                : 'Khung nhìn đang lọc hẹp — con số trên chip là 0 nên bảng trống đúng, không phải hỏng.'
            }
            tiep={
              <button
                type="button"
                className="sx-btn"
                onClick={() => {
                  setQ('')
                  setView('all')
                }}
              >
                Xem tất cả lệnh
              </button>
            }
          />
        ) : (
          <div className="sx-grid">
            <table className="sx-tb" style={{ minWidth: 1480 }}>
              <colgroup>
                <col style={{ width: 168 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 156 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 132 }} />
                <col />
                <col style={{ width: 76 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="pin">Lệnh</th>
                  <th>Khách</th>
                  <th>Hạn xuất</th>
                  <th>Công đoạn ({stages.length} ô)</th>
                  <th className="r">Bộ xong</th>
                  <th>Dự kiến xong</th>
                  <th>Ai đang giữ</th>
                  <th>Vướng gì → gỡ ở đâu</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <DongLenh
                    key={r.lsx.id}
                    r={r}
                    stages={stages}
                    canRecord={canRecord}
                    today={today}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pin">Cộng {fmt(shown.length)} lệnh</td>
                  <td colSpan={3}></td>
                  <td className="r num">{pctAll == null ? '—' : `${pctAll}%`}</td>
                  <td colSpan={4} className="mut" style={{ fontWeight: 400 }}>
                    “Bộ xong” = Σ đã làm / Σ cần của mọi công đoạn (chính thức) — không
                    phải số bộ đã đóng gói
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <ThanhTT
          left={
            <>
              Dải công đoạn: ô sọc = không trong lộ trình · ô xám = có trong lộ trình,
              chưa có sổ · tô dần theo % đạt · <b>{stages.length}</b> ô theo danh mục, thứ
              tự cố định
            </>
          }
          right={
            <>
              nguồn <b>jobsService.overview</b> — cùng hàm với Tình hình xưởng
            </>
          }
        />
      </div>
    </SxKhung>
  )
}

function DongLenh({
  r,
  stages,
  canRecord,
  today,
}: {
  r: OverviewRow
  stages: { code: string; label: string }[]
  canRecord: boolean
  today: string
}) {
  const d = r.lsx.ship_date ? daysBetween(today, r.lsx.ship_date) : null
  const due = d == null ? null : dueText(d)
  const s = snagOf(r, canRecord)
  const strip = stripOf(r.chips, stages)
  const pct = r.qty_needed > 0 ? Math.round((r.qty_done / r.qty_needed) * 100) : null
  const stale = r.holder.days != null && !r.holder.closed && isStale(r.holder)
  const orders = r.lsx.order_codes
  return (
    <tr className="d">
      <td
        className="pin"
        title={
          orders.length
            ? `${r.lsx.code} · ${fmt(orders.length)} đơn: ${orders.join(' · ')}`
            : r.lsx.code
        }
      >
        <Link href={`/thongke/lsx/${r.lsx.id}`} className="lnk ma">
          {r.lsx.code}
        </Link>
      </td>
      <td title={r.lsx.customer_name}>{r.lsx.customer_name}</td>
      <td>
        {r.lsx.ship_date && due ? (
          <>
            <span className="num">{dmy(r.lsx.ship_date)}</span>{' '}
            <span
              className={cx(
                due.tone === 'stop' && 'stop',
                due.tone === 'warn' && 'warn',
                !due.tone && 'mut',
              )}
            >
              {due.tone ? <b>{due.text}</b> : due.text}
            </span>
          </>
        ) : (
          <span className="mut">chưa có hạn</span>
        )}
      </td>
      <td>
        <span className="sx-strip" role="img" aria-label={strip.summary}>
          {strip.cells.map((c) =>
            c.pct == null ? (
              <i key={c.stage} className="x" title={c.title} />
            ) : (
              <i key={c.stage} title={c.title}>
                <b
                  className={c.pct >= 100 ? 'f' : undefined}
                  style={{ height: `${Math.max(c.pct, c.pct > 0 ? 12 : 0)}%` }}
                />
              </i>
            ),
          )}
        </span>
      </td>
      <td className={cx('r', pct == null && 'empty')}>
        {pct == null ? (
          '—'
        ) : (
          <>
            <span className="sx-pct">
              <b className={pct >= 100 ? 'f' : undefined} style={{ width: `${pct}%` }} />
            </span>
            <span className="num">{pct}%</span>
          </>
        )}
      </td>
      <td className={cx(!r.forecast_date && 'mut')}>
        {r.forecast_date ? (
          <span className="num">{dmy(r.forecast_date)}</span>
        ) : (
          // Không bịa ngày: chưa có nhịp ghi sổ thì không suy được.
          'chưa có sổ'
        )}
      </td>
      <td title={r.holder.what}>
        {r.holder.who}
        {r.holder.days != null && !r.holder.closed && (
          <>
            {' '}
            <span className={cx('num', stale ? 'warn' : 'mut')}>
              {r.holder.days === 0 ? 'hôm nay' : `${fmt(r.holder.days)}đ`}
            </span>
          </>
        )}
      </td>
      <td title={s.text}>
        <i
          className={cx(
            'sx-dot',
            s.tone === 'stop' ? 'r' : s.tone === 'warn' ? 'w' : 'g',
          )}
        />
        {s.text} ·{' '}
        <Link href={goHref(s.go, r.lsx.id)} className="lnk">
          {s.goLabel} ›
        </Link>
      </td>
      <td>
        <Link href={`/thongke/lsx/${r.lsx.id}`} className="lnk">
          Mở ›
        </Link>
      </td>
    </tr>
  )
}
