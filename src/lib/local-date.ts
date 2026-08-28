/**
 * "Hôm nay" cho sổ sách — `new Date().toISOString().slice(0,10)` là ngày UTC:
 * 5h sáng VN vẫn ra NGÀY HÔM QUA, thống kê ca sớm sẽ ghi nhầm ngày. File thuần,
 * dùng được cả client lẫn server.
 */

/** Ngày hôm nay theo múi giờ MÁY NGƯỜI DÙNG (client component). */
export function localTodayIso(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Ngày hôm nay theo giờ VN (UTC+7, không DST) — cho server (server chạy UTC). */
export function vnTodayIso(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
}

/** Cộng/trừ ngày trên chuỗi ISO yyyy-mm-dd (thuần lịch, không múi giờ). */
export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
