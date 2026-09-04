'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  Factory,
  LayoutGrid,
  LayoutList,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Send,
  Truck,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import {
  LSX_SUPPLY_GATES,
  compareForSupply,
  daysUntilDue,
  dueLevel,
  lsxSupplyGate,
  type DueLevel,
  type LsxSupplyGateKey,
} from '@/lib/lsx-supply'
import type { BadgeTone } from '@/components/Badge'
import type { LsxSupplyRow } from '@/modules/dept/supply/lsx-supply.service'

export type { LsxSupplyRow }

const GATE_TONE: Record<LsxSupplyGateKey, BadgeTone> = {
  none: 'amber',
  unsent: 'amber',
  late: 'red',
  inflight: 'blue',
  done: 'green',
}

const GATE_LABEL: Record<LsxSupplyGateKey, string> = {
  none: 'Chưa lập đơn',
  unsent: 'Đơn chưa gửi',
  late: 'NCC trễ hẹn',
  inflight: 'Vật tư đang về',
  done: 'Về đủ',
}

const DUE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Mọi hạn vật tư' },
  { value: 'overdue', label: 'Quá hạn vật tư' },
  { value: 'today', label: 'Đến hạn hôm nay' },
  { value: 'soon', label: 'Sắp đến hạn (≤7 ngày)' },
  { value: 'later', label: 'Còn thời gian' },
  { value: 'none', label: 'Chưa đặt hạn' },
]

