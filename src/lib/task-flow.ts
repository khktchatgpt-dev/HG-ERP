import { todayVn } from './date-vn'

/**
 * PHÂN CÔNG VIỆC — luật thuần, không chạm DB (chạy được ở cả server lẫn client).
 *
 * Quản lý Cung ứng xin 29/10/2026, chủ dự án chốt 30/10: "không gắn gì hết, chỉ
 * đơn giản giống phần phân công công việc, buộc xem người được giao có hoàn thành
 * được không những công việc mà sếp và quản lý giao". Bản vẽ duyệt:
 * https://claude.ai/artifact/FQxKHGKQnhWt5dBjGA8n5k — Q1–Q6 theo đề xuất:
 *   Q1 sếp (admin) + quản lý (manager) giao được; nhân viên chỉ nhận việc
 *   Q2 quản lý giao được cho người PHÒNG KHÁC (luật cũ chỉ cho cùng phòng)
 *   Q3 việc chỉ "xong" khi người giao duyệt Đạt
 *   Q4 báo hoàn thành bắt một câu kết quả; trả lại bắt lý do
 *
 * Không xây mới: dựng trên module Việc (`modules/workflow/tasks`) đã có vòng
 * todo → in_progress → submitted → done / rejected. Module chết vì bị ẩn khỏi
 * sidebar từ 08/08/2026 (`HIDE_PERSONAL_SECTION_GLOBALLY`), không phải vì sai luật.
 */

export type TaskStatus =
  'todo' | 'in_progress' | 'submitted' | 'done' | 'rejected' | 'cancelled' | 'on_hold'

export type FlowTask = {
  kind: 'assigned' | 'self'
  status: TaskStatus
  assigner_id: string
  assignee_id: string
  /** timestamptz (ISO) — hạn chót; null = không hạn. */
  due_date: string | null
}

export type FlowActor = { id: string; role: string }

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  done: 'Xong',
  rejected: 'Bị trả lại',
  cancelled: 'Đã huỷ',
  on_hold: 'Tạm hoãn',
}

/** Q1 — ai giao được việc cho NGƯỜI KHÁC. Tự ghi việc cho mình thì ai cũng được. */
export function canAssign(actor: FlowActor): boolean {
  return actor.role === 'admin' || actor.role === 'manager'
}

/** Câu nói khi người không có quyền mở nút "Giao việc" — nói cách gỡ, không nói "403". */
export const ASSIGN_BLOCKED = 'Sếp và quản lý giao việc. Cần giao thì nhờ quản lý phòng.'

export const TASK_ACTIONS = [
  'start', // bắt đầu / làm tiếp
  'hold', // tạm hoãn
  'submit', // báo hoàn thành
  'approve', // người giao duyệt Đạt
  'reject', // người giao trả lại
  'cancel', // người giao huỷ
  'restore', // người giao mở lại việc đã huỷ
] as const
export type TaskAction = (typeof TASK_ACTIONS)[number]

/** Trạng thái sau mỗi bước. */
export const ACTION_TO: Record<TaskAction, TaskStatus> = {
  start: 'in_progress',
  hold: 'on_hold',
  submit: 'submitted',
  approve: 'done',
  reject: 'rejected',
  cancel: 'cancelled',
  restore: 'todo',
}

/** Từ trạng thái nào thì bước đó làm được. */
const FROM: Record<TaskAction, TaskStatus[]> = {
  start: ['todo', 'rejected', 'on_hold'],
  hold: ['in_progress'],
  // Báo hoàn thành thẳng từ "Chưa làm" cũng được — "Bắt đầu" là tuỳ chọn.
  submit: ['todo', 'in_progress', 'rejected', 'on_hold'],
  approve: ['submitted'],
  reject: ['submitted'],
  cancel: ['todo', 'in_progress', 'submitted', 'rejected', 'on_hold'],
  restore: ['cancelled'],
}

/** Bước nào thuộc NGƯỜI NHẬN, bước nào thuộc NGƯỜI GIAO. */
const OWNER: Record<TaskAction, 'taker' | 'giver'> = {
  start: 'taker',
  hold: 'taker',
  submit: 'taker',
  approve: 'giver',
  reject: 'giver',
  cancel: 'giver',
  restore: 'giver',
}

