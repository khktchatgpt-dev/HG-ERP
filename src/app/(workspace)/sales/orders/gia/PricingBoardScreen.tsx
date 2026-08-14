'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardPaste, Lock, Save, Search, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { cn } from '@/lib/utils'
import {
  guessDecimalSep,
  matchPasteRows,
  parsePricePaste,
  type DecimalSep,
  type MatchResult,
} from '@/lib/price-paste'
import type { PricingBoard, PricingLine } from '@/modules/dept/sales/orders.service'

/** Số tiền hiển thị theo tiền tệ của ĐƠN — USD và VND không bao giờ cộng chung. */
function money(value: number, currency: string): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value)
}

/**
 * BẢNG ĐIỀN ĐƠN GIÁ — mọi dòng đơn còn sống trên một lưới, gõ giá rồi lưu một
 * lần. Có đường dán từ Excel cho trường hợp giá nằm sẵn trong file khách gửi.
 *
 * Nguyên tắc: DÁN KHÔNG LƯU THẲNG. Dán chỉ điền vào ô trên màn hình, người dùng
 * nhìn lại rồi mới bấm Lưu. Đây là tiền hợp đồng — một cú dán nhầm cột mà tự lưu
 * là hỏng cả sổ đơn.
 */
export function PricingBoardScreen({ board }: { board: PricingBoard }) {
  const toast = useToast()
  const router = useRouter()

  /** line_id → text đang gõ. Giữ dạng text để ô trống khác hẳn số 0. */
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [onlyUnpriced, setOnlyUnpriced] = useState(true)
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return board.lines.filter((l) => {
      if (onlyUnpriced && l.unit_price > 0 && draft[l.line_id] === undefined) return false
      if (!needle) return true
      return (
        l.order_code.toLowerCase().includes(needle) ||
        l.product_code.toLowerCase().includes(needle) ||
        l.product_name.toLowerCase().includes(needle) ||
        l.customer_name.toLowerCase().includes(needle)
      )
    })
  }, [board.lines, onlyUnpriced, q, draft])

  /** Dòng thực sự đổi số — nguồn cho nút Lưu và cho dải tổng ở chân màn. */
  const dirty = useMemo(() => {
    const out: { line: PricingLine; price: number }[] = []
    for (const l of board.lines) {
      const raw = draft[l.line_id]
      if (raw === undefined || raw.trim() === '') continue
      const price = Number(raw)
      if (!Number.isFinite(price) || price < 0) continue
      if (price === l.unit_price) continue
      out.push({ line: l, price })
    }
    return out
  }, [board.lines, draft])

  const invalid = useMemo(
    () =>
      Object.entries(draft).filter(([, raw]) => {
        if (raw.trim() === '') return false
        const n = Number(raw)
        return !Number.isFinite(n) || n < 0
      }).length,
    [draft],
  )

  async function save() {
    if (!dirty.length) return
    setBusy(true)
    try {
      const res = await api<{ updated: number; orders: number }>(
        '/api/dept/sales/orders/prices',
        {
          method: 'PATCH',
          body: {
            items: dirty.map((d) => ({
              line_id: d.line.line_id,
              unit_price: d.price,
            })),
            note: note.trim() || null,
          },
        },
      )
      setDraft({})
      setNote('')
      router.refresh()
      toast.success(`Đã điền giá ${res.updated} dòng`, `Thuộc ${res.orders} đơn hàng`)
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  /** Nhận kết quả từ hộp thoại dán — chỉ ĐIỀN vào ô, không gọi API. */
  function applyPaste(applied: { line_id: string; price: number }[]) {
    setDraft((d) => {
      const next = { ...d }
      for (const a of applied) next[a.line_id] = String(a.price)
      return next
    })
  }

  const totalByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of dirty) {
      m.set(d.line.currency, (m.get(d.line.currency) ?? 0) + d.price * d.line.qty)
    }
    return [...m.entries()]
  }, [dirty])

  return (
    <div className="space-y-4 pb-24">
      <TopProgressBar active={busy} />

      <PageHeader
        breadcrumbs={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Đơn hàng', href: '/sales/orders' },
          { label: 'Điền đơn giá' },
        ]}
        title="Điền đơn giá"
        description="Gõ đơn giá cho từng dòng rồi lưu một lần. Dòng chưa có giá làm doanh số, giá trị đơn và bảng tin Giám đốc ra 0."
        actions={
          <Button variant="outline" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste className="size-4" aria-hidden />
            Dán từ Excel
          </Button>
        }
      />

      <StatsBar
        stats={[
          {
            label: 'Dòng thiếu giá',
            value: board.stats.unpriced,
            tone: board.stats.unpriced ? 'red' : 'green',
            hint: `trên tổng ${board.stats.lines_total} dòng`,
          },
          {
            label: 'Bạn sửa được',
            value: board.stats.unpriced_mine,
            tone: 'amber',
            hint: 'đơn do bạn tạo (hoặc bạn là quản lý)',
          },
          {
            label: 'Đơn thiếu giá',
            value: board.stats.orders_unpriced,
            tone: 'amber',
            hint: `trên tổng ${board.stats.orders_total} đơn còn sống`,
          },
          {
            label: 'Đang sửa',
            value: dirty.length,
            tone: dirty.length ? 'blue' : 'gray',
            hint: dirty.length ? 'chưa lưu' : 'chưa gõ gì',
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo mã đơn, mã SP, tên SP, khách hàng…"
            className="ps-8"
          />
        </div>
        <Button
          variant={onlyUnpriced ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyUnpriced((v) => !v)}
        >
          {onlyUnpriced ? 'Chỉ dòng thiếu giá' : 'Tất cả dòng'}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={onlyUnpriced ? 'Không còn dòng nào thiếu giá' : 'Không có dòng nào'}
          description={
            onlyUnpriced
              ? 'Mọi dòng đơn đang mở đều đã có đơn giá.'
              : 'Thử xoá bớt từ khoá tìm kiếm.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Đơn / Khách</th>
                <th className="px-3 py-2 text-left font-medium">Sản phẩm</th>
                <th className="px-3 py-2 text-right font-medium">SL</th>
                <th className="px-3 py-2 text-right font-medium">Đơn giá</th>
                <th className="px-3 py-2 text-right font-medium">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((l) => {
                const raw = draft[l.line_id]
                const price = raw === undefined || raw === '' ? l.unit_price : Number(raw)
                const bad =
                  raw !== undefined &&
                  raw !== '' &&
                  (!Number.isFinite(price) || price < 0)
                const changed = Number.isFinite(price) && price !== l.unit_price
                return (
                  <tr
                    key={l.line_id}
                    className={cn(
                      'hover:bg-accent/30',
                      changed && !bad && 'bg-sky-50/60 dark:bg-sky-950/20',
                    )}
                  >
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/sales/orders/${l.order_id}`}
                        className="font-medium hover:underline"
                      >
                        {l.order_code}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {l.customer_name}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-mono text-xs">{l.product_code}</div>
                      <div className="text-muted-foreground max-w-72 truncate text-xs">
                        {l.product_name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums">
                      {money(l.qty, 'VND')}
                      <div className="text-muted-foreground text-xs">
                        {l.product_unit}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        {!l.editable && (
                          <Lock
                            className="text-muted-foreground size-3.5 shrink-0"
                            aria-label="Đơn của người khác"
                          />
                        )}
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          disabled={!l.editable || busy}
                          value={raw ?? (l.unit_price > 0 ? String(l.unit_price) : '')}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [l.line_id]: e.target.value }))
                          }
                          placeholder="0"
                          className={cn(
                            'h-8 w-28 text-right tabular-nums',
                            bad && 'border-red-500 focus-visible:ring-red-500',
                          )}
                          aria-label={`Đơn giá ${l.product_code} của đơn ${l.order_code}`}
                        />
                        <span className="text-muted-foreground w-8 text-xs">
                          {l.currency}
                        </span>
                      </div>
                      {!l.editable && (
                        <div className="text-muted-foreground mt-0.5 text-end text-[11px]">
                          đơn của người khác
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums">
                      {Number.isFinite(price) && price > 0
                        ? money(price * l.qty, l.currency)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dải lưu — nổi ở chân màn để không phải cuộn lên đầu sau khi gõ 40 dòng. */}
      {(dirty.length > 0 || invalid > 0) && (
        <div className="bg-card fixed inset-x-0 bottom-0 z-20 border-t shadow-lg">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="text-sm">
              <span className="font-semibold">{dirty.length}</span> dòng sẽ được lưu
              {totalByCurrency.length > 0 && (
                <span className="text-muted-foreground">
                  {' · '}
                  {totalByCurrency
                    .map(([cur, v]) => `${money(v, cur)} ${cur}`)
                    .join(' · ')}
                </span>
              )}
              {invalid > 0 && (
                <span className="ms-2 text-red-600">· {invalid} ô sai định dạng</span>
              )}
            </div>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lý do / nguồn giá (không bắt buộc) — vào lịch sử đơn"
              className="h-9 min-w-56 flex-1"
            />
            <Button variant="ghost" onClick={() => setDraft({})} disabled={busy}>
              <X className="size-4" aria-hidden />
              Bỏ thay đổi
            </Button>
            <Button onClick={() => void save()} disabled={busy || dirty.length === 0}>
              {busy ? <Spinner size={14} /> : <Save className="size-4" aria-hidden />}
              Lưu {dirty.length} dòng
            </Button>
          </div>
        </div>
      )}

      <PasteDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        lines={board.lines}
        onApply={applyPaste}
      />
    </div>
  )
}

/**
 * HỘP THOẠI DÁN TỪ EXCEL — dán → chọn dấu thập phân → XEM TRƯỚC → mới điền vào
 * bảng. Không có bước xem trước thì không ai biết "1.200" vừa được hiểu là 1,2
 * hay 1200, mà hai số đó lệch nhau 1000 lần.
 */
function PasteDialog({
  open,
  onClose,
  lines,
  onApply,
}: {
  open: boolean
  onClose: () => void
  lines: PricingLine[]
  onApply: (applied: { line_id: string; price: number }[]) => void
}) {
  const [text, setText] = useState('')
  const [sep, setSep] = useState<DecimalSep>('.')
  const [touchedSep, setTouchedSep] = useState(false)

  const parsed = useMemo(() => parsePricePaste(text, sep), [text, sep])
  const byId = useMemo(() => new Map(lines.map((l) => [l.line_id, l])), [lines])

  const match: MatchResult = useMemo(
    () =>
      matchPasteRows(
        lines.map((l) => ({
          line_id: l.line_id,
          order_code: l.order_code,
          product_code: l.product_code,
        })),
        parsed.rows,
      ),
    [lines, parsed.rows],
  )

  // Dòng khớp nhưng thuộc đơn của người khác → không điền, nói rõ số lượng.
  const applicable = match.matched.filter((m) => byId.get(m.line_id)?.editable)
  const locked = match.matched.length - applicable.length

  function handleText(v: string) {
    setText(v)
    if (!touchedSep) setSep(guessDecimalSep(v))
  }

  function apply() {
    onApply(applicable.map((m) => ({ line_id: m.line_id, price: m.price })))
    setText('')
    setTouchedSep(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Dán đơn giá từ Excel</DialogTitle>
          <DialogDescription>
            Bôi 2 cột <b>mã SP · đơn giá</b>, hoặc 3 cột <b>mã đơn · mã SP · đơn giá</b>{' '}
            rồi dán vào đây. Giá chỉ được điền vào ô trên bảng — bạn xem lại rồi mới bấm
            Lưu.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => handleText(e.target.value)}
          rows={8}
          placeholder={'PT-138-155-HG\t12.5\nPT-138-156-HG\t8'}
          className="font-mono text-xs"
        />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Dấu thập phân:</span>
          {(['.', ','] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sep === s ? 'default' : 'outline'}
              onClick={() => {
                setSep(s)
                setTouchedSep(true)
              }}
            >
              {s === '.' ? '1,234.56  (chấm)' : '1.234,56  (phẩy)'}
            </Button>
          ))}
        </div>

        {text.trim() !== '' && (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
            <p>
              <b>{applicable.length}</b> dòng sẽ được điền
              {locked > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  · {locked} dòng khớp nhưng thuộc đơn của người khác nên bỏ qua
                </span>
              )}
            </p>

            {applicable.length > 0 && (
              <table className="w-full text-xs">
                <tbody className="divide-y">
                  {applicable.slice(0, 30).map((m) => {
                    const l = byId.get(m.line_id)!
                    return (
                      <tr key={m.line_id}>
                        <td className="py-1 pe-2">{l.order_code}</td>
                        <td className="py-1 pe-2 font-mono">{l.product_code}</td>
                        <td className="py-1 pe-2 text-right tabular-nums">
                          {money(l.unit_price, l.currency)} →{' '}
                          <b>{money(m.price, l.currency)}</b> {l.currency}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {applicable.length > 30 && (
              <p className="text-muted-foreground text-xs">
                … và {applicable.length - 30} dòng nữa
              </p>
            )}

            {match.ambiguous.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <b>{match.ambiguous.length} dòng không rõ thuộc đơn nào</b> — mã SP này có
                ở nhiều đơn. Thêm cột mã đơn vào khối dán rồi dán lại:
                <ul className="mt-1 list-inside list-disc">
                  {match.ambiguous.slice(0, 5).map((a) => (
                    <li key={a.line}>
                      dòng {a.line}: {a.product_code} — có ở {a.order_codes.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {match.unmatched.length > 0 && (
              <div className="text-muted-foreground rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                <b>{match.unmatched.length} dòng không tìm thấy</b> trong các đơn đang mở:{' '}
                {match.unmatched
                  .slice(0, 8)
                  .map((u) => u.product_code)
                  .join(', ')}
              </div>
            )}

            {parsed.errors.length > 0 && (
              <div className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <b>{parsed.errors.length} dòng không đọc được</b>
                <ul className="mt-1 list-inside list-disc">
                  {parsed.errors.slice(0, 5).map((e) => (
                    <li key={e.line}>
                      dòng {e.line}: {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={apply} disabled={applicable.length === 0}>
            Điền {applicable.length} dòng vào bảng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