const dmy = (iso: string | null) => {
  if (!iso) return '—'
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

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
  const [dueFilter, setDueFilter] = useState('')
  const [q, setQ] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

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
      if (dueFilter && e.due !== dueFilter) return false
      if (!ql) return true
      return `${e.row.code} ${e.row.customer_name} ${e.row.order_codes.join(' ')} ${e.row.products
        .map((p) => `${p.code} ${p.name}`)
        .join(' ')}`
        .toLowerCase()
        .includes(ql)
    })
  }, [enriched, gate, customer, dueFilter, q])

  const toggle = (k: LsxSupplyGateKey | 'mine') => setGate(gate === k ? 'all' : k)

  return (
    <div className="theme-v3 text-foreground flex flex-col gap-5 pb-16">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư theo lệnh' },
        ]}
        title="Vật tư theo lệnh"
        description="Theo dõi tiến độ vật tư và tình trạng đơn mua của các lệnh sản xuất đang chạy. Xếp theo việc cần xử lý trước."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href="/api/dept/supply/lsx-report" download>
                <Download className="size-4" /> Xuất Excel
              </a>
            </Button>
            {canEdit && (
              <Button size="sm" asChild>
                <Link href="/planning/pos/new">
                  <Plus className="size-4" /> Tạo phiếu mua
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* ── Dải 4 Thẻ KPI StatTiles ──────────────────────────────────────── */}
      <StatTiles>
        <StatTile
          label="Việc của tôi"
          value={counts.mine ?? 0}
          icon={ClipboardList}
          tone="primary"
          hint="lệnh cần Cung ứng xử lý"
          active={gate === 'mine'}
          onClick={() => toggle('mine')}
        />
        <StatTile
          label="Chưa lập đơn"
          value={counts.none ?? 0}
          icon={Package}
          tone="warn"
          hint="lệnh chưa có PO nào"
          active={gate === 'none'}
          onClick={() => toggle('none')}
          title="Lệnh chưa có đơn mua nào"
        />
        <StatTile
          label="Đơn chưa gửi NCC"
          value={counts.unsent ?? 0}
          icon={Send}
          tone="warn"
          hint="còn nháp hoặc chờ duyệt"
          active={gate === 'unsent'}
          onClick={() => toggle('unsent')}
          title="Còn đơn nháp hoặc chờ ký — chưa ra khỏi nhà"
        />
        <StatTile
          label="NCC trễ hẹn"
          value={counts.late ?? 0}
          icon={AlertTriangle}
          tone="stop"
          hint="đơn quá hạn cam kết"
          active={gate === 'late'}
          onClick={() => toggle('late')}
          title="Đơn đã gửi mà quá hẹn giao"
        />
      </StatTiles>

      {/* ── Gate Tabs: Phân loại theo bậc cung ứng ────────────────────────── */}
      <Tabs value={gate} onValueChange={(v) => setGate(v as LsxSupplyGateKey | 'all')}>
        <TabsList className="bg-muted/60 h-auto flex-wrap p-1">
          <TabsTrigger value="all" className="gap-2">
            Tất cả
            <Badge tone="gray" className="px-1.5 py-0 text-[10px]">
              {counts.all}
            </Badge>
          </TabsTrigger>
          {LSX_SUPPLY_GATES.map((k) => (
            <TabsTrigger
              key={k}
              value={k}
              disabled={(counts[k] ?? 0) === 0}
              className="gap-2"
            >
              {GATE_LABEL[k]}
              <Badge
                tone={
                  k === 'late'
                    ? 'red'
                    : k === 'none' || k === 'unsent'
                      ? 'amber'
                      : k === 'done'
                        ? 'green'
                        : 'blue'
                }
                className="px-1.5 py-0 text-[10px]"
              >
                {counts[k] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── Toolbar: Tìm kiếm, Bộ lọc & Chuyển đổi View Mode ─────────────── */}
      <div className="flex flex-col gap-3">
        <Toolbar
          left={
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarInput
                value={q}
                onChange={setQ}
                icon={<Search className="size-4 text-muted-foreground" />}
                placeholder="Tìm mã lệnh, khách hàng, mã đơn, mã sản phẩm…"
                className="w-72 sm:w-80"
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
              <ToolbarSelect
                value={dueFilter}
                onChange={setDueFilter}
                aria-label="Lọc theo hạn vật tư"
                options={DUE_FILTER_OPTIONS}
              />
            </div>
          }
          right={
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs font-medium">
                {visible.length} / {enriched.length} lệnh
              </span>
              <div className="bg-muted flex items-center rounded-lg p-0.5 border">
                <Button
                  size="icon"
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  className="size-7"
                  onClick={() => setViewMode('table')}
                  title="Chế độ Bảng dữ liệu (Table View)"
                >
                  <LayoutList className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  className="size-7"
                  onClick={() => setViewMode('cards')}
                  title="Chế độ Thẻ trực quan (Cards View)"
                >
                  <LayoutGrid className="size-3.5" />
                </Button>
              </div>
            </div>
          }
        />

        {/* ── Nội dung: Table View hoặc Cards View ──────────────────────── */}
        {visible.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<Factory className="size-8 text-muted-foreground" />}
                title={
                  rows.length === 0
                    ? 'Không có lệnh nào đang chạy'
                    : 'Không có lệnh nào khớp bộ lọc'
                }
                description={
                  rows.length === 0
                    ? 'Lệnh sản xuất chỉ hiện ở đây sau khi đã được duyệt và đang trong quá trình chuẩn bị vật tư.'
                    : 'Thử bỏ bớt điều kiện lọc hoặc nhập từ khoá khác.'
                }
                action={
                  rows.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setGate('all')
                        setCustomer('')
                        setDueFilter('')
                        setQ('')
                      }}
                    >
                      Bỏ mọi bộ lọc
                    </Button>
                  )
                }
              />
            </CardContent>
          </Card>
        ) : viewMode === 'table' ? (
          /* ── BẢNG DỮ LIỆU CHUẨN ERP (TABLE VIEW) ────────────────────────── */
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[900px] w-full">
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-8 text-center font-semibold text-xs uppercase tracking-wider">#</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Lệnh SX & Khách hàng</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Sản phẩm & Đơn hàng</TableHead>
                    <TableHead className="w-44 font-semibold text-xs uppercase tracking-wider">Tiến độ vật tư</TableHead>
                    <TableHead className="w-44 font-semibold text-xs uppercase tracking-wider">Hạn & Giao khách</TableHead>
                    <TableHead className="w-44 font-semibold text-xs uppercase tracking-wider">Đơn mua (PO)</TableHead>
                    <TableHead className="w-20 text-right font-semibold text-xs uppercase tracking-wider">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(({ row, gate: g, due, daysLeft, owners }, idx) => (
                    <TableRow key={row.id} className="align-top hover:bg-muted/40 transition-colors group">
                      {/* # */}
                      <TableCell className="font-mono text-muted-foreground text-center text-xs pt-3.5">
                        {idx + 1}
                      </TableCell>

                      {/* Lệnh SX & Khách hàng */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1.5">
                          <Link href={`/planning/lsx/${row.id}`} className="hover:opacity-80 w-fit">
                            <DocChip>{row.code}</DocChip>
                          </Link>
                          <div className="flex items-center gap-1.5 font-semibold text-sm">
                            <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[180px]">{row.customer_name}</span>
                          </div>
                          {owners.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <UserRound className="size-3 shrink-0" />
                              <span className="truncate max-w-[170px]">{owners.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Sản phẩm & Đơn hàng */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1">
                          {row.order_codes.length > 0 && (
                            <div className="font-mono text-xs text-muted-foreground">
                              ĐH: {row.order_codes.join(', ')}
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5 text-xs">
                            {row.products.slice(0, 3).map((p) => (
                              <div key={p.code} className="flex items-baseline gap-2">
                                <span className="font-medium text-foreground font-mono">{p.code}</span>
                                <span className="font-mono text-muted-foreground ml-auto shrink-0">{p.qty.toLocaleString('vi-VN')}</span>
                              </div>
                            ))}
                            {row.products.length > 3 && (
                              <span className="text-muted-foreground text-[10.5px]">
                                +{row.products.length - 3} mã khác
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Tiến độ vật tư */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1.5">
                          <Badge tone={GATE_TONE[g.key]} className="w-fit">{g.label}</Badge>
                          <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">
                            {g.detail}
                          </p>
                        </div>
                      </TableCell>

                      {/* Hạn & Giao khách */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="size-3" /> Hạn vật tư
                            </span>
                            <span className="font-mono font-semibold text-sm">{dmy(row.materials_due_at)}</span>
                            {due === 'overdue' && daysLeft !== null ? (
                              <Badge tone="red" className="w-fit text-[10px]">Quá {-daysLeft} ngày</Badge>
                            ) : due === 'today' ? (
                              <Badge tone="amber" className="w-fit text-[10px]">Đến hạn hôm nay</Badge>
                            ) : due === 'soon' && daysLeft !== null ? (
                              <span className="text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>Còn {daysLeft} ngày</span>
                            ) : due === 'later' && daysLeft !== null ? (
                              <span className="text-muted-foreground text-[11px]">Còn {daysLeft} ngày</span>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">Chưa đặt hạn</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="size-3" /> Giao khách
                            </span>
                            <span className="font-mono text-xs font-medium">{dmy(row.ship_date)}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Đơn mua (PO) */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1.5">
                          <Link
                            href={`/planning/lsx/${row.id}`}
                            className="font-mono font-bold text-sm hover:underline"
                            style={{ color: 'var(--primary)' }}
                          >
                            {row.posTotal} đơn mua
                          </Link>
                          <div className="flex flex-wrap gap-1">
                            {row.posTotal === 0 ? (
                              <Badge tone="amber" className="text-[10px]">Chưa lập PO</Badge>
                            ) : (
                              <>
                                {row.posUnsent > 0 && (
                                  <Badge tone="amber" className="text-[10px]">{row.posUnsent} chưa gửi</Badge>
                                )}
                                {row.posLate > 0 && (
                                  <Badge tone="red" className="text-[10px]">{row.posLate} quá hẹn</Badge>
                                )}
                                {row.posOpen > 0 && row.posUnsent === 0 && row.posLate === 0 && (
                                  <Badge tone="blue" className="text-[10px]">{row.posOpen} đang về</Badge>
                                )}
                                {row.posTotal > 0 && row.posOpen === 0 && row.posUnsent === 0 && row.posLate === 0 && (
                                  <Badge tone="green" className="text-[10px]">Hoàn tất</Badge>
                                )}
                              </>
                            )}
                          </div>
                          {owners.length === 0 && row.posTotal > 0 && (
                            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                              <UserRound className="size-3" /> Chưa giao ai
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Thao tác */}
                      <TableCell className="text-right py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" asChild title="Xem chi tiết">
                            <Link href={`/planning/lsx/${row.id}`}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/planning/lsx/${row.id}`}>
                                  <Package className="size-4" /> Xem đơn mua ({row.posTotal})
                                </Link>
                              </DropdownMenuItem>
                              {canEdit && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/planning/pos/new?production_order_id=${row.id}`}>
                                    <Plus className="size-4" /> Tạo đơn mua mới
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link href={`/production/lsx/${row.id}`}>
                                  <Factory className="size-4" /> Mở hồ sơ lệnh
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* ── CHẾ ĐỘ THẺ TRỰC QUAN (CARDS VIEW) ───────────────────────────── */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(({ row, gate: g, due, daysLeft, owners }) => (
              <Card key={row.id} className="flex flex-col justify-between hover:border-primary/50 transition-colors shadow-2xs">
                <CardHeader className="border-b bg-muted/20 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <DocChip>{row.code}</DocChip>
                    <Badge tone={GATE_TONE[g.key]}>{g.label}</Badge>
                  </div>
                  <CardTitle className="text-base font-bold flex items-center gap-1.5 mt-2">
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{row.customer_name}</span>
                  </CardTitle>
                  {row.order_codes.length > 0 && (
                    <div className="text-muted-foreground font-mono text-xs">
                      Đơn hàng: {row.order_codes.join(', ')}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex flex-col gap-3.5 p-4 text-sm">
                  {/* Trạng thái chi tiết */}
                  <div className="bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground leading-relaxed">
                    {g.detail}
                  </div>

                  {/* Sản phẩm */}
                  {row.products.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sản phẩm ({row.products.length} mã)
                      </span>
                      <div className="flex flex-col gap-1 text-xs">
                        {row.products.slice(0, 2).map((p) => (
                          <div key={p.code} className="flex justify-between items-baseline gap-2">
                            <span className="font-medium truncate">{p.code}</span>
                            <span className="font-mono text-muted-foreground">{p.qty.toLocaleString('vi-VN')}</span>
                          </div>
                        ))}
                        {row.products.length > 2 && (
                          <span className="text-muted-foreground text-[11px]">
                            +{row.products.length - 2} sản phẩm khác
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Các mốc thời gian */}
                  <div className="grid grid-cols-2 gap-3 border-t pt-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="size-3" /> Hạn vật tư
                      </span>
                      <span className="font-mono text-xs font-semibold">{dmy(row.materials_due_at)}</span>
                      {due === 'overdue' && daysLeft !== null ? (
                        <span className="text-[11px] font-semibold text-destructive">Quá {-daysLeft} ngày</span>
                      ) : due === 'today' ? (
                        <span className="text-[11px] font-semibold text-amber-600">Đến hạn hôm nay</span>
                      ) : due === 'soon' && daysLeft !== null ? (
                        <span className="text-[11px] text-amber-600">Còn {daysLeft} ngày</span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="size-3" /> Giao khách
                      </span>
                      <span className="font-mono text-xs font-semibold">{dmy(row.ship_date)}</span>
                    </div>
                  </div>

                  {/* Đơn mua và người theo dõi */}
                  <div className="flex items-center justify-between border-t pt-3 text-xs">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10.5px] uppercase font-semibold">Đơn mua</span>
                      <span className="font-mono font-medium">{row.posTotal} đơn</span>
                    </div>

                    <div className="flex flex-col text-right">
                      <span className="text-muted-foreground text-[10.5px] uppercase font-semibold">Người theo dõi</span>
                      <span className="font-medium truncate max-w-[130px]">
                        {owners.length > 0 ? owners.join(', ') : <span className="text-muted-foreground">—</span>}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-t bg-muted/20 px-4 py-2.5 flex items-center justify-between">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/planning/lsx/${row.id}`} className="gap-1.5">
                      Xem đơn mua <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/planning/pos/new?production_order_id=${row.id}`} title="Tạo đơn mua mới">
                        <Plus className="size-4" /> Tạo PO
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
