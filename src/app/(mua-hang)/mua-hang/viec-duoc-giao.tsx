'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Play } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { todayVn } from '@/lib/date-vn'
import { TASK_STATUS_LABEL } from '@/lib/task-flow'
import type { AssignedItem } from '@/modules/workflow/tasks/tasks.service'

/**
 * Ô "VIỆC ĐƯỢC GIAO" trên Bàn làm việc (phân công việc P3, bản vẽ B 30/10/2026).
 *
 * VIẾT KHÔNG KIT (chủ dự án chốt D1: phần thêm mới không dùng bộ kit, Bàn làm việc
 * giữ nguyên). Chỉ dùng biến màu của khung `.kit` bao ngoài (`--act`, `--stop`…) —
 * một màu hành động, ba màu vòng đời — không dùng thành phần nào của kit.
 *
 * Nút trên dòng là `actions` server trả: chủ bàn có "Bắt đầu" / "Báo hoàn thành";
 * người duyệt xem bàn người khác nhận danh sách rỗng nút (chỉ xem). Báo hoàn thành
 * mở ô kết quả NGAY DƯỚI dòng và bắt một câu (Q4).
 */

const btnBase = 'inline-flex h-6 items-center gap-1.5 rounded-[var(--radius)] border px-2 text-[12px] whitespace-nowrap' // prettier-ignore
const BTN = {
  primary: `${btnBase} border-[var(--act)] bg-[var(--act)] font-semibold text-[var(--act-ink)] hover:bg-[var(--act-hover)]`, // prettier-ignore
  normal: `${btnBase} border-[var(--line)] bg-[var(--surface-card)] font-medium text-[var(--ink)] hover:bg-[var(--surface)]`, // prettier-ignore
  ghost: `${btnBase} border-transparent bg-transparent font-medium text-[var(--act-text)] hover:bg-[var(--act-wash)]`, // prettier-ignore
  locked: `${btnBase} cursor-not-allowed border-[var(--line-faint)] bg-[var(--surface-raised)] text-[var(--ink-3)]`, // prettier-ignore
}

