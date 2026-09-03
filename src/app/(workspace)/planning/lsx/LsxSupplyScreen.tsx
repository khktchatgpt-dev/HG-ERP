'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Download,
  Factory,
  Package,
  Plus,
  Search,
  Send,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { Button } from '@/components/shadcn/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
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

/**
 * Ngày ngắn dd/mm — cắt thẳng chuỗi ISO thay vì `toLocaleDateString`.
 * `vi-VN` trên Chrome trả "29-11" (gạch nối) trong khi cả app dùng gạch chéo,
 * và `new Date(iso)` còn kéo theo lệch múi giờ cho chuỗi chỉ có ngày.
 */
const dmy = (iso: string | null) => {
  if (!iso) return '—'
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

/** Người đang giữ các đơn của lệnh — gộp, bỏ trùng, bỏ đơn đã huỷ. */
function ownersOf(row: LsxSupplyRow): string[] {
  return [
    ...new Set(
      row.pos
        .filter((p) => p.status !== 'cancelled')
        .map((p) => p.assignee_name)
        .filter((v): v is string => !!v),
    ),
  ]
}

/**
 * VẬT TƯ THEO LỆNH — DANH SÁCH ĐỂ CHỌN, không phải nơi đọc mọi thứ.
 *
 * Ba tầng như mẫu v3 (/design-lab, giống `PoFilters`): THẺ SỐ bấm được → TAB
 * bậc vật tư → thanh tìm. Bản 03/09 xếp hai hàng chip dài (bậc + từng người
 * đảm nhận) ngay dưới ô tìm: cùng một hình dạng nút cho hai loại câu hỏi khác
 * hẳn nhau, và hàng người dài thêm mỗi lần thêm nhân sự. Nay "ai giữ" là ô
 * CHỌN trong thanh công cụ — đúng thứ nó là: một bộ lọc phụ.
 *
 * Bấm một lệnh → `/planning/lsx/[id]` (đơn mua của lệnh) → bấm đơn →
 * `/planning/pos/[id]`. Ba tầng, mỗi tầng một câu hỏi.
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
  const [gate, setGate] = useState<LsxSupplyGateKey | 'mine' | 'all'>('all')
  const [customer, setCustomer] = useState('')
  const [q, setQ] = useState('')

  const enriched = useMemo(
    () =>
      rows
        .map((r) => ({
          row: r,
          gate: lsxSupplyGate(r),
          due: dueLevel(r.materials_due_at, today),
          daysLeft: daysUntilDue(r.materials_due_at, today),
          owners: ownersOf(r),
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
    const c: Record<string, number> = { mine: 0, all: enriched.length }
    for (const e of enriched) {
      c[e.gate.key] = (c[e.gate.key] ?? 0) + 1
      if (e.gate.mine) c.mine++
    }
    return c
  }, [enriched])

  /**
   * KHÁCH HÀNG là chiều lọc của màn này (user chốt 03/09/2026).
   *
   * Bản trước lọc theo NGƯỜI ĐẢM NHẬN — sai đơn vị: lệnh là của KHÁCH, còn các
   * đơn mua bên trong một lệnh do NHIỀU nhân viên lập, nên "lệnh của tôi" không
   * phải một khái niệm có thật. Người đảm nhận vẫn hiện trên dòng (biết gọi ai)
   * và lọc được ở tầng dưới — trang đơn mua của lệnh, nơi đơn vị đúng là ĐƠN.
   */
  const customerOptions = useMemo(
    () =>
      [...new Set(enriched.map((e) => e.row.customer_name).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'vi'),
      ),
    [enriched],
  )

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return enriched.filter((e) => {
      if (gate === 'mine' && !e.gate.mine) return false
      if (gate !== 'mine' && gate !== 'all' && e.gate.key !== gate) return false
      if (customer && e.row.customer_name !== customer) return false
      if (!ql) return true
      // Tìm cả theo KHÁCH và MÃ SP: người mua hay được hỏi ngược từ hai phía đó.
      return `${e.row.code} ${e.row.customer_name} ${e.row.order_codes.join(' ')} ${e.row.products
        .map((p) => p.code)
        .join(' ')}`
        .toLowerCase()
        .includes(ql)
    })
  }, [enriched, gate, customer, q])

  const toggle = (k: LsxSupplyGateKey | 'mine') => setGate(gate === k ? 'all' : k)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư theo lệnh' },
        ]}
        title="Vật tư theo lệnh"
        description="Lệnh đang chạy, xếp theo việc bạn cần làm trước. Bấm một lệnh để xem các đơn mua của nó — tình trạng, hẹn về và ai đang giữ."
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

      {/* Tầng 1 — bốn chỗ cần động tay; bấm thẻ là lọc đúng nhóm nó đếm. */}
      <StatTiles>
        <StatTile
          label="Việc của tôi"
          value={counts.mine ?? 0}
          icon={ClipboardList}
          tone="primary"
          hint="lệnh đang chờ Cung ứng làm gì đó"
          active={gate === 'mine'}
          onClick={() => toggle('mine')}
        />
        <StatTile
          label="Chưa lập đơn"
          value={counts.none ?? 0}
          icon={Package}
          tone="warn"
          active={gate === 'none'}
          onClick={() => toggle('none')}
          title="Lệnh chưa có đơn mua nào"
        />
        <StatTile
          label="Đơn chưa gửi NCC"
          value={counts.unsent ?? 0}
          icon={Send}
          tone="warn"
          active={gate === 'unsent'}
          onClick={() => toggle('unsent')}
          title="Còn đơn nháp hoặc chờ ký — chưa ra khỏi nhà"
        />
        <StatTile
          label="NCC trễ hẹn"
          value={counts.late ?? 0}
          icon={TriangleAlert}
          tone="stop"
          active={gate === 'late'}
          onClick={() => toggle('late')}
          title="Đơn đã gửi mà quá hẹn giao"
        />
      </StatTiles>

      {/* Tầng 2 — bậc vật tư, chọn một (một lệnh chỉ ở một bậc). */}
      <Tabs value={gate} onValueChange={(v) => setGate(v as LsxSupplyGateKey | 'all')}>
        <TabsList
          variant="line"
          className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto"
        >
          <TabsTrigger value="all">Tất cả · {counts.all}</TabsTrigger>
          {LSX_SUPPLY_GATES.map((k) => (
            <TabsTrigger key={k} value={k} disabled={(counts[k] ?? 0) === 0}>
              {GATE_LABEL[k]} · {counts[k] ?? 0}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                icon={<Search size={14} strokeWidth={1.8} />}
                placeholder="Tìm mã lệnh, khách hàng, mã đơn, mã sản phẩm…"
                className="w-80"
              />
              {customerOptions.length > 1 && (
                <ToolbarSelect
                  value={customer}
                  onChange={setCustomer}
                  aria-label="Lọc theo khách hàng"
                  options={[
                    { value: '', label: 'Mọi khách hàng' },
                    ...customerOptions.map((n) => ({ value: n, label: n })),
                  ]}
                />
              )}
            </>
          }
          right={
            <span className="t-label text-muted-foreground">
              {visible.length} / {enriched.length} lệnh
            </span>
          }
        />

        {visible.length === 0 ? (
          <div className="bg-card rounded-b-lg border">
            <EmptyState
              icon={<Factory />}
              title={
                rows.length === 0
                  ? 'Không có lệnh nào đang chạy'
                  : 'Không lệnh nào khớp bộ lọc'
              }
              description={
                rows.length === 0
                  ? 'Lệnh chỉ hiện ở đây sau khi Giám đốc ký và trước khi hoàn tất.'
                  : 'Thử bỏ bớt điều kiện lọc hoặc gõ mã lệnh ở ô tìm.'
              }
              action={
                rows.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setGate('all')
                      setCustomer('')
                      setQ('')
                    }}
                  >
                    Bỏ mọi bộ lọc
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="bg-card overflow-hidden rounded-b-lg border">
            {visible.map(({ row, gate: g, due, daysLeft, owners }) => (
              <Link
                key={row.id}
                href={`/planning/lsx/${row.id}`}
                className="spine grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b px-4 py-3 transition-colors last:border-0 hover:bg-[var(--accent)]/40 sm:grid-cols-[1fr_auto_auto]"
                style={{ '--spine': GATE_COLOR[g.key] } as React.CSSProperties}
              >
                <div className="flex min-w-0 flex-col gap-1">
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
                  {/* Dòng 2 — đang tắc ở đâu, chờ gì, ai giữ */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                      style={{ color: GATE_COLOR[g.key] }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: GATE_COLOR[g.key] }}
                        aria-hidden
                      />
                      {g.label}
                    </span>
                    <span className="text-muted-foreground text-[11.5px]">
                      {g.detail}
                    </span>
                    {row.products.length > 0 && (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11.5px]">
                        <Package className="size-3.5" strokeWidth={1.8} />
                        {row.products.length} mã SP
                      </span>
                    )}
                    {/* Trên điện thoại khối số bên phải bị ẩn — nhưng HẠN VẬT
                        TƯ là mốc quyết định, không được biến mất theo. */}
                    <span
                      className="inline-flex items-center gap-1 text-[11.5px] sm:hidden"
                      style={{ color: DUE_COLOR[due] }}
                    >
                      <CalendarClock className="size-3.5" strokeWidth={1.8} />
                      hạn VT {dmy(row.materials_due_at)}
                      {row.posTotal > 0 && ` · ${row.posTotal} đơn`}
                    </span>
                    {owners.length > 0 ? (
                      /* Một lệnh có thể do NHIỀU người lập đơn — kể tên hết thì
                         dòng dài ngoằng và át cả bậc vật tư. Hai tên đầu là đủ
                         để biết gọi ai; danh sách đủ nằm ở trang đơn của lệnh. */
                      <span
                        className="text-muted-foreground inline-flex items-center gap-1 text-[11.5px]"
                        title={owners.join(', ')}
                      >
                        <UserRound className="size-3.5" strokeWidth={1.8} />
                        {owners.slice(0, 2).join(', ')}
                        {owners.length > 2 && ` +${owners.length - 2}`}
                      </span>
                    ) : (
                      row.posTotal > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px]"
                          style={{ color: 'var(--warn)' }}
                        >
                          <UserRound className="size-3.5" strokeWidth={1.8} />
                          đơn chưa giao ai
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Khối số — ba mốc người mua đối chiếu, thẳng cột giữa các dòng */}
                <div className="hidden gap-6 text-right sm:flex">
                  <Meta label="Hạn vật tư" color={DUE_COLOR[due]}>
                    <span className="t-data text-[12.5px] font-medium">
                      {dmy(row.materials_due_at)}
                    </span>
                    <span className="block text-[11px]">
                      {daysLeft === null
                        ? 'chưa đặt hạn'
                        : daysLeft < 0
                          ? `quá ${-daysLeft} ngày`
                          : daysLeft === 0
                            ? 'hôm nay'
                            : `còn ${daysLeft} ngày`}
                    </span>
                  </Meta>
                  <Meta label="Giao khách">
                    <span className="t-data text-[12.5px]">{dmy(row.ship_date)}</span>
                  </Meta>
                  <Meta label="Đơn mua">
                    <span className="t-data text-[12.5px]">{row.posTotal}</span>
                    {/* Đơn CHƯA GỬI đứng trước "quá hẹn": khi cả hai cùng có,
                        việc phải làm là gửi đơn đi, và nói "quá hẹn" cạnh một
                        xấp đơn còn trên bàn mình dễ đọc thành "NCC trễ". */}
                    {row.posUnsent > 0 ? (
                      <span
                        className="block text-[11px] font-medium"
                        style={{ color: 'var(--warn)' }}
                      >
                        {row.posUnsent} chưa gửi
                      </span>
                    ) : row.posLate > 0 ? (
                      <span
                        className="block text-[11px] font-medium"
                        style={{ color: 'var(--stop)' }}
                      >
                        {row.posLate} quá hẹn
                      </span>
                    ) : null}
                  </Meta>
                </div>

                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Một mốc số ở mép phải dòng lệnh — nhãn nhỏ trên, số dưới. */
function Meta({
  label,
  color,
  children,
}: {
  label: string
  color?: string
  children: React.ReactNode
}) {
  return (
    <div className="w-20" style={color ? { color } : undefined}>
      <div className="t-label text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}
