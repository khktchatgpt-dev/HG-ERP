'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Factory,
  MoreHorizontal,
  PenLine,
  Printer,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Checkbox } from '@/components/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { OrderStageBar } from '@/components/sales/OrderStageBar'
import { StageBar as LsxStageBar } from '@/components/production/LsxStageBar'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { DocumentFiles } from '@/components/DocumentFiles'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { OrderStatus } from '@/lib/order-progress'

/**
 * HỒ SƠ ĐƠN HÀNG — dựng lại theo style v2 (shadcn + `.theme-v2`), khớp trang danh
 * sách đơn và trang Lệnh sản xuất.
 *
 * Bản ERP kit cũ nói nhiều mà đọc ra ít. Năm bệnh và cách chữa:
 *   · KHỐI "THÔNG TIN ĐƠN" 9 Ô, một nửa là dấu gạch (đơn thật hiếm khi khai
 *     thanh toán/cọc/phụ trách) → chỉ hiện ô CÓ dữ liệu, các ô trống gom thành
 *     một dòng "chưa khai: …" cỡ nhỏ. Thông tin không mất mà hết loang lổ.
 *   · CỘT ĐƠN GIÁ / THÀNH TIỀN toàn số 0 (đơn gia công nhập không kèm giá) →
 *     ẩn hẳn hai cột + dòng tổng tiền khi cả đơn không có giá nào. Bảng còn
 *     đúng phần dùng được.
 *   · TÊN SP IN HAI LẦN vì `note` của dòng trùng nguyên văn tên SP trong dữ
 *     liệu import → chỉ in note khi nó khác tên.
 *   · BADGE TRẠNG THÁI một màu → OrderStageBar (thanh 6 đoạn), cùng ngôn ngữ
 *     với danh sách đơn; lệnh SX dùng LsxStageBar của nó.
 *   · NÚT HÀNH ĐỘNG rải ba nơi (đầu trang, giữa thẻ LSX, cuối trang) → gom hết
 *     lên đầu: việc chính là nút, việc phụ/nguy hiểm nằm trong menu ⋯.
 *
 * Thêm dải TÓM TẮT 4 ô ngay dưới tiêu đề (tiến trình · hạn giao · sản phẩm ·
 * giá trị) để trả lời "đơn này đang sao" mà không phải đọc hết trang.
 *
 * Lý do huỷ đơn trước dùng `window.prompt` — hộp thoại trắng của trình duyệt
 * giữa một trang đã tạo kiểu, lại không cho xem trước hệ quả. Nay là Dialog
 * riêng: liệt kê hệ quả (LSX/PO bị ảnh hưởng) rồi mới nhận lý do.
 */

export type OrderView = {
  id: string
  code: string
  customer_name: string
  quote_code: string | null
  customer_po_no: string | null
  status: OrderStatus
  currency: string
  due_date: string | null
  deposit_percent: number | null
  price_term: string | null
  payment_terms: string | null
  payment_method: string | null
  qty_tolerance_pct: number | null
  partial_shipment: boolean | null
  transhipment: boolean | null
  port_of_loading: string | null
  port_of_discharge: string | null
  required_docs: string | null
  container_summary: string | null
  note: string | null
  owner_name: string | null
  created_at: string
}
export type LineView = {
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  qty: number
  unit_price: number
  note: string | null
  image_url: string | null
}
export type ChangeView = {
  id: string
  changed_by_name: string | null
  change: {
    type?: string
    fields?: Record<string, { from: unknown; to: unknown }>
    lines?: unknown
  }
  note: string | null
  created_at: string
}
export type LsxView = {
  id: string
  code: string
  status: string
  issued_at: string | null
  approved_at: string | null
  completed_at: string | null
  rejected_reason: string | null
  updated_at: string
}
export type ProgressView = {
  stage: string
  action: 'start' | 'done' | 'received' | 'cancelled'
  note: string | null
  updated_by_name: string | null
  created_at: string
}

