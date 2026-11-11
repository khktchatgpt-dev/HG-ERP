import type {
  ChiTieuCell,
  ChiTieuRow,
  ChiTieuWeek,
} from '@/modules/dept/production/targets.service'

/**
 * CHỈ TIÊU NGÀY — phần THUẦN của màn (bản vẽ 1 11/11/2026,
 * https://claude.ai/artifact/Y5UN1RKu11M9aMHW1hdCL1, duyệt Q1–Q7): khoá ô,
 * nhãn tuần, đọc số gõ, Σ tuần (ô gõ thắng số suy), câu chặn, ngày nào phải
 * ghi, payload từng ngày, "→ tuần". Không `'use client'` để test và trang dùng.
 *
 * Luật giữ nguyên từ màn cũ: ô TRỐNG = không giao (ba màn đọc số suy); ô 0 =
 * chỉ tiêu thật. Ngày đã qua chỉ đọc (Q4).
 */

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')
export const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export const keyOf = (team: string, stage: string, date: string) =>
  `${team}|${stage}|${date}`
export const rowKey = (r: Pick<ChiTieuRow, 'team_id' | 'stage'>) =>
  `${r.team_id}|${r.stage}`

/** Số tuần ISO của ngày (T2 là đầu tuần). */
export function isoWeek(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const y0 = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - y0) / 86_400_000 + 1) / 7)
}

/** "Tuần 46 · 10–16/11" (khác tháng: "27/10–02/11"; khác năm: thêm năm). */
export function weekLabel(days: string[]): { so: number; khoang: string } {
  const a = days[0]
  const b = days[6]
  const sameMonth = a.slice(0, 7) === b.slice(0, 7)
  const sameYear = a.slice(0, 4) === b.slice(0, 4)
  const khoang = !sameYear
    ? `${dmy(a)}–${dmy(b)}`
    : sameMonth
      ? `${a.slice(8, 10)}–${dm(b)}`
      : `${dm(a)}–${dm(b)}`
  return { so: isoWeek(a), khoang }
}

export type Draft = Record<string, string>

/** Nháp ban đầu = chỉ tiêu thật đã lưu, giữ dạng chữ để gõ tiếp. */
export function initialDraft(targets: ChiTieuCell[]): Draft {
  const d: Draft = {}
  for (const t of targets) d[keyOf(t.team_department_id, t.stage, t.date)] = String(t.qty)
  return d
}

export function cellMap(cells: ChiTieuCell[]): Map<string, number> {
  return new Map(cells.map((c) => [keyOf(c.team_department_id, c.stage, c.date), c.qty]))
}

/**
 * Đọc số gõ: "1.960" (nghìn kiểu VN) = 1960, "12,5" = 12.5; trống = null
 * (không giao); không đọc được → NaN để câu chặn chỉ ra.
 */
export function parseQty(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, '')
  if (s === '') return null
  const norm = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s.replace(',', '.')
  const n = Number(norm)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export type RowTotal = { sum: number; approx: boolean; empty: boolean }

/** Σ tuần một hàng: ô gõ thắng số suy cùng ngày; "≈" khi tổng còn chứa số suy. */
export function rowTotal(
  r: ChiTieuRow,
  days: string[],
  draft: Draft,
  derived: Map<string, number>,
): RowTotal {
  let sum = 0
  let approx = false
  let any = false
  for (const d of days) {
    const k = keyOf(r.team_id, r.stage, d)
    const typed = parseQty(draft[k] ?? '')
    if (typed != null && !Number.isNaN(typed)) {
      sum += typed
      any = true
      continue
    }
    const suy = derived.get(k)
    if (suy != null && suy > 0) {
      sum += suy
      approx = true
      any = true
    }
  }
  return { sum: Math.round(sum * 100) / 100, approx, empty: !any }
}

export type Blocker = { key: string; text: string }