/**
 * VÌ SAO người này KHÔNG bấm được bước này — null = bấm được.
 *
 * `who` (sai người → 403) tách khỏi `state` (sai lúc → 400) vì cách gỡ khác nhau.
 * Câu chặn nói luôn cách gỡ — màn hình đọc thẳng câu này ra cạnh nút.
 *
 * Admin (sếp) làm được mọi bước của người giao: người giao nghỉ việc thì việc của
 * họ vẫn phải có người duyệt / huỷ. Người NHẬN thì không ai làm thay được — báo
 * hoàn thành là lời của chính người làm.
 *
 * Việc TỰ GHI (kind 'self'): chủ việc là cả người giao lẫn người nhận, không có
 * bước duyệt — "xong" là bước `submit` đi thẳng tới `done` (xem `nextStatus`).
 */
export function taskActionBlock(
  task: FlowTask,
  action: TaskAction,
  actor: FlowActor,
): { kind: 'who' | 'state'; message: string } | null {
  const isTaker = actor.id === task.assignee_id
  const isGiver = actor.id === task.assigner_id || actor.role === 'admin'

  if (task.kind === 'self') {
    if (actor.id !== task.assignee_id) return { kind: 'who', message: 'Đây là việc tự ghi của người khác' } // prettier-ignore
    if (action === 'approve' || action === 'reject') return { kind: 'state', message: 'Việc tự ghi không có bước duyệt' } // prettier-ignore
  } else if (OWNER[action] === 'taker' ? !isTaker : !isGiver) {
    return {
      kind: 'who',
      message:
        OWNER[action] === 'taker'
          ? 'Chỉ người được giao mới báo được việc của mình'
          : 'Chỉ người giao việc (hoặc sếp) làm được bước này',
    }
  }

  if (FROM[action].includes(task.status)) return null
  // Việc tự ghi đã xong vẫn mở lại được (luật cũ SELF_TRANSITIONS cho done → todo).
  if (task.kind === 'self' && action === 'restore' && task.status === 'done') return null
  return { kind: 'state', message: STATE_MSG[task.status] }
}

const STATE_MSG: Record<TaskStatus, string> = {
  todo: 'Việc chưa bắt đầu',
  in_progress: 'Việc đang làm',
  submitted: 'Việc đang chờ người giao duyệt',
  done: 'Việc đã xong',
  rejected: 'Việc bị trả lại — người nhận làm tiếp rồi báo lại',
  cancelled: 'Việc đã huỷ',
  on_hold: 'Việc đang tạm hoãn',
}

/** Các bước người này bấm được lúc này — để màn hình vẽ nút. */
export function taskActions(task: FlowTask, actor: FlowActor): TaskAction[] {
  return TASK_ACTIONS.filter((a) => taskActionBlock(task, a, actor) === null)
}

/** Trạng thái đích. Việc tự ghi không qua duyệt: báo hoàn thành là xong luôn. */
export function nextStatus(task: Pick<FlowTask, 'kind'>, action: TaskAction): TaskStatus {
  if (task.kind === 'self' && action === 'submit') return 'done'
  return ACTION_TO[action]
}

/**
 * Đổi trạng thái kiểu cũ (`POST /status { status }`) sang bước — để màn cũ còn
 * chạy mà không có đường thứ hai đi vòng qua luật. null = không có bước nào
 * dẫn tới trạng thái đó (vd. tự đặt "done" cho việc được giao: phải qua duyệt).
 */
export function actionForStatus(task: FlowTask, to: TaskStatus): TaskAction | null {
  if (to === 'in_progress') return 'start'
  if (to === 'on_hold') return 'hold'
  if (to === 'cancelled') return 'cancel'
  if (to === 'todo') return task.status === 'cancelled' ? 'restore' : null
  if (to === 'done') return task.kind === 'self' ? 'submit' : null
  return null
}

// ---- Quá hạn + số đỏ ------------------------------------------------------

/** Trạng thái mà bóng đang ở NGƯỜI NHẬN — chỉ những việc này mới "quá hạn" được. */
const TAKER_HOLDS: TaskStatus[] = ['todo', 'in_progress', 'rejected', 'on_hold']

/**
 * Quá hạn mấy ngày (theo ngày VN). 0 = không quá. Hạn đúng hôm nay chưa tính quá.
 * Việc đang CHỜ DUYỆT không quá hạn phía người nhận — họ đã làm xong, bóng ở
 * người giao.
 */
export function taskOverdueDays(
  task: Pick<FlowTask, 'status' | 'due_date'>,
  today: string,
): number {
  if (!task.due_date || !TAKER_HOLDS.includes(task.status)) return 0
  const due = todayVn(new Date(task.due_date))
  const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.max(0, Math.round((ms(today) - ms(due)) / 86_400_000))
}

