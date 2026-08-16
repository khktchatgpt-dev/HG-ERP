'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Copy,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  PenLine,
  Plus,
  Printer,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { TopProgressBar } from '@/components/erp/Spinner'
import { StageBar, STAGE_OF } from '@/components/production/LsxStageBar'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { IssueLsxDialog, type IssueForm } from './IssueLsxDialog'

/**
 * TRANG LỆNH SẢN XUẤT của Sales — TRANG MẪU cho style v2 (chốt 06/08/2026).
 *
 * Trang đầu tiên dựng thuần shadcn/ui + token `.theme-v2` ("phiếu giấy ấm"),
 * thay ERP kit cũ. Bốn quyết định trị bệnh "khó nhìn" của bản trước:
 *   · đơn chờ phát gom theo khách thành DẢI một-dòng-một-khách đầu trang;
 *   · bảng mỗi dòng cao ĐÚNG 2 tầng chữ — cột Đơn hàng chỉ hiện mã đầu + chip
 *     "+N" mở popover (dòng ROSCO 13 mã từng cao 8 dòng);
 *   · tiến trình là thanh 4 đoạn đọc được từ xa, không phải 4 chấm 2px;
 *   · số thống kê nằm luôn trên tab lọc — đúng chức năng thật của nó.
 *
 * Luồng phát lệnh giữ nguyên hộp thoại dẫn bước khách → đơn (IssueLsxDialog).
 * Các trang khác vẫn ERP kit — duyệt style này xong mới migrate dần.
 */

export type AwaitingOrder = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  due_date: string | null
  line_count: number
  qty: number
}

export type LsxRow = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  order_codes: string[]
  status: string
  revision: number
  issued_at: string | null
  ship_date: string | null
  lines: number
  qty: number
  /** Người LẬP lệnh — null với lệnh nhập bằng script trước khi có tính năng. */
  created_by_name: string | null
}

const fmtD = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'
const fmtN = (n: number) => n.toLocaleString('vi-VN')

/**
 * Tên gọi (chữ cuối) để nhét vừa ô hẹp: "Nguyễn T.Minh Hằng" → "Hằng". Họ tên
 * đầy đủ trong ô 250px bị cắt cụt, vừa mất chữ vừa không phân biệt được ai —
 * tên đầy đủ giữ ở tooltip.
 */
const shortName = (full: string) => full.trim().split(/\s+/).at(-1) ?? full

