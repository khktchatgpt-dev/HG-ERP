/**
 * GIỜ CÔNG · KG · NĂNG SUẤT của một phiếu báo sản lượng (0296, 11/11/2026).
 *
 * Thuần, không chạm DB — màn Ghi sản lượng, Hồ sơ lệnh và service dùng chung.
 *
 * Giờ công thuộc về ĐẦU PHIẾU (tổ × ngày × ca × công đoạn), không thuộc từng
 * dòng: sổ Excel cũ chép số CN × giờ lên mỗi dòng chi tiết nên một tổ 4 người
 * × 7 giờ thành 2.716 giờ công một ngày (14/09, 97 dòng Sơn). Năng suất luôn là
 * Σ kg ÷ Σ giờ công — không lấy trung bình của các tỉ số.
 */

export const CREW_MAX_WORKERS = 500
export const CREW_MAX_HOURS = 24

export type Crew = {
  shift: number | null
  worker_count: number | null
  hours_per_worker: number | null
}

/** Ô gõ trên dải chip: chuỗi thô như người dùng gõ ("3,5" là 3,5 giờ). */
export type CrewInput = { shift: string; workers: string; hours: string }

const parseVn = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** Chuỗi gõ → số cho API. Ô trống → null; gõ bậy → NaN (để `crewProblem` bắt). */
export function parseCrew(input: CrewInput): Crew {
  return {
    shift: parseVn(input.shift),
    worker_count: parseVn(input.workers),
    hours_per_worker: parseVn(input.hours),
  }
}

/** Giờ công = số CN × giờ/người, làm tròn 2 số lẻ. Thiếu một vế → null. */
export function laborHours(
  c: Pick<Crew, 'worker_count' | 'hours_per_worker'>,
): number | null {
  const w = c.worker_count
  const h = c.hours_per_worker
  if (w == null || h == null || !Number.isFinite(w) || !Number.isFinite(h)) return null
  if (w <= 0 || h <= 0) return null
  return Math.round(w * h * 100) / 100
}

export type CrewProblem = {
  /** true = ô TRỐNG (chặn Ghi sổ, không chặn Lưu nháp); false = gõ SAI (chặn cả hai). */
  missing: boolean
  field: 'workers' | 'hours' | 'shift'
  msg: string
}

/** Lỗi đầu tiên của bộ giờ công — null là dùng được để ghi chính thức. */
export function crewProblem(c: Crew): CrewProblem | null {
  if (c.shift != null && (!Number.isInteger(c.shift) || c.shift < 1 || c.shift > 3)) {
    return { missing: false, field: 'shift', msg: 'ca phải là 1, 2 hoặc 3' }
  }
  const w = c.worker_count
  if (w != null && (!Number.isInteger(w) || w < 1 || w > CREW_MAX_WORKERS)) {
    return {
      missing: false,
      field: 'workers',
      msg: `số công nhân phải là số nguyên 1–${CREW_MAX_WORKERS}`,
    }
  }
  const h = c.hours_per_worker
  if (h != null && (!Number.isFinite(h) || h <= 0 || h > CREW_MAX_HOURS)) {
    return {
      missing: false,
      field: 'hours',
      msg: `giờ mỗi người phải từ 0,5 đến ${CREW_MAX_HOURS}`,
    }
  }
  if (w == null)
    return { missing: true, field: 'workers', msg: 'chưa ghi số công nhân của tổ' }
  if (h == null) return { missing: true, field: 'hours', msg: 'chưa ghi giờ mỗi người' }
  return null
}

/** Năng suất kg/giờ-người. Không có giờ công hoặc kg = 0 → null (không bịa số 0). */
export function productivity(kg: number, hours: number | null): number | null {
  if (hours == null || hours <= 0 || kg <= 0) return null
  return Math.round((kg / hours) * 10) / 10
}

/**
 * Kg của các dòng phiếu: kg gõ tay thắng, trống thì ĐM × SL (cùng luật
 * `backflushKg` lúc ghi). `missing` = dòng có SL mà không ra được kg — màn phải
 * nói ra, vì năng suất kg của phiếu đang thiếu đúng chừng ấy dòng.
 */
export function linesKg(
  lines: { qty: number; kg: number | null; dm_kg: number | null }[],
): { kg: number; missing: number } {
  let kg = 0
  let missing = 0
  for (const l of lines) {
    if (l.qty <= 0 && l.kg == null) continue
    if (l.kg != null) kg += l.kg
    else if (l.dm_kg != null && l.dm_kg > 0) kg += l.dm_kg * l.qty
    else missing++
  }
  return { kg: Math.round(kg * 100) / 100, missing }
}