/**
 * SỐ ĐỎ trên sidebar "Phân công việc": việc CHỜ TÔI DUYỆT + việc CỦA TÔI quá
 * hạn. Hai thứ cần người đang xem động tay ngay — không đếm việc tôi giao mà người
 * khác đang trễ (cái đó thuộc chip "Quá hạn" trong danh sách, không phải lỗi của
 * người xem).
 */
export function taskAttention(
  tasks: (FlowTask & { id: string })[],
  userId: string,
  today: string,
): { to_approve: number; my_overdue: number; total: number } {
  let toApprove = 0
  let myOverdue = 0
  for (const t of tasks) {
    if (t.kind === 'assigned' && t.assigner_id === userId && t.status === 'submitted') toApprove++ // prettier-ignore
    if (t.assignee_id === userId && taskOverdueDays(t, today) > 0) myOverdue++
  }
  return { to_approve: toApprove, my_overdue: myOverdue, total: toApprove + myOverdue }
}

// ---- Danh sách "Việc tôi giao" (P2) -----------------------------------------

/** Việc đã đóng (xong / huỷ) chỉ giữ trên danh sách bấy nhiêu ngày. */
export const CLOSED_KEEP_DAYS = 30

export const GIVEN_FILTERS = [
  'to_approve',
  'overdue',
  'open',
  'done',
  'cancelled',
] as const
export type GivenFilter = (typeof GIVEN_FILTERS)[number]

export const GIVEN_FILTER_LABEL: Record<GivenFilter, string> = {
  to_approve: 'Chờ tôi duyệt',
  overdue: 'Quá hạn',
  open: 'Chưa xong',
  done: `Xong ${CLOSED_KEEP_DAYS} ngày`,
  cancelled: `Đã huỷ ${CLOSED_KEEP_DAYS} ngày`,
}

type ListTask = FlowTask & {
  created_at: string
  completed_at: string | null
  cancelled_at: string | null
}

function daysSince(iso: string | null, today: string): number {
  if (!iso) return Infinity
  const d = todayVn(new Date(iso))
  const ms = (x: string) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10))
  return Math.round((ms(today) - ms(d)) / 86_400_000)
}

/**
 * MỘT phép lọc cho cả số trên chip lẫn danh sách chip mở ra — số là lời hứa về
 * số dòng. "Chưa xong" gồm cả chờ duyệt: với người giao, việc chưa duyệt Đạt là
 * việc chưa xong.
 */
export function matchesGiven(t: ListTask, f: GivenFilter, today: string): boolean {
  switch (f) {
    case 'to_approve':
      return t.status === 'submitted'
    case 'overdue':
      return taskOverdueDays(t, today) > 0
    case 'open':
      return !['done', 'cancelled'].includes(t.status)
    case 'done':
      return t.status === 'done' && daysSince(t.completed_at, today) < CLOSED_KEEP_DAYS
    case 'cancelled':
      return (
        t.status === 'cancelled' && daysSince(t.cancelled_at, today) < CLOSED_KEEP_DAYS
      )
  }
}

export function summarizeGiven(
  list: ListTask[],
  today: string,
): Record<GivenFilter, number> {
  const out = { to_approve: 0, overdue: 0, open: 0, done: 0, cancelled: 0 }
  for (const t of list)
    for (const f of GIVEN_FILTERS) if (matchesGiven(t, f, today)) out[f]++
  return out
}

/**
 * Thứ tự đọc của người giao: chờ tôi duyệt lên đầu (bóng ở tôi) → quá hạn lâu nhất
 * → hạn gần nhất → không hạn → đã đóng (mới đóng trước).
 */
export function sortGiven<T extends ListTask>(list: T[], today: string): T[] {
  const rank = (t: T) =>
    t.status === 'submitted' ? 0 : ['done', 'cancelled'].includes(t.status) ? 2 : 1
  const closedAt = (t: T) => t.completed_at ?? t.cancelled_at ?? ''
  return [...list].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (rank(a) === 2) return closedAt(b).localeCompare(closedAt(a))
    const od = taskOverdueDays(b, today) - taskOverdueDays(a, today)
    if (od !== 0) return od
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }
    return a.created_at.localeCompare(b.created_at)
  })
}

/** Hạn gõ theo ngày (YYYY-MM-DD, giờ VN) → mốc HẾT NGÀY đó để lưu `due_date`. */
export function dueEndOfDay(isoDate: string): string {
  return `${isoDate}T23:59:59+07:00`
}

// ---- Theo người mua (P4) ---------------------------------------------------

