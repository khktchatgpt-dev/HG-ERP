'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  MoreHorizontal,
  PenLine,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
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
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'

/**
 * SỔ BÁO GIÁ của Sales — dựng theo style v2 (shadcn + `.theme-v2`), cùng ngôn
 * ngữ với sổ Đơn hàng để hai màn cạnh nhau đọc như MỘT hệ thống (trước đây báo
 * giá còn ở ERP kit zinc/sky đời đầu, cạnh sổ đơn stone/emerald nhìn như hai app).
 *
 * Các quyết định kế thừa từ sổ đơn — vì dữ liệu thật giống nhau về cấu trúc:
 *   · GOM THEO KHÁCH — Drive của Sales xếp báo giá theo khách (Merxx/, Laura/…),
 *     sổ trên app giữ đúng trục đọc đó; tên khách in MỘT lần một cụm.
 *   · TAB = TRẠNG THÁI + "HẾT HIỆU LỰC" — hết hiệu lực không phải status trong
 *     DB mà là bộ lọc suy ra (valid_to < hôm nay, còn nháp thì không tính vì
 *     chưa gửi ai); chỉ hiện tab khi thật sự có, có mặt là tự nó cảnh báo.
 *   · CỘT NÓI ĐƯỢC VIỆC — số dòng SP, điều khoản (Incoterm), hiệu lực (kèm nhắc
 *     sắp hết hạn), trạng thái. Ngày tạo + người lập là dòng phụ dưới mã BG.
 *   · HÀNH ĐỘNG GOM VỀ MENU ⋯ — mở, sửa, in, chốt & gửi, xoá (nháp).
 */

type QuoteStatus = 'draft' | 'sent'

export type QuoteRow = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  status: QuoteStatus
  currency: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
  created_at: string
  line_count: number
  owner_name: string | null
}

const fmtD = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'

/** Tên gọi (chữ cuối) cho ô hẹp — tên đủ vẫn ở tooltip (cùng cách với sổ đơn). */
const shortName = (full: string) => full.trim().split(/\s+/).at(-1) ?? full

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Báo giá ĐÃ GỬI mà quá hạn hiệu lực — giá chào không còn giá trị pháp lý. */
const isExpired = (q: QuoteRow, today: string) =>
  q.status === 'sent' && !!q.valid_to && q.valid_to < today

type Group = { id: string; name: string; quotes: QuoteRow[]; newest: string }

