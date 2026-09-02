'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  Factory,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { PO_STATUS_LABEL, PO_STATUS_TONE, isPoStatus } from '@/lib/po-status'
import { cn } from '@/lib/utils'
import {
  LSX_SUPPLY_GATES,
  compareForSupply,
  daysUntilDue,
  dueLevel,
  lsxSupplyGate,
  type DueLevel,
  type LsxSupplyGateKey,
} from '@/lib/lsx-supply'
import type { LsxSupplyRow } from '@/modules/dept/supply/lsx-supply.service'

/* Kiểu dòng do SERVICE định nghĩa (dùng chung với file xuất Excel). Import
   type-only nên không kéo code server vào bundle client. */
export type { LsxSupplyRow }

const GATE_COLOR: Record<LsxSupplyGateKey, string> = {
  none: 'var(--warn)',
  unsent: 'var(--warn)',
  late: 'var(--stop)',
  inflight: 'var(--primary)',
  done: 'var(--done)',
}

const GATE_LABEL: Record<LsxSupplyGateKey, string> = {
  none: 'Chưa lập đơn',
  unsent: 'Đơn chưa gửi',
  late: 'NCC trễ',
  inflight: 'Đang về',
  done: 'Về đủ',
}

const DUE_COLOR: Record<DueLevel, string> = {
  overdue: 'var(--stop)',
  today: 'var(--warn)',
  soon: 'var(--warn)',
  later: 'var(--muted-foreground)',
  none: 'var(--muted-foreground)',
}

const dmy = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    : '—'

/**
 * VẬT TƯ THEO LỆNH — màn triage của người mua.
 *
 * Mỗi lệnh MỘT DÒNG, và dòng đó phải trả lời ngay ba thứ người mua cần để lên
 * đơn: KHÁCH NÀO, BAO GIỜ vật tư phải về, ĐÃ ĐẶT gì chưa. Sản phẩm và danh sách
 * đơn mua nằm trong phần bung ra — một lệnh có thể có chục đơn và vài chục sản
 * phẩm, trải hết ra thì trang thành một bức tường chữ.
 *
 * Danh sách xếp sẵn theo thứ tự phải làm (`compareForSupply`): việc của Cung
 * ứng trước, hạn vật tư gấp trước — đầu trang là việc của sáng nay.
 */
