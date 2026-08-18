'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import { Spinner } from '@/components/erp/Spinner'
import { suggestLsxCode } from '@/lib/lsx-code'
import type { AwaitingOrder } from './LsxWorkbench'

/**
 * HỘP THOẠI PHÁT LỆNH — chọn KHÁCH trước, ĐƠN sau (luồng đã chốt, giữ nguyên).
 *
 * Bản đầu để Sales tick thẳng các đơn trên trang rồi mới điền số lệnh. Hai chỗ
 * vướng: (a) tick nhầm sang khách khác thì cả loạt đơn đang chọn bị xoá âm thầm
 * (một lệnh chỉ gộp đơn CÙNG MỘT KHÁCH); (b) Sales nghĩ theo lối "làm lệnh cho
 * ROSCO", chứ không phải "gom mấy đơn này lại". Nên: bước 1 chọn khách → bước 2
 * đơn của khách đó TICK SẴN HẾT. Mở từ dải "Chờ phát lệnh" thì nhảy thẳng
 * bước 2 (`initialCustomerId`).
 *
 * Bước 2 trình bày như CUỐNG PHIẾU: số lệnh mono lớn trên đầu như tờ lệnh in,
 * dưới là đơn gộp và dòng tổng — Sales thấy trước thứ Giám đốc sẽ ký.
 *
 * Vỏ: Dialog shadcn theo style v2 (trang mẫu) — content phải mang class
 * `theme-v2` vì Radix portal ra ngoài wrapper của trang.
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

type CustomerGroup = { id: string; name: string; orders: AwaitingOrder[] }

export function IssueLsxDialog({
  open,
  onClose,
  awaiting,
  codesByCustomer,
  initialCustomerId = null,
  busy,
  onIssue,
}: {
  open: boolean
  onClose: () => void
  awaiting: AwaitingOrder[]
  /** Mã lệnh đã phát, gom theo khách — để gợi ý số lệnh kế tiếp. */
  codesByCustomer: Record<string, string[]>
  /** Mở từ dải chờ phát: nhảy thẳng bước 2 với khách này. */
  initialCustomerId?: string | null
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
    const m = new Map<string, CustomerGroup>()
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

  /** Chọn khách → tick sẵn mọi đơn, điền sẵn số lệnh + hạn xuất cho sửa. */
  function chooseCustomer(c: CustomerGroup) {
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

  // Mở lại hộp thoại = làm ván mới: reset trong lúc render (không dùng effect),
  // và nếu mở từ dải chờ phát thì vào thẳng bước 2 của khách đó.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      const preset = initialCustomerId
        ? customers.find((c) => c.id === initialCustomerId)
        : null
      if (preset) {
        chooseCustomer(preset)
      } else {
        setCustomerId(null)
        setPicked([])
      }
      setQ('')
    }
  }

  const current = customers.find((c) => c.id === customerId) ?? null
  const pickedOrders = current?.orders.filter((o) => picked.includes(o.id)) ?? []
  const pickedQty = pickedOrders.reduce((s, o) => s + o.qty, 0)
  const pickedLines = pickedOrders.reduce((s, o) => s + o.line_count, 0)

  const canSubmit = !!form.code.trim() && picked.length > 0 && !busy

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="theme-v3 max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {current ? `Tạo lệnh — ${current.name}` : 'Tạo lệnh sản xuất'}
          </DialogTitle>
          <DialogDescription>
            {current
              ? 'Soát lại đơn gộp và số lệnh — lệnh tạo ra ở dạng nháp.'
              : 'Một lệnh gộp được nhiều đơn, nhưng phải là đơn của cùng một khách.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Bước 1: chọn khách ──────────────────────────────────────────── */}
        {!current &&
          (customers.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Không còn đơn nào chờ — mọi đơn đã xác nhận đều đã có lệnh sản xuất.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {customers.length > 6 && (
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm khách hoặc mã đơn…"
                  autoFocus
                />
              )}
              {shownCustomers.map((c) => {
                const qty = c.orders.reduce((s, o) => s + o.qty, 0)
                const due = earliestDue(c.orders)
                return (
                  <button
                    key={c.id}
                    onClick={() => chooseCustomer(c)}
                    className="bg-card hover:border-ring hover:bg-accent flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                        {c.orders.map((o) => o.code).join(' · ')}
                      </div>
                    </div>
                    <div className="text-muted-foreground shrink-0 text-right text-xs">
                      <div>
                        <b className="text-foreground">{c.orders.length}</b> đơn ·{' '}
                        {fmtN(qty)} SP
                      </div>
                      {due && <div>hạn sớm nhất {fmtD(due)}</div>}
                    </div>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </button>
                )
              })}
              {shownCustomers.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Không có khách nào khớp “{q}”.
                </p>
              )}
            </div>
          ))}

        {/* ── Bước 2: cuống phiếu lệnh ────────────────────────────────────── */}
        {current && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border">
              {/* Số lệnh nằm trên đầu như trên tờ lệnh in. */}
              <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <div className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                    Lệnh sản xuất — số
                  </div>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="01/26-27 - ROSCO"
                    maxLength={50}
                    autoFocus
                    aria-label="Số lệnh"
                    className="mt-1 w-64 max-w-full font-mono text-base font-semibold"
                  />
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    gợi ý theo lệnh trước của khách — sửa được
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                    Hạn xuất dự kiến
                    <Input
                      type="date"
                      value={form.ship_date}
                      onChange={(e) => setForm({ ...form, ship_date: e.target.value })}
                      className="w-36"
                    />
                  </label>
                  <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                    Container
                    <Input
                      value={form.container}
                      onChange={(e) => setForm({ ...form, container: e.target.value })}
                      placeholder="3 x 40'HC"
                      className="w-28"
                    />
                  </label>
                </div>
              </div>

              <div className="px-4 py-2">
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-muted-foreground text-xs">
                    Đơn gộp vào lệnh — bỏ tick đơn chưa muốn đưa vào.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setCustomerId(null)}
                    className="text-muted-foreground text-xs"
                  >
                    <ArrowLeft />
                    Đổi khách
                  </Button>
                </div>
                <div className="flex flex-col divide-y">
                  {current.orders.map((o) => (
                    <label
                      key={o.id}
                      className="hover:bg-accent/50 flex cursor-pointer items-center gap-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={picked.includes(o.id)}
                        onCheckedChange={(v) =>
                          setPicked((prev) =>
                            v ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                          )
                        }
                      />
                      <span className="font-mono">{o.code}</span>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {o.line_count} dòng · {fmtN(o.qty)} SP
                        {o.due_date ? ` · hạn ${fmtD(o.due_date)}` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="text-muted-foreground border-t px-4 py-2.5 text-xs">
                {picked.length ? (
                  <>
                    Gộp <b className="text-foreground">{picked.length}</b>/
                    {current.orders.length} đơn ·{' '}
                    <b className="text-foreground">{pickedLines}</b> dòng ·{' '}
                    <b className="text-foreground">{fmtN(pickedQty)}</b> SP
                  </>
                ) : (
                  <span className="text-destructive font-medium">
                    Chưa chọn đơn nào — tick ít nhất một đơn để phát lệnh.
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Tạo xong sang màn soạn dòng; gửi Giám đốc duyệt ở bước sau.
              </span>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={busy}>
                  Huỷ
                </Button>
                <Button disabled={!canSubmit} onClick={() => void onIssue(picked, form)}>
                  {busy && <Spinner size={14} />}
                  Tạo lệnh nháp
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