export function QuotesManager({
  quotes,
  customers,
  canEdit,
}: {
  quotes: QuoteRow[]
  customers: { id: string; name: string }[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [customer, setCustomer] = useState('all')
  const [tab, setTab] = useState('all')
  const today = new Date().toISOString().slice(0, 10)

  const match = useMemo(
    () => ({
      all: () => true,
      draft: (r: QuoteRow) => r.status === 'draft',
      sent: (r: QuoteRow) => r.status === 'sent' && !isExpired(r, today),
      expired: (r: QuoteRow) => isExpired(r, today),
    }),
    [today],
  )
  const count = (key: keyof typeof match) => quotes.filter(match[key]).length

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return quotes.filter((r) => {
      if (customer !== 'all' && r.customer_id !== customer) return false
      if (!match[tab as keyof typeof match](r)) return false
      if (!ql) return true
      return `${r.code} ${r.customer_name}`.toLowerCase().includes(ql)
    })
  }, [quotes, q, customer, tab, match])

  /* Gom theo khách — nhóm mới nhất lên đầu, trong nhóm mới tạo trước. */
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>()
    for (const r of filtered) {
      const g = m.get(r.customer_id) ?? {
        id: r.customer_id,
        name: r.customer_name,
        quotes: [],
        newest: r.created_at,
      }
      g.quotes.push(r)
      if (r.created_at > g.newest) g.newest = r.created_at
      m.set(r.customer_id, g)
    }
    const list = [...m.values()]
    for (const g of list) g.quotes.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    list.sort((a, b) => (a.newest < b.newest ? 1 : -1))
    return list
  }, [filtered])

  const customerLabel =
    customer === 'all'
      ? 'Mọi khách hàng'
      : (customers.find((c) => c.id === customer)?.name ?? 'Mọi khách hàng')

  const tabs = [
    { value: 'all', label: 'Tất cả', count: quotes.length },
    { value: 'draft', label: 'Nháp', count: count('draft') },
    { value: 'sent', label: 'Đã gửi khách', count: count('sent') },
    ...(count('expired')
      ? [{ value: 'expired', label: 'Hết hiệu lực', count: count('expired') }]
      : []),
  ]

  async function run(url: string, method: 'POST' | 'DELETE') {
    setBusy(true)
    try {
      await api(url, { method })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function sendQuote(r: QuoteRow) {
    const ok = await confirm({
      title: `Chốt & gửi khách ${r.code}?`,
      description: 'Sau khi chốt sẽ không sửa được nữa và có thể tạo đơn hàng.',
      confirmLabel: 'Chốt & gửi khách',
    })
    if (!ok) return
    if (await run(`/api/dept/sales/quotes/${r.id}/send`, 'POST'))
      toast.success('Đã chốt báo giá', r.code)
  }

  async function deleteQuote(r: QuoteRow) {
    const ok = await confirm({
      title: `Xoá báo giá nháp ${r.code}?`,
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    if (await run(`/api/dept/sales/quotes/${r.id}`, 'DELETE'))
      toast.success('Đã xoá', r.code)
  }

  return (
    <div className="theme-v2 text-foreground flex flex-col gap-5">
      <TopProgressBar active={busy} />

      {/* ── Đầu trang ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Báo giá</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Hồ sơ riêng của Sales, không cần duyệt: nháp → chốt &amp; gửi khách → tạo đơn
            hàng. Gom theo khách hàng.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {/* Tờ báo giá có SP mới thường đã nằm sẵn trong file Excel kèm ảnh +
                thông số — nhập thẳng file nhanh hơn gõ lại từng SP. */}
            <Button asChild variant="outline">
              <Link href="/sales/quotes/import">⭳ Nhập từ Excel</Link>
            </Button>
            <Button asChild>
              <Link href="/sales/quotes/new">
                <Plus />
                Lập báo giá
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── Lọc + bảng ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger size="sm" className="bg-card w-44">
                <SelectValue>{customerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="theme-v2">
                <SelectItem value="all">Mọi khách hàng</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm số BG, khách hàng…"
                className="bg-card h-9 w-60 pl-8"
              />
            </div>
            {busy && <Spinner size={14} />}
          </div>
        </div>

        <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
          <Table className="min-w-[820px] table-fixed">
            <colgroup>
              <col style={{ width: '200px' }} />
              <col style={{ width: '80px' }} />
              <col />
              <col style={{ width: '150px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '48px' }} />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {['Số báo giá', 'SP', 'Điều khoản', 'Hiệu lực', 'Trạng thái', ''].map(
                  (label, i) => (
                    <TableHead
                      key={i}
                      className={`text-foreground px-3 text-[11px] font-semibold tracking-wider uppercase ${
                        label === 'SP' ? 'text-right' : ''
                      }`}
                    >
                      {label}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center whitespace-normal">
                    <div className="text-sm font-medium">
                      {quotes.length === 0
                        ? 'Chưa có báo giá nào'
                        : 'Không có báo giá nào khớp bộ lọc'}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {quotes.length === 0
                        ? canEdit
                          ? 'Bấm "Lập báo giá" ở góc trên — chọn khách và sản phẩm từ thư viện.'
                          : 'Sales sẽ lập báo giá từ thư viện sản phẩm.'
                        : 'Đổi tab trạng thái, bỏ lọc khách hàng hoặc xoá từ khoá tìm kiếm.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((g) => (
                  <Fragment key={g.id}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={6} className="px-3 py-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <Link
                            href={`/sales/customers/${g.id}`}
                            className="text-sm font-semibold hover:underline"
                          >
                            {g.name}
                          </Link>
                          <span className="text-muted-foreground text-xs">
                            {g.quotes.length} báo giá
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {g.quotes.map((r) => {
                      const expired = isExpired(r, today)
                      const daysLeft =
                        r.status === 'sent' && r.valid_to
                          ? daysBetween(today, r.valid_to.slice(0, 10))
                          : null
                      return (
                        <TableRow key={r.id} className={expired ? 'opacity-70' : ''}>
                          <TableCell className="px-3 py-2.5">
                            <Link
                              href={`/sales/quotes/${r.id}`}
                              className="block truncate font-mono text-[13px] font-medium hover:underline"
                            >
                              {r.code}
                            </Link>
                            <div
                              className="text-muted-foreground mt-0.5 truncate text-[11px]"
                              title={
                                r.owner_name
                                  ? `Lập ${fmtD(r.created_at)} bởi ${r.owner_name}`
                                  : undefined
                              }
                            >
                              <span className="tabular-nums">
                                lập {fmtD(r.created_at)}
                              </span>
                              {r.owner_name && ` · ${shortName(r.owner_name)}`}
                            </div>
                          </TableCell>

                          <TableCell className="px-3 py-2.5 text-right">
                            {r.line_count > 0 ? (
                              <span className="text-sm font-semibold tabular-nums">
                                {r.line_count}
                              </span>
                            ) : (
                              <span
                                className="text-amber-600 dark:text-amber-400"
                                title="Chưa có dòng sản phẩm — chưa chốt được"
                              >
                                0
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="px-3 py-2.5">
                            <div className="flex min-w-0 flex-wrap items-center gap-1">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {r.currency}
                              </Badge>
                              {r.price_term && (
                                <Badge
                                  variant="secondary"
                                  className="max-w-40 truncate text-[10px]"
                                  title={r.price_term}
                                >
                                  {r.price_term}
                                </Badge>
                              )}
                              {r.payment_terms && (
                                <span
                                  className="text-muted-foreground min-w-0 truncate text-[11px]"
                                  title={r.payment_terms}
                                >
                                  {r.payment_terms}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="px-3 py-2.5">
                            {r.valid_to ? (
                              <div>
                                <div className="text-sm tabular-nums">
                                  {fmtD(r.valid_to)}
                                </div>
                                {expired ? (
                                  <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
                                    hết hiệu lực
                                  </div>
                                ) : daysLeft != null && daysLeft <= 7 ? (
                                  <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                    còn {daysLeft} ngày
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="px-3 py-2.5">
                            {r.status === 'draft' ? (
                              <Badge variant="secondary">Nháp</Badge>
                            ) : expired ? (
                              <Badge
                                variant="outline"
                                className="border-red-300 text-red-700 dark:border-red-900 dark:text-red-400"
                              >
                                Hết hiệu lực
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white dark:bg-emerald-700">
                                Đã gửi khách
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="px-2 py-2.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground size-7"
                                  aria-label={`Thao tác với báo giá ${r.code}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="theme-v2">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/sales/quotes/${r.id}`)}
                                >
                                  <FileText />
                                  Mở báo giá
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    window.open(`/print/quotes/${r.id}`, '_blank')
                                  }
                                >
                                  <Printer />
                                  In báo giá
                                </DropdownMenuItem>
                                {canEdit && r.status === 'draft' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        router.push(`/sales/quotes/${r.id}/edit`)
                                      }
                                    >
                                      <PenLine />
                                      Sửa
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void sendQuote(r)}>
                                      <Send />
                                      Chốt &amp; gửi khách
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => void deleteQuote(r)}
                                    >
                                      <Trash2 />
                                      Xoá
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
          <div className="bg-muted/30 text-muted-foreground border-t px-3 py-1.5 text-xs">
            {filtered.length}/{quotes.length} báo giá · {groups.length} khách hàng
          </div>
        </div>
      </div>
    </div>
  )
}
