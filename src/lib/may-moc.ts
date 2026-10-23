/**
 * MÁY MÓC & BẢO TRÌ — logic THUẦN dùng chung trình duyệt + máy chủ (0270).
 *
 * Mang từ bản demo "MOCA Tài sản" (bản vẽ duyệt 21/10/2026). Mọi phép tính
 * hạn bảo trì, luật chuyển trạng thái phiếu báo hỏng và đánh số nằm ở đây để
 * service và màn hình đếm bằng CÙNG một hàm (nguyên tắc 3: con số là lời hứa).
 * Không chạm DB.
 */
import type { TagTone } from '@/components/kit'

// ── Từ vựng ────────────────────────────────────────────────────────────────

export type AssetKind = 'machine' | 'tool'
export type AssetStatus =
  'dang_dung' | 'chua_dung' | 'hong' | 'sua_chua' | 'mat' | 'thanh_ly'
export type PlanUnit = 'h' | 'd' | 'm'
export type IssueStatus = 'moi' | 'cho_duyet' | 'dang_sua' | 'xong' | 'huy'
export type IssuePriority = 'dung_may' | 'van_chay'
export type WoKind = 'BD' | 'SC' | 'KD'
export type MoveType = 'GT' | 'CP' | 'TH' | 'DC' | 'BM' | 'TL'

export const ASSET_STATUSES = [
  'dang_dung',
  'chua_dung',
  'hong',
  'sua_chua',
  'mat',
  'thanh_ly',
] as const

/** Nhãn trạng thái MÁY (TSCĐ). Dụng cụ dùng `TOOL_STATUS` — "Đang dùng / Trong kho". */
export const MACHINE_STATUS: Record<AssetStatus, { label: string; tone: TagTone }> = {
  dang_dung: { label: 'Đang chạy', tone: 'done' },
  chua_dung: { label: 'Chưa sử dụng', tone: 'neutral' },
  hong: { label: 'Hỏng – chờ sửa', tone: 'stop' },
  sua_chua: { label: 'Đang sửa', tone: 'warn' },
  mat: { label: 'Đã báo mất', tone: 'neutral' },
  thanh_ly: { label: 'Đã thanh lý', tone: 'neutral' },
}
export const TOOL_STATUS: Record<AssetStatus, { label: string; tone: TagTone }> = {
  dang_dung: { label: 'Đang dùng', tone: 'run' },
  chua_dung: { label: 'Trong kho', tone: 'neutral' },
  hong: { label: 'Hỏng', tone: 'stop' },
  sua_chua: { label: 'Đang sửa', tone: 'warn' },
  mat: { label: 'Đã báo mất', tone: 'neutral' },
  thanh_ly: { label: 'Đã thanh lý', tone: 'neutral' },
}
export function statusOf(kind: AssetKind, status: AssetStatus) {
  return kind === 'tool' ? TOOL_STATUS[status] : MACHINE_STATUS[status]
}

/** Còn trên sổ (chưa mất / thanh lý). */
export const inBooks = (s: AssetStatus) => s !== 'mat' && s !== 'thanh_ly'
/** Máy đang dừng — đếm "Máy đang dừng" ở mọi màn đi qua hàm này. */
export const isDown = (s: AssetStatus) => s === 'hong' || s === 'sua_chua'

export const ISSUE_STATUS: Record<IssueStatus, { label: string; tone: TagTone }> = {
  moi: { label: 'Mới báo', tone: 'stop' },
  cho_duyet: { label: 'Chờ GĐ duyệt', tone: 'warn' },
  dang_sua: { label: 'Đang sửa', tone: 'run' },
  xong: { label: 'Đã xong', tone: 'done' },
  huy: { label: 'Đã huỷ', tone: 'neutral' },
}
export const OPEN_ISSUE: readonly IssueStatus[] = ['moi', 'cho_duyet', 'dang_sua']
export const isOpenIssue = (s: IssueStatus) => OPEN_ISSUE.includes(s)

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  dung_may: 'Phải dừng máy',
  van_chay: 'Vẫn chạy được',
}

