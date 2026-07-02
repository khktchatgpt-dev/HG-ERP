import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { AppShell } from '@/components/AppShell'
import { TaskActions } from './TaskActions'
import { CommentForm } from './CommentForm'
import { ProgressSlider } from './ProgressSlider'
import { DeadlinePill } from '@/components/DeadlinePill'

const STATUS_LABEL: Record<string, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  done: 'Hoàn thành',
  rejected: 'Bị trả lại',
  cancelled: 'Đã huỷ',
  on_hold: 'Tạm hoãn',
}

const KIND_LABEL: Record<string, string> = {
  comment: 'Bình luận',
  progress_report: 'Báo cáo',
  approval: 'Duyệt',
  rejection: 'Trả lại',
  system: 'Hệ thống',
}

const ACTION_LABEL: Record<string, string> = {
  created: 'Tạo công việc',
  updated: 'Cập nhật',
  reassigned: 'Giao lại',
  status_changed: 'Đổi trạng thái',
  commented: 'Bình luận',
  attachment_added: 'Thêm tệp',
  attachment_removed: 'Xoá tệp',
  deleted: 'Xoá',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
  urgent: 'Khẩn cấp',
}

function describeActivity(action: string, payload: Record<string, unknown>): string {
  const label = ACTION_LABEL[action] ?? action
  if (action === 'status_changed') {
    const from = STATUS_LABEL[String(payload.from)] ?? String(payload.from ?? '')
    const to = STATUS_LABEL[String(payload.to)] ?? String(payload.to ?? '')
    return `${label}: ${from} → ${to}`
  }
  if (action === 'created' && payload.title) {
    return `${label}: ${payload.title}`
  }
  return label
}

export default async function TaskDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  let task
  try {
    task = await tasksService.get(user, id)
  } catch {
    notFound()
  }

  const [comments, activity] = await Promise.all([
    tasksService.listComments(user, id),
    tasksService.listActivity(user, id),
  ])

  const isAssignee = task.assignee_id === user.id
  const isAssigner = task.assigner_id === user.id || user.role === 'admin'

  return (
    <AppShell title={task.task_code} subtitle={task.title}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {STATUS_LABEL[task.status]}
              </span>
              <DeadlinePill
                dueDate={task.due_date}
                status={task.status}
                completedAt={task.completed_at}
              />
            </div>
            {task.description ? (
              <p className="mb-5 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {task.description}
              </p>
            ) : (
              <p className="mb-5 text-sm italic text-zinc-400">Không có mô tả.</p>
            )}
            <ProgressSlider
              taskId={task.id}
              initial={task.progress_percent}
              canEdit={isAssignee || isAssigner}
            />
          </section>

          <TaskActions
            taskId={task.id}
            status={task.status}
            isAssignee={isAssignee}
            isAssigner={isAssigner}
          />

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-500">
              Bình luận & Báo cáo
            </h2>
            <CommentForm taskId={task.id} canReport={isAssignee} />
            <ul className="mt-3 flex flex-col gap-3">
              {comments.length === 0 && (
                <li className="text-sm text-zinc-500">Chưa có bình luận.</li>
              )}
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {c.user_name ?? c.user_email}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                      {KIND_LABEL[c.kind] ?? c.kind}
                    </span>
                    <time>{new Date(c.created_at).toLocaleString('vi-VN')}</time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-4 text-sm">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
              Thông tin
            </h3>
            <dl className="space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Người giao</dt>
                <dd>{task.assigner_name ?? task.assigner_email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Người nhận</dt>
                <dd>{task.assignee_name ?? task.assignee_email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Phòng ban</dt>
                <dd>{task.department_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Ưu tiên</dt>
                <dd>{PRIORITY_LABEL[task.priority] ?? task.priority}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Hạn</dt>
                <dd>
                  {task.due_date
                    ? new Date(task.due_date).toLocaleString('vi-VN')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Tạo</dt>
                <dd>{new Date(task.created_at).toLocaleString('vi-VN')}</dd>
              </div>
              {task.completed_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Hoàn thành</dt>
                  <dd>{new Date(task.completed_at).toLocaleString('vi-VN')}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
              Lịch sử
            </h3>
            <ol className="space-y-1.5 text-xs">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-col">
                  <span>{describeActivity(a.action, a.payload)}</span>
                  <time className="text-zinc-500">
                    {new Date(a.created_at).toLocaleString('vi-VN')}
                  </time>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
