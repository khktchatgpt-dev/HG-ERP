/**
 * Ngày kiểu Việt Nam cho ô nhập: `dd/mm/yyyy` ↔ ISO `yyyy-mm-dd`.
 *
 * `<input type="date">` hiển thị theo NGÔN NGỮ TRÌNH DUYỆT, không theo app:
 * máy cài Windows/Chrome tiếng Anh thì ô "Hẹn giao" hiện `mm/dd/yyyy` trong khi
 * cả app (và chứng từ giấy) đọc `dd/mm/yyyy` — 03/08 với 08/03 là hai ngày khác
 * nhau, không có cách nào nhìn ra ô đang nói kiểu nào. Nên ô nhập tự vẽ chữ
 * theo kiểu VN, giá trị bên dưới vẫn là ISO như cũ.
 *
 * File thuần: không múi giờ, không `new Date()` — chỉ cắt/ghép chuỗi lịch.
 */

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** ISO `yyyy-mm-dd` → `dd/mm/yyyy`. Chuỗi rỗng/không đúng khuôn → ''. */
export function isoToVn(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Ngày có thật trên lịch (bắt 31/02, 30/02, 31/04…). */
function isRealDate(d: number, mo: number, y: number): boolean {
  if (mo < 1 || mo > 12 || d < 1) return false
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return d <= daysInMonth
}

/**
 * `dd/mm/yyyy` (hoặc `d/m/yyyy`) → ISO `yyyy-mm-dd`.
 * Trả `null` khi chưa gõ xong hoặc ngày không có thật — người gõ dở không bị
 * ô nhảy giá trị dưới tay.
 */
export function vnToIso(text: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  const y = Number(m[3])
  if (y < 1900 || y > 2999) return null
  if (!isRealDate(d, mo, y)) return null
  return `${m[3]}-${pad(mo)}-${pad(d)}`
}

/**
 * Chèn dấu `/` khi đang gõ: `03082026` → `03/08/2026`. Người gõ (hoặc dán từ
 * Excel) đã có dấu ngăn thì GIỮ NGUYÊN ranh giới họ chia — `3-8-2026` là mùng
 * 3 tháng 8, không phải `38/20/26` như kiểu cắt mù theo vị trí.
 */
export function maskVnDate(raw: string): string {
  const s = raw.trim()
  const seg = s.split(/[^0-9]+/)
  if (seg.length > 1) {
    const parts = [seg[0].slice(0, 2), (seg[1] ?? '').slice(0, 2), (seg[2] ?? '').slice(0, 4)]
    return parts.slice(0, Math.min(seg.length, 3)).join('/')
  }
  const digits = s.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * HÔM NAY THEO GIỜ VIỆT NAM (yyyy-mm-dd).
 *
 * `new Date().toISOString().slice(0, 10)` là hôm nay theo **UTC**, tức từ
 * 00:00 đến 07:00 giờ Việt Nam nó trả về NGÀY HÔM QUA. Mọi so sánh hạn dựng
 * trên mốc đó đều lệch một ngày trong khung giờ ấy: "quá hẹn" đếm thiếu, "còn
 * N ngày" dư một, "đến hẹn hôm nay" bày đơn của hôm qua. Đo 15/09/2026 lúc
 * 00:45 giờ VN: Bàn làm việc ghi "Hôm nay 14/09/2026".
 *
 * Xưởng bắt đầu ca lúc 7h30 nên khung giờ hỏng đúng vào lúc người ta mở máy.
 *
 * Dùng `en-CA` vì nó cho sẵn dạng yyyy-mm-dd; `timeZone` để Intl tự lo lệch
 * giờ thay vì cộng tay 7 tiếng (cộng tay thì sai khi máy chủ đổi múi).
 */
export const TZ_VN = 'Asia/Ho_Chi_Minh'

export function todayVn(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_VN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