/** Xong trễ mấy ngày so với hạn (theo ngày VN). 0 = đúng hạn; null = không hạn / chưa xong. */
export function taskLateDays(
  due: string | null,
  completed: string | null,
): number | null {
  if (!due || !completed) return null
  const ms = (x: string) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10))
  const d = ms(todayVn(new Date(completed))) - ms(todayVn(new Date(due)))
  return Math.max(0, Math.round(d / 86_400_000))
}

/** Việc mà bóng đang ở người nhận — đúng tập ô "Việc được giao" trên bàn của họ. */
export function isTakerOpen(status: TaskStatus): boolean {
  return TAKER_HOLDS.includes(status)
}

export type TakerStats = {
  /** Việc được giao còn ở người đó (= số dòng ô "Việc được giao" trên bàn họ). */
  open: number
  /** Trong số đó, đã quá hạn. */
  overdue: number
  /** Việc CÓ HẠN được duyệt Đạt trong 30 ngày qua, xong trong / trước ngày hạn… */
  on_time: number
  /** …trên tổng việc có hạn được duyệt Đạt trong 30 ngày qua. 0 = chưa có việc nào xong. */
  done_due: number
}

/**
 * Ba cột "Theo người mua" (bản vẽ C): người được giao có hoàn thành được không.
 * Chỉ đếm việc được GIAO (việc tự ghi không ai duyệt nên không nói gì về chuyện
 * làm xong việc người khác giao). Đúng hạn = ngày duyệt Đạt ≤ ngày hạn (ngày VN).
 */
export function summarizeTaker(
  list: (Pick<FlowTask, 'kind' | 'status' | 'due_date'> & {
    completed_at: string | null
  })[],
  today: string,
): TakerStats {
  const out: TakerStats = { open: 0, overdue: 0, on_time: 0, done_due: 0 }
  for (const t of list) {
    if (t.kind !== 'assigned') continue
    if (isTakerOpen(t.status)) {
      out.open++
      if (taskOverdueDays(t, today) > 0) out.overdue++
    } else if (
      t.status === 'done' &&
      t.due_date &&
      daysSince(t.completed_at, today) < CLOSED_KEEP_DAYS
    ) {
      out.done_due++
      if (taskLateDays(t.due_date, t.completed_at) === 0) out.on_time++
    }
  }
  return out
}

// ---- "Việc của tôi" (P5) + đường dẫn chuông ----------------------------------

export const MINE_FILTERS = ['doing', 'overdue', 'waiting', 'done', 'cancelled'] as const
export type MineFilter = (typeof MINE_FILTERS)[number]

export const MINE_FILTER_LABEL: Record<MineFilter, string> = {
  doing: 'Cần làm',
  overdue: 'Quá hạn',
  waiting: 'Chờ duyệt',
  done: `Xong ${CLOSED_KEEP_DAYS} ngày`,
  cancelled: `Đã huỷ ${CLOSED_KEEP_DAYS} ngày`,
}

/**
 * Lọc việc NGƯỜI NHẬN thấy. "Cần làm" = bóng ở tôi — đúng tập ô "Việc được giao"
 * trên Bàn làm việc; "Chờ duyệt" = đã báo hoàn thành, bóng ở người giao.
 */
export function matchesMine(t: ListTask, f: MineFilter, today: string): boolean {
  switch (f) {
    case 'doing':
      return isTakerOpen(t.status)
    case 'overdue':
      return taskOverdueDays(t, today) > 0
    case 'waiting':
      return t.status === 'submitted'
    case 'done':
    case 'cancelled':
      return matchesGiven(t, f, today)
  }
}

export function summarizeMine(
  list: ListTask[],
  today: string,
): Record<MineFilter, number> {
  const out = { doing: 0, overdue: 0, waiting: 0, done: 0, cancelled: 0 }
  for (const t of list)
    for (const f of MINE_FILTERS) if (matchesMine(t, f, today)) out[f]++
  return out
}

/**
 * Chip đầu tiên có chứa việc này — chuông mở trang thì chip này được chọn sẵn,
 * để dòng việc nằm trong bảng chứ không bị bộ lọc mặc định giấu đi.
 */
export function filterHolding<F extends string>(
  filters: readonly F[],
  match: (f: F) => boolean,
): F | null {
  return filters.find(match) ?? null
}

/**
 * Chuông việc mở ĐÂY (P5): trang dùng chung tự chọn mục + chip có việc đó và tô
 * dòng. Một chỗ cho mọi người — người ngoài Cung ứng không có Bàn làm việc.
 */
export function taskHref(taskId: string): string {
  return `/phan-cong-viec?viec=${encodeURIComponent(taskId)}`
}
