/**
 * Nhãn TUẦN GIAO kiểu sổ đơn thật ('w37.26') suy từ NGÀY giao (0121).
 *
 * Chốt 07/08/2026: khách chốt lịch theo tuần nhưng mốc thật là NGÀY (cuối tuần
 * đó) → DB lưu `ship_date` date; nhãn tuần chỉ là cách ĐỌC, tính từ ngày theo
 * ISO-8601 (tuần bắt đầu thứ Hai, tuần 1 chứa ngày 4/1) — không lưu chuỗi song
 * song để khỏi lệch nhau.
 */

/** Tuần ISO-8601 của một ngày yyyy-mm-dd. */
export function isoWeek(dateStr: string): { week: number; year: number } {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7 // Thứ Hai = 0
  d.setUTCDate(d.getUTCDate() - day + 3) // thứ Năm của tuần này quyết định năm ISO
  const isoYear = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const week1Thu = Date.UTC(isoYear, 0, 4 - jan4Day + 3)
  const week = 1 + Math.round((d.getTime() - week1Thu) / (7 * 86_400_000))
  return { week, year: isoYear }
}

/** '2026-11-20' → 'w47.26' — nhãn in trên sổ đơn / hợp đồng. */
export function shipWeekLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  const { week, year } = isoWeek(dateStr)
  return `w${String(week).padStart(2, '0')}.${String(year % 100).padStart(2, '0')}`
}
