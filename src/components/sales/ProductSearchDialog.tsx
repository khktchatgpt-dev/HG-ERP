'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import { Spinner } from '@/components/erp/Spinner'
import { hasCached, searchProducts, type ProductPick } from './ProductPicker'

/**
 * HỘP THOẠI TÌM SẢN PHẨM — tách hẳn khỏi dòng đơn.
 *
 * Vì sao không để ô chọn nằm luôn trong dòng (bản trước): dòng đơn ở khổ bảng
 * chỉ rộng ~290px, mà thứ cần đọc để chọn đúng hàng thì nhiều — mã HG, mã khách
 * đặt, tên, tình trạng BOM, kích thước. Nhét cả vào một ô hẹp thì hoặc cắt chữ,
 * hoặc panel đè lên các dòng dưới. Tách ra hộp thoại thì:
 *   · chỗ tìm rộng bằng cả màn, mỗi kết quả đọc được đủ 5 thứ trên;
 *   · CHỌN ĐƯỢC NHIỀU SP MỘT LƯỢT — đơn MERXX 26 dòng, bản cũ phải bấm "thêm
 *     dòng" rồi tìm, 26 lần; giờ tick 26 cái rồi bấm một nút;
 *   · bàn phím đi hết được: gõ để lọc, ↑↓ chạy, Space tick, Enter chốt;
 *   · SP đã có trên đơn hiện rõ "đã có" và không tick lại được.
 *
 * Dùng chung cho hai việc: THÊM dòng (nhiều) và ĐỔI SP của một dòng (một).
 */
