'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  History,
  MoreHorizontal,
  Package,
  PackageCheck,
  PackageSearch,
  Paperclip,
  Pencil,
  Printer,
  ScrollText,
  SendHorizontal,
  Trash2,
  Truck,
  UserCog,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { DocumentFiles } from '@/components/DocumentFiles'
import { Breadcrumbs } from '@/components/erp/Breadcrumbs'
import { RefChain, type ChainNode } from '@/components/erp/RefChain'
import { DocChip } from '@/components/erp/DocChip'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import { fmtMoney, poLineAmount, poMoney, qtyTotals, roundMoney } from '@/lib/po-line'
import { canReschedule } from '@/lib/po-reschedule'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { PO_STATUS_LABEL, PO_STATUS_TONE, type PoStatus } from '@/lib/po-status'
import type { ApprovalEvent } from '@/modules/core/approvals/approvals.repo'
import { PoStatusStepper } from '../PoStatusStepper'
import {
  PoDialogs,
  ReasonDialog,
  type ReassignState,
  type ReasonState,
  type RescheduleState,
} from '../PoDialogs'
import { usePoActions } from '../usePoActions'
import { PoConfirmDialog, PoShipmentsCard, type ShipmentView } from './PoShipmentsPanel'
import type { PoLine, StatusLine } from '../po-types'

export type PoDetailPo = {
  id: string
  code: string
  status: PoStatus
  template: string
  supplier_id: string
  supplier_name: string
  lsx_code: string | null
  order_code: string | null
  production_order_id: string | null
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  discount_amount: number | null
  contract_no: string | null
  expected_at: string | null
  terms: string | null
  terms_quality: string | null
  terms_delivery_place: string | null
  terms_payment: string | null
  terms_invoice: string | null
  terms_lead_time: string | null
  note: string | null
  signer_role: string | null
  assigned_to: string | null
  assignee_name: string | null
  approved_at: string | null
  ordered_at: string | null
  confirmed_at: string | null
  confirmed_note: string | null
  created_at: string
}

const money = (n: number) => n.toLocaleString('vi-VN')
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')
const stamp = (s: string) => new Date(s).toLocaleString('vi-VN')

const HISTORY_LABEL: Record<ApprovalEvent['action'], string> = {
  submitted: 'Gửi Giám đốc duyệt',
  approved: 'Giám đốc duyệt',
  rejected: 'Giám đốc từ chối',
  withdrawn: 'Rút về nháp',
  reassigned: 'Bàn giao người phụ trách',
}
const HISTORY_TONE: Record<ApprovalEvent['action'], 'gray' | 'amber' | 'green' | 'red'> =
  {
    submitted: 'amber',
    approved: 'green',
    rejected: 'red',
    withdrawn: 'gray',
    reassigned: 'gray',
  }

