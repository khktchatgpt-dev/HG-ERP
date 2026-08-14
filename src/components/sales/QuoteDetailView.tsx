'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  MoreHorizontal,
  PenLine,
  Printer,
  Send,
  Stamp,
  Trash2,
} from 'lucide-react'
import { isSvgUrl } from '@/lib/image'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent } from '@/components/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { DocumentFiles } from '@/components/DocumentFiles'
import type { Packing } from '@/components/sales/ProductPicker'

/**
 * HỒ SƠ BÁO GIÁ — style v2 (shadcn + `.theme-v2`), cùng ngôn ngữ với hồ sơ Đơn
 * hàng: back link + tiêu đề + MỌI hành động trên đầu trang; dải tóm tắt 4 ô trả
 * lời "báo giá này đang sao" trong một lượt mắt; việc nguy hiểm (xoá) nằm trong
 * menu ⋯ thay vì nút đỏ lơ lửng cuối trang như bản cũ.
 */

// Vòng đời 0149: duyệt GĐ tuỳ chọn — draft có 2 đường ra (gửi thẳng / trình GĐ).
type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent'

type QuoteView = {
  id: string
  code: string
  status: QuoteStatus
  currency: string
  customer_name: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
  owner_name: string | null
  created_at: string
  /** Lý do GĐ từ chối lần gần nhất — chỉ có khi status = rejected. */
  rejected_reason?: string | null
}

type LineView = {
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  description_en: string | null
  unit_price: number
  discount_pct: number | null
  note: string | null
  packing: Packing
  image_url: string | null
}

const dimStr = (a?: number, b?: number, c?: number) =>
  a != null && b != null && c != null ? `${a}×${b}×${c}` : null
const cmToInch = (v?: number) => (v != null ? (v / 2.54).toFixed(1) : null)
const inchStr = (a?: number, b?: number, c?: number) => {
  const [x, y, z] = [cmToInch(a), cmToInch(b), cmToInch(c)]
  return x && y && z ? `${x}×${y}×${z}` : null
}
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '…')

