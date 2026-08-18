'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  FileText,
  MoreHorizontal,
  PenLine,
  Plus,
  Printer,
  Search,
  Factory,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { OrderStageBar } from '@/components/sales/OrderStageBar'
import type { OrderStatus } from '@/lib/order-progress'

/**
 * SỔ ĐƠN HÀNG của Sales — dựng lại theo style v2 (shadcn + `.theme-v2`), cùng
 * ngôn ngữ với trang Lệnh sản xuất.
 *
 * Bản ERP kit cũ rối vì bảng nói rất ít mà chiếm rất nhiều: cột "Số đơn / Khách
 * hàng" ăn quá nửa bề ngang trong khi nội dung chỉ hai chữ ngắn; mã đơn và PO
 * khách in cạnh nhau dù phần lớn ca trùng nhau (`PT-138-167-HG · PO:
 * PT-138-167-HG`); tên khách lặp nguyên văn hàng chục dòng liền; hai cột "Từ
 * BG" và "Ngày tạo" gần như toàn dấu gạch hoặc cùng một ngày; 5 ô thống kê nằm
 * tách khỏi bộ lọc nên bấm vào không lọc được gì.
 *
 * Năm quyết định trị đúng năm bệnh đó:
 *   · GOM THEO KHÁCH — mỗi khách một dải tiêu đề kèm số đơn + Σ giá trị, dòng
 *     con thôi lặp tên; tên khách xuất hiện 1 lần thay vì 30 lần.
 *   · CỘT NÓI ĐƯỢC VIỆC — bỏ "Từ BG" (rỗng 100%) và "Ngày tạo" (giống nhau
 *     hết), thay bằng SL/dòng, Giá trị và Lệnh SX (28/30 đơn có). Mã báo giá
 *     hiếm khi có nên xuống làm chip cạnh mã đơn.
 *   · PO KHÁCH CHỈ HIỆN KHI KHÁC mã đơn — trùng thì ghi "như số đơn" cỡ 11px,
 *     hết cảnh đọc hai lần cùng một chuỗi.
 *   · TIẾN TRÌNH LÀ THANH 6 ĐOẠN (OrderStageBar) thay badge một màu.
 *   · SỐ THỐNG KÊ NẰM TRÊN TAB LỌC — bấm là lọc, đúng chức năng thật của nó.
 *
 * Mỗi dòng cao đúng 2 tầng chữ; mọi ô dài đều truncate nên bảng không bao giờ
 * nở. Bảng rộng ~950px: dưới lg thì cuộn ngang trong khung (shadcn `Table` tự
 * bọc `overflow-x-auto`), giống trang Lệnh sản xuất.
 */

