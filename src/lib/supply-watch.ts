/**
 * THEO DÕI CỦA CUNG ỨNG — logic thuần, dùng chung cho hai màn mới
 * ("Chờ tôi xử lý", "Hàng sắp về") và cho số đếm trên sidebar.
 *
 * Vì sao tách khỏi `po-filter.ts` (bộ lọc màn danh sách): bộ lọc trả lời câu
 * "cho tôi xem nhóm đơn nào", còn tệp này trả lời câu KHÁC — "đơn này có đang
 * đợi tôi làm gì không, và nếu có thì làm gì". Một đơn `approved` nằm im ba
 * tuần vẫn thuộc nhóm lọc "Đã duyệt", nhưng ở đây nó là MỘT VIỆC PHẢI LÀM.
 *
 * Nguyên tắc: MỘT ĐƠN CHỈ NẰM Ở MỘT CHỖ. Đơn vừa quá hẹn vừa về một phần mà
 * đếm hai lần thì tổng số việc phồng lên, và người đọc mất niềm tin vào con số
 * ngay lần đầu họ ngồi đếm tay.
 */

import { assessPoLate, isMissingEta } from './late-risk'

/** Trường tối thiểu để phân loại — mọi màn đều có sẵn từ `posService.list`. */
export type SupplyWatchInput = {
  status: string
  expected_at: string | null
  assigned_to: string | null
  /** Tiến độ về kho theo DÒNG (0126) — thiếu thì coi như chưa biết. */
  lines_done?: number
  lines_total?: number
}

// ── 1. Việc cần xử lý ─────────────────────────────────────────────────

export type SupplyTodoKind = 'overdue' | 'unsent' | 'no_eta' | 'partial' | 'draft'

export const SUPPLY_TODO: Record<
  SupplyTodoKind,
  {
    label: string
    /** Việc phải làm — viết ở thể MỆNH LỆNH, không mô tả trạng thái. */
    action: string
    /** Vì sao đơn này lọt vào đây (một câu, hiện dưới nhóm). */
    why: string
    tone: 'stop' | 'warn' | 'primary' | 'muted'
    /** Thứ tự khẩn — nhóm nhỏ số hiện trên trước. */
    order: number
  }
> = {
  overdue: {
    label: 'Quá hẹn giao',
    action: 'Giục nhà cung cấp',
    why: 'NCC đã nhận đơn nhưng qua ngày hẹn vẫn chưa giao đủ.',
    tone: 'stop',
    order: 1,
  },
  unsent: {
    label: 'Đã duyệt · chưa gửi NCC',
    action: 'Gửi nhà cung cấp',
    why: 'Giám đốc ký rồi mà đơn chưa ra khỏi cửa — chỗ đơn nằm im lâu nhất.',
    tone: 'warn',
    order: 2,
  },
  no_eta: {
    label: 'Chưa có hẹn giao',
    action: 'Chốt ngày giao với NCC',
    why: 'Không có ngày hẹn thì mọi cảnh báo trễ đều bỏ qua đơn này.',
    tone: 'warn',
    order: 3,
  },
  partial: {
    label: 'Về một phần',
    action: 'Theo dõi phần còn thiếu',
    why: 'Đã nhận được một số dòng, phần còn lại chưa về.',
    tone: 'primary',
    order: 4,
  },
  draft: {
    label: 'Nháp chưa gửi duyệt',
    action: 'Hoàn tất rồi gửi Giám đốc',
    why: 'Đơn soạn dở, chưa ai nhìn thấy ngoài bạn.',
    tone: 'muted',
    order: 5,
  },
}

export const SUPPLY_TODO_KINDS = (Object.keys(SUPPLY_TODO) as SupplyTodoKind[]).sort(
  (a, b) => SUPPLY_TODO[a].order - SUPPLY_TODO[b].order,
)

/**
 * Đơn này đang đợi Cung ứng làm gì? `null` = không phải việc của mình lúc này.
 *
 * `pending_approval` trả null có chủ đích: đơn đang nằm bàn Giám đốc, người mua
 * không thao tác được gì ngoài rút về nháp — để nó trong danh sách việc chỉ tổ
 * làm danh sách dài ra mà không ai làm được.
 *
 * Thứ tự xét chính là thứ tự VÒNG ĐỜI, không phải theo mức đỏ: một đơn
 * `approved` đã qua ngày hẹn thì gốc rễ là CHƯA GỬI ĐI, nên việc phải làm là
 * "gửi NCC" chứ không phải "giục NCC" — giục một người còn chưa nhận được đơn.
 */
export function classifyTodo(
  po: SupplyWatchInput,
  todayIso: string,
): SupplyTodoKind | null {
  if (po.status === 'received' || po.status === 'cancelled') return null
  if (po.status === 'draft') return 'draft'
  if (po.status === 'pending_approval') return null
  if (po.status === 'approved') return 'unsent'
  // Còn lại là đơn ĐÃ ra khỏi cửa: ordered / confirmed / in_transit / partial.
  if (assessPoLate(po, todayIso) === 'overdue') return 'overdue'
  if (isMissingEta(po)) return 'no_eta'
  if (po.status === 'partial') return 'partial'
  return null
}

