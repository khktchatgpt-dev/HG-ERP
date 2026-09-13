'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
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
import { daysUntilDue, dueLevel } from '@/lib/lsx-supply'
import {
  MEETING_LEVEL,
  MEETING_LEVELS,
  MEETING_STOP_DAYS,
  assessMeetingRisk,
  compareMeeting,
  type MeetingRiskLevel,
} from '@/lib/supply-meeting'
import { LEVEL_BADGE } from '../_components/IssueRow'
import type { LsxSupplyRow } from '@/modules/dept/supply/lsx-supply.service'
import { useToast } from '@/components/ui/Toast'
import { apiErrorText } from '@/lib/api'
import { suggestMaterialsDue } from '@/lib/lsx-supply'
import { LsxDueEditor, saveMaterialsDue } from './LsxDueEditor'

export type { LsxSupplyRow }

/**
 * MỘT THANG MỨC cho cả phòng (13/09/2026): danh sách này, ba trang họp
 * (Tổng quan · Vấn đề · Việc cần quyết định) và file Excel họp đều đọc
 * `assessMeetingRisk`. Trước đó danh sách dùng thang bậc cũ (Chưa lập đơn /
 * Đơn chưa gửi / NCC trễ…) nên cùng một lệnh mang hai nhãn ở hai trang.
 * Lọc `?muc=<mức>` để ô KPI ở Tổng quan dẫn thẳng tới đây đã lọc sẵn.
 */
type LevelFilter = MeetingRiskLevel | 'mine' | 'all'