const FIELD_LABEL: Record<string, string> = {
  customer_po_no: 'PO khách',
  due_date: 'Hạn giao',
  deposit_percent: '% cọc',
  price_term: 'Điều kiện giá',
  payment_terms: 'Thanh toán',
  container_summary: 'Container',
  note: 'Ghi chú',
  status: 'Trạng thái',
  qty_tolerance_pct: 'Dung sai %',
  partial_shipment: 'Giao từng phần',
  transhipment: 'Chuyển tải',
  port_of_loading: 'Cảng xếp',
  port_of_discharge: 'Cảng dỡ',
  payment_method: 'Phương thức TT',
  required_docs: 'Chứng từ',
}

const BOM_LABEL = { none: 'Chưa có', drawing: 'Đang vẽ', done: 'Đã vẽ' } as const
const BOM_TONE = {
  none: 'bg-muted text-muted-foreground',
  drawing: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
} as const

const LSX_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ GĐ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang sản xuất',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ theo đơn',
  rejected: 'Bị từ chối',
}

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtDT = (d: string) => new Date(d).toLocaleString('vi-VN')
const fmtN = (n: number) => n.toLocaleString('vi-VN')
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Hệ quả khi huỷ đơn — server tính sẵn để hộp thoại nói thật (P3). */
export type CancelImpact = {
  lsx_active: boolean
  /** Lệnh còn chạy cho đơn khác → huỷ đơn này chỉ gỡ nó khỏi lệnh (0113). */
  lsx_shared: boolean
  pos_auto: string[] // PO chưa gửi NCC — sẽ tự huỷ
  pos_manual: string[] // PO đã gửi NCC — Cung ứng xử lý tay
}

/** Đơn cùng khách đủ điều kiện gộp chung một lệnh sản xuất (0113). */
export type MergeCandidate = {
  id: string
  code: string
  due_date: string | null
  line_count: number
}

/* ── Ô tóm tắt đầu trang ───────────────────────────────────────────────────── */
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

/** Một ô thông tin — trả null khi rỗng để khối không bị rỗ dấu gạch. */
function Info({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string | null
  wide?: boolean
}) {
  if (!value) return null
  return (
    <div className={`flex min-w-0 flex-col ${wide ? 'col-span-2' : ''}`}>
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {label}
      </span>
      <span className="text-sm break-words">{value}</span>
    </div>
  )
}

/**
 * Khối thông tin: chỉ vẽ ô có dữ liệu, tên các ô trống dồn xuống một dòng nhỏ.
 * Nhận mảng [nhãn, giá trị] để chỗ gọi khai một lần, không lặp hai lần cho hai
 * nhánh có/không.
 */
