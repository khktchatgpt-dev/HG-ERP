'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Play } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import {
  MINE_FILTER_LABEL,
  MINE_FILTERS,
  TASK_STATUS_LABEL,
  matchesMine,
  type MineFilter,
} from '@/lib/task-flow'
import type { AssignedItem, MineBoard } from '@/modules/workflow/tasks/tasks.service'
import { btn, dmVn, fieldCls, lateDays, Tag } from './phan-cong.shared'

/**
 * VIỆC CỦA TÔI — việc sếp / quản lý giao cho người đang xem, nhìn từ phía NGƯỜI NHẬN.
 *
 * Bảng dùng ở HAI chỗ (một luật, một cách bấm): ô "Việc được giao" trên Bàn làm việc
 * Cung ứng (P3) và mục "Việc của tôi" ở trang Phân công việc cho người ngoài Cung
 * ứng (P5, chốt D2). Nút trên dòng là `actions` server trả — chủ việc có "Bắt đầu" /
 * "Báo hoàn thành", người xem bàn người khác nhận danh sách rỗng. Báo hoàn thành mở
 * ô kết quả NGAY DƯỚI dòng và bắt một câu (Q4).
 */

/** Tình trạng nhìn từ phía NGƯỜI NHẬN. Quá hạn thắng mọi nhãn khác. */
function TakerTag({ t }: { t: AssignedItem }) {
  if (t.overdue_days > 0) return <Tag tone="stop">Quá hạn {t.overdue_days} ngày</Tag>
  if (t.status === 'rejected') return <Tag tone="stop">Bị trả lại</Tag>
  if (t.status === 'in_progress') return <Tag tone="act">Đang làm</Tag>
  if (t.status === 'done') {
    const late = lateDays(t.due_date, t.completed_at)
    return (
      <Tag tone="done">
        Xong{late == null ? '' : late > 0 ? ` · trễ ${late} ngày` : ' · đúng hạn'}
      </Tag>
    )
  }
  return <Tag tone="off">{TASK_STATUS_LABEL[t.status]}</Tag>
}

/** Cuộn tới dòng chuông vừa mở — hàm cố định nên chỉ chạy một lần lúc dòng hiện ra. */
const scrollHere = (el: HTMLTableRowElement | null) =>
  el?.scrollIntoView?.({ block: 'nearest' })