export function ProductSearchDialog({
  open,
  onOpenChange,
  customerId,
  usedIds,
  multi,
  title,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Khách của đơn — chưa gõ gì thì gợi ý SP của khách này trước. */
  customerId: string | null
  /** SP đã nằm trên đơn — không cho chọn lại (trừ chính dòng đang đổi). */
  usedIds: Set<string>
  multi: boolean
  title?: string
  onConfirm: (products: ProductPick[]) => void
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ProductPick[]>([])
  const [fuzzy, setFuzzy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Map<string, ProductPick>>(new Map())
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  /*
   * Mở lại là một lượt chọn mới — đừng giữ từ khoá và tick của lượt trước.
   * Chỉnh state NGAY TRONG RENDER theo mẫu "derive state on change" của React,
   * không dùng effect: đặt trong effect thì thừa một lượt render với dữ liệu cũ
   * (và vướng luật `react-hooks/set-state-in-effect` của repo).
   */
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQ('')
      setPicked(new Map())
      setActive(0)
    }
  }

  const run = useCallback(
    async (term: string) => {
      setLoading(true)
      setError(null)
      try {
        const out = await searchProducts(customerId, term)
        setRows(out.rows)
        setFuzzy(out.fuzzy)
        setActive(0)
      } catch {
        setRows([])
        setError('Không tải được danh sách sản phẩm')
      } finally {
        setLoading(false)
      }
    },
    [customerId],
  )

  // Gõ thêm → tìm sau 250ms; có sẵn trong cache thì trả ngay, khỏi nháy "Đang tìm…".
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    const instant = !term || hasCached(customerId, term)
    const t = setTimeout(() => void run(term), instant ? 0 : 250)
    return () => clearTimeout(t)
  }, [open, q, customerId, run])

  const groups = useMemo(() => {
    const own: ProductPick[] = []
    const common: ProductPick[] = []
    const others: ProductPick[] = []
    for (const p of rows) {
      if (customerId && p.customer_id === customerId) own.push(p)
      else if (!p.customer_id) common.push(p)
      else others.push(p)
    }
    return [
      { label: 'SP của khách này', items: own },
      { label: 'Mẫu chung', items: common },
      { label: 'SP khách khác', items: others },
    ].filter((g) => g.items.length > 0)
  }, [rows, customerId])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  function toggle(p: ProductPick) {
    if (usedIds.has(p.id)) return
    if (!multi) return onConfirm([p])
    setPicked((m) => {
      const next = new Map(m)
      if (next.has(p.id)) next.delete(p.id)
      else next.set(p.id, p)
      return next
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1
        const clamped = Math.max(0, Math.min(flat.length - 1, next))
        listRef.current
          ?.querySelectorAll('[data-row]')
          [clamped]?.scrollIntoView({ block: 'nearest' })
        return clamped
      })
      return
    }
    if (e.key === ' ' && multi) {
      // Space tick dòng đang trỏ — nhưng vẫn phải gõ được dấu cách trong từ khoá.
      if (flat[active] && q.endsWith(' ')) return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (multi && picked.size > 0) return onConfirm([...picked.values()])
      const p = flat[active]
      if (p) toggle(p)
    }
  }

  const dims = (p: ProductPick) => {
    const k = p.packing ?? {}
    return k.l_cm && k.w_cm && k.h_cm ? `${k.l_cm}×${k.w_cm}×${k.h_cm} cm` : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-v3 bg-card flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>{title ?? 'Chọn sản phẩm'}</DialogTitle>
          <DialogDescription>
            Gõ mã HG, mã cũ, mã khách đặt hoặc tên — tìm trong cả thư viện Kỹ thuật.
            {multi && ' Tick nhiều sản phẩm rồi thêm một lượt.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            {}
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Gõ mã SP, mã cũ, mã KH đặt hoặc tên…"
              className="pl-8"
            />
          </div>
        </div>

        {fuzzy && (
          <p className="px-5 pb-2 text-[11px] text-[var(--warn)]">
            Không có kết quả khớp đúng — đang hiện những mã gần giống.
          </p>
        )}

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto border-t">
          {loading && (
            <div className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm">
              <Spinner size={14} /> Đang tìm…
            </div>
          )}
          {!loading && error && (
            <div className="text-destructive px-5 py-4 text-sm">{error}</div>
          )}
          {!loading && !error && flat.length === 0 && (
            <div className="text-muted-foreground px-5 py-10 text-center text-sm">
              {q.trim()
                ? `Không tìm thấy sản phẩm nào khớp “${q.trim()}”.`
                : 'Chưa có sản phẩm nào để gợi ý — gõ để tìm trong thư viện.'}
            </div>
          )}
          {!loading &&
            !error &&
            groups.map((g) => (
              <div key={g.label}>
                <div className="t-label text-muted-foreground bg-muted/60 sticky top-0 px-5 py-1">
                  {g.label}
                </div>
                {g.items.map((p) => {
                  const i = flat.indexOf(p)
                  const used = usedIds.has(p.id)
                  const on = picked.has(p.id)
                  return (
                    <button
                      key={p.id}
                      data-row
                      type="button"
                      disabled={used}
                      onClick={() => toggle(p)}
                      onPointerEnter={() => setActive(i)}
                      className={`flex w-full items-start gap-3 px-5 py-2 text-left ${
                        i === active ? 'bg-accent' : ''
                      } ${used ? 'opacity-50' : 'hover:bg-accent'}`}
                    >
                      {multi && (
                        <span
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                            on ? 'bg-primary border-primary text-primary-foreground' : ''
                          }`}
                        >
                          {on && <Check className="size-3" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="t-data">{p.code}</span>
                          <span className="text-sm font-medium">{p.name}</span>
                          {used && (
                            <span className="text-muted-foreground text-[11px]">
                              đã có trên đơn
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                          {p.customer_item_code && (
                            <span>KH đặt: {p.customer_item_code}</span>
                          )}
                          <Badge tone={BOM_TONE[p.bom_status]}>
                            {BOM_LABEL[p.bom_status]}
                          </Badge>
                          {dims(p) && <span>📐 {dims(p)}</span>}
                          <span>ĐVT {p.unit}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
        </div>

        <DialogFooter className="border-t px-5 py-3 sm:justify-between">
          <span className="text-muted-foreground text-xs">
            {multi
              ? picked.size > 0
                ? `Đã chọn ${picked.size} sản phẩm`
                : 'Chưa chọn sản phẩm nào'
              : 'Bấm vào một sản phẩm để chọn'}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            {multi && (
              <Button
                disabled={picked.size === 0}
                onClick={() => onConfirm([...picked.values()])}
              >
                Thêm {picked.size > 0 ? `${picked.size} sản phẩm` : 'sản phẩm'}
              </Button>
            )}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const BOM_LABEL = { none: 'Chưa có BOM', drawing: 'Đang vẽ', done: 'Đã vẽ' } as const
const BOM_TONE = { none: 'gray', drawing: 'amber', done: 'green' } as const