/** Ô gõ không đọc được thành số ≥ 0 — câu bấm được nhảy tới ô. */
export function blockers(rows: ChiTieuRow[], days: string[], draft: Draft): Blocker[] {
  const out: Blocker[] = []
  for (const r of rows) {
    for (let i = 0; i < days.length; i++) {
      const k = keyOf(r.team_id, r.stage, days[i])
      const v = draft[k]
      if (v == null || v.trim() === '') continue
      if (Number.isNaN(parseQty(v))) {
        out.push({
          key: k,
          text: `${r.team_name} · ${THU[i]}: “${v.trim()}” không phải số ≥ 0`,
        })
      }
    }
  }
  return out
}

/** Những ngày (≥ hôm nay) có ô đổi so với lúc mở — mỗi ngày một lượt PUT. */
export function changedDays(
  rows: ChiTieuRow[],
  days: string[],
  today: string,
  draft: Draft,
  initial: Draft,
): string[] {
  const out: string[] = []
  for (const d of days) {
    if (d < today) continue
    const changed = rows.some((r) => {
      const k = keyOf(r.team_id, r.stage, d)
      return (draft[k] ?? '').trim() !== (initial[k] ?? '').trim()
    })
    if (changed) out.push(d)
  }
  return out
}

/**
 * Payload ghi đè MỘT ngày: mọi ô có số của các hàng đang bày + chỉ tiêu đã lưu
 * của cặp (tổ × công đoạn) KHÔNG có hàng (không xoá thứ mình không thấy).
 */
export function payloadForDay(
  date: string,
  rows: ChiTieuRow[],
  draft: Draft,
  saved: ChiTieuCell[],
): { team_department_id: string; stage: string; qty: number }[] {
  const out: { team_department_id: string; stage: string; qty: number }[] = []
  const shown = new Set(rows.map(rowKey))
  for (const r of rows) {
    const q = parseQty(draft[keyOf(r.team_id, r.stage, date)] ?? '')
    if (q == null || Number.isNaN(q)) continue
    out.push({ team_department_id: r.team_id, stage: r.stage, qty: q })
  }
  for (const t of saved) {
    if (t.date !== date) continue
    if (shown.has(`${t.team_department_id}|${t.stage}`)) continue
    out.push({ team_department_id: t.team_department_id, stage: t.stage, qty: t.qty })
  }
  return out
}

/**
 * "→ tuần": chép ô ĐẦU TIÊN có số (từ hôm nay) sang các ngày còn lại trống của
 * hàng — không đè ô đã gõ. Không có ô nào có số → trả nháp cũ.
 */
export function fillWeek(
  r: ChiTieuRow,
  days: string[],
  today: string,
  draft: Draft,
): Draft {
  const live = days.filter((d) => d >= today)
  const src = live.find((d) => (draft[keyOf(r.team_id, r.stage, d)] ?? '').trim() !== '')
  if (!src) return draft
  const v = draft[keyOf(r.team_id, r.stage, src)]
  const next = { ...draft }
  for (const d of live) {
    const k = keyOf(r.team_id, r.stage, d)
    if ((next[k] ?? '').trim() === '') next[k] = v
  }
  return next
}

/** Số ô đã gõ (có chữ) ở ngày ≥ hôm nay — chữ "n ô đã giao" ở đầu trang. */
export function countTyped(
  rows: ChiTieuRow[],
  days: string[],
  today: string,
  draft: Draft,
): number {
  let n = 0
  for (const r of rows)
    for (const d of days)
      if (d >= today && (draft[keyOf(r.team_id, r.stage, d)] ?? '').trim() !== '') n++
  return n
}

/** Dán vùng (hàng × cột) từ ô (r0, c0) xuống phải/dưới, chỉ ngày ≥ hôm nay. */
export function applyPaste(
  grid: string[][],
  r0: number,
  c0: number,
  rows: ChiTieuRow[],
  days: string[],
  today: string,
  draft: Draft,
): Draft {
  const next = { ...draft }
  for (let i = 0; i < grid.length; i++) {
    const r = rows[r0 + i]
    if (!r) break
    for (let j = 0; j < grid[i].length; j++) {
      const d = days[c0 + j]
      if (!d) break
      if (d < today) continue
      next[keyOf(r.team_id, r.stage, d)] = grid[i][j].trim()
    }
  }
  return next
}

export type Week = ChiTieuWeek
