'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { TeamJobCard } from '@/modules/dept/production/jobs.service'

/**
 * VIỆC CỦA TỔ — trang chính workspace Tổ sản xuất (0087, mobile-first): CHỈ
 * thẻ việc (ảnh SP + thông số + tiến độ % + đối chiếu + nút Xong/ghi chú).
 * Lệnh đang chạy (/to/lenh) và Quá trình tổ (/to/qua-trinh) là trang riêng.
 */

export type TeamCard = TeamJobCard & { image_url: string | null }

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtN = (n: number) => n.toLocaleString('vi-VN')

const STATUS_LABEL = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Đã xong' } as const
const STATUS_TONE = { todo: 'gray', doing: 'amber', done: 'green' } as const

const SPEC_LABELS: [keyof TeamCard['spec'], string][] = [
  ['machine', 'Máy/dây'],
  ['cushion', 'Nệm'],
  ['paint', 'Sơn'],
  ['glass', 'Kính'],
  ['wood', 'Gỗ'],
]

export function TeamScreen({
  teamId,
  cards,
  teams,
  canPick,
  canConfirm,
  isManager,
}: {
  teamId: string | null
  cards: TeamCard[]
  teams: { id: string; name: string }[]
  canPick: boolean
  canConfirm: boolean
  isManager: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [hideDone, setHideDone] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<TeamCard | null>(null)
  const [needOverride, setNeedOverride] = useState(false)
  const [overrideNote, setOverrideNote] = useState('')
  const [noteFor, setNoteFor] = useState<TeamCard | null>(null)
  const [noteText, setNoteText] = useState('')

  const shown = useMemo(
    () => (hideDone ? cards.filter((c) => c.status !== 'done') : cards),
    [cards, hideDone],
  )
  const doneCount = cards.filter((c) => c.status === 'done').length

  async function patchJob(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusy(true)
    try {
      await api(`/api/dept/production/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      toast.success(okMsg)
      setConfirmFor(null)
      setNoteFor(null)
      setNeedOverride(false)
      setOverrideNote('')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'JOB_NOT_READY') {
        setNeedOverride(true)
        toast.error(e.message)
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Không thao tác được')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Tổ sản xuất' }]}
        title="Việc của tổ"
        description="Đối chiếu số thống kê đã nhập — đủ số thì bấm Xong để bàn giao tổ sau. Bấm ℹ xem thông số + thông tin lệnh."
      />

      <div className="flex flex-wrap items-center gap-2">
        {canPick && (
          <select
            value={teamId ?? ''}
            onChange={(e) =>
              router.push(e.target.value ? `/to?team=${e.target.value}` : '/to')
            }
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">— Chọn tổ —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="h-4 w-4"
          />
          Ẩn việc đã xong ({doneCount})
        </label>
      </div>

      {!teamId ? (
        <EmptyState
          icon="▤"
          title="Chưa chọn tổ"
          description="Chọn tổ ở trên để xem việc. Nhân viên tổ vào thẳng việc tổ mình."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="✓"
          title={cards.length === 0 ? 'Tổ chưa có việc' : 'Hết việc dở'}
          description={
            cards.length === 0
              ? 'Kế hoạch giao việc cho tổ sẽ hiện ở đây.'
              : 'Mọi việc của tổ đã xong.'
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((c) => {
            const pct =
              c.progress.needed > 0
                ? Math.min(100, Math.round((c.progress.done / c.progress.needed) * 100))
                : 0
            const isOpen = expanded === c.id
            return (
              <div
                key={c.id}
                className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-950 ${
                  c.late === 'overdue'
                    ? 'border-red-300 dark:border-red-800'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl text-zinc-400 dark:bg-zinc-900">
                      ◇
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">
                      {c.product_name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {c.product_code} · {fmtN(c.line_qty)} SP · {c.customer_name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {c.stage_label}
                      </span>
                      {c.planned_end && (
                        <span className="text-zinc-500">
                          Hạn: <b>{fmtD(c.planned_end)}</b>
                        </span>
                      )}
                      {c.late && (
                        <Badge tone={c.late === 'overdue' ? 'red' : 'amber'}>
                          {c.late === 'overdue' ? 'Trễ hạn xuất' : 'Sát hạn'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </div>

                <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                  {c.progress.has_components ? (
                    <>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Số thống kê đã ghi / cần</span>
                        <b
                          className={
                            c.progress.ready
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-zinc-700 dark:text-zinc-200'
                          }
                        >
                          {fmtN(c.progress.done)}/{fmtN(c.progress.needed)} ({pct}%)
                        </b>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${
                            c.progress.ready
                              ? 'bg-green-500'
                              : c.late === 'overdue'
                                ? 'bg-red-500'
                                : 'bg-sky-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {c.progress.shortfalls.length > 0 && c.status !== 'done' && (
                        <ul className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                          {c.progress.shortfalls.slice(0, isOpen ? 99 : 3).map((s) => (
                            <li key={s.component_id}>
                              {s.name}: thiếu {fmtN(s.missing)} (đã {fmtN(s.done)}/
                              {fmtN(s.needed)})
                            </li>
                          ))}
                          {!isOpen && c.progress.shortfalls.length > 3 && (
                            <li>… +{c.progress.shortfalls.length - 3} chi tiết</li>
                          )}
                        </ul>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500">
                      Chưa có bảng chi tiết để đối chiếu — nhờ thống kê định hình trước.
                    </span>
                  )}
                  {c.note && (
                    <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-500 dark:border-zinc-700">
                      📝 {c.note}
                    </p>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
                    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-300">
                      <span>
                        Lệnh: <b className="font-mono">{c.lsx_code}</b>
                      </span>
                      <span>
                        Đơn: <b>{c.order_code}</b>
                      </span>
                      <span>
                        Xuất: <b>{fmtD(c.ship_date)}</b>
                      </span>
                      {c.planned_start && (
                        <span>
                          KH: {fmtD(c.planned_start)} → {fmtD(c.planned_end)}
                        </span>
                      )}
                    </div>
                    {SPEC_LABELS.some(([k]) => c.spec[k]) ? (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {SPEC_LABELS.filter(([k]) => c.spec[k]).map(([k, label]) => (
                          <div key={k} className="flex gap-1">
                            <dt className="text-zinc-400">{label}:</dt>
                            <dd className="font-medium">{c.spec[k]}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-zinc-400">Lệnh không có thông số riêng.</p>
                    )}
                    <Link
                      href={`/to/lsx/${c.production_order_id}`}
                      className="mt-2 inline-block text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Xem hồ sơ lệnh đầy đủ →
                    </Link>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {canConfirm && c.status !== 'done' && (
                    <button
                      onClick={() => {
                        setConfirmFor(c)
                        setNeedOverride(false)
                        setOverrideNote('')
                      }}
                      disabled={busy}
                      className={`flex-1 rounded-xl py-3 text-sm font-bold ${
                        c.progress.ready
                          ? 'bg-green-600 text-white active:bg-green-700'
                          : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      ✓ Xong công đoạn
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="rounded-xl border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700"
                    title="Thông tin lệnh + thông số SX"
                  >
                    {isOpen ? '▴' : 'ℹ'}
                  </button>
                  {canConfirm && c.status !== 'done' && (
                    <button
                      onClick={() => {
                        setNoteFor(c)
                        setNoteText(c.note ?? '')
                      }}
                      disabled={busy}
                      className="rounded-xl border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700"
                      title="Sửa ghi chú"
                    >
                      📝
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal xác nhận xong */}
      <Modal
        open={!!confirmFor}
        onClose={() => setConfirmFor(null)}
        title={`Xong ${confirmFor?.stage_label ?? ''} — ${confirmFor?.product_name ?? ''}`}
      >
        {confirmFor && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {confirmFor.progress.ready
                ? `Đủ số (${fmtN(confirmFor.progress.done)}/${fmtN(confirmFor.progress.needed)}) — xác nhận để bàn giao tổ sau.`
                : 'Số thống kê nhập CHƯA đủ — hệ sẽ chặn. Nếu số ngoài xưởng đã đủ, nhờ thống kê ghi sổ; muốn cho qua phải là Ban quản lý kèm lý do.'}
            </p>
            {needOverride && isManager && (
              <textarea
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                rows={2}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm dark:border-red-800 dark:bg-zinc-900"
                placeholder="Lý do ép xác nhận (bắt buộc)"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmFor(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Huỷ
              </button>
              {needOverride && isManager ? (
                <button
                  onClick={() =>
                    patchJob(
                      confirmFor.id,
                      { action: 'confirm', override: true, note: overrideNote },
                      'Đã ép xác nhận xong công đoạn',
                    )
                  }
                  disabled={busy || !overrideNote.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy && <Spinner size={14} />} Ép xác nhận
                </button>
              ) : (
                <button
                  onClick={() =>
                    patchJob(
                      confirmFor.id,
                      { action: 'confirm' },
                      `${confirmFor.stage_label} của ${confirmFor.product_name} đã xong`,
                    )
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy && <Spinner size={14} />} Xác nhận xong
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal ghi chú */}
      <Modal
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={`Ghi chú — ${noteFor?.product_name ?? ''}`}
      >
        {noteFor && (
          <div className="flex flex-col gap-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="VD: hàng trần chờ sơn, thiếu ống 25…"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNoteFor(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Huỷ
              </button>
              <button
                onClick={() =>
                  patchJob(
                    noteFor.id,
                    { action: 'note', note: noteText.trim() || null },
                    'Đã lưu ghi chú',
                  )
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {busy && <Spinner size={14} />} Lưu
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
