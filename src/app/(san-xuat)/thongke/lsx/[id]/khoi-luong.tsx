'use client'

import { byUnitText, sortByUnit, teamText } from '@/lib/khoi-luong'
import type { KlStage } from '@/lib/khoi-luong'
import { tenNgan } from '@/lib/ho-so-lenh'
import { cx, fmt } from './ho-so-lenh.shared'
import type { HoSoLenhCtx } from './useHoSoLenh'

/**
 * DẢI CÔNG ĐOẠN — một hàng ô, mỗi ô một công đoạn lệnh ĐI QUA (bản vẽ gọn
 * 12/11/2026, https://claude.ai/artifact/T2otDmrhZce8LZSmow3itu, Q3): thay cả
 * dải 5 ô số lẫn khối "Khối lượng theo công đoạn" 12 ô × 4 dòng của 09/11.
 *
 * Ô = tên · % · cần (đơn vị chính, đơn vị phụ nhỏ) · thanh. Tổ & hạn chỉ hiện
 * khi đã giao — "chưa giao tổ & hạn" nói MỘT lần ở dòng việc phải làm, không
 * lặp chín lần. Bấm ô → bảng bên dưới tô cột đó. Số từ `lib/khoi-luong` (cùng
 * `tallyLineStages` với Lệnh sản xuất), màn này không cộng lại gì.
 */
export function DaiCongDoan({ d }: { d: HoSoLenhCtx }) {
  const k = d.data.khoi_luong
  if (k.stages.length === 0) return null
  return (
    <div
      className="sx-dcd"
      role="list"
      aria-label="Tiến độ theo công đoạn"
      style={{ gridTemplateColumns: `repeat(${k.stages.length}, minmax(0, 1fr))` }}
    >
      {k.stages.map((s) => (
        <O key={s.code} d={d} s={s} />
      ))}
    </div>
  )
}

const ngan = (u: string) => (u === 'chi tiết' ? 'ct' : u)

function O({ d, s }: { d: HoSoLenhCtx; s: KlStage }) {
  const units = sortByUnit(s.by_unit)
  const main = units[0]
  const p = s.needed > 0 ? Math.min(s.done / s.needed, 1) : 0
  const pct = Math.round(p * 100)
  const team = teamText(s)
  const on = d.congDoanChon === s.code
  const tip = [
    `${s.label}: cần ${byUnitText(units)} · đạt ${fmt(s.done)}`,
    s.jobs > 0 ? team.text : 'chưa giao tổ & hạn',
    main?.level === 'cluster' && main.unit !== 'cụm' ? 'đếm theo cụm mặc nhiên' : null,
    s.unassigned_qty > 0 ? `${fmt(s.unassigned_qty)} chi tiết chưa gán cụm` : null,
    'bấm để tô cột ở bảng',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      type="button"
      role="listitem"
      className={cx('c', on && 'sel')}
      onClick={() => d.chonCongDoan(s.code)}
      title={tip}
      aria-pressed={on}
    >
      <span className="h">
        <b>{tenNgan(s.label)}</b>
        <span className={cx('p num', s.done === 0 ? 'empty' : pct >= 100 && 'ok')}>
          {s.done === 0 ? '·' : `${pct === 100 && s.done < s.needed ? 99 : pct}%`}
        </span>
      </span>
      {main && (
        <span className="n num">
          {fmt(main.needed)} <small>{main.unit}</small>
          {units.slice(1).map((u) => (
            <small key={u.level + u.unit} className="u2">
              {' '}
              +{fmt(u.needed)} {ngan(u.unit)}
            </small>
          ))}
        </span>
      )}
      <span className="bar">
        <s className={pct >= 100 ? 'f' : undefined} style={{ width: `${pct}%` }} />
      </span>
      {s.jobs > 0 && (
        <span className={cx('t', team.tone === 'warn' && 'warn')}>{team.text}</span>
      )}
    </button>
  )
}