export function BangViecCuaToi({
  version,
  rows,
  footer,
  focusId = null,
}: {
  /**
   * Đối tượng server trả, ĐỔI khi trang tải lại xong. Ghi xong thì dòng vừa bấm nói
   * "đang cập nhật" thay vì nút cũ (kẻo bấm hai lần) cho tới khi đối tượng này đổi.
   */
  version: object
  /** Dòng cần vẽ (đã lọc, đã xếp ở server). */
  rows: AssignedItem[]
  /** Chân bảng — câu nói bảng gồm gì, không gồm gì. */
  footer: React.ReactNode
  /** Việc chuông vừa mở — tô dòng và cuộn tới. */
  focusId?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loi, setLoi] = useState<{ id: string; text: string } | null>(null)
  const [waiting, setWaiting] = useState<{ id: string; seen: object } | null>(null)

  async function call(t: AssignedItem, path: 'submit' | 'status', body: unknown) {
    setBusy(t.id)
    setLoi(null)
    try {
      await api(`/api/tasks/${t.id}/${path}`, { method: 'POST', body })
      setWaiting({ id: t.id, seen: version })
      setOpen(null)
      setResult('')
      router.refresh()
    } catch (e) {
      setLoi({ id: t.id, text: apiErrorText(e, 'Chưa ghi được — thử lại') })
    } finally {
      setBusy(null)
    }
  }

  const th = 'border-b border-[var(--input)] px-2 py-1.5 font-semibold'
  const td = 'border-b border-[var(--border)] px-2 py-1.5 align-top'

  return (
    <table className="w-full border-collapse text-[13px] text-[var(--foreground)]">
      <thead className="sticky top-0 z-[1] bg-[var(--muted)]">
        <tr className="text-left text-[11px] tracking-[0.05em] text-[var(--muted-foreground)] uppercase">
          <th className={`${th} pl-3.5`}>Hạn</th>
          <th className={th}>Việc</th>
          <th className={th}>Người giao</th>
          <th className={th}>Tình trạng</th>
          <th className={th} aria-label="Thao tác" />
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const isOpen = open === t.id
          const err = loi?.id === t.id ? loi.text : null
          const isWaiting = waiting?.id === t.id && waiting.seen === version
          const focus = t.id === focusId
          return (
            <Fragment key={t.id}>
              <tr
                ref={focus ? scrollHere : undefined}
                aria-current={focus ? 'true' : undefined}
                className={focus ? 'bg-[var(--accent)]' : undefined}
              >
                <td className={`${td} pl-3.5 font-mono whitespace-nowrap tabular-nums`}>
                  {t.due_date ? (
                    dmVn(t.due_date)
                  ) : (
                    <span className="text-[var(--muted-foreground)]">—</span>
                  )}
                </td>
                <td className={`${td} min-w-[280px]`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{t.title}</span>
                    {t.priority === 'urgent' && <Tag tone="stop">Gấp</Tag>}
                  </div>
                  {t.description && (
                    <p className="line-clamp-2 text-[12px] whitespace-pre-line text-[var(--muted-foreground)]">
                      {t.description}
                    </p>
                  )}
                  {t.status === 'rejected' && t.last_reject && (
                    <p className="text-[12px] text-[var(--stop)]">
                      Trả lại: “{t.last_reject}”
                    </p>
                  )}
                  {(t.status === 'submitted' || t.status === 'done') && t.last_result && (
                    <p className="text-[12px] text-[var(--muted-foreground)]">
                      Đã báo: “{t.last_result}”
                      {t.submitted_at ? ` · ${dmVn(t.submitted_at)}` : ''}
                    </p>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap`}>{t.assigner_name ?? '—'}</td>
                <td className={td}>
                  <TakerTag t={t} />
                </td>
                <td className={`${td} pr-3.5`}>
                  {busy === t.id ? (
                    <span className="text-[12px] text-[var(--muted-foreground)]">
                      Đang ghi…
                    </span>
                  ) : isWaiting ? (
                    <span
                      role="status"
                      className="text-[12px] text-[var(--muted-foreground)]"
                    >
                      Đã ghi — đang cập nhật…
                    </span>
                  ) : (
                    !isOpen && (
                      <div className="flex justify-end gap-1">
                        {t.actions.includes('start') && t.status !== 'rejected' && (
                          <button
                            type="button"
                            className={btn('normal', false, true)}
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
                            className={btn('primary', false, true)}
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
                    className="border-b border-[var(--border)] bg-[var(--muted)] px-3.5 py-2"
                  >
                    {isOpen && (
                      <div className="flex max-w-[640px] flex-col gap-1.5">
                        <label
                          htmlFor={`kq-${t.id}`}
                          className="text-[11px] font-semibold tracking-[0.05em] text-[var(--muted-foreground)] uppercase"
                        >
                          Kết quả — người giao đọc câu này để duyệt
                        </label>
                        <textarea
                          id={`kq-${t.id}`}
                          rows={2}
                          autoFocus
                          maxLength={2000}
                          className={`${fieldCls} resize-y py-1.5`}
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
                            className={btn('primary', !result.trim(), true)}
                            onClick={() =>
                              result.trim() && void call(t, 'submit', { result })
                            }
                          >
                            <Check size={13} aria-hidden />
                            Báo hoàn thành
                          </button>
                          <button
                            type="button"
                            className={btn('ghost', false, true)}
                            onClick={() => setOpen(null)}
                          >
                            Thôi
                          </button>
                          {!result.trim() && (
                            <span className="text-[12px] text-[var(--warn)]">
                              Ghi một câu kết quả để người giao biết đã làm gì
                            </span>
                          )}
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
      <tfoot className="sticky bottom-0 bg-[var(--muted)]">
        <tr>
          <td
            colSpan={5}
            className="border-t border-[var(--input)] px-3.5 py-1.5 text-[12px] text-[var(--muted-foreground)]"
          >
            {footer}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

/** Mục "Việc của tôi" ở trang Phân công việc: chip lọc + bảng. */
export function ViecCuaToi({
  board,
  today,
  initialFilter,
  focusId = null,
}: {
  board: MineBoard
  today: string
  /** Chip chọn sẵn — chuông mở trang thì là chip có việc đó. */
  initialFilter?: MineFilter
  focusId?: string | null
}) {
  const [filter, setFilter] = useState<MineFilter>(
    initialFilter ??
      (board.summary.doing > 0 || board.summary.waiting === 0 ? 'doing' : 'waiting'),
  )
  const rows = board.items.filter((t) => matchesMine(t, filter, today))
  const s = board.summary

  return (
    <div className="flex min-h-0 flex-col">
      <div
        role="group"
        aria-label="Lọc việc của tôi"
        className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--card)] px-3.5 py-2"
      >
        {MINE_FILTERS.map((f) => {
          const n = s[f]
          const on = f === filter
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f)}
              className={`inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] ${on ? 'border-[var(--primary)]/40 bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]' : 'border-[var(--input)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)]'}`}
            >
              {MINE_FILTER_LABEL[f]}
              <span
                className={`font-mono tabular-nums ${f === 'overdue' && n > 0 && !on ? 'font-semibold text-[var(--stop)]' : ''}`}
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
              ? 'Chưa ai giao việc cho bạn'
              : `Không có việc nào ở mục "${MINE_FILTER_LABEL[filter]}"`}
          </p>
          <p className="text-[12px] text-[var(--muted-foreground)]">
            {board.items.length === 0
              ? 'Sếp hoặc quản lý giao việc thì bạn có chuông, và việc hiện ở đây để báo hoàn thành.'
              : 'Chọn mục khác ở hàng trên để xem việc còn lại.'}
          </p>
        </div>
      ) : (
        <div className="max-h-[calc(100dvh-240px)] min-h-0 overflow-auto bg-[var(--card)]">
          {/* Đổi mục lọc = bảng mới: ô kết quả đang mở của mục cũ không theo sang. */}
          <BangViecCuaToi
            key={filter}
            version={board}
            rows={rows}
            focusId={focusId}
            footer={
              <>
                {rows.length} việc · {s.doing} cần làm · {s.overdue} quá hạn · {s.waiting}{' '}
                chờ duyệt · không gồm việc đã đóng quá 30 ngày
              </>
            }
          />
        </div>
      )}
    </div>
  )
}
