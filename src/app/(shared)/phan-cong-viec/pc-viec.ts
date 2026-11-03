import {
  ASSIGN_BLOCKED,
  TASK_STATUS_LABEL,
  type TaskAction,
  type TaskStatus,
} from '@/lib/task-flow'
import type { AssignedItem, GivenItem } from '@/modules/workflow/tasks/tasks.service'
import { fold } from './phan-cong.shared'

/**
 * Đồ thuần của trang Phân công việc bản 3 (lối ERP, không kit): một dòng việc, nhãn
 * tình trạng một chữ, tìm, và câu nói vì sao một nút trên Action Pane chưa bấm được.
 */

export type Viec = AssignedItem | GivenItem
export type Muc = 'cua-toi' | 'giao'

export type Tone = 'act' | 'warn' | 'stop' | 'done' | 'idle'

/** Tình trạng MỘT CHỮ cho ô lưới — trễ hạn thắng mọi nhãn khác. */
export function tinhTrang(t: Pick<Viec, 'status' | 'overdue_days'>): {
  label: string
  tone: Tone
} {
  if (t.overdue_days > 0) return { label: `Trễ ${t.overdue_days} ngày`, tone: 'stop' }
  const tone: Record<TaskStatus, Tone> = {
    todo: 'idle',
    in_progress: 'act',
    submitted: 'warn',
    done: 'done',
    rejected: 'stop',
    cancelled: 'idle',
    on_hold: 'idle',
  }
  return { label: TASK_STATUS_LABEL[t.status], tone: tone[t.status] }
}

/** Gõ không dấu tìm theo mã, tên việc, người giao, người nhận. */
export function khopTim(t: Viec, q: string): boolean {
  const k = fold(q.trim())
  if (!k) return true
  return fold(
    [t.task_code, t.title, t.assigner_name, t.assignee_name, t.department_name]
      .filter(Boolean)
      .join(' '),
  ).includes(k)
}

/** Nút trên Action Pane — mỗi mục chỉ có nút của vai mình. */
export const NUT: Record<Muc, { a: TaskAction; label: string; chinh?: boolean }[]> = {
  'cua-toi': [
    { a: 'start', label: 'Bắt đầu' },
    { a: 'submit', label: 'Báo hoàn thành', chinh: true },
  ],
  giao: [
    { a: 'approve', label: 'Duyệt Đạt', chinh: true },
    { a: 'reject', label: 'Trả lại' },
    { a: 'restore', label: 'Mở lại' },
    { a: 'cancel', label: 'Huỷ việc' },
  ],
}

/** Nhãn "Bắt đầu" đổi thành "Làm tiếp" khi việc bị trả lại / tạm hoãn. */
export function nhanNut(a: TaskAction, label: string, t: Viec | null): string {
  if (a === 'start' && t && (t.status === 'rejected' || t.status === 'on_hold'))
    return 'Làm tiếp'
  return label
}

/**
 * Vì sao nút `a` chưa bấm được với dòng đang chọn — null = bấm được. Câu nói việc
 * đang ở đâu và cần gì, hiện ngay dưới Action Pane khi bấm vào nút khoá.
 */
export function vuong(a: TaskAction, label: string, t: Viec | null): string | null {
  if (!t) return `Chọn một việc trong lưới để ${label.toLowerCase()}.`
  if ((t.actions as TaskAction[]).includes(a)) return null
  const dang = `${t.task_code ?? 'Việc này'} đang “${tinhTrang(t).label}”`
  if (a === 'approve' || a === 'reject') return `${dang} — chỉ việc Chờ duyệt mới ${label.toLowerCase()} được.` // prettier-ignore
  if (a === 'submit') return `${dang} — không báo hoàn thành được nữa.`
  if (a === 'start') return `${dang} — không cần bắt đầu.`
  if (a === 'restore') return `${dang} — chỉ việc đã huỷ mới mở lại được.`
  if (a === 'cancel') return `${dang} — không huỷ được nữa.`
  return dang
}

export { ASSIGN_BLOCKED }