function isLevel(v: string | null): v is MeetingRiskLevel {
  return !!v && v in MEETING_LEVEL
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
  const muc = useSearchParams().get('muc')
  const [gate, setGate] = useState<LevelFilter>(isLevel(muc) ? muc : 'all')

  const router = useRouter()
  const toast = useToast()
  const [filling, setFilling] = useState(false)
  // Lệnh chưa có hạn nhưng có ngày xuất — điền gợi ý "ngày xuất − 30" một lượt.
  const fillable = useMemo(
    () =>
      rows.filter((r) => !r.materials_due_at && suggestMaterialsDue(r.ship_date, today)),
    [rows, today],
  )
  async function fillSuggested() {
    setFilling(true)
    let ok = 0
    try {
      for (const r of fillable) {
        await saveMaterialsDue(r.id, suggestMaterialsDue(r.ship_date, today))
        ok++
      }
      toast.success(`Đã đặt hạn vật tư cho ${ok} lệnh theo ngày xuất − 30`)
      router.refresh()
    } catch (e) {
      toast.error(`Dừng sau ${ok} lệnh`, apiErrorText(e))
      router.refresh()
    } finally {
      setFilling(false)
    }
  }
  const [customer, setCustomer] = useState('')
  const [dueFilter, setDueFilter] = useState('')
  const [q, setQ] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  const enriched = useMemo(
    () =>
      rows
        .map((r) => ({
          row: r,
          risk: assessMeetingRisk(r, today),
          due: dueLevel(r.materials_due_at, today),
          daysLeft: daysUntilDue(r.materials_due_at, today),
          owners: ownersOf(r),
        }))
        // Cùng thứ tự với ba trang họp: khẩn trước, cùng mức thì mốc gần trước.
        .sort(compareMeeting),
    [rows, today],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { mine: 0, all: enriched.length }
    for (const e of enriched) {
      c[e.risk.level] = (c[e.risk.level] ?? 0) + 1
      // "Việc của tôi" = lệnh mà bóng đang ở Cung ứng (chưa lập/chưa gửi đơn).
      if (e.risk.owner === 'Cung ứng') c.mine++
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
      if (gate === 'mine' && e.risk.owner !== 'Cung ứng') return false
      if (gate !== 'mine' && gate !== 'all' && e.risk.level !== gate) return false
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

  const toggle = (k: MeetingRiskLevel | 'mine') => setGate(gate === k ? 'all' : k)

  return (
    <div className="theme-v3 text-foreground flex flex-col gap-5 pb-16">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư theo lệnh' },
        ]}
        title="Vật tư theo lệnh"
        description="Từng lệnh đang chạy: vật tư ở mức nào, vì sao, ai đang cầm bóng. Cùng thang mức với bảng họp và file Excel họp — khẩn xếp trước."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href="/api/dept/supply/hop-report" download>
                <Download className="size-4" /> Báo cáo đơn hàng (Excel)
              </a>
            </Button>
            {canEdit && fillable.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={filling}
                onClick={() => void fillSuggested()}
              >
                <CalendarClock className="size-4" /> Điền hạn gợi ý cho {fillable.length}{' '}
                lệnh
              </Button>
            )}
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
          label="Nguy cơ dừng SX"
          value={counts.stop ?? 0}
          icon={AlertTriangle}
          tone="stop"
          hint={`vật tư chưa đủ, mốc còn ≤ ${MEETING_STOP_DAYS} ngày`}
          active={gate === 'stop'}
          onClick={() => toggle('stop')}
          title="Vật tư chưa đủ mà mốc (hạn vật tư hoặc ngày xuất) còn rất gần hoặc đã qua"
        />
        <StatTile
          label="Thiếu / chưa mua"
          value={counts.warn ?? 0}
          icon={Package}
          tone="warn"
          hint="chưa lập đơn, đơn chưa gửi, NCC trễ"
          active={gate === 'warn'}
          onClick={() => toggle('warn')}
          title="Chưa lập đơn, đơn còn nháp/chờ ký, hoặc nhà cung cấp đã trễ hẹn"
        />
        <StatTile
          label="Chưa có mốc"
          value={counts.watch ?? 0}
          icon={CalendarClock}
          tone="default"
          hint="không hạn vật tư, không ngày xuất"
          active={gate === 'watch'}
          onClick={() => toggle('watch')}
          title="Lệnh không có hạn vật tư lẫn ngày xuất — chưa đo được rủi ro"
        />
      </StatTiles>

      {/* ── Tabs mức: đúng 5 mức của bảng họp ─────────────────────────────── */}
      <Tabs value={gate} onValueChange={(v) => setGate(v as LevelFilter)}>
        <TabsList className="bg-muted/60 h-auto flex-wrap p-1">
          <TabsTrigger value="all" className="gap-2">
            Tất cả
            <Badge tone="gray" className="px-1.5 py-0 text-[10px]">
              {counts.all}
            </Badge>
          </TabsTrigger>
          {MEETING_LEVELS.map((k) => (
            <TabsTrigger
              key={k}
              value={k}
              disabled={(counts[k] ?? 0) === 0}
              className="gap-2"
            >
              {MEETING_LEVEL[k].label}
              <Badge tone={LEVEL_BADGE[k]} className="px-1.5 py-0 text-[10px]">
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
                icon={<Search className="text-muted-foreground size-4" />}
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
              <div className="bg-muted flex items-center rounded-lg border p-0.5">
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
                icon={<Factory className="text-muted-foreground size-8" />}
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
          /* ── BẢNG DỮ LIỆU CHUẨN ERP (TABLE VIEW) ──────────────────────────
             Làm lại 13/09/2026 (user: "thông tin đơn hàng nhiều gây khó nhìn"):
             mỗi lệnh TỐI ĐA HAI DÒNG. Sản phẩm và mã đơn hàng rút thành một
             đoạn tóm tắt (đủ danh sách ở tooltip và ở trang lệnh); cột Mức
             tách riêng để mắt quét dọc; mốc vật tư, đơn mua, người theo dõi mỗi
             thứ một cột hẹp. Câu hỏi của bảng là "lệnh nào cần tôi động vào" —
             chi tiết để dành cho trang lệnh. */
          <Card className="overflow-hidden">
            <CardContent className="overflow-x-auto p-0">
              <Table className="w-full min-w-[960px] text-[12.5px]">
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-32 text-xs font-semibold tracking-wider uppercase">
                      Mức
                    </TableHead>
                    <TableHead className="text-xs font-semibold tracking-wider uppercase">
                      Lệnh · khách hàng
                    </TableHead>
                    <TableHead className="w-[34%] text-xs font-semibold tracking-wider uppercase">
                      Vì sao · việc phải làm
                    </TableHead>
                    <TableHead className="w-36 text-xs font-semibold tracking-wider uppercase">
                      Hạn vật tư · xuất
                    </TableHead>
                    <TableHead className="w-36 text-xs font-semibold tracking-wider uppercase">
                      Đơn mua
                    </TableHead>
                    <TableHead className="w-36 text-xs font-semibold tracking-wider uppercase">
                      Người theo dõi
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(({ row, risk, due, daysLeft, owners }) => {
                    const spTitle = row.products
                      .map(
                        (p) => `${p.code} — ${p.name} × ${p.qty.toLocaleString('vi-VN')}`,
                      )
                      .join('\n')
                    const tomTat = [
                      row.customer_name,
                      row.products.length > 0 ? `${row.products.length} mã SP` : null,
                      row.order_codes.length > 0
                        ? row.order_codes.length === 1
                          ? `ĐH ${row.order_codes[0]}`
                          : `${row.order_codes.length} đơn hàng`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    const hanText =
                      due === 'overdue' && daysLeft !== null
                        ? `quá ${-daysLeft} ngày`
                        : due === 'today'
                          ? 'đến hạn hôm nay'
                          : (due === 'soon' || due === 'later') && daysLeft !== null
                            ? `còn ${daysLeft} ngày`
                            : null
                    const hanTone =
                      due === 'overdue'
                        ? 'var(--stop)'
                        : due === 'today' || due === 'soon'
                          ? 'var(--warn)'
                          : undefined
                    const poParts = [
                      row.posUnsent > 0 ? (
                        <span key="u" style={{ color: 'var(--warn)' }}>
                          {row.posUnsent} chưa gửi
                        </span>
                      ) : null,
                      row.posLate > 0 ? (
                        <span key="l" style={{ color: 'var(--stop)' }}>
                          {row.posLate} quá hẹn
                        </span>
                      ) : null,
                      row.posOpen > 0 ? (
                        <span key="o" className="text-muted-foreground">
                          {row.posOpen} đang về
                        </span>
                      ) : null,
                    ].filter((x) => x !== null)
                    return (
                      <TableRow
                        key={row.id}
                        className="hover:bg-muted/40 align-top transition-colors"
                      >
                        {/* Mức */}
                        <TableCell className="py-2">
                          <Badge tone={LEVEL_BADGE[risk.level]} className="w-fit">
                            {risk.label}
                          </Badge>
                        </TableCell>

                        {/* Lệnh · khách · tóm tắt SP/ĐH */}
                        <TableCell className="py-2">
                          <Link
                            href={`/planning/lsx/${row.id}`}
                            className="w-fit hover:opacity-80"
                          >
                            <DocChip>{row.code}</DocChip>
                          </Link>
                          <div
                            className="text-muted-foreground mt-1 max-w-[260px] truncate text-[11.5px]"
                            title={[
                              row.customer_name,
                              spTitle,
                              row.order_codes.join(', '),
                            ]
                              .filter(Boolean)
                              .join('\n')}
                          >
                            {tomTat}
                          </div>
                        </TableCell>

                        {/* Vì sao · việc phải làm — cùng câu chữ với trang Vấn đề */}
                        <TableCell className="py-2">
                          <p className="line-clamp-1" title={risk.reason}>
                            {risk.reason}
                          </p>
                          {risk.action ? (
                            <p className="mt-0.5 text-[11.5px]">
                              <span className="text-muted-foreground">{risk.owner}:</span>{' '}
                              <span className="font-medium">{risk.action}</span>
                            </p>
                          ) : (
                            <p className="text-muted-foreground mt-0.5 text-[11.5px]">
                              Không có việc phải làm
                            </p>
                          )}
                        </TableCell>

                        {/* Hạn vật tư · xuất */}
                        <TableCell className="py-2">
                          {canEdit ? (
                            <LsxDueEditor
                              lsxId={row.id}
                              value={row.materials_due_at}
                              shipDate={row.ship_date}
                              today={today}
                              compact
                            />
                          ) : (
                            <span className="font-mono text-xs font-semibold">
                              {dmy(row.materials_due_at)}
                            </span>
                          )}
                          <div className="text-muted-foreground mt-0.5 text-[11.5px]">
                            {hanText ? (
                              <span className="font-medium" style={{ color: hanTone }}>
                                {hanText}
                              </span>
                            ) : (
                              <span className="italic">chưa đặt hạn</span>
                            )}
                            {' · '}xuất{' '}
                            <span className="font-mono">{dmy(row.ship_date)}</span>
                          </div>
                        </TableCell>

                        {/* Đơn mua */}
                        <TableCell className="py-2">
                          <Link
                            href={`/planning/lsx/${row.id}`}
                            className="font-mono font-semibold hover:underline"
                            style={{ color: 'var(--primary)' }}
                          >
                            {row.posTotal} đơn
                          </Link>
                          <div className="mt-0.5 text-[11.5px]">
                            {row.posTotal === 0 ? (
                              <span style={{ color: 'var(--warn)' }}>chưa lập đơn</span>
                            ) : poParts.length > 0 ? (
                              poParts.flatMap((el, i) => (i === 0 ? [el] : [' · ', el]))
                            ) : (
                              <span style={{ color: 'var(--done)' }}>đã nhận đủ</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Người theo dõi */}
                        <TableCell className="py-2">
                          {owners.length > 0 ? (
                            <span className="block truncate" title={owners.join(', ')}>
                              {owners.slice(0, 2).join(', ')}
                              {owners.length > 2 && ` +${owners.length - 2}`}
                            </span>
                          ) : row.posTotal > 0 ? (
                            <span
                              className="text-[11.5px]"
                              style={{ color: 'var(--warn)' }}
                            >
                              chưa giao ai
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Thao tác */}
                        <TableCell className="py-1.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem asChild>
                                <Link href={`/planning/lsx/${row.id}`}>
                                  <Eye className="size-4" /> Xem đơn mua ({row.posTotal})
                                </Link>
                              </DropdownMenuItem>
                              {canEdit && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/planning/pos/new?production_order_id=${row.id}`}
                                  >
                                    <Plus className="size-4" /> Tạo đơn mua mới
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link href={`/production/lsx/${row.id}`}>
                                  <Factory className="size-4" /> Mở hồ sơ lệnh
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={`/api/dept/supply/hop-report?lsx=${row.id}`}
                                  download
                                >
                                  <Download className="size-4" /> Báo cáo đơn hàng (Excel)
                                </a>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* ── CHẾ ĐỘ THẺ TRỰC QUAN (CARDS VIEW) ───────────────────────────── */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(({ row, risk, due, daysLeft, owners }) => (
              <Card
                key={row.id}
                className="hover:border-primary/50 flex flex-col justify-between shadow-2xs transition-colors"
              >
                <CardHeader className="bg-muted/20 border-b pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <DocChip>{row.code}</DocChip>
                    <Badge tone={LEVEL_BADGE[risk.level]}>{risk.label}</Badge>
                  </div>
                  <CardTitle className="mt-2 flex items-center gap-1.5 text-base font-bold">
                    <Building2 className="text-muted-foreground size-4 shrink-0" />
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
                  <div className="bg-muted/40 text-muted-foreground rounded-lg p-2.5 text-xs leading-relaxed">
                    {risk.reason}
                    {risk.action && (
                      <>
                        {' '}
                        <span className="text-foreground font-medium">
                          → {risk.action}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Sản phẩm */}
                  {row.products.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                        Sản phẩm ({row.products.length} mã)
                      </span>
                      <div className="flex flex-col gap-1 text-xs">
                        {row.products.slice(0, 2).map((p) => (
                          <div
                            key={p.code}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span className="truncate font-medium">{p.code}</span>
                            <span className="text-muted-foreground font-mono">
                              {p.qty.toLocaleString('vi-VN')}
                            </span>
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
                      <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase">
                        <CalendarClock className="size-3" /> Hạn vật tư
                      </span>
                      {canEdit ? (
                        <LsxDueEditor
                          lsxId={row.id}
                          value={row.materials_due_at}
                          shipDate={row.ship_date}
                          today={today}
                          compact
                        />
                      ) : (
                        <span className="font-mono text-xs font-semibold">
                          {dmy(row.materials_due_at)}
                        </span>
                      )}
                      {due === 'overdue' && daysLeft !== null ? (
                        <span className="text-destructive text-[11px] font-semibold">
                          Quá {-daysLeft} ngày
                        </span>
                      ) : due === 'today' ? (
                        <span className="text-[11px] font-semibold text-amber-600">
                          Đến hạn hôm nay
                        </span>
                      ) : due === 'soon' && daysLeft !== null ? (
                        <span className="text-[11px] text-amber-600">
                          Còn {daysLeft} ngày
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase">
                        <CalendarDays className="size-3" /> Giao khách
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        {dmy(row.ship_date)}
                      </span>
                    </div>
                  </div>

                  {/* Đơn mua và người theo dõi */}
                  <div className="flex items-center justify-between border-t pt-3 text-xs">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10.5px] font-semibold uppercase">
                        Đơn mua
                      </span>
                      <span className="font-mono font-medium">{row.posTotal} đơn</span>
                    </div>

                    <div className="flex flex-col text-right">
                      <span className="text-muted-foreground text-[10.5px] font-semibold uppercase">
                        Người theo dõi
                      </span>
                      <span className="max-w-[130px] truncate font-medium">
                        {owners.length > 0 ? (
                          owners.join(', ')
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="bg-muted/20 flex items-center justify-between border-t px-4 py-2.5">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/planning/lsx/${row.id}`} className="gap-1.5">
                      Xem đơn mua <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        href={`/planning/pos/new?production_order_id=${row.id}`}
                        title="Tạo đơn mua mới"
                      >
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