/** Gom theo loại việc, giữ thứ tự khẩn. Đơn nào không phải việc thì rơi ra. */
export function groupTodos<T extends SupplyWatchInput>(
  pos: T[],
  todayIso: string,
): { kind: SupplyTodoKind; rows: T[] }[] {
  const map = new Map<SupplyTodoKind, T[]>()
  for (const po of pos) {
    const kind = classifyTodo(po, todayIso)
    if (!kind) continue
    const list = map.get(kind)
    if (list) list.push(po)
    else map.set(kind, [po])
  }
  return SUPPLY_TODO_KINDS.filter((k) => map.has(k)).map((kind) => ({
    kind,
    rows: map.get(kind)!,
  }))
}

// ── 2. Lịch hàng về ───────────────────────────────────────────────────

export type IncomingBucket = 'overdue' | 'today' | 'week' | 'later' | 'no_eta'

export const INCOMING_BUCKET: Record<
  IncomingBucket,
  { label: string; tone: 'stop' | 'warn' | 'primary' | 'muted'; order: number }
> = {
  overdue: { label: 'Quá hẹn', tone: 'stop', order: 1 },
  today: { label: 'Đến hẹn hôm nay', tone: 'warn', order: 2 },
  week: { label: 'Trong 7 ngày tới', tone: 'primary', order: 3 },
  later: { label: 'Sau đó', tone: 'muted', order: 4 },
  no_eta: { label: 'Chưa hẹn ngày', tone: 'warn', order: 5 },
}

export const INCOMING_BUCKETS = (Object.keys(INCOMING_BUCKET) as IncomingBucket[]).sort(
  (a, b) => INCOMING_BUCKET[a].order - INCOMING_BUCKET[b].order,
)

/**
 * Đơn ĐANG TRÊN ĐƯỜNG — NCC đã nhận đơn và đang lo hàng.
 *
 * KHÔNG gồm `approved`: đơn chưa gửi thì không có ai đang chuẩn bị hàng cả,
 * xếp nó vào lịch giao là tự nói dối mình rằng hàng đang về. Nó thuộc danh sách
 * việc ("chưa gửi NCC") — đúng chỗ để bị thúc.
 */
const EN_ROUTE = new Set(['ordered', 'confirmed', 'in_transit', 'partial'])

export function isIncoming(po: SupplyWatchInput): boolean {
  return EN_ROUTE.has(po.status)
}

/** `null` = đơn không nằm trong lịch hàng về (chưa gửi / đã đóng sổ). */
export function incomingBucket(
  po: SupplyWatchInput,
  todayIso: string,
  horizonDays = 7,
): IncomingBucket | null {
  if (!isIncoming(po)) return null
  if (!po.expected_at) return 'no_eta'
  const eta = po.expected_at.slice(0, 10)
  if (eta < todayIso) return 'overdue'
  if (eta === todayIso) return 'today'
  return eta <= addDays(todayIso, horizonDays) ? 'week' : 'later'
}

export function groupIncoming<T extends SupplyWatchInput>(
  pos: T[],
  todayIso: string,
  horizonDays = 7,
): { bucket: IncomingBucket; rows: T[] }[] {
  const map = new Map<IncomingBucket, T[]>()
  for (const po of pos) {
    const b = incomingBucket(po, todayIso, horizonDays)
    if (!b) continue
    const list = map.get(b)
    if (list) list.push(po)
    else map.set(b, [po])
  }
  // Trong mỗi nhóm: hẹn sớm lên trước; đơn chưa hẹn thì giữ nguyên thứ tự vào.
  for (const rows of map.values()) {
    rows.sort((a, b) => (a.expected_at ?? '9999').localeCompare(b.expected_at ?? '9999'))
  }
  return INCOMING_BUCKETS.filter((b) => map.has(b)).map((bucket) => ({
    bucket,
    rows: map.get(bucket)!,
  }))
}

// ── 3. Số đếm cho badge sidebar ───────────────────────────────────────

/**
 * Số việc đang đợi MỘT NGƯỜI. `meId` null (hoặc người không phụ trách đơn nào)
 * ra 0 — badge im lặng, đúng với cái tên "Chờ tôi xử lý".
 */
export function countMyTodos(
  pos: SupplyWatchInput[],
  meId: string | null,
  todayIso: string,
): number {
  if (!meId) return 0
  let n = 0
  for (const po of pos) {
    if (po.assigned_to !== meId) continue
    if (classifyTodo(po, todayIso)) n++
  }
  return n
}

/**
 * Số đơn ĐẾN HẸN trong 7 ngày tới — KHÔNG tính đơn đã quá hẹn.
 *
 * Quá hẹn đã có mặt trong badge "Chờ tôi xử lý"; đếm lại ở đây thì hai con số
 * cộng lại lớn hơn số đơn có thật, và người dùng sẽ tin cả hai đều sai.
 */
export function countIncomingSoon(pos: SupplyWatchInput[], todayIso: string): number {
  let n = 0
  for (const po of pos) {
    const b = incomingBucket(po, todayIso)
    if (b === 'today' || b === 'week') n++
  }
  return n
}

/** Cộng ngày trên chuỗi yyyy-mm-dd (UTC — tránh lệch múi giờ). */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
