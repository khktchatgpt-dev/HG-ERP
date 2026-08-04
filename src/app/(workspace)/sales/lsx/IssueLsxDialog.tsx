'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/erp/Spinner'
import { suggestLsxCode } from '@/lib/lsx-code'
import type { AwaitingOrder } from './LsxWorkbench'

/**
 * HỘP THOẠI PHÁT LỆNH — chọn KHÁCH trước, ĐƠN sau.
 *
 * Bản đầu để Sales tick thẳng các đơn trên trang rồi mới điền số lệnh. Hai chỗ
 * vướng: (a) tick nhầm sang khách khác thì cả loạt đơn đang chọn bị xoá âm thầm
 * (một lệnh chỉ gộp đơn CÙNG MỘT KHÁCH); (b) Sales nghĩ theo lối "làm lệnh cho
 * ROSCO", chứ không phải "gom mấy đơn này lại".
 *
 * Nên đảo thứ tự: bước 1 chọn khách → bước 2 hiện đúng đơn của khách đó, TICK
 * SẴN HẾT (bỏ tick đơn chưa muốn đưa vào). Chọn nhầm khách thành chuyện không
 * thể xảy ra, không cần cảnh báo.
 */

const fmtD = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'
const fmtN = (n: number) => n.toLocaleString('vi-VN')

/** Hạn sớm nhất trong nhóm đơn — dùng làm hạn xuất gợi ý cho lệnh. */
function earliestDue(orders: AwaitingOrder[]): string {
  const dates = orders.map((o) => o.due_date).filter((d): d is string => !!d)
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : ''
}

export type IssueForm = {
  code: string
  ship_date: string
  container: string
}