/* ── Ô tóm tắt đầu trang (cùng khối với OrderDetailView) ───────────────────── */
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-2.5">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export function QuoteDetailView({
  quote,
  lines,
  canEdit,
}: {
  quote: QuoteView
  lines: LineView[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const isDraft = quote.status === 'draft'
  const isRejected = quote.status === 'rejected'
  const isPending = quote.status === 'pending_approval'
  const isApproved = quote.status === 'approved'
  /** Sửa/xoá theo luật service: nháp + bị từ chối sửa được, chỉ nháp xoá được. */
  const editable = isDraft || isRejected
  const today = new Date().toISOString().slice(0, 10)
  const expired = quote.status === 'sent' && !!quote.valid_to && quote.valid_to < today

  /* SP thiếu quy cách (KT/carton) — in báo giá sẽ trống ô, cảnh báo trước. */
  const missingSpec = lines.filter((l) => {
    const pk = l.packing ?? {}
    return !dimStr(pk.l_cm, pk.w_cm, pk.h_cm) && pk.qty_per_carton == null
  }).length

  async function send() {
    const ok = await confirm({
      title: `Chốt & gửi khách ${quote.code}?`,
      description: 'Sau khi chốt, báo giá bất biến và tạo được đơn hàng.',
      confirmLabel: 'Chốt & gửi',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/quotes/${quote.id}/send`, { method: 'POST' })
      toast.success('Đã chốt & gửi khách', quote.code)
      router.refresh()
    } catch (e) {
      toast.error('Không gửi được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  /** Trình GĐ duyệt (0149 — tuỳ chọn): Sale tự quyết báo giá nào cần chữ ký. */
  async function submitForApproval() {
    const ok = await confirm({
      title: `Trình Giám đốc duyệt ${quote.code}?`,
      description:
        'Báo giá sẽ khoá cho tới khi Giám đốc quyết. Được duyệt rồi mới chốt & gửi khách được.',
      confirmLabel: 'Trình duyệt',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/quotes/${quote.id}/submit`, { method: 'POST' })
      toast.success('Đã trình Giám đốc duyệt', quote.code)
      router.refresh()
    } catch (e) {
      toast.error('Không trình được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Xoá báo giá ${quote.code}?`,
      description: 'Không thể hoàn tác.',
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/quotes/${quote.id}`, { method: 'DELETE' })
      toast.success('Đã xoá báo giá')
      router.push('/sales/quotes')
    } catch (e) {
      toast.error('Không xoá được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <div className="theme-v2 text-foreground flex flex-col gap-5 pb-4">
      <TopProgressBar active={busy} />

      {/* ── Đầu trang: nhận diện + mọi hành động ──────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Link
          href="/sales/quotes"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Báo giá
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight">
                {quote.code}
              </h1>
              <Badge variant="outline" className="font-mono text-[11px]">
                {quote.currency}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {quote.customer_name}
              <span className="text-muted-foreground/70">
                {' · lập '}
                {fmtD(quote.created_at)}
                {quote.owner_name && ` bởi ${quote.owner_name}`}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (isDraft || isApproved) && (
              <Button onClick={() => void send()} disabled={busy}>
                <Send />
                Chốt &amp; gửi khách
              </Button>
            )}
            {canEdit && (isDraft || isRejected) && (
              <Button
                variant={isRejected ? 'default' : 'outline'}
                onClick={() => void submitForApproval()}
                disabled={busy}
              >
                <Stamp />
                {isRejected ? 'Trình duyệt lại' : 'Trình GĐ duyệt'}
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={`/print/quotes/${quote.id}`} target="_blank" rel="noopener">
                <Printer />
                In báo giá
              </a>
            </Button>
            {canEdit && editable && (
              <Button variant="outline" asChild>
                <Link href={`/sales/quotes/${quote.id}/edit`}>
                  <PenLine />
                  Sửa
                </Link>
              </Button>
            )}
            {canEdit && isDraft && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    aria-label="Thao tác khác"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="theme-v2">
                  <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
                    <Trash2 />
                    Xoá báo giá nháp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* ── Dải tóm tắt ───────────────────────────────────────────────────── */}
      <div className="bg-card divide-y rounded-xl border shadow-xs sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Tile label="Trạng thái">
          {isDraft ? (
            <Badge variant="secondary">Nháp — sửa/xoá được</Badge>
          ) : isPending ? (
            <Badge className="bg-amber-500 text-white dark:bg-amber-600">
              Chờ GĐ duyệt
            </Badge>
          ) : isApproved ? (
            <Badge className="bg-sky-600 text-white dark:bg-sky-700">
              GĐ đã duyệt — chưa gửi khách
            </Badge>
          ) : isRejected ? (
            <Badge variant="destructive">GĐ từ chối — sửa rồi trình lại</Badge>
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
        </Tile>
        <Tile label="Hiệu lực">
          {quote.valid_from || quote.valid_to ? (
            <>
              <div className="text-sm font-medium tabular-nums">
                {fmtD(quote.valid_from)} → {fmtD(quote.valid_to)}
              </div>
              {expired && (
                <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
                  ⚠ đã quá hạn — làm báo giá mới nếu khách còn quan tâm
                </div>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-sm">Không giới hạn</span>
          )}
        </Tile>
        <Tile label="Sản phẩm">
          <div className="text-sm font-medium tabular-nums">{lines.length} dòng</div>
          {missingSpec > 0 && (
            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {missingSpec} SP thiếu quy cách
            </div>
          )}
        </Tile>
        <Tile label="Điều khoản">
          {quote.price_term || quote.payment_terms ? (
            <>
              <div
                className="truncate text-sm font-medium"
                title={quote.price_term ?? ''}
              >
                {quote.price_term ?? '—'}
              </div>
              {quote.payment_terms && (
                <div
                  className="text-muted-foreground truncate text-[11px]"
                  title={quote.payment_terms}
                >
                  {quote.payment_terms}
                </div>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-sm">Chưa khai</span>
          )}
        </Tile>
      </div>

      {isRejected && quote.rejected_reason && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm dark:border-red-900 dark:bg-red-950/30">
          <b>Giám đốc từ chối:</b> {quote.rejected_reason}
        </div>
      )}

      {quote.note && (
        <div className="bg-muted/40 text-muted-foreground rounded-xl border px-4 py-2.5 text-sm">
          {quote.note}
        </div>
      )}

      {/* ── Bảng sản phẩm — đầy đủ trường như tờ báo giá ──────────────────── */}
      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Sản phẩm ({lines.length})</h2>
          <span className="text-muted-foreground text-xs">
            Báo giá chào theo đơn giá — số lượng nằm ở đơn hàng
          </span>
        </div>
        <Table className="min-w-[900px] text-center text-xs">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {[
                'Ảnh',
                'Sản phẩm',
                'KT (cm)',
                'Carton (cm)',
                'Carton (inch)',
                'SL/ctn',
                'Load 40HC',
                'NW/GW (kg)',
                `Đơn giá (${quote.currency})`,
              ].map((h, i) => (
                <TableHead
                  key={i}
                  className={`text-foreground px-2 text-center text-[11px] font-semibold tracking-wider uppercase ${
                    h === 'Sản phẩm' ? 'text-left' : ''
                  }`}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => {
              const pk = l.packing ?? {}
              const dims = dimStr(pk.l_cm, pk.w_cm, pk.h_cm)
              const carton = dimStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)
              const inch = inchStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)
              const nwgw =
                pk.nw_kg != null || pk.gw_kg != null
                  ? `${pk.nw_kg ?? '—'} / ${pk.gw_kg ?? '—'}`
                  : null
              const cell = (v: string | null) =>
                v ?? <span className="text-amber-600 dark:text-amber-500">—</span>
              return (
                <TableRow key={i} className="align-top">
                  <TableCell className="p-1">
                    {l.image_url ? (
                      <Image
                        src={l.image_url}
                        alt={l.product_name}
                        width={72}
                        height={56}
                        unoptimized={isSvgUrl(l.image_url)}
                        className="mx-auto h-14 w-20 object-contain"
                      />
                    ) : (
                      <span className="text-amber-600 dark:text-amber-500">—</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1.5 text-left whitespace-normal">
                    <div className="text-muted-foreground font-mono text-[11px]">
                      {l.product_code}
                      {l.customer_item_code && ` · KH: ${l.customer_item_code}`}
                    </div>
                    <div className="font-medium">{l.product_name}</div>
                    {l.description_en && (
                      <div className="text-muted-foreground text-[11px]">
                        {l.description_en}
                      </div>
                    )}
                    {l.note && (
                      <div className="text-muted-foreground text-[11px] italic">
                        {l.note}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="p-1.5">{cell(dims)}</TableCell>
                  <TableCell className="p-1.5">{cell(carton)}</TableCell>
                  <TableCell className="p-1.5">{cell(inch)}</TableCell>
                  <TableCell className="p-1.5">
                    {cell(pk.qty_per_carton != null ? String(pk.qty_per_carton) : null)}
                  </TableCell>
                  <TableCell className="p-1.5">
                    {cell(pk.loading_40hc != null ? String(pk.loading_40hc) : null)}
                  </TableCell>
                  <TableCell className="p-1.5">{cell(nwgw)}</TableCell>
                  <TableCell className="p-1.5 text-right font-semibold tabular-nums">
                    {l.unit_price.toLocaleString('en-US')}
                    {l.discount_pct != null && l.discount_pct > 0 && (
                      <span className="text-muted-foreground block text-[10px] font-normal">
                        −{l.discount_pct}%
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="text-muted-foreground border-t px-4 py-2 text-xs">
          Ô <span className="text-amber-600 dark:text-amber-500">—</span> là quy cách Kỹ
          thuật chưa khai — in báo giá sẽ trống ô đó.
        </p>
      </div>

      <Card>
        <CardContent>
          <DocumentFiles
            kind="quote"
            id={quote.id}
            canEdit={canEdit}
            title="File báo giá gốc"
          />
        </CardContent>
      </Card>

      {busy && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Spinner size={12} /> Đang xử lý…
        </div>
      )}
    </div>
  )
}
