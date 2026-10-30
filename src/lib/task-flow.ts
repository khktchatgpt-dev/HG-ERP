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