export function IssueLsxDialog({
  open,
  onClose,
  awaiting,
  codesByCustomer,
  busy,
  onIssue,
}: {
  open: boolean
  onClose: () => void
  awaiting: AwaitingOrder[]
  /** Mã lệnh đã phát, gom theo khách — để gợi ý số lệnh kế tiếp. */
  codesByCustomer: Record<string, string[]>
  busy: boolean
  onIssue: (orderIds: string[], form: IssueForm) => Promise<void>
}) {
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState<IssueForm>({
    code: '',
    ship_date: '',
    container: '',
  })

  // Khách có đơn chờ, kèm số liệu tóm tắt để chọn mà không phải mở ra xem.
  const customers = useMemo(() => {
    const m = new Map<string, { id: string; name: string; orders: AwaitingOrder[] }>()
    for (const o of awaiting) {
      const g = m.get(o.customer_id) ?? {
        id: o.customer_id,
        name: o.customer_name,
        orders: [],
      }
      g.orders.push(o)
      m.set(o.customer_id, g)
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [awaiting])

  const shownCustomers = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(ql) ||
        c.orders.some((o) => o.code.toLowerCase().includes(ql)),
    )
  }, [customers, q])

  const current = customers.find((c) => c.id === customerId) ?? null
  const pickedOrders = current?.orders.filter((o) => picked.includes(o.id)) ?? []
  const pickedQty = pickedOrders.reduce((s, o) => s + o.qty, 0)

  function reset() {
    setCustomerId(null)
    setPicked([])
    setQ('')
    setForm({ code: '', ship_date: '', container: '' })
  }

  function close() {
    if (busy) return
    reset()
    onClose()
  }

  /** Chọn khách → tick sẵn mọi đơn, điền sẵn số lệnh + hạn xuất cho sửa. */
  function chooseCustomer(c: { id: string; name: string; orders: AwaitingOrder[] }) {
    setCustomerId(c.id)
    setPicked(c.orders.map((o) => o.id))
    setForm({
      code: suggestLsxCode({
        customerName: c.name,
        existingCodes: codesByCustomer[c.id] ?? [],
        year: new Date().getFullYear(),
      }),
      ship_date: earliestDue(c.orders),
      container: '',
    })
  }

  const canSubmit = !!form.code.trim() && picked.length > 0 && !busy

  return (
    <Modal
      open={open}
      onClose={close}
      title={current ? `Phát lệnh — ${current.name}` : 'Phát lệnh sản xuất'}
      maxWidth="sm:max-w-2xl"
    >
      {/* ── Bước 1: chọn khách ──────────────────────────────────────────── */}
      {!current && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Chọn khách hàng cần làm lệnh. Một lệnh gộp được nhiều đơn, nhưng phải là đơn
            của <b>cùng một khách</b>.
          </p>

          {customers.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Không còn đơn nào chờ — mọi đơn đã xác nhận đều đã có lệnh sản xuất.
            </p>
          ) : (
            <>
              {customers.length > 6 && (
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm khách hoặc mã đơn…"
                  autoFocus
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              )}
              <div className="flex flex-col gap-2">
                {shownCustomers.map((c) => {
                  const qty = c.orders.reduce((s, o) => s + o.qty, 0)
                  const due = earliestDue(c.orders)
                  return (
                    <button
                      key={c.id}
                      onClick={() => chooseCustomer(c)}
                      className="flex items-center gap-3 rounded-lg border border-zinc-300 px-3 py-2.5 text-left hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="mt-0.5 truncate text-xs text-zinc-500">
                          {c.orders.map((o) => o.code).join(', ')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-zinc-500">
                        <div>
                          <b className="text-zinc-800 dark:text-zinc-200">
                            {c.orders.length}
                          </b>{' '}
                          đơn · {fmtN(qty)} SP
                        </div>
                        {due && <div>hạn sớm nhất {fmtD(due)}</div>}
                      </div>
                      <span className="shrink-0 text-zinc-400">›</span>
                    </button>
                  )
                })}
                {shownCustomers.length === 0 && (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    Không có khách nào khớp “{q}”.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Bước 2: đơn đưa vào lệnh + thông tin lệnh ───────────────────── */}
      {current && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">
              Bỏ tick đơn chưa muốn đưa vào lệnh này.
            </span>
            <button
              onClick={reset}
              disabled={busy}
              className="text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-white"
            >
              ← Đổi khách
            </button>
          </div>

          <div className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {current.orders.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(o.id)}
                  onChange={() =>
                    setPicked((prev) =>
                      prev.includes(o.id)
                        ? prev.filter((x) => x !== o.id)
                        : [...prev, o.id],
                    )
                  }
                />
                <span className="font-mono">{o.code}</span>
                <span className="ml-auto text-xs text-zinc-500">
                  {o.line_count} dòng · {fmtN(o.qty)} SP
                  {o.due_date ? ` · hạn ${fmtD(o.due_date)}` : ''}
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs">
              Số lệnh <span className="text-red-500">*</span>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="01/26 - Rosco"
                maxLength={50}
                autoFocus
                className="w-56 rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="text-[11px] text-zinc-500">gợi ý sẵn — sửa được</span>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Hạn xuất dự kiến
              <input
                type="date"
                value={form.ship_date}
                onChange={(e) => setForm({ ...form, ship_date: e.target.value })}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="text-[11px] text-zinc-500">theo hạn sớm nhất</span>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Container
              <input
                value={form.container}
                onChange={(e) => setForm({ ...form, container: e.target.value })}
                placeholder="3 x 40'HC"
                className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {picked.length ? (
                <>
                  Phát <b>{picked.length}</b>/{current.orders.length} đơn ·{' '}
                  <b>{fmtN(pickedQty)}</b> SP → chờ Giám đốc duyệt
                </>
              ) : (
                <span className="text-red-600 dark:text-red-400">Chưa chọn đơn nào.</span>
              )}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={close} disabled={busy}>
                Huỷ
              </Button>
              <Button
                variant="success"
                disabled={!canSubmit}
                onClick={() => void onIssue(picked, form)}
              >
                {busy && <Spinner size={14} />}
                Phát lệnh
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