const dm = (at: string) => {
  const d = todayVn(new Date(at))
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

function StatusTag({ t }: { t: AssignedItem }) {
  const base = 'inline-flex h-5 items-center rounded-[var(--radius-sm)] border px-1.5 text-[12px] font-medium whitespace-nowrap' // prettier-ignore
  if (t.overdue_days > 0)
    return <span className={`${base} border-[var(--stop-line)] bg-[var(--stop-wash)] text-[var(--stop)]`}>Quá hạn {t.overdue_days} ngày</span> // prettier-ignore
  if (t.status === 'rejected')
    return <span className={`${base} border-[var(--stop-line)] bg-[var(--stop-wash)] text-[var(--stop)]`}>Bị trả lại</span> // prettier-ignore
  if (t.status === 'in_progress')
    return <span className={`${base} border-[var(--act-line)] bg-[var(--act-wash)] text-[var(--act-text)]`}>Đang làm</span> // prettier-ignore
  return <span className={`${base} border-[var(--hair)] bg-[var(--surface-raised)] text-[var(--ink-label)]`}>{TASK_STATUS_LABEL[t.status]}</span> // prettier-ignore
}

export function ViecDuocGiao({
  items,
  readOnly,
  who,
}: {
  items: AssignedItem[]
  /** Người duyệt đang xem bàn người khác — không có nút. */
  readOnly: boolean
  /** "bạn" hoặc tên chủ bàn khi xem bàn người khác. */
  who: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loi, setLoi] = useState<{ id: string; text: string } | null>(null)
  // Ghi xong → tải lại trang. Trong lúc chờ, dòng vừa bấm nói "đang cập nhật" thay vì
  // nút cũ (kẻo bấm hai lần). Hết chờ khi `items` mới về — so CHÍNH mảng lúc bấm.
  const [waiting, setWaiting] = useState<{ id: string; seen: AssignedItem[] } | null>(
    null,
  )

  const overdue = items.filter((t) => t.overdue_days > 0).length

  async function call(t: AssignedItem, path: 'submit' | 'status', body: unknown) {
    setBusy(t.id)
    setLoi(null)
    try {
      await api(`/api/tasks/${t.id}/${path}`, { method: 'POST', body })
      setWaiting({ id: t.id, seen: items })
      setOpen(null)
      setResult('')
      router.refresh()
    } catch (e) {
      setLoi({ id: t.id, text: apiErrorText(e, 'Chưa ghi được — thử lại') })
    } finally {
      setBusy(null)
    }
  }

  const th = 'border-b border-[var(--line)] px-2 py-1.5 text-left text-[11px] font-semibold tracking-[0.05em] text-[var(--ink-label)] uppercase' // prettier-ignore
  const td = 'border-b border-[var(--hair)] px-2 py-1.5 align-top'

  return (
    <div className="min-h-0 overflow-auto bg-[var(--surface-card)]">
      <table className="w-full border-collapse text-[13px] text-[var(--ink)]">
        <thead className="sticky top-0 z-[1] bg-[var(--surface-raised)]">
          <tr>
            <th className={`${th} pl-3.5`}>Hạn</th>
            <th className={th}>Việc</th>
            <th className={th}>Người giao</th>
            <th className={th}>Tình trạng</th>
            <th className={th} aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const isOpen = open === t.id
            const err = loi?.id === t.id ? loi.text : null
            const isWaiting = waiting?.id === t.id && waiting.seen === items
            return (
              <Fragment key={t.id}>
                <tr>
                  <td className={`${td} pl-3.5 font-mono whitespace-nowrap tabular-nums`}>
                    {t.due_date ? (
                      dm(t.due_date)
                    ) : (
                      <span className="text-[var(--ink-3)]">—</span>
                    )}
                  </td>
                  <td className={`${td} min-w-[280px]`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{t.title}</span>
                      {t.priority === 'urgent' && (
                        <span className="inline-flex h-[18px] items-center rounded-[var(--radius-sm)] border border-[var(--stop-line)] bg-[var(--stop-wash)] px-1.5 text-[11px] font-semibold text-[var(--stop)]">
                          Gấp
                        </span>
                      )}
                    </div>
                    {
                      t.description &&
                      <p className="line-clamp-2 text-[12px] whitespace-pre-line text-[var(--ink-3)]">{t.description}</p> // prettier-ignore
                    }
                    {t.status === 'rejected' && t.last_reject && (
                      <p className="text-[12px] text-[var(--stop)]">
                        Trả lại: “{t.last_reject}”
                      </p>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{t.assigner_name ?? '—'}</td>
                  <td className={td}>
                    <StatusTag t={t} />
                  </td>
                  <td className={`${td} pr-3.5`}>
                    {busy === t.id ? (
                      <span className="text-[12px] text-[var(--ink-3)]">Đang ghi…</span>
                    ) : isWaiting ? (
                      <span role="status" className="text-[12px] text-[var(--ink-3)]">
                        Đã ghi — đang cập nhật…
                      </span>
                    ) : (
                      !isOpen && (
                        <div className="flex justify-end gap-1">
                          {t.actions.includes('start') && t.status !== 'rejected' && (
                            <button
                              type="button"
                              className={BTN.normal}
                              onClick={() =>
                                void call(t, 'status', { status: 'in_progress' })
                              }
                            >
                              <Play size={13} aria-hidden />
                              Bắt đầu
                            </button>
                          )}
                          {t.actions.includes('submit') && (
                            <button
                              type="button"
                              className={BTN.primary}
                              onClick={() => {
                                setOpen(t.id)
                                setResult('')
                                setLoi(null)
                              }}
                            >
                              <Check size={13} aria-hidden />
                              Báo hoàn thành
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </td>
                </tr>
                {(isOpen || err) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-3.5 py-2"
                    >
                      {isOpen && (
                        <div className="flex max-w-[640px] flex-col gap-1.5">
                          <label
                            htmlFor={`kq-${t.id}`}
                            className="text-[11px] font-semibold tracking-[0.05em] text-[var(--ink-label)] uppercase"
                          >
                            Kết quả — người giao đọc câu này để duyệt
                          </label>
                          <textarea
                            id={`kq-${t.id}`}
                            rows={2}
                            autoFocus
                            maxLength={2000}
                            className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-1.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--act)]"
                            placeholder="Đã làm gì, còn gì chưa xong…"
                            value={result}
                            onChange={(e) => setResult(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setOpen(null)
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && result.trim()) void call(t, 'submit', { result }) // prettier-ignore
                            }}
                          />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              aria-disabled={!result.trim()}
                              className={result.trim() ? BTN.primary : BTN.locked}
                              onClick={() =>
                                result.trim() && void call(t, 'submit', { result })
                              }
                            >
                              <Check size={13} aria-hidden />
                              Báo hoàn thành
                            </button>
                            <button
                              type="button"
                              className={BTN.ghost}
                              onClick={() => setOpen(null)}
                            >
                              Thôi
                            </button>
                            {
                              !result.trim() &&
                              <span className="text-[12px] text-[var(--warn)]">Ghi một câu kết quả để người giao biết đã làm gì</span> // prettier-ignore
                            }
                          </div>
                        </div>
                      )}
                      {err && (
                        <p role="alert" className="mt-1 text-[12px] text-[var(--stop)]">
                          {err}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0 bg-[var(--surface-raised)]">
          <tr>
            <td
              colSpan={5}
              className="border-t border-[var(--line)] px-3.5 py-1.5 text-[12px] text-[var(--ink-label)]"
            >
              {items.length} việc đang giao cho {who}
              {overdue > 0 ? ` · ${overdue} quá hạn` : ''} · việc đã báo hoàn thành đang
              chờ người giao duyệt thì không nằm ở đây
              {readOnly ? ` · chỉ xem — ${who} tự báo hoàn thành trên bàn của mình` : ''}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