export const WO_KIND: Record<WoKind, { label: string; prefix: string }> = {
  BD: { label: 'Bảo dưỡng', prefix: 'PBD' },
  SC: { label: 'Sửa chữa', prefix: 'PSC' },
  KD: { label: 'Kiểm định', prefix: 'PKD' },
}

export const MOVE_LABEL: Record<MoveType, string> = {
  GT: 'Đưa vào dùng',
  CP: 'Giao',
  TH: 'Thu hồi',
  DC: 'Điều chuyển',
  BM: 'Báo mất',
  TL: 'Thanh lý',
}

/** Hiện tượng hay gặp — chip điền nhanh ở hộp báo hỏng. */
export const ISSUE_CHIPS = [
  'Kêu bất thường',
  'Không khởi động',
  'Rò dầu, rò hơi',
  'Lưỡi, dao cùn',
  'Mùi khét',
  'Mất an toàn',
] as const

// ── Ngày ───────────────────────────────────────────────────────────────────

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const toUtc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fromUtc = (t: number) => {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
export const addDaysIso = (iso: string, n: number) => fromUtc(toUtc(iso) + n * 864e5)
/** Cộng tháng kiểu lịch, chốt cuối tháng (31/01 + 1 tháng = 28|29/02). */
export function addMonthsIso(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  const ny = Math.floor(idx / 12)
  const nm = idx % 12
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`
}
export const dayDiff = (a: string, b: string) => Math.round((toUtc(a) - toUtc(b)) / 864e5)
export const dmy = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'
export const dm = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—'

// ── Lịch bảo trì ───────────────────────────────────────────────────────────

export type PlanCore = {
  every_n: number
  unit: PlanUnit
  last_date: string
  last_hours: number | null
}
export type AssetHours = { hours: number; hours_per_day: number }

/**
 * Giờ chạy TRUNG BÌNH mỗi ngày lịch — 6 ngày làm / tuần. Sàn 0,1 để máy khai 0
 * giờ/ngày vẫn có hạn (rất xa) chứ không chia cho 0.
 */
export const hoursPerCalendarDay = (a: AssetHours) =>
  Math.max(0.1, (a.hours_per_day * 6) / 7)

/**
 * Máy có đồng hồ giờ mà 14 ngày chưa ai đọc số — lịch theo giờ của nó đang ĐOÁN
 * theo giờ/ngày khai báo. Một hàm cho cả ô đếm ở Việc hôm nay lẫn chip lọc ở Máy móc.
 */
export const hoursStale = (
  a: {
    kind: AssetKind
    status: AssetStatus
    hours_per_day: number
    hours_updated_on: string | null
  },
  today: string,
) =>
  a.kind === 'machine' &&
  inBooks(a.status) &&
  a.status !== 'chua_dung' &&
  a.hours_per_day > 0 &&
  (!a.hours_updated_on || a.hours_updated_on < addDaysIso(today, -14))

export type Due = {
  /** Ngày đến hạn (ISO) — với lịch theo giờ chạy là ngày ƯỚC theo giờ/ngày. */
  date: string
  /** Còn bao nhiêu ngày (âm = quá hạn). */
  days: number
  /** Chỉ lịch theo giờ: còn bao nhiêu giờ (âm = đã vượt). */
  hoursLeft: number | null
}

/**
 * Hạn kỳ tới của một hạng mục. Theo giờ chạy: (giờ lần trước + chu kỳ) − giờ
 * đồng hồ hiện tại, quy ra ngày theo giờ chạy trung bình. Theo ngày / tháng:
 * lần trước + chu kỳ.
 */
export function planDue(p: PlanCore, a: AssetHours, today: string): Due {
  if (p.unit === 'h') {
    const left = (p.last_hours ?? 0) + p.every_n - a.hours
    const days = Math.floor(left / hoursPerCalendarDay(a))
    return { date: addDaysIso(today, days), days, hoursLeft: Math.round(left) }
  }
  const date =
    p.unit === 'd'
      ? addDaysIso(p.last_date, p.every_n)
      : addMonthsIso(p.last_date, p.every_n)
  return { date, days: dayDiff(date, today), hoursLeft: null }
}

export type PlanState = 'od' | 'soon' | 'ok'
/** Quá hạn · trong 7 ngày · còn xa. Kiểm định nhắc trước 30 ngày → dùng `inspectionSoon`. */
export const planState = (days: number): PlanState =>
  days < 0 ? 'od' : days <= 7 ? 'soon' : 'ok'
export const inspectionSoon = (days: number) => days >= 0 && days <= 30

export function everyTxt(every: number, unit: PlanUnit): string {
  if (unit === 'h') return `${every.toLocaleString('vi-VN')} giờ chạy`
  if (unit === 'd') return `${every} ngày`
  return every >= 12 && every % 12 === 0 ? `${every / 12} năm` : `${every} tháng`
}

/**
 * Lúc báo kể tương đối như demo: "vừa xong", "25 phút trước", "3 giờ trước", "hôm
 * qua", "5 ngày trước"; quá 30 ngày thì ngày dd/mm/yyyy. Ngày tính theo giờ VN.
 */
export function agoTxt(iso: string, now: Date): string {
  const t = new Date(iso)
  const m = Math.floor((now.getTime() - t.getTime()) / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const dd = dayDiff(vnDay(now), vnDay(t))
  if (dd === 0) return `${Math.round(m / 60)} giờ trước`
  if (dd === 1) return 'hôm qua'
  if (dd < 30) return `${dd} ngày trước`
  return dmy(vnDay(t))
}
/** Ngày (yyyy-mm-dd) theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè). */
const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10)

export function dueTxt(d: Due): string {
  const base =
    d.days < 0
      ? `quá hạn ${-d.days} ngày`
      : d.days === 0
        ? 'hôm nay'
        : d.days === 1
          ? 'ngày mai'
          : `còn ${d.days} ngày`
  if (d.hoursLeft == null) return base
  // Như demo: vượt giờ vẫn nói quá bao nhiêu ngày (quy theo giờ chạy/ngày) để xếp
  // cùng thang với hạng mục theo lịch.
  return d.hoursLeft < 0
    ? `${base} · vượt ${(-d.hoursLeft).toLocaleString('vi-VN')} h`
    : `${base} · còn ${d.hoursLeft.toLocaleString('vi-VN')} h`
}

// ── Báo hỏng: luật chuyển trạng thái ──────────────────────────────────────

export type IssueAction = 'accept' | 'approve' | 'reject' | 'done' | 'cancel'

/** Trạng thái được phép làm hành động — service kiểm lại, UI dùng để ẩn nút. */
export const ISSUE_FROM: Record<IssueAction, readonly IssueStatus[]> = {
  accept: ['moi'],
  approve: ['cho_duyet'],
  reject: ['cho_duyet'],
  done: ['dang_sua'],
  cancel: ['moi'],
}
export const canIssue = (action: IssueAction, s: IssueStatus) =>
  ISSUE_FROM[action].includes(s)

/** Nhận việc: dự toán VƯỢT hạn mức thì chờ GĐ duyệt, không thì vào sửa ngay. */
export const acceptGoesTo = (
  estimate: number | null,
  approveOver: number,
): IssueStatus => ((estimate ?? 0) > approveOver ? 'cho_duyet' : 'dang_sua')

/** Máy khi có phiếu báo hỏng mới: phải dừng máy thì "Hỏng – chờ sửa". */
export const assetOnReport = (prio: IssuePriority, cur: AssetStatus): AssetStatus =>
  prio === 'dung_may' && cur === 'dang_dung' ? 'hong' : cur

/** Máy khi bắt đầu sửa: đã hỏng (hoặc phải dừng) thì "Đang sửa". */
export const assetOnStart = (prio: IssuePriority, cur: AssetStatus): AssetStatus =>
  prio === 'dung_may' || cur === 'hong' ? 'sua_chua' : cur

/** Máy khi sửa xong: chạy lại (máy chưa dùng / mất / thanh lý giữ nguyên). */
export const assetOnDone = (cur: AssetStatus): AssetStatus =>
  isDown(cur) ? 'dang_dung' : cur

// ── Số tiền phiếu ─────────────────────────────────────────────────────────

export type Part = { name: string; qty: number; price: number }
export const partsTotal = (parts: readonly Part[]) =>
  parts.reduce((s, p) => s + Math.round(p.qty * p.price), 0)
export const woCost = (parts: readonly Part[], labor: number) =>
  partsTotal(parts) + Math.round(labor)

// ── Đánh số ────────────────────────────────────────────────────────────────

/** Mã tem: máy `TS-HAN-004`, dụng cụ `CC-DC-014`. */
export const assetCode = (kind: AssetKind, prefix: string, n: number) =>
  `${kind === 'machine' ? 'TS' : 'CC'}-${prefix}-${pad(n, 3)}`
/** Khoá bộ đếm của mã tem — một bộ đếm cho mỗi tiền tố. */
export const assetCounterKey = (kind: AssetKind, prefix: string) =>
  `${kind === 'machine' ? 'TS' : 'CC'}-${prefix}`
/** Số chứng từ: `BH-0007`, `PSC-0012`, `CP-0003`. */
export const docNo = (prefix: string, n: number) => `${prefix}-${pad(n, 4)}`

// ── Thống kê ───────────────────────────────────────────────────────────────

export type WoCore = {
  kind: WoKind
  done_on: string
  cost: number
  downtime_hours: number
}
export type RepairStats = {
  nBD: number
  nSC: number
  nKD: number
  cost: number
  costSC: number
  down: number
}

/** Bảo dưỡng / sửa / kiểm định + chi phí + giờ dừng của các phiếu từ `since` (ISO) trở đi. */
export function repairStats(wos: readonly WoCore[], since: string): RepairStats {
  const r: RepairStats = { nBD: 0, nSC: 0, nKD: 0, cost: 0, costSC: 0, down: 0 }
  for (const w of wos) {
    if (w.done_on < since) continue
    if (w.kind === 'BD') r.nBD++
    else if (w.kind === 'SC') {
      r.nSC++
      r.costSC += w.cost
    } else r.nKD++
    r.cost += w.cost
    r.down += w.downtime_hours
  }
  return r
}

/** Tiền gọn: 18,5 tr · 1,2 tỷ · 450k. Dùng cho ô tóm tắt; bảng giữ số đầy đủ. */
export function shortMoney(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9)
    return `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`
  if (a >= 1e6)
    return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
  if (a >= 1e3) return `${Math.round(n / 1e3)}k`
  return n.toLocaleString('vi-VN')
}
export const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN')

/** Tháng `yyyy-mm` của một ngày ISO; cộng / trừ tháng. */
export const ymOf = (iso: string) => iso.slice(0, 7)
export const addYm = (ym: string, n: number) => addMonthsIso(`${ym}-01`, n).slice(0, 7)
export const ymTxt = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`

/**
 * Chữ đọc được từ tem → mã máy. Tem in đường dẫn tuyệt đối tới hồ sơ máy
 * (`https://…/may-moc/may/TS-HAN-001`), nhưng người gõ tay thì gõ mã trần.
 */
export function codeFromScan(text: string): string {
  const t = text.trim()
  const m = /\/may-moc\/may\/([^/?#\s]+)/.exec(t)
  return (m ? decodeURIComponent(m[1]) : t).toUpperCase()
}