export function PoDetailScreen({
  po,
  lines,
  statusLines,
  shipmentReceipts,
  extraLsx,
  shipments,
  history,
  warehouseDocs,
  canEdit,
  isSupply,
  canApprove,
  canReassign,
  staff,
}: {
  po: PoDetailPo
  lines: PoLine[]
  statusLines: StatusLine[]
  shipmentReceipts: Record<string, Record<string, number>>
  extraLsx: { id: string; code: string }[]
  shipments: ShipmentView[]
  history: ApprovalEvent[]
  warehouseDocs: {
    doc_id: string
    code: string
    kind: 'receipt' | 'return'
    qty_total: number
    at: string
  }[]
  canEdit: boolean
  isSupply: boolean
  canApprove: boolean
  canReassign: boolean
  staff: { id: string; name: string }[]
}) {
  const router = useRouter()
  const act = usePoActions({ onDone: () => router.refresh() })
  const [rescheduling, setRescheduling] = useState<RescheduleState | null>(null)
  const [reassigning, setReassigning] = useState<ReassignState | null>(null)
  const [reasoning, setReasoning] = useState<ReasonState | null>(null)
  const [confirming, setConfirming] = useState<'confirm' | 'add' | null>(null)
  const [editingTerms, setEditingTerms] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    void navigator.clipboard.writeText(po.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shipmentLines = lines
    .filter((l) => l.material_id != null)
    .map((l) => ({
      id: l.id,
      name: l.material_name,
      unit: l.material_unit,
      qty_ordered: l.qty_ordered,
      amount: l.unit_price != null ? poLineAmount(l) : null,
      price_approx: l.price_basis === 'unit2',
    }))
  const shipmentLinesById = new Map(shipmentLines.map((l) => [l.id, l]))

  const shippedByLine = new Map<string, number>()
  for (const s of shipments) {
    if (s.status === 'cancelled') continue
    for (const l of s.lines) {
      shippedByLine.set(l.po_line_id, (shippedByLine.get(l.po_line_id) ?? 0) + l.qty)
    }
  }

  /*
   * ĐỢT GIAO — đếm cho thẻ số đầu trang. Đợt đã HUỶ không nằm ở mẫu số: chia 5
   * đợt rồi huỷ 2 thì "3/5" đọc thành còn thiếu, trong khi thực tế đã xong.
   */
  const liveShipments = shipments.filter((s) => s.status !== 'cancelled')
  const shipmentsDone = liveShipments.filter((s) => s.status === 'received').length

  const receivedById = new Map(statusLines.map((s) => [s.id, s]))
  const showReceived = !['draft', 'pending_approval', 'approved', 'cancelled'].includes(
    po.status,
  )
  const canCloseShort = ['ordered', 'confirmed', 'in_transit', 'partial'].includes(
    po.status,
  )
  const openStockLines = statusLines.filter(
    (l) => l.material_id != null && l.qty_open > 0,
  )

  const m = poMoney({
    subtotalRaw: lines.reduce((s, l) => s + poLineAmount(l), 0),
    discount: po.discount_amount,
    vatRate: po.vat_rate,
    priceIncludesVat: po.price_includes_vat,
    currency: po.currency,
  })
  const cash = (n: number) => fmtMoney(n, po.currency)
  const today = new Date().toISOString().slice(0, 10)
  const late = assessPoLate(po, today)
  const lsxCodes = po.lsx_code
    ? [po.lsx_code, ...extraLsx.map((l) => l.code)].join(' + ')
    : null

  const totalOrderedStock = statusLines
    .filter((l) => l.material_id != null)
    .reduce((s, l) => s + l.qty_ordered, 0)
  const totalReceivedStock = statusLines
    .filter((l) => l.material_id != null)
    .reduce((s, l) => s + (l.qty_received ?? 0), 0)
  const pctReceived =
    totalOrderedStock > 0
      ? Math.min(Math.round((totalReceivedStock / totalOrderedStock) * 100), 100)
      : 0

  const daysBetween = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
  const dueDays = po.expected_at ? daysBetween(today, po.expected_at.slice(0, 10)) : null

  // Chuỗi liên kết chứng từ cha → con (RefChain)
  const chain: ChainNode[] = [
    ...(po.order_code
      ? [{ label: 'Đơn hàng khách', value: po.order_code, href: '/sales/orders' }]
      : []),
    ...(po.lsx_code
      ? [
          {
            label: 'Lệnh sản xuất',
            value: lsxCodes ?? po.lsx_code,
            href: '/planning/lsx',
          },
        ]
      : []),
    { label: 'Đơn đặt vật tư', value: po.code, current: true },
  ]

  type Mark = {
    key: string
    at: string
    label: string
    tone: 'gray' | 'amber' | 'green' | 'red' | 'blue'
    actor?: string | null
    detail?: string | null
  }
  const marks: Mark[] = [
    ...history.map((h) => ({
      key: `h-${h.id}`,
      at: h.created_at,
      label: HISTORY_LABEL[h.action],
      tone: HISTORY_TONE[h.action],
      actor: h.actor_name ?? 'hệ thống',
      detail: h.reason ? `“${h.reason}”` : null,
    })),
    ...(po.ordered_at
      ? [{ key: 'ordered', at: po.ordered_at, label: 'Gửi NCC', tone: 'blue' as const }]
      : []),
    ...(po.confirmed_at
      ? [
          {
            key: 'confirmed',
            at: po.confirmed_at,
            label: 'NCC xác nhận',
            tone: 'blue' as const,
            detail: po.confirmed_note,
          },
        ]
      : []),
    ...shipments.map((s) => ({
      key: `sh-${s.id}`,
      at: s.created_at,
      label: `Khai đợt ${s.seq} — hẹn ${day(s.expected_date)}`,
      tone:
        s.status === 'cancelled'
          ? ('gray' as const)
          : s.status === 'received'
            ? ('green' as const)
            : ('amber' as const),
      detail:
        s.status === 'received'
          ? 'đã nhận đủ'
          : s.status === 'cancelled'
            ? `đã huỷ${s.note ? ` — ${s.note}` : ''}`
            : s.status === 'arrived'
              ? 'xe đã tới, đang nhận'
              : null,
    })),
    ...warehouseDocs.map((d) => ({
      key: `doc-${d.doc_id}`,
      at: d.at,
      label:
        d.kind === 'receipt'
          ? `${d.code} — nhận ${money(d.qty_total)}`
          : `${d.code} — trả NCC ${money(d.qty_total)}`,
      tone: d.kind === 'receipt' ? ('green' as const) : ('red' as const),
    })),
    ...[
      ...new Map(
        statusLines
          .filter((l) => l.closed_short_at != null)
          .map((l) => [l.closed_short_at as string, l]),
      ).entries(),
    ].map(([at, sample]) => {
      const batch = statusLines.filter((l) => l.closed_short_at === at)
      return {
        key: `cs-${at}`,
        at,
        label: 'Chốt phần thiếu — NCC không giao nữa',
        tone: 'gray' as const,
        detail: `${batch.map((l) => `${l.material_name} (${money(l.qty_missing)} ${l.material_unit})`).join(', ')}${
          sample.closed_short_reason ? ` — “${sample.closed_short_reason}”` : ''
        }`,
      }
    }),
  ].sort((a, b) => b.at.localeCompare(a.at))

  async function removeDraft() {
    if (await act.deleteDraft(po)) router.push('/planning/pos')
  }

  const primary =
    canEdit && po.status === 'draft'
      ? {
          label: 'Gửi Giám đốc duyệt',
          onClick: () => void act.submitPo(po),
          icon: SendHorizontal,
        }
      : canApprove && po.status === 'pending_approval'
        ? {
            label: 'Duyệt đơn đặt',
            onClick: () => void act.approve(po),
            icon: CheckCircle2,
            isDoneTone: true,
          }
        : canEdit && po.status === 'approved'
          ? {
              label: 'Gửi cho NCC',
              onClick: () => void act.advance(po, 'ordered'),
              icon: SendHorizontal,
            }
          : canEdit && po.status === 'ordered'
            ? {
                label: 'NCC đã xác nhận',
                onClick: () =>
                  shipmentLines.length > 0
                    ? setConfirming('confirm')
                    : void act.advance(po, 'confirmed'),
                icon: Check,
              }
            : canEdit && po.status === 'confirmed'
              ? {
                  label: 'Hàng đang trên đường',
                  onClick: () => void act.advance(po, 'in_transit'),
                  icon: Truck,
                }
              : canEdit && po.status === 'partial' && openStockLines.length > 0
                ? {
                    label: 'Chốt phần thiếu',
                    onClick: () =>
                      setReasoning({
                        po,
                        kind: 'close_short',
                        reason: '',
                        lineId: null,
                        detail:
                          openStockLines.length === 1
                            ? `${openStockLines[0].material_name} — thiếu ${money(openStockLines[0].qty_missing)} ${openStockLines[0].material_unit}`
                            : `${openStockLines.length} dòng còn thiếu sẽ được chốt`,
                      }),
                    icon: Check,
                  }
                : null

  const canAcceptByHand =
    canEdit &&
    lines.length > 0 &&
    lines.some((l) => l.material_id == null) &&
    statusLines.every((l) => l.material_id == null || l.qty_open <= 0) &&
    ['ordered', 'confirmed', 'in_transit', 'partial'].includes(po.status)

  const stepDates: Partial<Record<PoStatus, string | null>> = {
    draft: po.created_at,
    pending_approval: history.find((h) => h.action === 'submitted')?.created_at ?? null,
    approved: po.approved_at,
    ordered: po.ordered_at,
    confirmed: po.confirmed_at,
    in_transit:
      shipments.find((s) => s.status === 'arrived' || s.status === 'received')
        ?.created_at ?? null,
    partial: statusLines.some((l) => (l.qty_received ?? 0) > 0)
      ? (warehouseDocs[0]?.at ?? null)
      : null,
    received: po.status === 'received' ? (warehouseDocs[0]?.at ?? null) : null,
  }

  return (
    <div className="theme-v3 text-foreground flex flex-col gap-5 pb-16">
      <TopProgressBar active={act.busy} />

      {/* ── Breadcrumbs & Back Navigation ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Breadcrumbs
          items={[
            { label: 'Cung ứng', href: '/planning' },
            { label: 'Đơn đặt vật tư', href: '/planning/pos' },
            { label: po.code },
          ]}
        />
        {/* Ẩn ở màn hẹp: nó trỏ đúng chỗ mà breadcrumb "Đơn đặt vật tư" ngay
            bên trái đã trỏ, mà trên điện thoại nó lại xuống hàng riêng — tốn
            một dòng cho một lối đi đã có. */}
        <Link
          href="/planning/pos"
          className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-xs font-medium transition-colors sm:inline-flex"
        >
          <ArrowLeft className="size-3.5" />
          Về danh sách đơn đặt
        </Link>
      </div>

      {/*
        ── MỘT THẺ ĐẦU TRANG (04/09/2026) ───────────────────────────────────
        Trước đây ba thẻ rời: RefChain / tiêu đề+hành động / stepper. Ba viền,
        ba lần đổ bóng, hai khoảng cách 16px — 457px trước khi tới nội dung, và
        chúng nói trùng nhau: đo trên đơn thật thì `PO-2026-0065` hiện 3 lần,
        `Nháp` 3 lần, mã lệnh 3 lần.

        Gộp lại vì cả ba trả lời CÙNG một câu: "đơn này là đơn nào, thuộc về
        đâu, đang ở bước nào". Đó là một khối nhận diện, không phải ba.
      */}
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-bold tracking-tight">{po.code}</h1>
              <button
                type="button"
                onClick={copyCode}
                title="Sao chép mã đơn"
                className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-7 items-center justify-center rounded-md transition-colors"
              >
                {copied ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>

              <Badge tone={PO_STATUS_TONE[po.status]}>{PO_STATUS_LABEL[po.status]}</Badge>

              <Badge tone="gray" className="text-xs font-normal">
                Mẫu {poTemplateMeta(po.template as PoTemplate).label.toLowerCase()}
              </Badge>

              {late === 'overdue' && (
                <Badge tone="red" className="flex items-center gap-1 font-semibold">
                  <AlertTriangle className="size-3" />
                  Quá hạn giao
                </Badge>
              )}
            </div>

            {/*
              DẤU PHÂN CÁCH GẮN VÀO MỤC, KHÔNG ĐỨNG RIÊNG (04/09/2026).

              Bản cũ chèn `<span>·</span>` rời giữa các mục. Hàng này chắc chắn
              xuống dòng trên điện thoại, và khi đó dấu chấm — vốn là một phần
              tử độc lập — trôi ra cuối dòng trên hoặc đầu dòng dưới, để lại
              "· Ngày lập: 3/9/2026 ·" trông như câu bị cụt. Nay dấu là
              `::before` của chính mục đứng sau nên không tách khỏi mục được
              nữa; màn hẹp thì xếp dọc và bỏ dấu, vì mỗi mục đã một dòng riêng.
            */}
            <div className="text-muted-foreground sm:[&>span+span]:before:text-muted-foreground/60 flex flex-col gap-y-0.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:[&>span+span]:before:mr-3 sm:[&>span+span]:before:content-['·']">
              <span>
                Nhà cung cấp:{' '}
                <Link
                  href={`/planning/suppliers/${po.supplier_id}`}
                  className="text-foreground font-semibold hover:underline"
                >
                  {po.supplier_name}
                </Link>
              </span>
              <span>Ngày lập: {day(po.created_at)}</span>
              {po.contract_no && (
                <span>
                  Hợp đồng: <b className="text-foreground font-mono">{po.contract_no}</b>
                </span>
              )}
              {po.assignee_name && <span>Phụ trách: {po.assignee_name}</span>}
            </div>
          </div>

          {/* Action buttons toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {canAcceptByHand && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void act.advance(po, 'received')}
              >
                <PackageCheck className="size-4" /> Đã nhận đủ
              </Button>
            )}

            {canEdit && po.status === 'pending_approval' && (
              <Button variant="outline" size="sm" onClick={() => void act.withdrawPo(po)}>
                Rút về nháp
              </Button>
            )}

            {canApprove && po.status === 'pending_approval' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReasoning({ po, kind: 'reject', reason: '' })}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Từ chối
              </Button>
            )}

            <Button variant="outline" size="sm" asChild>
              <a href={`/print/supply/${po.id}`} target="_blank" rel="noopener">
                <Printer className="size-4" /> In phiếu
              </a>
            </Button>

            {canEdit && po.status === 'draft' && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/planning/pos/${po.id}/edit`}>
                  <Pencil className="size-4" /> Sửa đơn
                </Link>
              </Button>
            )}

            {primary && (
              <Button
                size="sm"
                onClick={primary.onClick}
                disabled={act.busy}
                className={
                  primary.isDoneTone
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : ''
                }
              >
                {act.busy ? <Spinner size={14} /> : <primary.icon className="size-4" />}
                {primary.label}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Thao tác khác">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <a href={`/print/supply/${po.id}`} target="_blank" rel="noopener">
                    <Printer className="size-4" /> In đơn đặt hàng
                  </a>
                </DropdownMenuItem>

                {canEdit && po.status === 'draft' && (
                  <DropdownMenuItem asChild>
                    <Link href={`/planning/pos/${po.id}/edit`}>
                      <Pencil className="size-4" /> Sửa đơn
                    </Link>
                  </DropdownMenuItem>
                )}

                {canEdit && canReschedule(po.status).ok && (
                  <DropdownMenuItem
                    onSelect={() =>
                      setRescheduling({
                        po,
                        date: po.expected_at?.slice(0, 10) ?? '',
                        reason: '',
                      })
                    }
                  >
                    <CalendarClock className="size-4" /> Đổi hẹn giao
                  </DropdownMenuItem>
                )}

                {canReassign && !['received', 'cancelled'].includes(po.status) && (
                  <DropdownMenuItem onSelect={() => setReassigning({ po, toId: '' })}>
                    <UserCog className="size-4" /> Bàn giao phụ trách
                  </DropdownMenuItem>
                )}

                {isSupply && (
                  <DropdownMenuItem asChild>
                    <Link href={`/planning/pos/${po.id}/edit?duplicate=1`}>
                      <Copy className="size-4" />
                      {po.status === 'cancelled' ? 'Tạo lại từ đơn' : 'Nhân bản đơn'}
                    </Link>
                  </DropdownMenuItem>
                )}

                {canEdit && po.status === 'draft' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void removeDraft()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" /> Xoá nháp
                    </DropdownMenuItem>
                  </>
                )}

                {canEdit && !['draft', 'received', 'cancelled'].includes(po.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setReasoning({ po, kind: 'cancel', reason: '' })}
                      className="text-destructive focus:text-destructive"
                    >
                      <Ban className="size-4" /> Huỷ đơn
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!canEdit && !canApprove && (
          <div className="bg-muted/60 text-muted-foreground rounded-md px-3 py-2 text-xs">
            Bạn đang xem đơn của nhân sự khác — chế độ chỉ đọc.
          </div>
        )}

        {/*
          CHUỖI CHỨNG TỪ — nay nằm TRONG thẻ, ngay dưới tiêu đề, và BỎ mắt cuối
          (chính đơn đang xem). Mắt đó lặp lại cái mã đang in to ngay phía trên
          nó; giữ lại chỉ để đánh dấu "bạn đang ở đây" thì thừa, vì cả thẻ này
          đã là "đây" rồi.
        */}
        {chain.length > 1 && (
          <div className="border-t pt-3">
            <RefChain nodes={chain.filter((n) => !n.current)} size="md" />
          </div>
        )}

        {/* Tiến trình vòng đời — cùng thẻ vì nó cũng đang tả CHÍNH đơn này. */}
        <div className="w-full overflow-x-auto border-t pt-3">
          <PoStatusStepper status={po.status} dates={stepDates} />
        </div>
      </div>

      {/* ── 4 ERP Kit StatTiles ─────────────────────────────────────────── */}
      <StatTiles>
        {/*
          Ô "Trạng thái" từng đứng đây, nay bỏ (04/09/2026): nó in đúng chữ mà
          Badge cạnh tiêu đề và stepper ngay trên đã nói — ba chỗ cho một giá
          trị. Tệ hơn, nó là CHỮ nằm trong lưới bốn thẻ SỐ: mắt quét hàng thẻ
          tìm con số thì vấp phải một từ.

          Thay bằng đợt giao — thứ chưa chỗ nào trên đầu trang nói, mà lại là
          câu hỏi kế tiếp ngay sau "hạn giao khi nào".
        */}
        <StatTile
          label="Đợt giao"
          value={
            liveShipments.length > 0 ? `${shipmentsDone}/${liveShipments.length}` : '—'
          }
          tone={
            liveShipments.length === 0
              ? 'default'
              : shipmentsDone >= liveShipments.length
                ? 'done'
                : 'warn'
          }
          hint={
            liveShipments.length === 0
              ? 'chưa chia đợt — giao trọn gói'
              : shipmentsDone >= liveShipments.length
                ? 'đã nhận đủ mọi đợt'
                : `còn ${liveShipments.length - shipmentsDone} đợt chưa về`
          }
          icon={Truck}
        />
        <StatTile
          label="Hạn giao hàng"
          value={po.expected_at ? day(po.expected_at) : 'Chưa hẹn'}
          tone={late === 'overdue' ? 'stop' : 'default'}
          hint={
            late === 'overdue'
              ? `Quá hạn ${dueDays !== null ? -dueDays : ''} ngày`
              : po.confirmed_at
                ? `NCC xác nhận: ${day(po.confirmed_at)}`
                : isMissingEta(po)
                  ? 'Chưa cam kết ngày'
                  : dueDays !== null && dueDays >= 0
                    ? `Còn ${dueDays} ngày`
                    : undefined
          }
          icon={CalendarDays}
        />
        <StatTile
          label="Vật tư & Nhập kho"
          value={
            showReceived
              ? `${money(totalReceivedStock)} / ${money(totalOrderedStock)}`
              : `${lines.length} mặt hàng`
          }
          tone={
            showReceived && pctReceived >= 100
              ? 'done'
              : showReceived && pctReceived > 0
                ? 'warn'
                : 'default'
          }
          hint={
            showReceived
              ? `Đã nhập ${pctReceived}% (${openStockLines.length > 0 ? `${openStockLines.length} dòng chờ` : 'đủ hàng'})`
              : `Tổng ${money(lines.reduce((s, l) => s + l.qty_ordered, 0))} đơn vị`
          }
          icon={Package}
        />
        <StatTile
          label="Tổng thanh toán"
          value={cash(m.grandTotal)}
          tone="primary"
          hint={`Tiền tệ: ${po.currency}${m.vatAmount > 0 ? ` · VAT: ${cash(m.vatAmount)}` : ''}`}
          icon={Truck}
        />
      </StatTiles>

      {/* ── Tabs nội dung chính ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="flex flex-col gap-4">
        <TabsList className="bg-muted/60 h-auto flex-wrap p-1">
          <TabsTrigger value="overview" className="gap-2">
            <Package className="size-4" />
            Tổng quan & Mặt hàng
            <Badge tone="gray" className="px-1.5 py-0 text-[10px]">
              {lines.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="shipments" className="gap-2">
            <Truck className="size-4" />
            Kế hoạch giao & Đợt hàng
            {shipments.length > 0 && (
              <Badge tone="gray" className="px-1.5 py-0 text-[10px]">
                {shipments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-2">
            <ScrollText className="size-4" />
            Điều khoản & Hợp đồng
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <History className="size-4" />
            Dòng thời gian
            <Badge tone="gray" className="px-1.5 py-0 text-[10px]">
              {marks.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <Paperclip className="size-4" />
            Tài liệu đính kèm
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: TỔNG QUAN & MẶT HÀNG ───────────────────────────────── */}
        <TabsContent value="overview" className="flex flex-col gap-5">
          {/* Khối thông tin đối tác & logistics */}
          <Card>
            <CardHeader className="bg-muted/20 border-b py-3">
              <CardTitle className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Thông tin đơn hàng & Đối tác
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Bên bán (Nhà cung cấp)
                </span>
                <Link
                  href={`/planning/suppliers/${po.supplier_id}`}
                  className="text-primary text-sm font-semibold hover:underline"
                >
                  {po.supplier_name}
                </Link>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Lệnh sản xuất
                </span>
                {lsxCodes ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href="/planning/lsx"
                      className="text-primary font-mono text-sm font-medium hover:underline"
                    >
                      {lsxCodes}
                    </Link>
                    {extraLsx.length > 0 && (
                      <Badge tone="blue" className="text-[10px]">
                        Gộp {extraLsx.length + 1} lệnh
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Đơn ngoài lệnh</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Đơn hàng khách
                </span>
                {po.order_code ? (
                  <Link
                    href="/sales/orders"
                    className="text-primary font-mono text-sm font-medium hover:underline"
                  >
                    {po.order_code}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Người phụ trách
                </span>
                <span className="text-sm font-medium">
                  {po.assignee_name ?? (
                    <span className="text-amber-600 dark:text-amber-400">Chưa giao</span>
                  )}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Tiền tệ & Thuế VAT
                </span>
                <span className="text-sm">
                  {po.currency}
                  {po.vat_rate != null && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      (VAT {po.vat_rate}%, {po.price_includes_vat ? 'đã gồm' : 'chưa gồm'}
                      )
                    </span>
                  )}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Số hợp đồng
                </span>
                <div>
                  {po.contract_no ? (
                    <DocChip>{po.contract_no}</DocChip>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Chiết khấu
                </span>
                <span className="text-sm">
                  {m.discountAmount > 0 ? cash(m.discountAmount) : 'Không có'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Điều kiện giao hàng
                </span>
                <span className="truncate text-sm">
                  {po.terms_delivery_place || 'Theo thoả thuận'}
                </span>
              </div>
            </CardContent>
            {po.note && (
              <div className="bg-muted/20 text-muted-foreground border-t px-5 py-2.5 text-xs">
                <span className="text-foreground font-semibold">Ghi chú: </span>
                {po.note}
              </div>
            )}
          </Card>

          {/* Bảng danh mục vật tư */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/20 border-b py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <PackageSearch className="text-primary size-4" />
                  Danh mục vật tư đặt hàng ({lines.length} dòng)
                </CardTitle>
                {canEdit && po.status === 'draft' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/planning/pos/${po.id}/edit`}>
                      <Pencil className="size-3.5" /> Chỉnh sửa vật tư
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table className="min-w-[720px]">
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center text-xs font-semibold tracking-wider uppercase">
                      #
                    </TableHead>
                    <TableHead className="text-xs font-semibold tracking-wider uppercase">
                      Vật tư
                    </TableHead>
                    <TableHead className="w-36 text-xs font-semibold tracking-wider uppercase">
                      Quy cách
                    </TableHead>
                    <TableHead className="w-28 text-right text-xs font-semibold tracking-wider uppercase">
                      SL đặt
                    </TableHead>
                    {showReceived && (
                      <TableHead className="w-48 text-right text-xs font-semibold tracking-wider uppercase">
                        Về kho
                      </TableHead>
                    )}
                    <TableHead className="w-32 text-right text-xs font-semibold tracking-wider uppercase">
                      Đơn giá
                    </TableHead>
                    <TableHead className="w-36 text-right text-xs font-semibold tracking-wider uppercase">
                      Thành tiền
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => {
                    const st = receivedById.get(l.id)
                    const pct =
                      st && st.qty_ordered > 0
                        ? Math.min((st.qty_received ?? 0) / st.qty_ordered, 1) * 100
                        : 0

                    return (
                      <TableRow key={l.id} className="align-top">
                        <TableCell className="text-muted-foreground text-center font-mono text-xs">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              {l.material_code && <DocChip>{l.material_code}</DocChip>}
                            </div>
                            <div className="text-foreground text-sm font-medium">
                              {l.material_name}
                            </div>
                            {(l.qty2 != null || l.note) && (
                              <div className="text-muted-foreground text-xs">
                                {l.qty2 != null && `${money(l.qty2)} ${l.unit2 ?? ''}`}
                                {l.qty2 != null && l.note && ' · '}
                                {l.note}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {l.spec ?? '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <span className="font-mono text-sm font-semibold">
                            {money(l.qty_ordered)}
                          </span>
                          <span className="text-muted-foreground ml-1 text-xs">
                            {l.material_unit}
                          </span>
                        </TableCell>

                        {showReceived && (
                          <TableCell className="text-right">
                            {l.material_id == null ? (
                              <span
                                className="text-muted-foreground text-xs"
                                title="Nghiệm thu ngoài sổ kho"
                              >
                                Ngoài sổ kho
                              </span>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-mono text-xs whitespace-nowrap">
                                  <span
                                    className={`font-semibold ${
                                      st && st.qty_missing <= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : ''
                                    }`}
                                  >
                                    {money(st?.qty_received ?? 0)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    /{money(l.qty_ordered)}
                                  </span>
                                </span>
                                <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor:
                                        pct >= 100
                                          ? 'var(--done, #10b981)'
                                          : 'var(--warn, #f59e0b)',
                                    }}
                                  />
                                </div>
                                {st?.closed_short_at ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <Badge tone="gray" className="text-[10px]">
                                      Chốt thiếu {money(st.qty_missing)}
                                    </Badge>
                                    {canEdit && po.status !== 'cancelled' && (
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground text-[11px] underline"
                                        onClick={() => void act.reopenShort(po, st.id)}
                                      >
                                        Mở lại
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  st &&
                                  st.qty_missing > 0 && (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className="font-mono text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                        Thiếu {money(st.qty_missing)}
                                      </span>
                                      {canEdit && canCloseShort && st.qty_open > 0 && (
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-foreground text-[11px] underline"
                                          onClick={() =>
                                            setReasoning({
                                              po,
                                              kind: 'close_short',
                                              reason: '',
                                              lineId: st.id,
                                              detail: `${st.material_name} — thiếu ${money(st.qty_missing)} ${st.material_unit}`,
                                            })
                                          }
                                        >
                                          Chốt thiếu
                                        </button>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </TableCell>
                        )}

                        <TableCell className="text-right whitespace-nowrap">
                          {l.unit_price != null ? (
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm">
                                {cash(l.unit_price)}
                              </span>
                              {l.price_basis === 'unit2' && l.unit2 && (
                                <span className="text-muted-foreground text-[11px]">
                                  /{l.unit2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              Chưa có giá
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-right whitespace-nowrap">
                          <span className="font-mono text-sm font-semibold">
                            {l.unit_price != null
                              ? cash(roundMoney(poLineAmount(l), po.currency))
                              : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Chân bảng: Tổng số lượng & Tổng thanh toán */}
              <div className="bg-muted/10 grid gap-4 border-t p-5 sm:grid-cols-[1fr_auto]">
                <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                  <span className="text-foreground font-semibold tracking-wider uppercase">
                    Tổng số lượng theo đơn vị:
                  </span>
                  {qtyTotals(
                    lines.some((l) => l.price_basis === 'unit2' && l.unit2),
                    lines,
                  ).map((t) => (
                    <div key={t.label} className="flex items-center gap-2">
                      <span>{t.label}:</span>
                      <span className="text-foreground font-mono font-medium">
                        {money(t.value)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex min-w-[280px] flex-col gap-2 text-sm">
                  <div className="text-muted-foreground flex justify-between gap-6">
                    <span>Tiền hàng</span>
                    <span className="text-foreground font-mono font-medium">
                      {cash(m.subtotal)}
                    </span>
                  </div>

                  {m.discountAmount > 0 && (
                    <div className="flex justify-between gap-6 text-emerald-600 dark:text-emerald-400">
                      <span>Chiết khấu</span>
                      <span className="font-mono font-medium">
                        − {cash(m.discountAmount)}
                      </span>
                    </div>
                  )}

                  {po.vat_rate != null && (
                    <div className="text-muted-foreground flex justify-between gap-6">
                      <span>
                        VAT ({po.vat_rate}%)
                        <span className="ml-1 text-[11px]">
                          {po.price_includes_vat ? '(đã gồm)' : '(chưa gồm)'}
                        </span>
                      </span>
                      <span className="text-foreground font-mono font-medium">
                        {cash(m.vatAmount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-baseline justify-between gap-6 border-t pt-2.5">
                    <span className="text-foreground text-xs font-bold tracking-wider uppercase">
                      Tổng thanh toán
                    </span>
                    <div className="text-right">
                      <span className="text-primary font-mono text-xl font-bold">
                        {cash(m.grandTotal)}
                      </span>
                      <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                        {po.currency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: KẾ HOẠCH GIAO & ĐỢT HÀNG ────────────────────────────── */}
        <TabsContent value="shipments" className="flex flex-col gap-5">
          {po.status !== 'cancelled' ? (
            <PoShipmentsCard
              shipments={shipments}
              linesById={shipmentLinesById}
              currency={po.currency ?? 'VND'}
              receivedByLine={
                new Map(statusLines.map((s) => [s.id, s.qty_received ?? 0]))
              }
              linkedReceipts={
                new Map(
                  Object.entries(shipmentReceipts).map(([sid, per]) => [
                    sid,
                    new Map(Object.entries(per)),
                  ]),
                )
              }
              confirmedNote={po.confirmed_note}
              canEdit={canEdit}
              canAddMore={
                shipmentLines.length > 0 &&
                ['confirmed', 'in_transit', 'partial'].includes(po.status)
              }
              emptyHint={
                po.status === 'draft'
                  ? 'Chia đợt ngay trong màn “Sửa đơn” — tab Chia đợt giao; lịch đó in lên phiếu gửi NCC.'
                  : po.status === 'pending_approval'
                    ? 'Đơn đang chờ duyệt nên khoá sửa — bấm “Thu hồi về nháp” rồi chia đợt trong màn Sửa đơn.'
                    : po.status === 'approved'
                      ? 'Đơn đã duyệt nên khoá sửa. Lịch giao sẽ ghi ở bước “NCC xác nhận” sau khi gửi đơn.'
                      : po.status === 'ordered'
                        ? 'Bấm “NCC đã xác nhận” ở thanh công cụ để ghi lịch NCC hẹn — mỗi dòng tách được nhiều đợt.'
                        : shipmentLines.length === 0
                          ? 'Đơn toàn dòng tự gõ (không gắn vật tư kho) nên không chia đợt được.'
                          : null
              }
              busy={act.busy}
              today={today}
              onArrived={(id) =>
                void act.shipmentAction(id, { action: 'arrived' }, 'Đã ghi nhận xe tới')
              }
              onReschedule={(id, date, reason) =>
                act.shipmentAction(
                  id,
                  { action: 'reschedule', expected_date: date, reason },
                  'Đã dời ngày đợt giao',
                )
              }
              onCancel={(id, reason) =>
                act.shipmentAction(id, { action: 'cancel', reason }, 'Đã huỷ đợt giao')
              }
              onAdd={() => setConfirming('add')}
            />
          ) : (
            <EmptyState
              icon={<Ban className="text-destructive size-6" />}
              title="Đơn hàng đã huỷ"
              description="Kế hoạch giao nhận và chứng từ kho không còn áp dụng cho đơn này."
            />
          )}

          {warehouseDocs.length > 0 && (
            <Card>
              <CardHeader className="bg-muted/20 border-b py-3.5">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="text-primary size-4" />
                  Chứng từ kho liên quan ({warehouseDocs.length} phiếu)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold uppercase">
                        Mã chứng từ
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase">
                        Loại nghiệp vụ
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase">
                        Tổng số lượng
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase">
                        Thời gian ghi nhận
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouseDocs.map((doc) => (
                      <TableRow key={doc.doc_id}>
                        <TableCell className="font-mono text-sm font-medium">
                          <DocChip>{doc.code}</DocChip>
                        </TableCell>
                        <TableCell>
                          <Badge tone={doc.kind === 'receipt' ? 'green' : 'red'}>
                            {doc.kind === 'receipt'
                              ? 'Phiếu nhập kho (PNK)'
                              : 'Phiếu xuất trả NCC'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {money(doc.qty_total)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right font-mono text-xs">
                          {stamp(doc.at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB 3: ĐIỀU KHOẢN & HỢP ĐỒNG ─────────────────────────────────── */}
        <TabsContent value="terms" className="flex flex-col gap-5">
          <Card>
            <CardHeader className="bg-muted/20 border-b py-3.5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ScrollText className="text-primary size-4" />
                  Điều khoản hợp đồng & Cam kết
                </CardTitle>
                {canEdit && po.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTerms(true)}
                  >
                    <Pencil className="size-3.5" /> Sửa điều khoản
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-2xs">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Điều 1 · Tiêu chuẩn chất lượng
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_quality || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
                </div>

                <div className="bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-2xs">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Điều 2 · Địa điểm giao hàng
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_delivery_place || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
                </div>

                <div className="bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-2xs">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Điều 3 · Điều kiện thanh toán
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_payment || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
                </div>

                <div className="bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-2xs">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Điều 4 · Hoá đơn & Chứng từ
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_invoice || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
                </div>

                <div className="bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-2xs">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Điều 5 · Thời hạn giao hàng
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_lead_time || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
                </div>

                <div className="bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-2xs">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Đại diện ký đơn (Chức danh)
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {po.signer_role || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {(po.terms || po.note) && (
                <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-4 text-sm">
                  {po.terms && (
                    <div>
                      <span className="text-foreground font-semibold">
                        Điều khoản bổ sung:{' '}
                      </span>
                      <span className="text-muted-foreground leading-relaxed">
                        {po.terms}
                      </span>
                    </div>
                  )}
                  {po.note && (
                    <div>
                      <span className="text-foreground font-semibold">
                        Ghi chú chung:{' '}
                      </span>
                      <span className="text-muted-foreground leading-relaxed">
                        {po.note}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: DÒNG THỜI GIAN & LỊCH SỬ DUYỆT ─────────────────────────── */}
        <TabsContent value="timeline" className="flex flex-col gap-5">
          <Card>
            <CardHeader className="bg-muted/20 border-b py-3.5">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <History className="text-primary size-4" />
                Dòng thời gian & Nhật ký xử lý ({marks.length} mốc sự kiện)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {marks.length === 0 ? (
                <EmptyState
                  icon={<History className="text-muted-foreground size-6" />}
                  title="Chưa có mốc nhật ký"
                  description="Phiếu còn nằm ở người soạn hoặc chưa phát sinh sự kiện nào."
                />
              ) : (
                <div className="border-border relative ml-3 space-y-6 border-l-2 pl-6">
                  {marks.map((mk) => (
                    <div key={mk.key} className="group relative">
                      <div
                        className={`border-background absolute top-1 -left-[31px] size-3.5 rounded-full border-2 ring-4 ${
                          mk.tone === 'green'
                            ? 'bg-emerald-500 ring-emerald-500/15'
                            : mk.tone === 'blue'
                              ? 'bg-primary ring-primary/15'
                              : mk.tone === 'amber'
                                ? 'bg-amber-500 ring-amber-500/15'
                                : mk.tone === 'red'
                                  ? 'bg-rose-500 ring-rose-500/15'
                                  : 'bg-muted-foreground ring-muted/20'
                        }`}
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-foreground text-sm font-semibold">
                          {mk.label}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {stamp(mk.at)}
                        </span>
                      </div>
                      {(mk.actor || mk.detail) && (
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                          {mk.actor && (
                            <span className="text-foreground font-medium">
                              {mk.actor}
                            </span>
                          )}
                          {mk.actor && mk.detail && ' · '}
                          {mk.detail && <span>{mk.detail}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 5: TÀI LIỆU ĐÍNH KÈM ─────────────────────────────────────── */}
        <TabsContent value="docs" className="flex flex-col gap-5">
          <Card>
            <CardHeader className="bg-muted/20 border-b py-3.5">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="text-primary size-4" />
                Hồ sơ & Tài liệu đính kèm
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <DocumentFiles
                kind="purchase_order"
                id={po.id}
                canEdit={isSupply || canApprove}
                title="Báo giá NCC · Hợp đồng mua bán · Chứng từ giao nhận"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <PoTermsDialog
        open={editingTerms}
        po={po}
        busy={act.busy}
        onClose={() => setEditingTerms(false)}
        onSaved={() => {
          setEditingTerms(false)
          router.refresh()
        }}
      />

      <PoConfirmDialog
        open={confirming !== null}
        mode={confirming ?? 'confirm'}
        poCode={po.code}
        defaultDate={po.expected_at?.slice(0, 10) ?? today}
        lines={shipmentLines}
        existing={confirming === 'add' ? shippedByLine : new Map()}
        busy={act.busy}
        onClose={() => setConfirming(null)}
        onSubmit={async (ships, note) =>
          confirming === 'add'
            ? act.addShipments(po, ships)
            : act.confirmSupplier(po, { confirmed_note: note || null, shipments: ships })
        }
      />

      <PoDialogs
        rescheduling={rescheduling}
        onRescheduleChange={setRescheduling}
        onRescheduleSubmit={async (s) => {
          if (await act.reschedule(s.po, s.date, s.reason)) setRescheduling(null)
        }}
        reassigning={reassigning}
        onReassignChange={setReassigning}
        onReassignSubmit={async (s) => {
          const name = staff.find((x) => x.id === s.toId)?.name
          if (await act.reassign(s.po, s.toId, name)) setReassigning(null)
        }}
        staff={staff}
        busy={act.busy}
        currentExpected={po.expected_at}
      />

      <ReasonDialog
        state={reasoning}
        onChange={setReasoning}
        onSubmit={async (st) => {
          const ok =
            st.kind === 'reject'
              ? await act.reject(st.po, st.reason)
              : st.kind === 'close_short'
                ? await act.closeShort(st.po, st.reason, st.lineId)
                : await act.cancelPo(st.po, st.reason)
          if (ok) setReasoning(null)
        }}
        busy={act.busy}
      />
    </div>
  )
}

function PoTermsDialog({
  open,
  po,
  busy,
  onClose,
  onSaved,
}: {
  open: boolean
  po: PoDetailPo
  busy: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    contract_no: '',
    terms_quality: '',
    terms_delivery_place: '',
    terms_payment: '',
    terms_invoice: '',
    terms_lead_time: '',
    signer_role: '',
    note: '',
  })
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm({
        contract_no: po.contract_no ?? '',
        terms_quality: po.terms_quality ?? '',
        terms_delivery_place: po.terms_delivery_place ?? '',
        terms_payment: po.terms_payment ?? '',
        terms_invoice: po.terms_invoice ?? '',
        terms_lead_time: po.terms_lead_time ?? '',
        signer_role: po.signer_role ?? '',
        note: po.note ?? '',
      })
    }
  }

  const field =
    'border-input focus:border-ring h-9 w-full rounded-md border px-3 text-sm outline-none bg-background'
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const FIELDS: [keyof typeof form, string][] = [
    ['contract_no', 'Theo HĐ số'],
    ['terms_quality', 'Chất lượng'],
    ['terms_delivery_place', 'Nơi giao hàng'],
    ['terms_payment', 'Thanh toán'],
    ['terms_invoice', 'Hoá đơn'],
    ['terms_lead_time', 'Thời gian giao'],
    ['signer_role', 'Người ký (chức danh)'],
  ]

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await api(`/api/dept/supply/pos/${po.id}/terms`, {
        method: 'PATCH',
        body: Object.fromEntries(
          Object.entries(form).map(([k, v]) => [k, v.trim() || null]),
        ),
      })
      toast.success('Đã lưu điều khoản', 'Phiếu in và hồ sơ dùng bản vừa sửa')
      onSaved()
    } catch (e) {
      toast.error('Lưu điều khoản thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Sửa điều khoản — ${po.code}`}
      maxWidth="sm:max-w-xl"
    >
      <div className="flex flex-col gap-3.5 text-sm">
        <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-xs">
          Chỉ sửa đổi thông tin điều khoản và ghi chú. Muốn thay đổi danh sách mặt hàng,
          số lượng hoặc đơn giá vui lòng rút đơn về nháp để chỉnh sửa.
        </p>
        {FIELDS.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <input value={form[k]} onChange={set(k)} className={field} />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">Ghi chú chung</span>
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="border-input focus:border-ring bg-background w-full rounded-md border px-3 py-1.5 text-sm outline-none"
          />
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Huỷ
          </Button>
          <Button size="sm" disabled={saving || busy} onClick={() => void save()}>
            {saving && <Spinner size={14} />}
            Lưu điều khoản
          </Button>
        </div>
      </div>
    </Modal>
  )
}