function InfoBlock({
  title,
  fields,
  footer,
}: {
  title: string
  fields: [string, string | null, boolean?][]
  footer?: React.ReactNode
}) {
  const filled = fields.filter(([, v]) => !!v)
  const missing = fields.filter(([, v]) => !v).map(([l]) => l)
  if (!filled.length && !footer) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {filled.map(([label, value, wide]) => (
            <Info key={label} label={label} value={value} wide={wide} />
          ))}
        </div>
        {missing.length > 0 && (
          <div className="text-muted-foreground border-t pt-2.5 text-xs">
            Chưa khai: {missing.join(' · ')}
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  )
}

export function OrderDetailView({
  order,
  lines,
  changes,
  canEdit,
  canIssue,
  lsx,
  progress,
  stageLabels,
  cancelImpact,
  mergeCandidates,
}: {
  order: OrderView
  lines: LineView[]
  changes: ChangeView[]
  canEdit: boolean
  canIssue: boolean
  lsx: LsxView | null
  progress: ProgressView[]
  stageLabels: Record<string, string>
  cancelImpact: CancelImpact | null
  mergeCandidates: MergeCandidate[]
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [lsxCode, setLsxCode] = useState('')
  const [shipDate, setShipDate] = useState(order.due_date ?? '')
  const [container, setContainer] = useState(order.container_summary ?? '')
  const [mergeIds, setMergeIds] = useState<string[]>([])
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const editable = order.status !== 'delivered' && order.status !== 'cancelled'
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const bomPending = lines.filter((l) => l.bom_status !== 'done').length
  /*
   * Đơn gia công nhập từ file thường KHÔNG kèm giá — mọi unit_price = 0. In ra
   * hai cột toàn số 0 chỉ làm bảng rối, nên ẩn cả cột lẫn dòng tổng tiền.
   */
  const hasPrices = lines.some((l) => l.unit_price > 0)
  /* PO khách phần lớn trùng hoặc nằm gọn trong mã đơn (`17976 HG-MX` ⊃ `17976`). */
  const poDistinct =
    !!order.customer_po_no &&
    !order.code.toLowerCase().includes(order.customer_po_no.toLowerCase())

  // ── Timeline hợp nhất: tạo đơn → sửa → LSX → tiến độ SX → giao/huỷ ────
  const timeline = useMemo(() => {
    type Ev = {
      at: string
      title: string
      who: string | null
      detail: string | null
      tone: 'blue' | 'green' | 'red' | 'amber' | 'gray'
    }
    const evs: Ev[] = [
      {
        at: order.created_at,
        title: `Tạo đơn ${order.code}`,
        who: order.owner_name,
        detail: order.quote_code ? `Từ báo giá ${order.quote_code}` : 'Tạo trực tiếp',
        tone: 'blue',
      },
    ]
    for (const c of changes) {
      const t = c.change.type
      if (t === 'cancel') {
        evs.push({
          at: c.created_at,
          title: 'Huỷ đơn',
          who: c.changed_by_name,
          detail: c.note,
          tone: 'red',
        })
      } else if (t === 'delivered') {
        evs.push({
          at: c.created_at,
          title: 'Xác nhận đã giao hàng',
          who: c.changed_by_name,
          detail: c.note,
          tone: 'green',
        })
      } else {
        const fields = c.change.fields
          ? Object.entries(c.change.fields)
              .filter(([f]) => f !== 'status')
              .map(
                ([f, v]) =>
                  `${FIELD_LABEL[f] ?? f}: ${String(v.from ?? '—')} → ${String(v.to ?? '—')}`,
              )
          : []
        if (c.change.lines != null) fields.push('Danh sách sản phẩm thay đổi')
        evs.push({
          at: c.created_at,
          title: 'Sửa đơn (khách thay đổi)',
          who: c.changed_by_name,
          detail: [c.note, ...fields].filter(Boolean).join(' · ') || null,
          tone: 'amber',
        })
      }
    }
    if (lsx) {
      if (lsx.issued_at)
        evs.push({
          at: lsx.issued_at,
          title: `Phát LSX ${lsx.code}`,
          who: null,
          detail: null,
          tone: 'blue',
        })
      if (lsx.approved_at)
        evs.push({
          at: lsx.approved_at,
          title: 'LSX được Giám đốc duyệt',
          who: null,
          detail: null,
          tone: 'green',
        })
      if (lsx.status === 'rejected')
        evs.push({
          at: lsx.updated_at,
          title: 'LSX bị từ chối',
          who: null,
          detail: lsx.rejected_reason,
          tone: 'red',
        })
      for (const p of progress) {
        const st = stageLabels[p.stage] ?? p.stage
        evs.push({
          at: p.created_at,
          title:
            p.action === 'start'
              ? `Bắt đầu: ${st}`
              : p.action === 'done'
                ? `Hoàn thành: ${st}`
                : p.action === 'received'
                  ? 'Xưởng xác nhận nhận vật tư'
                  : 'LSX dừng theo đơn',
          who: p.updated_by_name,
          detail: p.note,
          tone: p.action === 'done' ? 'green' : p.action === 'cancelled' ? 'red' : 'gray',
        })
      }
      if (lsx.completed_at)
        evs.push({
          at: lsx.completed_at,
          title: 'Sản xuất hoàn thành',
          who: null,
          detail: null,
          tone: 'green',
        })
    }
    return evs.sort((a, b) => a.at.localeCompare(b.at))
  }, [order, changes, lsx, progress, stageLabels])

  async function issueLsx() {
    setBusy(true)
    try {
      await api('/api/dept/production/lsx', {
        method: 'POST',
        body: {
          code: lsxCode.trim(),
          order_ids: [order.id, ...mergeIds],
          ship_date: shipDate || null,
          container_summary: container.trim() || order.container_summary,
        },
      })
      toast.success(
        'Đã phát LSX — chờ Giám đốc duyệt',
        mergeIds.length ? `${order.code} + ${mergeIds.length} đơn gộp` : order.code,
      )
      setIssuing(false)
      router.refresh()
    } catch (e) {
      toast.error('Phát LSX thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function deliverOrder() {
    const ok = await confirm({
      title: `Xác nhận đã giao đơn ${order.code}?`,
      description: 'Đơn chuyển sang "Đã giao" và không sửa được nữa.',
      confirmLabel: 'Đã giao hàng',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/orders/${order.id}/deliver`, {
        method: 'POST',
        body: {},
      })
      toast.success('Đơn đã giao — chuỗi hoàn tất', order.code)
      router.refresh()
    } catch (e) {
      toast.error('Xác nhận giao thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /** Hệ quả huỷ đơn, tính từ dữ liệu server — hiện TRƯỚC khi nhận lý do. */
  const cancelEffects = useMemo(() => {
    const out = ['Đơn đã huỷ không khôi phục được.']
    if (cancelImpact?.lsx_shared && lsx) {
      out.push(
        `LSX ${lsx.code} còn chạy cho đơn khác — đơn này chỉ được gỡ khỏi lệnh, lệnh KHÔNG dừng.`,
      )
    } else if (cancelImpact?.lsx_active && lsx) {
      out.push(`LSX ${lsx.code} sẽ dừng (Đã huỷ).`)
    }
    if (cancelImpact?.pos_auto.length) {
      out.push(
        `Tự huỷ ${cancelImpact.pos_auto.length} PO chưa gửi NCC: ${cancelImpact.pos_auto.join(', ')}.`,
      )
    }
    if (cancelImpact?.pos_manual.length) {
      out.push(
        `${cancelImpact.pos_manual.length} PO ĐÃ GỬI NCC không tự huỷ — Cung ứng xử lý tay: ${cancelImpact.pos_manual.join(', ')}.`,
      )
    }
    if (cancelImpact?.lsx_active && !cancelImpact.lsx_shared) {
      out.push('Vật tư đã xuất không tự hoàn kho — Kho lập phiếu nhập lại nếu thu hồi.')
    }
    return out
  }, [cancelImpact, lsx])

  async function cancelOrder() {
    const reason = cancelReason.trim()
    if (!reason) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/orders/${order.id}/cancel`, {
        method: 'POST',
        body: { reason },
      })
      toast.success('Đã huỷ đơn', order.code)
      setCancelling(false)
      setCancelReason('')
      router.refresh()
    } catch (e) {
      toast.error('Huỷ thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const dueDays = order.due_date ? daysBetween(today, order.due_date.slice(0, 10)) : null
  const dueClosed = order.status === 'delivered' || order.status === 'cancelled'

  return (
    <div className="theme-v2 text-foreground flex flex-col gap-5">
      <TopProgressBar active={busy} />

      {/* ── Đầu trang: nhận diện + MỌI hành động ─────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Link
          href="/sales/orders"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Đơn hàng
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight">
                {order.code}
              </h1>
              {order.quote_code && (
                <Badge variant="secondary" className="text-muted-foreground">
                  Từ BG {order.quote_code}
                </Badge>
              )}
              {poDistinct && (
                <Badge variant="outline" className="font-mono text-[11px]">
                  PO {order.customer_po_no}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{order.customer_name}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canIssue && order.status === 'confirmed' && !lsx && !issuing && (
              <Button onClick={() => setIssuing(true)}>
                <Factory />
                Phát lệnh sản xuất
              </Button>
            )}
            {canEdit && editable && order.status === 'completed' && (
              <Button onClick={() => void deliverOrder()} disabled={busy}>
                <CheckCircle2 />
                Xác nhận đã giao
              </Button>
            )}
            {canEdit && editable && (
              <Button variant="outline" asChild>
                <Link href={`/sales/orders/${order.id}/edit`}>
                  <PenLine />
                  Sửa đơn
                </Link>
              </Button>
            )}
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
                <DropdownMenuItem
                  disabled={!lsx}
                  onClick={() => router.push(`/sales/lsx/${lsx?.id}`)}
                >
                  <Factory />
                  Mở lệnh sản xuất
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!lsx}
                  onClick={() => window.open(`/print/lsx/${lsx?.id}`, '_blank')}
                >
                  <Printer />
                  In phiếu lệnh
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canEdit || !editable}
                  variant="destructive"
                  onClick={() => setCancelling(true)}
                >
                  <Trash2 />
                  Huỷ đơn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Dải tóm tắt: trả lời "đơn này đang sao" trong một lượt mắt ────── */}
      <div className="bg-card divide-y rounded-xl border shadow-xs sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Tile label="Tiến trình">
          <OrderStageBar status={order.status} className="w-full max-w-[190px]" />
        </Tile>
        <Tile label="Hạn giao">
          <div className="text-sm font-medium tabular-nums">{fmtD(order.due_date)}</div>
          {dueDays !== null && !dueClosed && dueDays < 0 && (
            <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
              ⚠ quá {-dueDays} ngày
            </div>
          )}
          {dueDays !== null && !dueClosed && dueDays >= 0 && dueDays <= 7 && (
            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              còn {dueDays} ngày
            </div>
          )}
        </Tile>
        <Tile label="Sản phẩm">
          <div className="text-sm font-medium tabular-nums">{fmtN(totalQty)}</div>
          <div className="text-muted-foreground text-[11px]">{lines.length} dòng</div>
        </Tile>
        <Tile label={hasPrices ? 'Giá trị đơn' : 'Lệnh sản xuất'}>
          {hasPrices ? (
            <>
              <div className="text-sm font-medium tabular-nums">{fmtN(total)}</div>
              <div className="text-muted-foreground text-[11px]">{order.currency}</div>
            </>
          ) : lsx ? (
            <Link
              href={`/sales/lsx/${lsx.id}`}
              className="font-mono text-sm hover:underline"
            >
              {lsx.code}
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">Chưa phát lệnh</span>
          )}
        </Tile>
      </div>

      {bomPending > 0 && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/15 dark:text-amber-300">
          ⚠ {bomPending}/{lines.length} dòng SP chưa xong BOM — phát LSX vẫn được (BR-07)
          nhưng Cung ứng thiếu định mức để đặt vật tư.
        </div>
      )}

      {/* ── Hộp phát LSX (chỉ khi đang mở) ───────────────────────────────── */}
      {canIssue && order.status === 'confirmed' && !lsx && issuing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Phát lệnh sản xuất</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs">
              Một đơn chỉ thuộc 1 lệnh; một lệnh gộp được nhiều đơn của cùng khách. Không
              bắt buộc đủ BOM (BR-07).
            </p>

            {mergeCandidates.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="text-sm font-medium">
                  Gộp thêm đơn của {order.customer_name}
                  <span className="text-muted-foreground ml-1 text-xs font-normal">
                    (đã xác nhận, chưa có lệnh)
                  </span>
                </div>
                {mergeCandidates.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={mergeIds.includes(c.id)}
                      onCheckedChange={(v) =>
                        setMergeIds((prev) =>
                          v ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                        )
                      }
                    />
                    <span className="font-mono text-xs">{c.code}</span>
                    <span className="text-muted-foreground text-xs">
                      {c.line_count} dòng SP
                      {c.due_date ? ` · hạn ${fmtD(c.due_date)}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span>
                  Số lệnh <span className="text-destructive">*</span>
                </span>
                <Input
                  value={lsxCode}
                  onChange={(e) => setLsxCode(e.target.value)}
                  maxLength={50}
                  placeholder="Tự đặt — vd 27/25-26 (17951+17955HG/MX)"
                  className="bg-card font-mono"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Thời gian xuất dự kiến
                <Input
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                  className="bg-card"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Container
                <Input
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                  placeholder="3 x 40'HC"
                  className="bg-card"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Xem trước phiếu in với số/ngày đang gõ — bản thử có watermark đỏ. */}
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/print/lsx/preview/${order.id}?code=${encodeURIComponent(
                    lsxCode.trim(),
                  )}&ship_date=${encodeURIComponent(shipDate)}${
                    mergeIds.length ? `&orders=${mergeIds.join(',')}` : ''
                  }`}
                  target="_blank"
                  rel="noopener"
                >
                  <Printer />
                  Xem trước bản in
                </a>
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setIssuing(false)}>
                  Huỷ
                </Button>
                <Button
                  disabled={busy || !lsxCode.trim()}
                  onClick={() => void issueLsx()}
                >
                  {busy && <Spinner size={14} />}
                  Xác nhận phát lệnh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs nội dung ────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="flex flex-col gap-4">
        <div className="max-w-full">
          <TabsList className="h-auto! flex-wrap">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="timeline">
              Dòng thời gian
              <span className="text-muted-foreground text-xs tabular-nums">
                {timeline.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="docs">Tài liệu</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <InfoBlock
            title="Thông tin đơn"
            fields={[
              ['Khách hàng', order.customer_name],
              /* Giữ nguyên số PO (đây là sổ gốc của đơn, phải tra được), nhưng
                 chú thích khi nó trùng mã đơn — không thì đọc như in lỗi hai lần. */
              [
                'PO khách',
                order.customer_po_no
                  ? poDistinct
                    ? order.customer_po_no
                    : `${order.customer_po_no} (trùng số đơn)`
                  : null,
              ],
              ['Ngày đặt', fmtD(order.created_at)],
              ['Hạn giao', order.due_date ? fmtD(order.due_date) : null],
              ['Thanh toán', order.payment_terms],
              [
                'Đặt cọc',
                order.deposit_percent != null ? `${order.deposit_percent}%` : null,
              ],
              ['Người phụ trách', order.owner_name],
              ['Từ báo giá', order.quote_code],
              ['Tiền tệ', order.currency],
            ]}
            footer={
              order.note ? (
                <div className="text-muted-foreground border-t pt-2.5 text-sm">
                  <span className="text-foreground font-medium">Ghi chú: </span>
                  {order.note}
                </div>
              ) : undefined
            }
          />

          <InfoBlock
            title="Logistics & điều kiện giao"
            fields={[
              ['Incoterm / ĐK giá', order.price_term],
              ['Cảng xếp (POL)', order.port_of_loading],
              ['Cảng dỡ (POD)', order.port_of_discharge],
              ['Container', order.container_summary],
              [
                'Dung sai SL',
                order.qty_tolerance_pct != null ? `±${order.qty_tolerance_pct}%` : null,
              ],
              [
                'Giao từng phần',
                order.partial_shipment == null
                  ? null
                  : order.partial_shipment
                    ? 'Cho phép'
                    : 'Không',
              ],
              [
                'Chuyển tải',
                order.transhipment == null
                  ? null
                  : order.transhipment
                    ? 'Cho phép'
                    : 'Không',
              ],
              ['Phương thức TT', order.payment_method],
              ['Chứng từ yêu cầu', order.required_docs, true],
            ]}
          />

          {/* Dòng sản phẩm — hai cột tiền chỉ hiện khi đơn thật sự có giá. */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                Sản phẩm ({lines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-foreground w-[70px] px-3 text-[11px] font-semibold tracking-wider uppercase">
                      Ảnh
                    </TableHead>
                    <TableHead className="text-foreground px-3 text-[11px] font-semibold tracking-wider uppercase">
                      Sản phẩm
                    </TableHead>
                    <TableHead className="text-foreground w-[100px] px-3 text-[11px] font-semibold tracking-wider uppercase">
                      BOM
                    </TableHead>
                    <TableHead className="text-foreground w-[110px] px-3 text-right text-[11px] font-semibold tracking-wider uppercase">
                      SL
                    </TableHead>
                    {hasPrices && (
                      <>
                        <TableHead className="text-foreground w-[110px] px-3 text-right text-[11px] font-semibold tracking-wider uppercase">
                          Đơn giá
                        </TableHead>
                        <TableHead className="text-foreground w-[130px] px-3 text-right text-[11px] font-semibold tracking-wider uppercase">
                          Thành tiền
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-3 py-2">
                        {l.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={l.image_url}
                            alt={l.product_name}
                            className="h-11 w-14 rounded object-contain"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="text-muted-foreground font-mono text-[11px]">
                          {l.product_code}
                          {l.customer_item_code && ` · KH ${l.customer_item_code}`}
                        </div>
                        <div className="text-sm">{l.product_name}</div>
                        {/* Dữ liệu import có dòng note TRÙNG NGUYÊN VĂN tên SP —
                            in lại thành ra tên hiện hai lần. */}
                        {l.note && l.note.trim() !== l.product_name.trim() && (
                          <div className="text-muted-foreground text-xs">{l.note}</div>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Badge className={`border-transparent ${BOM_TONE[l.bom_status]}`}>
                          {BOM_LABEL[l.bom_status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <span className="text-sm font-medium tabular-nums">
                          {fmtN(l.qty)}
                        </span>
                        <span className="text-muted-foreground ml-1 text-[11px]">
                          {l.product_unit}
                        </span>
                      </TableCell>
                      {hasPrices && (
                        <>
                          <TableCell className="px-3 py-2 text-right text-sm tabular-nums">
                            {fmtN(l.unit_price)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-sm font-medium tabular-nums">
                            {fmtN(l.qty * l.unit_price)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell colSpan={3} className="px-3 py-2 text-right font-medium">
                      Tổng
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                      {fmtN(totalQty)}
                    </TableCell>
                    {hasPrices && (
                      <>
                        <TableCell />
                        <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                          {fmtN(total)} {order.currency}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Lệnh sản xuất đã phát */}
          {lsx && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Lệnh sản xuất
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <Link
                  href={`/sales/lsx/${lsx.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {lsx.code}
                </Link>
                <LsxStageBar status={lsx.status} className="w-[150px]" />
                <span className="text-muted-foreground text-xs">
                  {LSX_LABEL[lsx.status] ?? lsx.status}
                  {lsx.issued_at && ` · phát ${fmtD(lsx.issued_at)}`}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/print/lsx/${lsx.id}`} target="_blank" rel="noopener">
                      <Printer />
                      In phiếu
                    </a>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/sales/lsx/${lsx.id}`}>
                      Mở lệnh
                      <ChevronRight />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                Dòng thời gian đơn hàng
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative ml-1 flex flex-col border-l">
                {timeline.map((ev, i) => (
                  <li key={i} className="relative pb-5 pl-5 last:pb-0">
                    <span
                      className={
                        'ring-card absolute top-1 -left-[5px] size-2.5 rounded-full ring-4 ' +
                        (ev.tone === 'green'
                          ? 'bg-emerald-500'
                          : ev.tone === 'red'
                            ? 'bg-red-500'
                            : ev.tone === 'amber'
                              ? 'bg-amber-500'
                              : ev.tone === 'blue'
                                ? 'bg-blue-500'
                                : 'bg-muted-foreground/40')
                      }
                    />
                    <div className="text-muted-foreground text-xs tabular-nums">
                      {fmtDT(ev.at)}
                      {ev.who && <span> · {ev.who}</span>}
                    </div>
                    <div className="mt-0.5 text-sm font-medium">{ev.title}</div>
                    {ev.detail && (
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {ev.detail}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                Tài liệu đơn hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-muted-foreground text-xs">
                PO khách · Báo giá PDF · Spec / bản vẽ · Packing list · Invoice · B/L ·
                C/O · C/Q — đính kèm tất cả vào đây để cả chuỗi cùng xem.
              </p>
              <DocumentFiles
                kind="sales_order"
                id={order.id}
                canEdit={canEdit}
                title="File đính kèm"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Huỷ đơn: hệ quả TRƯỚC, lý do SAU ─────────────────────────────── */}
      <Dialog open={cancelling} onOpenChange={(v) => !v && setCancelling(false)}>
        <DialogContent className="theme-v2">
          <DialogHeader>
            <DialogTitle>Huỷ đơn {order.code}?</DialogTitle>
            <DialogDescription>
              Xem hệ quả bên dưới rồi ghi lý do — lý do vào dòng thời gian của đơn.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-1.5 rounded-lg border border-red-200/70 bg-red-50/60 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/15 dark:text-red-300">
            {cancelEffects.map((e) => (
              <li key={e}>· {e}</li>
            ))}
          </ul>
          <label className="flex flex-col gap-1.5 text-sm">
            <span>
              Lý do huỷ <span className="text-destructive">*</span>
            </span>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Vd: khách rút đơn, đổi mẫu, sai điều khoản…"
              className="bg-card"
            />
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelling(false)}>
              Không huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !cancelReason.trim()}
              onClick={() => void cancelOrder()}
            >
              {busy && <Spinner size={14} />}
              Huỷ đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
