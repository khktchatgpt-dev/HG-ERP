'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RotateCcw, Undo2, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import {
  GIVEN_FILTER_LABEL,
  GIVEN_FILTERS,
  matchesGiven,
  type GivenFilter,
} from '@/lib/task-flow'
import type { GivenBoard, GivenItem } from '@/modules/workflow/tasks/tasks.service'
import { btn, dmVn, fieldCls, lateDays, StatusTag, Tag } from './phan-cong.shared'

/**
 * "VIỆC TÔI GIAO" (bản vẽ 1, P2): cái nào chờ tôi duyệt, cái nào trễ.
 *
 * Số trên chip và dòng trong bảng đi qua CÙNG `matchesGiven` — server đếm, màn
 * lọc lại trên đúng tập đó. Nút trên dòng là `actions` server trả (luật ở
 * `task-flow`), màn hình không tự đoán. Trả lại / Huỷ mở một ô nhỏ NGAY DƯỚI dòng.
 */

type Step = { id: string; kind: 'reject' | 'cancel' }

export function ViecToiGiao({ board, today }: { board: GivenBoard; today: string }) {
  const router = useRouter()
  const [filter, setFilter] = useState<GivenFilter>(board.summary.to_approve > 0 ? 'to_approve' : 'open') // prettier-ignore
  const [step, setStep] = useState<Step | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loi, setLoi] = useState<{ id: string; text: string } | null>(null)
  // Ghi xong → tải lại trang (vài giây ở máy dev). Trong lúc đó dòng vừa bấm hiện
  // "Đã ghi — đang cập nhật…" thay vì nút cũ, kẻo bấm lần hai. Hết chờ khi `board`
  // mới về: so CHÍNH đối tượng `board` lúc bấm, không cần effect (đo 30/10/2026).
  const [waiting, setWaiting] = useState<{ id: string; seen: GivenBoard } | null>(null)

  const rows = board.items.filter((t) => matchesGiven(t, filter, today))

  async function call(t: GivenItem, path: string, body?: unknown) {
    setBusy(t.id)
    setLoi(null)
    try {
      await api(`/api/tasks/${t.id}/${path}`, { method: 'POST', body })
      setWaiting({ id: t.id, seen: board })
      setStep(null)
      setReason('')
      router.refresh()
    } catch (e) {
      setLoi({ id: t.id, text: apiErrorText(e, 'Chưa ghi được — thử lại') })
    } finally {
      setBusy(null)
    }
  }

  function actions(t: GivenItem) {
    if (busy === t.id)
      return <span className="text-[12px] text-[var(--muted-foreground)]">Đang ghi…</span>
    if (waiting?.id === t.id && waiting.seen === board)
      return (
        <span role="status" className="text-[12px] text-[var(--muted-foreground)]">
          Đã ghi — đang cập nhật…
        </span>
      )
    return (
      <div className="flex justify-end gap-1">
        {t.actions.includes('approve') && (
          <button
            type="button"
            className={btn('primary', false, true)}
            onClick={() => void call(t, 'approve', {})}
          >
            <Check size={14} aria-hidden />
            Đạt
          </button>
        )}
        {t.actions.includes('reject') && (
          <button
            type="button"
            className={btn('normal', false, true)}
            onClick={() => {
              setStep({ id: t.id, kind: 'reject' })
              setReason('')
            }}
          >
            <Undo2 size={14} aria-hidden />
            Trả lại
          </button>
        )}
        {t.actions.includes('restore') && (
          <button
            type="button"
            className={btn('normal', false, true)}
            onClick={() => void call(t, 'status', { status: 'todo' })}
          >
            <RotateCcw size={14} aria-hidden />
            Mở lại
          </button>
        )}
        {t.actions.includes('cancel') && !t.actions.includes('approve') && (
          <button
            type="button"
            className={btn('ghost', false, true)}
            onClick={() => setStep({ id: t.id, kind: 'cancel' })}
          >
            <X size={14} aria-hidden />
            Huỷ
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div
        role="group"
        aria-label="Lọc việc"
        className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--card)] px-3.5 py-2"
      >
        {GIVEN_FILTERS.map((f) => {
          const n = board.summary[f]
          const on = f === filter
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setFilter(f)
                setStep(null)
              }}
              className={`inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] ${on ? 'border-[var(--primary)]/40 bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]' : 'border-[var(--input)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)]'}`}
            >
              {GIVEN_FILTER_LABEL[f]}
              <span
                className={`font-mono tabular-nums ${(f === 'overdue' || f === 'to_approve') && n > 0 && !on ? 'font-semibold text-[var(--stop)]' : ''}`}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col gap-1 bg-[var(--card)] px-4 py-8">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">
            {board.items.length === 0
              ? 'Bạn chưa giao việc nào'
              : `Không có việc nào ở mục "${GIVEN_FILTER_LABEL[filter]}"`}{' '}
            {/* prettier-ignore */}
          </p>
          <p className="text-[12px] text-[var(--muted-foreground)]">
            {board.items.length === 0
              ? 'Dùng hộp "Giao việc" bên phải: chọn người, ghi việc, đặt hạn. Người nhận có chuông ngay.'
              : 'Chọn mục khác ở hàng trên để xem việc còn lại.'}
          </p>
        </div>
      ) : (
        <div className="max-h-[calc(100dvh-240px)] min-h-0 overflow-auto bg-[var(--card)]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-[1] bg-[var(--muted)]">
              <tr className="text-left text-[11px] tracking-[0.05em] text-[var(--muted-foreground)] uppercase">
                <th className="border-b border-[var(--input)] px-3 py-1.5 font-semibold">
                  Hạn
                </th>
                <th className="border-b border-[var(--input)] px-2 py-1.5 font-semibold">
                  Việc
                </th>
                <th className="border-b border-[var(--input)] px-2 py-1.5 font-semibold">
                  Người nhận
                </th>
                <th className="border-b border-[var(--input)] px-2 py-1.5 font-semibold">
                  Tình trạng
                </th>
                <th
                  className="border-b border-[var(--input)] px-3 py-1.5"
                  aria-label="Thao tác"
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const open = step?.id === t.id ? step : null
                const err = loi?.id === t.id ? loi.text : null
                return (
                  <Fragment key={t.id}>
                    <tr
                      className={`align-top ${t.status === 'submitted' ? 'bg-[var(--warn)]/5' : ''}`}
                    >
                      <td className="border-b border-[var(--border)] px-3 py-1.5 font-mono whitespace-nowrap tabular-nums">
                        {t.due_date ? (
                          dmVn(t.due_date)
                        ) : (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        )}
                      </td>
                      <td className="min-w-[260px] border-b border-[var(--border)] px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-[var(--foreground)]">
                            {t.title}
                          </span>
                          {t.priority === 'urgent' && <Tag tone="stop">Gấp</Tag>}
                        </div>
                        {t.status === 'submitted' && t.last_result && (
                          <p className="text-[12px] text-[var(--muted-foreground)]">
                            “{t.last_result}”
                            {t.submitted_at ? ` · báo ${dmVn(t.submitted_at)}` : ''}
                          </p>
                        )}
                        {t.status === 'rejected' && t.last_reject && (
                          <p className="text-[12px] text-[var(--muted-foreground)]">
                            Trả lại: “{t.last_reject}”
                          </p>
                        )}
                      </td>
                      <td className="border-b border-[var(--border)] px-2 py-1.5 whitespace-nowrap">
                        {t.assignee_name ?? '—'}
                        <div className="text-[12px] text-[var(--muted-foreground)]">
                          {t.department_name ?? '—'}
                        </div>
                      </td>
                      <td className="border-b border-[var(--border)] px-2 py-1.5">
                        <StatusTag
                          status={t.status}
                          overdueDays={t.overdue_days}
                          late={lateDays(t.due_date, t.completed_at)}
                        />
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-1.5">
                        {actions(t)}
                      </td>
                    </tr>
                    {(open || err) && (
                      <tr>
                        <td
                          colSpan={5}
                          className="border-b border-[var(--border)] bg-[var(--muted)]/60 px-3 py-2"
                        >
                          {open?.kind === 'reject' && (
                            <div className="flex max-w-[640px] flex-col gap-1.5">
                              <label
                                htmlFor={`tl-${t.id}`}
                                className="text-[12px] font-semibold text-[var(--foreground)]"
                              >
                                Lý do trả lại — người nhận đọc câu này để làm tiếp
                              </label>
                              <textarea
                                id={`tl-${t.id}`}
                                rows={2}
                                autoFocus
                                maxLength={2000}
                                className={`${fieldCls} resize-y py-1.5`}
                                placeholder="Vd: Còn 6 SP chưa có ảnh"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setStep(null)
                                  if (
                                    e.key === 'Enter' &&
                                    (e.ctrlKey || e.metaKey) &&
                                    reason.trim()
                                  )
                                    void call(t, 'reject', { reason })
                                }}
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-disabled={!reason.trim()}
                                  className={btn('primary', !reason.trim())}
                                  onClick={() =>
                                    reason.trim() && void call(t, 'reject', { reason })
                                  }
                                >
                                  Trả lại
                                </button>
                                <button
                                  type="button"
                                  className={btn('ghost')}
                                  onClick={() => setStep(null)}
                                >
                                  Thôi
                                </button>
                                {!reason.trim() && (
                                  <span className="text-[12px] text-[var(--warn)]">
                                    Ghi lý do để người nhận biết phải làm thêm gì
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {open?.kind === 'cancel' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[12px] text-[var(--foreground)]">
                                Huỷ việc này? {t.assignee_name ?? 'Người nhận'} nhận
                                chuông báo không phải làm nữa.
                              </span>
                              <button
                                type="button"
                                className={btn('normal')}
                                onClick={() =>
                                  void call(t, 'status', { status: 'cancelled' })
                                }
                              >
                                Huỷ việc
                              </button>
                              <button
                                type="button"
                                className={btn('ghost')}
                                onClick={() => setStep(null)}
                              >
                                Thôi
                              </button>
                            </div>
                          )}
                          {err && (
                            <p
                              role="alert"
                              className="mt-1 text-[12px] text-[var(--stop)]"
                            >
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
            <tfoot className="sticky bottom-0 bg-[var(--muted)]">
              <tr>
                <td
                  colSpan={5}
                  className="border-t border-[var(--input)] px-3 py-1.5 text-[12px] text-[var(--muted-foreground)]"
                >
                  {rows.length} việc · {board.summary.open} chưa xong ·{' '}
                  {board.summary.to_approve} chờ tôi duyệt · {board.summary.overdue} quá
                  hạn · không gồm việc đã đóng quá 30 ngày {/* prettier-ignore */}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