export type OrderRow = {
  id: string
  code: string
  quote_code: string | null
  customer_id: string
  customer_name: string
  customer_po_no: string | null
  status: OrderStatus
  currency: string
  due_date: string | null
  created_at: string
  /** Σ dòng SP / số lượng / giá trị của đơn (ordersRepo.lineSummaryByOrderIds). */
  lines: number
  qty: number
  total: number
  /** Lệnh sản xuất đang chạy đơn này — null = chưa phát lệnh. */
  lsx_id: string | null
  lsx_code: string | null
  /** Người tạo đơn — null với đơn nhập bằng script trước khi có tính năng. */
  created_by_name: string | null
  /** Người đang xem có sửa được ĐƠN NÀY không (chủ đơn / quản lý). */
  can_edit: boolean
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
 * Tên gọi (chữ cuối) để nhét vừa ô hẹp: "Nguyễn T.Minh Hằng" → "Hằng". In đủ
 * họ tên trong ô hẹp 190px thì bị cắt thành "Nguyễn T.Min…" — vừa mất chữ vừa
 * không phân biệt được ai. Tên đầy đủ vẫn còn ở tooltip.
 */
const shortName = (full: string) => full.trim().split(/\s+/).at(-1) ?? full

/** Chênh lệch ngày (b − a) trên chuỗi yyyy-mm-dd — cùng cách tính với LsxWorkbench. */
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Đơn đã đóng thì hạn giao không còn là việc phải lo. */
const isClosed = (o: OrderRow) => o.status === 'delivered' || o.status === 'cancelled'
const isLate = (o: OrderRow, today: string) =>
  !!o.due_date && o.due_date < today && !isClosed(o)

/**
 * PO khách có đáng một ô riêng không? Dữ liệu thật phần lớn là PO trùng hoặc
 * nằm gọn trong mã đơn (`18005 HG-MX` ⊃ `18005`) — in lại chỉ tổ nhiễu.
 */
const poIsDistinct = (o: OrderRow) =>
  !!o.customer_po_no && !o.code.toLowerCase().includes(o.customer_po_no.toLowerCase())

/** Σ giá trị theo từng loại tiền → "1.250.000 USD · 300.000.000 VND". */
function sumByCurrency(orders: OrderRow[]): string {
  const by = new Map<string, number>()
  for (const o of orders)
    if (o.total > 0) by.set(o.currency, (by.get(o.currency) ?? 0) + o.total)
  if (by.size === 0) return '—'
  return [...by.entries()].map(([cur, v]) => `${fmtN(v)} ${cur}`).join(' · ')
}

/* ── Hạn giao: ngày giữ màu thường, dòng phụ mới là cảnh báo ────────────────── */
function DueCell({ o, today }: { o: OrderRow; today: string }) {
  if (!o.due_date) return <span className="text-muted-foreground">—</span>
  const days = daysBetween(today, o.due_date.slice(0, 10))
  return (
    <div>
      <div className="text-sm tabular-nums">{fmtD(o.due_date)}</div>
      {!isClosed(o) && days < 0 && (
        <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
          ⚠ quá {-days} ngày
        </div>
      )}
      {!isClosed(o) && days >= 0 && days <= 7 && (
        <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
          còn {days} ngày
        </div>
      )}
    </div>
  )
}

type SortKey = 'due' | 'new' | 'name'
const SORT_LABEL: Record<SortKey, string> = {
  due: 'Hạn giao gần nhất',
  new: 'Mới tạo trước',
  name: 'Khách hàng A → Z',
}

type Group = {
  id: string
  name: string
  orders: OrderRow[]
  /** Hạn sớm nhất trong nhóm (đơn còn mở) — dùng để xếp nhóm khi sort theo hạn. */
  earliestDue: string | null
  newest: string
}

export function OrdersManager({
  orders,
  customers,
  canEdit,
}: {
  orders: OrderRow[]
  customers: { id: string; name: string }[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [customer, setCustomer] = useState('all')
  const [tab, setTab] = useState('all')
  const [sort, setSort] = useState<SortKey>('due')
  const [showAllAttention, setShowAllAttention] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  /*
   * Tab = bộ lọc theo NHÓM trạng thái, không phải từng status một: Sales nghĩ
   * theo "đơn này đang nằm ở khâu nào của mình". "Trễ hạn" là bộ lọc suy ra
   * (hạn < hôm nay), không phải một status — để chung vì đó chính là thứ hay
   * phải tìm nhất.
   */
  const match = useMemo(
    () => ({
      all: () => true,
      todo: (o: OrderRow) => o.status === 'confirmed' || o.status === 'lsx_pending',
      running: (o: OrderRow) => o.status === 'lsx_issued' || o.status === 'in_production',
      done: (o: OrderRow) => o.status === 'completed' || o.status === 'delivered',
      late: (o: OrderRow) => isLate(o, today),
      cancelled: (o: OrderRow) => o.status === 'cancelled',
    }),
    [today],
  )

  const count = (key: keyof typeof match) => orders.filter(match[key]).length

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return orders.filter((o) => {
      if (customer !== 'all' && o.customer_id !== customer) return false
      if (!match[tab as keyof typeof match](o)) return false
      if (!ql) return true
      return `${o.code} ${o.customer_name} ${o.customer_po_no ?? ''} ${o.lsx_code ?? ''}`
        .toLowerCase()
        .includes(ql)
    })
  }, [orders, q, customer, tab, match])

  /*
   * Gom theo khách: cùng một thứ tự áp cho CẢ nhóm lẫn đơn trong nhóm, để đổi
   * kiểu sắp xếp không tạo ra hai logic đọc ngược nhau.
   */
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>()
    for (const o of filtered) {
      const g = m.get(o.customer_id) ?? {
        id: o.customer_id,
        name: o.customer_name,
        orders: [],
        earliestDue: null,
        newest: o.created_at,
      }
      g.orders.push(o)
      if (o.due_date && !isClosed(o)) {
        g.earliestDue =
          g.earliestDue && g.earliestDue < o.due_date ? g.earliestDue : o.due_date
      }
      if (o.created_at > g.newest) g.newest = o.created_at
      m.set(o.customer_id, g)
    }
    const list = [...m.values()]
    // Không có hạn thì xuống cuối — '9999' đứng sau mọi ngày ISO thật.
    const dueKey = (d: string | null) => d ?? '9999-12-31'
    for (const g of list) {
      g.orders.sort((a, b) => {
        if (sort === 'new') return a.created_at < b.created_at ? 1 : -1
        if (sort === 'name') return a.code.localeCompare(b.code, 'vi')
        const ka = dueKey(a.due_date)
        const kb = dueKey(b.due_date)
        return ka === kb ? a.code.localeCompare(b.code, 'vi') : ka < kb ? -1 : 1
      })
    }
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'vi')
      if (sort === 'new') return a.newest < b.newest ? 1 : -1
      const ka = dueKey(a.earliestDue)
      const kb = dueKey(b.earliestDue)
      return ka === kb ? a.name.localeCompare(b.name, 'vi') : ka < kb ? -1 : 1
    })
    return list
  }, [filtered, sort])

  /* Việc cần để mắt: đơn đã quá hạn hoặc tới hạn trong 7 ngày, gấp nhất lên đầu. */
  const attention = useMemo(
    () =>
      orders
        .filter((o) => !isClosed(o) && o.due_date)
        .map((o) => ({ o, days: daysBetween(today, o.due_date!.slice(0, 10)) }))
        .filter((r) => r.days <= 7)
        .sort((a, b) => a.days - b.days),
    [orders, today],
  )
  const attentionShown = showAllAttention ? attention : attention.slice(0, 3)
  const hasOverdue = attention.some((r) => r.days < 0)

  const customerLabel =
    customer === 'all'
      ? 'Mọi khách hàng'
      : (customers.find((c) => c.id === customer)?.name ?? 'Mọi khách hàng')

  const tabs = [
    { value: 'all', label: 'Tất cả', count: orders.length },
    { value: 'todo', label: 'Chờ lệnh SX', count: count('todo') },
    { value: 'running', label: 'Đang sản xuất', count: count('running') },
    { value: 'done', label: 'Hoàn thành', count: count('done') },
    // Hai tab "sự cố" chỉ hiện khi thật sự có — có mặt là tự nó cảnh báo.
    ...(count('late') ? [{ value: 'late', label: 'Trễ hạn', count: count('late') }] : []),
    ...(count('cancelled')
      ? [{ value: 'cancelled', label: 'Đã huỷ', count: count('cancelled') }]
      : []),
  ]

  return (
    <div className="theme-v3 text-foreground flex flex-col gap-5">
      {/* ── Đầu trang ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Đơn hàng bán</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sổ đơn đã chốt với khách, gom theo khách hàng. Mở một đơn để sửa, đính hồ sơ
            và theo dõi lệnh sản xuất.
          </p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/sales/orders/new">
              <Plus />
              Tạo đơn hàng
            </Link>
          </Button>
        )}
      </div>

      {/* ── Dải "Cần để mắt" — chỉ hiện khi thật sự có đơn sát/quá hạn ─────── */}
      {attention.length > 0 && (
        <section
          className={
            hasOverdue
              ? 'overflow-hidden rounded-xl border border-red-200/70 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/15'
              : 'overflow-hidden rounded-xl border border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/15'
          }
        >
          <div
            className={`px-4 pt-2.5 pb-1 text-[11px] font-medium tracking-wider uppercase ${
              hasOverdue
                ? 'text-red-800/80 dark:text-red-300/80'
                : 'text-amber-800/80 dark:text-amber-300/80'
            }`}
          >
            Cần để mắt · {attention.filter((r) => r.days < 0).length} đơn quá hạn ·{' '}
            {attention.filter((r) => r.days >= 0).length} đơn tới hạn trong 7 ngày
          </div>
          <div
            className={
              hasOverdue
                ? 'divide-y divide-red-200/50 dark:divide-red-900/30'
                : 'divide-y divide-amber-200/50 dark:divide-amber-900/30'
            }
          >
            {/*
              Cả dòng là một link — dải này chỉ để NHẢY tới đơn, khác dải "chờ
              phát lệnh" bên LSX (nút ở đó mở hộp thoại, là hành động thật). Thêm
              nút "Mở đơn" ở đây chỉ lặp lại chính cái link đang bọc nó.
            */}
            {attentionShown.map(({ o, days }) => (
              <Link
                key={o.id}
                href={`/sales/orders/${o.id}`}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 ${
                  hasOverdue
                    ? 'hover:bg-red-100/50 dark:hover:bg-red-950/30'
                    : 'hover:bg-amber-100/50 dark:hover:bg-amber-950/30'
                }`}
              >
                <span className="min-w-0 flex-none basis-44 truncate font-mono text-xs font-medium">
                  {o.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{o.customer_name}</span>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    days < 0
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {days < 0
                    ? `quá ${-days} ngày`
                    : days === 0
                      ? 'đến hạn hôm nay'
                      : `còn ${days} ngày`}
                  {' · hạn '}
                  {fmtD(o.due_date)}
                </span>
              </Link>
            ))}
          </div>
          {attention.length > 3 && (
            <button
              onClick={() => setShowAllAttention((v) => !v)}
              className={`flex w-full items-center gap-1 border-t px-4 py-1.5 text-xs ${
                hasOverdue
                  ? 'border-red-200/50 text-red-800/80 hover:bg-red-100/50 dark:border-red-900/30 dark:text-red-300/80 dark:hover:bg-red-950/30'
                  : 'border-amber-200/50 text-amber-800/80 hover:bg-amber-100/50 dark:border-amber-900/30 dark:text-amber-300/80 dark:hover:bg-amber-950/30'
              }`}
            >
              <ChevronDown
                className={`size-3.5 transition-transform ${showAllAttention ? 'rotate-180' : ''}`}
              />
              {showAllAttention ? 'Thu gọn' : `Xem thêm ${attention.length - 3} đơn`}
            </button>
          )}
        </section>
      )}

      {/* ── Lọc + bảng đơn ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/*
            Tab XUỐNG DÒNG, không cuộn ngang. `overflow-x-auto` (cách cũ) kéo
            theo `overflow-y: auto` — Windows chừa sẵn 16px gutter nên mọc một
            thanh cuộn dọc thừa ngay cạnh tab cuối, dù chẳng có gì để cuộn.
            `h-auto!` phải có `!` mới thắng được `...horizontal:h-9` của TabsList.
          */}
          <Tabs value={tab} onValueChange={setTab} className="max-w-full">
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
          <div className="flex flex-wrap items-center gap-2">
            {/*
              Nhãn truyền TƯỜNG MINH vào SelectValue. Để trống thì Radix phải tra
              nhãn từ danh sách item — mà item nằm trong portal, chỉ mount khi mở
              — nên lần vẽ đầu (SSR + trước hydrate) hai ô lọc hiện RỖNG.
            */}
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger size="sm" className="bg-card w-44">
                <SelectValue>{customerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="theme-v3">
                <SelectItem value="all">Mọi khách hàng</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger size="sm" className="bg-card w-44">
                <SelectValue>{SORT_LABEL[sort]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="theme-v3">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm số đơn, PO khách, lệnh SX…"
                className="bg-card h-9 w-60 pl-8"
              />
            </div>
          </div>
        </div>

        <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
          <Table className="min-w-[950px] table-fixed">
            <colgroup>
              <col style={{ width: '190px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '165px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '115px' }} />
              <col />
              <col style={{ width: '48px' }} />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {[
                  'Số đơn',
                  'PO khách',
                  'Tiến trình',
                  'SL',
                  'Giá trị',
                  'Hạn giao',
                  'Lệnh sản xuất',
                  '',
                ].map((label, i) => (
                  <TableHead
                    key={i}
                    className={`text-foreground px-3 text-[11px] font-semibold tracking-wider uppercase ${
                      label === 'SL' || label === 'Giá trị' ? 'text-right' : ''
                    }`}
                  >
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14 text-center whitespace-normal">
                    <div className="text-sm font-medium">
                      {orders.length === 0
                        ? 'Chưa có đơn hàng nào'
                        : 'Không có đơn nào khớp bộ lọc'}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {orders.length === 0
                        ? canEdit
                          ? 'Bấm "Tạo đơn hàng" ở góc trên — từ báo giá đã chốt hoặc nhập trực tiếp.'
                          : 'Sales sẽ tạo đơn từ báo giá đã chốt hoặc nhập trực tiếp.'
                        : 'Đổi tab trạng thái, bỏ lọc khách hàng hoặc xoá từ khoá tìm kiếm.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((g) => (
                  <Fragment key={g.id}>
                    {/* Dải khách hàng: tên xuất hiện MỘT lần cho cả cụm + số cộng dồn. */}
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={8} className="px-3 py-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <Link
                            href={`/sales/customers/${g.id}`}
                            className="text-sm font-semibold hover:underline"
                          >
                            {g.name}
                          </Link>
                          <span className="text-muted-foreground text-xs">
                            {g.orders.length} đơn ·{' '}
                            {fmtN(g.orders.reduce((s, o) => s + o.qty, 0))} SP
                          </span>
                          <span className="ml-auto text-xs font-medium tabular-nums">
                            {sumByCurrency(g.orders)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {g.orders.map((o) => (
                      <TableRow
                        key={o.id}
                        className={o.status === 'cancelled' ? 'opacity-60' : ''}
                      >
                        <TableCell className="px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Link
                              href={`/sales/orders/${o.id}`}
                              className="truncate font-mono text-[13px] font-medium hover:underline"
                            >
                              {o.code}
                            </Link>
                            {o.quote_code && (
                              <Badge
                                variant="secondary"
                                className="text-muted-foreground shrink-0 text-[10px]"
                                title={`Tạo từ báo giá ${o.quote_code}`}
                              >
                                BG
                              </Badge>
                            )}
                          </div>
                          {/* Người tạo đi kèm ngày tạo trên DÒNG PHỤ sẵn có —
                              không đẻ thêm cột, bảng đã đủ rộng. */}
                          <div
                            className="text-muted-foreground mt-0.5 truncate text-[11px]"
                            title={
                              o.created_by_name
                                ? `Tạo ${fmtD(o.created_at)} bởi ${o.created_by_name}`
                                : undefined
                            }
                          >
                            <span className="tabular-nums">tạo {fmtD(o.created_at)}</span>
                            {o.created_by_name && ` · ${shortName(o.created_by_name)}`}
                          </div>
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          {poIsDistinct(o) ? (
                            <span className="block truncate font-mono text-xs">
                              {o.customer_po_no}
                            </span>
                          ) : o.customer_po_no ? (
                            <span className="text-muted-foreground text-[11px]">
                              như số đơn
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          <OrderStageBar status={o.status} />
                        </TableCell>

                        <TableCell className="px-3 py-2.5 text-right">
                          {o.lines ? (
                            <>
                              <div className="text-sm font-semibold tabular-nums">
                                {fmtN(o.qty)}
                              </div>
                              <div className="text-muted-foreground text-[11px]">
                                {o.lines} dòng
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-2.5 text-right">
                          {o.total > 0 ? (
                            <>
                              <div className="text-sm tabular-nums">{fmtN(o.total)}</div>
                              <div className="text-muted-foreground text-[11px]">
                                {o.currency}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          <DueCell o={o} today={today} />
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          {o.lsx_id && o.lsx_code ? (
                            <Link
                              href={`/sales/lsx/${o.lsx_id}`}
                              className="block truncate font-mono text-xs hover:underline"
                            >
                              {o.lsx_code}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Chưa phát lệnh
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="px-2 py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground size-7"
                                aria-label={`Thao tác với đơn ${o.code}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="theme-v3">
                              <DropdownMenuItem
                                onClick={() => router.push(`/sales/orders/${o.id}`)}
                              >
                                <FileText />
                                Mở hồ sơ đơn
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!o.can_edit || isClosed(o)}
                                onClick={() => router.push(`/sales/orders/${o.id}/edit`)}
                              >
                                <PenLine />
                                Sửa đơn
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!o.lsx_id}
                                onClick={() => router.push(`/sales/lsx/${o.lsx_id}`)}
                              >
                                <Factory />
                                Mở lệnh sản xuất
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(`/print/orders/${o.id}`, '_blank')
                                }
                              >
                                <Printer />
                                In hợp đồng
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!o.lsx_id}
                                onClick={() =>
                                  window.open(`/print/lsx/${o.lsx_id}`, '_blank')
                                }
                              >
                                <Printer />
                                In phiếu lệnh
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
          <div className="bg-muted/30 text-muted-foreground border-t px-3 py-1.5 text-xs">
            {filtered.length}/{orders.length} đơn · {groups.length} khách hàng
          </div>
        </div>
      </div>
    </div>
  )
}