export function LsxSupplyScreen({
  rows,
  today,
  canEdit,
}: {
  rows: LsxSupplyRow[]
  today: string
  canEdit: boolean
}) {
  const [gateFilter, setGateFilter] = useState<LsxSupplyGateKey | 'mine' | null>(null)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const enriched = useMemo(
    () =>
      rows
        .map((r) => ({
          row: r,
          gate: lsxSupplyGate(r),
          due: dueLevel(r.materials_due_at, today),
          daysLeft: daysUntilDue(r.materials_due_at, today),
        }))
        .sort((a, b) =>
          compareForSupply(
            { gate: a.gate, due: a.due, code: a.row.code },
            { gate: b.gate, due: b.due, code: b.row.code },
          ),
        ),
    [rows, today],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { mine: 0 }
    for (const e of enriched) {
      c[e.gate.key] = (c[e.gate.key] ?? 0) + 1
      if (e.gate.mine) c.mine++
    }
    return c
  }, [enriched])

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return enriched.filter((e) => {
      if (gateFilter === 'mine' && !e.gate.mine) return false
      if (gateFilter && gateFilter !== 'mine' && e.gate.key !== gateFilter) return false
      if (!ql) return true
      // Tìm cả theo KHÁCH và MÃ SP: người mua hay được hỏi ngược từ hai phía đó.
      return `${e.row.code} ${e.row.customer_name} ${e.row.order_codes.join(' ')} ${e.row.products
        .map((p) => p.code)
        .join(' ')}`
        .toLowerCase()
        .includes(ql)
    })
  }, [enriched, gateFilter, q])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư theo lệnh' },
        ]}
        title="Vật tư theo lệnh"
        description="Lệnh đang chạy kèm khách hàng, sản phẩm phải làm và hạn vật tư — xếp theo việc bạn cần làm trước. Bung một lệnh để xem sản phẩm và các đơn mua đã lập."
        actions={
          <>
            {/* File mang vào HỌP TUẦN — ai cũng tải được, không gác theo
                `canEdit`: người cần nó nhất là bên Sản xuất và Ban Giám đốc
                ngồi họp, họ không có quyền sửa đơn mua. Dùng <a> thường chứ
                không `router.push`: đây là tải file, không phải điều hướng. */}
            <Button size="sm" variant="outline" asChild>
              <a href="/api/dept/supply/lsx-report" download>
                <Download /> Xuất Excel
              </a>
            </Button>
            {canEdit && (
              <Button size="sm" asChild>
                <Link href="/planning/pos/new">
                  <Plus /> Tạo phiếu mua
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã lệnh, khách hàng, mã đơn, mã sản phẩm…"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="Tất cả"
            n={enriched.length}
            on={gateFilter === null}
            onClick={() => setGateFilter(null)}
          />
          <FilterChip
            label="Việc của tôi"
            n={counts.mine ?? 0}
            color="var(--primary)"
            on={gateFilter === 'mine'}
            onClick={() => setGateFilter(gateFilter === 'mine' ? null : 'mine')}
          />
          <span className="bg-border mx-0.5 h-4 w-px" aria-hidden />
          {LSX_SUPPLY_GATES.map((k) => (
            <FilterChip
              key={k}
              label={GATE_LABEL[k]}
              n={counts[k] ?? 0}
              color={GATE_COLOR[k]}
              on={gateFilter === k}
              onClick={() => setGateFilter(gateFilter === k ? null : k)}
            />
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-xl border py-14 text-center">
          <span className="bg-muted grid size-12 place-items-center rounded-xl">
            <Factory className="text-muted-foreground size-6" strokeWidth={1.8} />
          </span>
          <p className="t-title mt-4">
            {rows.length === 0
              ? 'Không có lệnh nào đang chạy'
              : 'Không lệnh nào khớp bộ lọc'}
          </p>
          <p className="t-body text-muted-foreground mt-1 max-w-sm">
            Lệnh chỉ hiện ở đây sau khi Giám đốc ký và trước khi hoàn tất.
          </p>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          {visible.map(({ row, gate, due, daysLeft }) => {
            const open = openId === row.id
            return (
              <div key={row.id} className="border-b last:border-0">
                <button
                  onClick={() => setOpenId(open ? null : row.id)}
                  aria-expanded={open}
                  className="spine flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/40"
                  style={{ '--spine': GATE_COLOR[gate.key] } as React.CSSProperties}
                >
                  {open ? (
                    <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  )}

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {/* Dòng 1 — KHÁCH HÀNG là chữ chính, mã lệnh là chip bên trái */}
                    <div className="flex flex-wrap items-center gap-2">
                      <DocChip className="text-[11px]">{row.code}</DocChip>
                      <span className="t-body flex min-w-0 items-center gap-1.5 truncate font-semibold">
                        <Building2
                          className="text-muted-foreground size-3.5 shrink-0"
                          strokeWidth={1.8}
                        />
                        {row.customer_name}
                      </span>
                      {row.order_codes.length > 0 && (
                        <span className="t-data text-muted-foreground text-[11px]">
                          {row.order_codes.join(', ')}
                        </span>
                      )}
                    </div>
                    {/* Dòng 2 — bậc vật tư + số sản phẩm */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                        style={{ color: GATE_COLOR[gate.key] }}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: GATE_COLOR[gate.key] }}
                          aria-hidden
                        />
                        {gate.label}
                      </span>
                      <span className="text-muted-foreground text-[11.5px]">
                        {gate.detail}
                      </span>
                      {row.products.length > 0 && (
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11.5px]">
                          <Package className="size-3.5" strokeWidth={1.8} />
                          {row.products.length} mã SP
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hạn vật tư — mốc quyết định của người mua */}
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="t-label text-muted-foreground">Hạn vật tư</div>
                    <div
                      className="t-data text-[12.5px] font-medium"
                      style={{ color: DUE_COLOR[due] }}
                    >
                      {dmy(row.materials_due_at)}
                    </div>
                    <div className="text-[11px]" style={{ color: DUE_COLOR[due] }}>
                      {daysLeft === null
                        ? 'chưa đặt hạn'
                        : daysLeft < 0
                          ? `quá ${-daysLeft} ngày`
                          : daysLeft === 0
                            ? 'hôm nay'
                            : `còn ${daysLeft} ngày`}
                    </div>
                  </div>

                  {/* Ngày giao khách — mốc gốc, để đối chiếu khi lệnh chưa đặt hạn VT */}
                  <div className="hidden w-20 shrink-0 text-right lg:block">
                    <div className="t-label text-muted-foreground">Giao khách</div>
                    <div className="t-data text-[12.5px]">{dmy(row.ship_date)}</div>
                  </div>

                  <div className="hidden w-20 shrink-0 text-right md:block">
                    <div className="t-label text-muted-foreground">Đơn mua</div>
                    <div className="t-data text-[12.5px]">{row.posTotal}</div>
                    {row.posLate > 0 && (
                      <div className="text-[11px] font-medium text-[var(--stop)]">
                        {row.posLate} quá hẹn
                      </div>
                    )}
                  </div>
                </button>

                {open && (
                  <div className="bg-muted/30 grid gap-4 border-t px-4 py-3 lg:grid-cols-2">
                    <ProductsBlock row={row} />
                    <PosBlock row={row} canEdit={canEdit} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Sản phẩm phải làm — người mua nhìn để biết đang mua đồ cho cái gì. */
function ProductsBlock({ row }: { row: LsxSupplyRow }) {
  const [all, setAll] = useState(false)
  const shown = all ? row.products : row.products.slice(0, 8)
  return (
    <section className="bg-card rounded-lg border">
      <header className="t-label text-muted-foreground flex items-center gap-1.5 border-b px-3 py-2">
        <Package className="size-3.5" strokeWidth={1.8} />
        Sản phẩm phải làm · {row.products.length} mã
      </header>
      {row.products.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-[12.5px]">
          Lệnh chưa có dòng sản phẩm nào.
        </p>
      ) : (
        <>
          <ul className="divide-border/60 divide-y">
            {shown.map((p) => (
              <li key={p.code} className="flex items-baseline gap-2 px-3 py-1.5">
                <span className="t-data text-muted-foreground shrink-0 text-[11px]">
                  {p.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.name}</span>
                <span className="t-data shrink-0 text-[12.5px] font-medium">
                  {p.qty.toLocaleString('vi-VN')}
                </span>
              </li>
            ))}
          </ul>
          {row.products.length > 8 && (
            <button
              onClick={() => setAll((v) => !v)}
              className="text-muted-foreground hover:text-foreground w-full border-t px-3 py-1.5 text-[11.5px] transition-colors"
            >
              {all ? 'Thu gọn' : `Xem đủ ${row.products.length} mã`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** Đơn mua đã lập cho lệnh — gồm cả đơn mua chung của lệnh khác (0125). */
function PosBlock({ row, canEdit }: { row: LsxSupplyRow; canEdit: boolean }) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="t-label text-muted-foreground flex items-center gap-1.5 border-b px-3 py-2">
        <ShoppingCart className="size-3.5" strokeWidth={1.8} />
        Đơn mua đã lập · {row.pos.length}
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-6 text-[11.5px]"
            asChild
          >
            <Link href={`/planning/pos/new?lsx=${row.id}`}>
              <Plus /> Đặt cho lệnh này
            </Link>
          </Button>
        )}
      </header>
      {row.pos.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-[12.5px]">
          Chưa có đơn mua nào cho lệnh này.
        </p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {row.pos.map((p) => (
            <li key={`${p.id}-${p.shared}`}>
              <Link
                href={`/planning/pos/${p.id}`}
                className="hover:bg-accent flex flex-wrap items-center gap-2 px-3 py-1.5 transition-colors"
              >
                <DocChip className="text-[11px]">{p.code}</DocChip>
                <span className="min-w-0 flex-1 truncate text-[12.5px]">
                  {p.supplier_name}
                </span>
                {p.shared && (
                  <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-foreground)]">
                    mua chung
                  </span>
                )}
                <span className="t-data text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                  <Truck className="size-3.5" strokeWidth={1.8} />
                  {dmy(p.expected_at)}
                </span>
                {isPoStatus(p.status) && (
                  <Badge tone={p.late ? 'red' : PO_STATUS_TONE[p.status]}>
                    {p.late ? 'Quá hẹn' : PO_STATUS_LABEL[p.status]}
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground flex items-center gap-1.5 border-t px-3 py-2 text-[11px]">
        <CalendarDays className="size-3.5" strokeWidth={1.8} />
        Ngày cạnh xe hàng là hẹn giao của nhà cung cấp.
      </p>
    </section>
  )
}

function FilterChip({
  label,
  n,
  color,
  on,
  onClick,
}: {
  label: string
  n: number
  color?: string
  on: boolean
  onClick: () => void
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors'
  if (n === 0 && !on) {
    return (
      <span className={cn(base, 'border-border/60 bg-card text-muted-foreground/40')}>
        {label} <span className="font-mono tabular-nums">0</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        base,
        on
          ? 'border-transparent text-white'
          : 'border-border bg-card hover:border-foreground/30 text-foreground/75',
      )}
      style={on ? { background: color ?? 'var(--primary)' } : undefined}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 font-mono text-[11px] tabular-nums',
          on ? 'bg-white/25' : 'bg-muted',
        )}
      >
        {n}
      </span>
    </button>
  )
}