/* ── Cột Đơn hàng: mã đầu + chip "+N" mở popover — hàng KHÔNG bao giờ nở cao ── */
function OrderCodesCell({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  if (!codes.length) return <span className="text-muted-foreground">—</span>
  const rest = codes.length - 1
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-xs">{codes[0]}</span>
      {rest > 0 && (
        <Popover onOpenChange={() => setCopied(false)}>
          <PopoverTrigger asChild>
            <button
              className="bg-secondary text-secondary-foreground hover:bg-accent shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
              aria-label={`Xem đủ ${codes.length} mã đơn`}
            >
              +{rest}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="theme-v3 w-64 p-0">
            <div className="border-b px-3 py-2 text-xs font-medium">
              {codes.length} đơn trong lệnh
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {codes.map((c) => (
                <li key={c} className="px-3 py-1 font-mono text-xs">
                  {c}
                </li>
              ))}
            </ul>
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(codes.join('\n'))
                  setCopied(true)
                }}
              >
                {copied ? <Check className="text-emerald-600" /> : <Copy />}
                {copied ? 'Đã sao chép' : `Sao chép ${codes.length} mã`}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

/** Số ngày giữa 2 mốc ISO yyyy-mm-dd (b − a). Cùng cách tính với PosManager. */
const daysBetween = (aIso: string, bIso: string) =>
  Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 86_400_000)

/** Hạn xuất: ngày giữ màu thường, dòng phụ mới là cảnh báo. */
function ShipCell({ r, today }: { r: LsxRow; today: string }) {
  if (!r.ship_date) return <span className="text-muted-foreground">—</span>
  const closed =
    r.status === 'completed' || r.status === 'cancelled' || r.status === 'rejected'
  const days = daysBetween(today, r.ship_date.slice(0, 10))
  return (
    <div>
      <div className="text-sm tabular-nums">{fmtD(r.ship_date)}</div>
      {!closed && days < 0 && (
        <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
          ⚠ quá {-days} ngày
        </div>
      )}
      {!closed && days >= 0 && days <= 7 && (
        <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
          còn {days} ngày
        </div>
      )}
    </div>
  )
}

/** Hạn sớm nhất trong nhóm đơn của một khách. */
const earliestDue = (orders: AwaitingOrder[]) => {
  const dates = orders.map((o) => o.due_date).filter((d): d is string => !!d)
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null
}

type SortKey = 'stage' | 'qty' | 'issued' | 'ship'
const SORT_VAL: Record<SortKey, (r: LsxRow) => number | string> = {
  stage: (r) => STAGE_OF[r.status] ?? -1,
  qty: (r) => r.qty,
  issued: (r) => r.issued_at ?? '',
  ship: (r) => r.ship_date ?? '',
}

export function LsxWorkbench({
  awaiting,
  rows,
  canIssue,
}: {
  awaiting: AwaitingOrder[]
  rows: LsxRow[]
  canIssue: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [issuing, setIssuing] = useState(false)
  // Khách được chọn sẵn khi bấm "Phát lệnh" từ dải chờ phát (null = tự chọn).
  const [issueFor, setIssueFor] = useState<string | null>(null)
  const [showAllPending, setShowAllPending] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)
  // Hạn xuất chỉ cần độ chính xác NGÀY — so bằng chuỗi ISO như PosManager.
  const today = new Date().toISOString().slice(0, 10)

  // Mã lệnh đã phát của từng khách — để hộp thoại gợi ý số lệnh kế tiếp.
  const codesByCustomer = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const r of rows) (m[r.customer_id] ??= []).push(r.code)
    return m
  }, [rows])

  // Đơn chờ phát, gom theo khách — nguồn của dải "Chờ phát lệnh".
  const pendingByCustomer = useMemo(() => {
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

  const count = (...sts: string[]) => rows.filter((r) => sts.includes(r.status)).length

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (status === 'running') {
        if (r.status !== 'approved' && r.status !== 'in_progress') return false
      } else if (status !== 'all' && r.status !== status) {
        return false
      }
      if (!ql) return true
      return `${r.code} ${r.customer_name} ${r.order_codes.join(' ')}`
        .toLowerCase()
        .includes(ql)
    })
    if (!sort) return filtered
    const val = SORT_VAL[sort.key]
    return [...filtered].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      return va < vb ? -sort.dir : va > vb ? sort.dir : 0
    })
  }, [rows, q, status, sort])

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 },
    )
  }

  function openIssue(customerId: string | null) {
    setIssueFor(customerId)
    setIssuing(true)
  }

  async function issue(orderIds: string[], form: IssueForm) {
    if (!form.code.trim() || !orderIds.length) return
    setBusy(true)
    try {
      const { lsx } = await api<{ lsx: { id: string; code: string } }>(
        '/api/dept/production/lsx',
        {
          method: 'POST',
          body: {
            code: form.code.trim(),
            order_ids: orderIds,
            ship_date: form.ship_date || null,
            container_summary: form.container.trim() || null,
          },
        },
      )
      toast.success(
        `Đã tạo lệnh nháp ${lsx.code}`,
        `${orderIds.length} đơn · soạn dòng xong hãy gửi Giám đốc duyệt`,
      )
      setIssuing(false)
      // Đi thẳng sang soạn dòng: dòng vừa nạp tự động gần như luôn phải sửa,
      // và đó cũng là nơi bấm "Gửi GĐ duyệt" khi soạn xong (0117).
      router.push(`/sales/lsx/${lsx.id}/dong`)
    } catch (e) {
      toast.error('Tạo lệnh thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      setBusy(false)
    }
  }

  const pendingShown = showAllPending ? pendingByCustomer : pendingByCustomer.slice(0, 3)

  // Tab trạng thái: hai tab "sự cố" chỉ hiện khi thật sự có — có là tự nó cảnh báo.
  const tabs = [
    { value: 'all', label: 'Tất cả', count: rows.length },
    ...(count('draft') ? [{ value: 'draft', label: 'Nháp', count: count('draft') }] : []),
    { value: 'pending_approval', label: 'Chờ duyệt', count: count('pending_approval') },
    { value: 'running', label: 'Đang chạy', count: count('approved', 'in_progress') },
    { value: 'completed', label: 'Hoàn thành', count: count('completed') },
    ...(count('rejected')
      ? [{ value: 'rejected', label: 'Bị từ chối', count: count('rejected') }]
      : []),
    ...(count('cancelled')
      ? [{ value: 'cancelled', label: 'Đã huỷ', count: count('cancelled') }]
      : []),
  ]

  const sortIcon = (key: SortKey) => (
    <ArrowUpDown
      className={`size-3 ${sort?.key === key ? 'text-foreground' : 'text-muted-foreground/50'}`}
    />
  )

  return (
    <div className="theme-v3 text-foreground flex flex-col gap-5">
      <TopProgressBar active={busy} />

      {/* ── Đầu trang ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lệnh sản xuất</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gom đơn đã xác nhận của một khách thành một lệnh, theo dõi lệnh qua duyệt —
            sản xuất — hoàn thành.
          </p>
        </div>
        {canIssue && (
          <Button
            onClick={() => openIssue(null)}
            disabled={awaiting.length === 0}
            title={
              awaiting.length === 0
                ? 'Không còn đơn nào chờ phát lệnh'
                : `${awaiting.length} đơn đang chờ phát lệnh`
            }
          >
            <Plus />
            Tạo lệnh sản xuất
          </Button>
        )}
      </div>

      {/* ── Dải "Chờ phát lệnh" — việc cần làm, mỗi khách một dòng ──────────── */}
      {canIssue && pendingByCustomer.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/15">
          <div className="px-4 pt-2.5 pb-1 text-[11px] font-medium tracking-wider text-amber-800/80 uppercase dark:text-amber-300/80">
            Chờ phát lệnh · {awaiting.length} đơn / {pendingByCustomer.length} khách
          </div>
          <div className="divide-y divide-amber-200/50 dark:divide-amber-900/30">
            {pendingShown.map((c) => {
              const qty = c.orders.reduce((s, o) => s + o.qty, 0)
              const due = earliestDue(c.orders)
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-none basis-44 truncate text-sm font-medium">
                    {c.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {c.orders[0].code}
                    {c.orders.length > 1 && ` +${c.orders.length - 1}`}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {c.orders.length} đơn · {fmtN(qty)} SP
                    {due && <> · hạn {fmtD(due)}</>}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto bg-transparent"
                    onClick={() => openIssue(c.id)}
                  >
                    Tạo lệnh
                  </Button>
                </div>
              )
            })}
          </div>
          {pendingByCustomer.length > 3 && (
            <button
              onClick={() => setShowAllPending((v) => !v)}
              className="flex w-full items-center gap-1 border-t border-amber-200/50 px-4 py-1.5 text-xs text-amber-800/80 hover:bg-amber-100/50 dark:border-amber-900/30 dark:text-amber-300/80 dark:hover:bg-amber-950/30"
            >
              <ChevronDown
                className={`size-3.5 transition-transform ${showAllPending ? 'rotate-180' : ''}`}
              />
              {showAllPending
                ? 'Thu gọn'
                : `Xem thêm ${pendingByCustomer.length - 3} khách`}
            </button>
          )}
        </section>
      )}

      {canIssue && (
        <IssueLsxDialog
          open={issuing}
          onClose={() => {
            setIssuing(false)
            setIssueFor(null)
          }}
          awaiting={awaiting}
          codesByCustomer={codesByCustomer}
          initialCustomerId={issueFor}
          busy={busy}
          onIssue={issue}
        />
      )}

      {/* ── Lọc + bảng lệnh ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/*
            Tab XUỐNG DÒNG, không cuộn ngang. `overflow-x-auto` (cách cũ) kéo
            theo `overflow-y: auto` — Windows chừa sẵn 16px gutter nên mọc một
            thanh cuộn dọc thừa ngay cạnh tab cuối, dù chẳng có gì để cuộn.
            `h-auto!` phải có `!` mới thắng được `...horizontal:h-9` của TabsList.
          */}
          <Tabs value={status} onValueChange={setStatus} className="max-w-full">
            <TabsList className="h-auto! flex-wrap">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {t.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm số lệnh, khách, mã đơn…"
              className="bg-card h-9 w-64 pl-8"
            />
          </div>
        </div>

        <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
          <Table className="table-fixed">
            <colgroup>
              <col style={{ width: '250px' }} />
              <col style={{ width: '210px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '110px' }} />
              <col />
              <col style={{ width: '48px' }} />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {(
                  [
                    ['Số lệnh / Khách', null],
                    ['Đơn hàng', null],
                    ['Tiến trình', 'stage'],
                    ['SL', 'qty'],
                    ['Phát', 'issued'],
                    ['Hạn xuất', 'ship'],
                    ['', null],
                    ['', null],
                  ] as [string, SortKey | null][]
                ).map(([label, key], i) => (
                  <TableHead
                    key={i}
                    className={`text-foreground px-3 text-[11px] font-semibold tracking-wider uppercase ${
                      key === 'qty' ? 'text-right' : ''
                    }`}
                  >
                    {key ? (
                      <button
                        onClick={() => toggleSort(key)}
                        className={`hover:text-foreground inline-flex items-center gap-1 ${
                          key === 'qty' ? 'w-full justify-end' : ''
                        }`}
                      >
                        {label}
                        {sortIcon(key)}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14 text-center whitespace-normal">
                    <div className="text-sm font-medium">
                      {rows.length === 0
                        ? 'Chưa có lệnh sản xuất nào'
                        : 'Không có lệnh nào khớp bộ lọc'}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {rows.length === 0
                        ? canIssue
                          ? 'Bấm "Tạo lệnh sản xuất" ở góc trên để làm lệnh đầu tiên.'
                          : 'Sales sẽ tạo lệnh từ các đơn đã xác nhận.'
                        : 'Đổi tab trạng thái hoặc xoá từ khoá tìm kiếm.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link
                          href={`/sales/lsx/${r.id}`}
                          className="truncate font-mono text-[13px] font-medium hover:underline"
                        >
                          {r.code}
                        </Link>
                        {r.revision > 1 && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-amber-300 bg-amber-50 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                          >
                            sửa lần {r.revision}
                          </Badge>
                        )}
                      </div>
                      {/* Người lập đi kèm tên khách trên dòng phụ sẵn có —
                          không đẻ thêm cột, bảng đã chật (0119). */}
                      <div
                        className="text-muted-foreground mt-0.5 truncate text-xs"
                        title={
                          r.created_by_name
                            ? `${r.customer_name} · lập bởi ${r.created_by_name}`
                            : r.customer_name
                        }
                      >
                        {r.customer_name}
                        {r.created_by_name && ` · ${shortName(r.created_by_name)}`}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <OrderCodesCell codes={r.order_codes} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <StageBar status={r.status} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right">
                      {r.lines ? (
                        <>
                          <div className="text-sm font-semibold tabular-nums">
                            {fmtN(r.qty)}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {r.lines} dòng
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-sm tabular-nums">
                      {fmtD(r.issued_at)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <ShipCell r={r} today={today} />
                    </TableCell>
                    <TableCell />
                    <TableCell className="px-2 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground size-7"
                            aria-label="Thao tác"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="theme-v3">
                          <DropdownMenuItem
                            onClick={() => router.push(`/sales/lsx/${r.id}`)}
                          >
                            <FileText />
                            Mở hồ sơ lệnh
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              !canIssue ||
                              r.status === 'completed' ||
                              r.status === 'cancelled'
                            }
                            onClick={() => router.push(`/sales/lsx/${r.id}/dong`)}
                          >
                            <PenLine />
                            Soạn dòng lệnh
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/print/lsx/${r.id}`, '_blank')}
                          >
                            <Printer />
                            In phiếu lệnh
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/api/dept/production/lsx/${r.id}/export`
                            }}
                          >
                            <FileSpreadsheet />
                            Xuất Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="bg-muted/30 text-muted-foreground border-t px-3 py-1.5 text-xs">
            {shown.length}/{rows.length} lệnh
          </div>
        </div>
      </div>
    </div>
  )
}
