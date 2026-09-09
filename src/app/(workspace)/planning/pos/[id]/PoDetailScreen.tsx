'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PoNotesPanel } from './PoNotesPanel'
import Link from 'next/link'
import {
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  FileText,
  History,
  Package,
  PackageCheck,
  PackageSearch,
  Paperclip,
  Pencil,
  ScrollText,
  SendHorizontal,
  Truck,
} from 'lucide-react'
import {
  Action,
  ActionGroup,
  ActionPane,
  Checks,
  Crumb,
  DocBody,
  DocHead,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridBtn,
  GridCheck,
  GridFoot,
  GridHead,
  GridRow,
  GridSep,
  GridToolbar,
  LineStatus,
  Td,
  Th,
  HolderBar,
  StatusBar,
  StatusTrack,
  daysHeld,
  poHolder,
  type Check as KitCheck,
} from '@/components/kit'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { DocumentFiles } from '@/components/DocumentFiles'
import { type ChainNode } from '@/components/erp/RefChain'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import { fmtMoney, poLineAmount, poMoney, qtyTotals, roundMoney } from '@/lib/po-line'
import { canReschedule } from '@/lib/po-reschedule'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { PO_STATUS_LABEL, PO_STATUS_TONE, type PoStatus } from '@/lib/po-status'
import type { ApprovalEvent } from '@/modules/core/approvals/approvals.repo'
import {
  PoDialogs,
  ReasonDialog,
  type ReassignState,
  type ReasonState,
  type RescheduleState,
} from '../PoDialogs'
import { usePoActions } from '../usePoActions'
import type { Supplier } from '@/modules/dept/supply/supply.repo'
import type { SupplierFacts } from '@/modules/dept/supply/supplier-facts.repo'
import { PoConfirmDialog, PoShipmentsCard, type ShipmentView } from './PoShipmentsPanel'
import { PoReceiptMatrix } from './PoReceiptMatrix'
import type { ReceiptBatch } from '@/modules/dept/supply/po-receipts.service'
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

/** Sáu bước của TRỤC ĐƠN. Nhận hàng là trục riêng — xem ghi chú ở docStepAt. */
const DOC_STEPS = ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã gửi NCC', 'NCC xác nhận', 'Đang về']

/** Trạng thái NHẬN HÀNG của một dòng — khác trạng thái của cả chứng từ. */
type LineKind = 'idle' | 'part' | 'done' | 'short'
const LINE_STATUS_TEXT: Record<LineKind, string> = {
  idle: 'Chưa nhận',
  part: 'Một phần',
  done: 'Đủ',
  short: 'Đóng thiếu',
}
function lineStatusOf(s?: { qty_received: number; qty_ordered: number; closed_short_at: string | null }): LineKind {
  if (!s) return 'idle'
  // Đóng thiếu xét TRƯỚC "đủ": dòng chốt thiếu vẫn có thể nhận gần đủ, nhưng
  // điều người đọc cần biết là nó đã KHÉP, không phải nó gần đủ.
  if (s.closed_short_at) return 'short'
  if (s.qty_received >= s.qty_ordered && s.qty_ordered > 0) return 'done'
  return s.qty_received > 0 ? 'part' : 'idle'
}

/**
 * Cắt ngắn cho dòng tóm tắt FastTab.
 *
 * Điều khoản thanh toán trên đơn thật là cả một đoạn; dòng tóm tắt cần một
 * giá trị liếc là thấy. Cắt ở đây (nguồn) chứ không chỉ dựa vào CSS ở kit:
 * CSS cắt bằng dấu ba chấm nên vẫn kéo cả đoạn vào DOM, còn màn hình hẹp thì
 * ba chấm rơi ngay sau chữ đầu tiên.
 */
const short = (v: string | null | undefined, max = 28) =>
  !v ? '—' : v.length <= max ? v : v.slice(0, max - 1).trimEnd() + '…'
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
  stock,
  position,
  supplier,
  facts,
  statusLines,
  shipmentReceipts,
  receiptBatches,
  extraLsx,
  shipments,
  history,
  warehouseDocs,
  canEdit,
  isSupply,
  canApprove,
  canReassign,
  staff,
  me,
}: {
  po: PoDetailPo
  lines: PoLine[]
  /** Tồn kho hiện tại theo material_id — xem ghi chú ở page.tsx. */
  stock: Record<string, number>
  /** Vị trí đơn trong danh sách, cho điều hướng ‹n / tổng›. */
  position: { index: number; total: number } | null
  /** Hồ sơ NCC — cho FactBox và các trường pháp lý. */
  supplier: Supplier | null
  /** Lịch sử mua với NCC này. */
  facts: SupplierFacts | null
  statusLines: StatusLine[]
  shipmentReceipts: Record<string, Record<string, number>>
  /** Đợt về theo phiếu nhập — ma trận dòng × đợt (B3). */
  receiptBatches: ReceiptBatch[]
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
  /** Người đang xem — cho khối trao đổi biết ghi chú nào là của mình. */
  me: { id: string; name: string }
}) {
  const router = useRouter()
  const act = usePoActions({ onDone: () => router.refresh() })
  const [rescheduling, setRescheduling] = useState<RescheduleState | null>(null)
  const [reassigning, setReassigning] = useState<ReassignState | null>(null)
  const [reasoning, setReasoning] = useState<ReasonState | null>(null)
  const [confirming, setConfirming] = useState<'confirm' | 'add' | null>(null)
  const [editingTerms, setEditingTerms] = useState(false)
  const [copied, setCopied] = useState(false)
  /* Dòng đang chọn trong lưới. Chỉ giữ vì nó DẪN tới một hành động thật
     (chốt phần thiếu cho đúng dòng), không phải để trang trí. */
  const [sel, setSel] = useState<string[]>([])
  const toggleLine = (id: string) =>
    setSel((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

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
    /*
      MỐC GỐC — "ai soạn đơn, lúc nào".

      Bảng `history` chỉ ghi các lần ĐỔI TRẠNG THÁI, nên đơn còn ở nháp trả
      về rỗng và cả dòng thời gian hiện "0 mốc" (đo trên PO-2026-0065,
      09/09/2026) — rồi empty state đổ lỗi "chưa phát sinh sự kiện nào".
      Nhưng một chứng từ tồn tại thì ít nhất đã có người tạo ra nó: mốc đó
      nằm sẵn ở `created_at`, chỉ là chưa ai đưa vào.
    */
    ...(po.created_at
      ? [
          {
            key: 'created',
            at: po.created_at,
            label: 'Soạn đơn',
            tone: 'blue' as const,
            actor: po.assignee_name,
          },
        ]
      : []),
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

  /*
    BƯỚC TRÊN HAI TRỤC TRẠNG THÁI.

    Trục "đơn" dừng ở 'Đang về' — 'partial' và 'received' KHÔNG phải bước của
    trục này mà của trục nhận hàng. Nhồi cả bảy vào một thanh là đúng cái lỗi
    mà Dynamics tách ba trục để tránh: đơn về một phần trong khi vẫn đang chờ
    NCC xác nhận lại giá thì một thanh không vẽ nổi.

    'cancelled' cố ý trả 0: đơn huỷ không đứng ở bước nào cả, và tô sáng một
    bước bất kỳ sẽ nói dối rằng nó còn đang chạy.
  */
  const docStepAt =
    ({
      draft: 0,
      pending_approval: 1,
      approved: 2,
      ordered: 3,
      confirmed: 4,
      in_transit: 5,
      partial: 5,
      received: 5,
      cancelled: 0,
    } as Record<string, number>)[po.status] ?? 0
  const recvStepAt = po.status === 'received' ? 2 : po.status === 'partial' ? 1 : 0

  // AI ĐANG GIỮ — dùng chung lõi với màn danh sách và màn "Chờ tôi xử lý".
  // Tính riêng ở đây thì ba chỗ sẽ lệch nhau, và đó đúng là thứ làm người dùng
  // hết tin hệ thống.
  const holder = poHolder(po, me.id)
  const heldDays = daysHeld(holder.since)

  /*
    BẢNG KIỂM TRƯỚC KHI GỬI DUYỆT.

    Chỉ dựng khi đơn còn ở tay Cung ứng — đơn đã duyệt rồi thì mấy điều này
    không còn là việc của người đang xem, và một dải đỏ vô nghĩa trên đầu màn
    làm người ta quen bỏ qua cảnh báo.
  */
  // Số dòng chưa có giá — hiện trên dòng tiêu đề FastTab để gấp rồi vẫn thấy.
  const noPriceCount = lines.filter((l) => l.unit_price == null || l.unit_price <= 0).length

  const checks: KitCheck[] = []
  if (['draft', 'pending_approval'].includes(po.status)) {
    const noPrice = lines.filter((l) => l.unit_price == null || l.unit_price <= 0)
    if (noPrice.length > 0) {
      checks.push({
        level: 'stop',
        what:
          noPrice.length === 1
            ? `Dòng "${noPrice[0].material_name ?? ''}" chưa có đơn giá`
            : `${noPrice.length} dòng chưa có đơn giá`,
        fix: 'Nhập giá, hoặc tách dòng đó sang đơn khác',
      })
    }
    if (lines.length === 0) {
      checks.push({ level: 'stop', what: 'Đơn chưa có dòng hàng nào', fix: 'Thêm ít nhất một dòng' })
    }
    if (!po.production_order_id && !po.lsx_code) {
      checks.push({
        level: 'warn',
        what: 'Đơn chưa gắn với lệnh sản xuất nào',
        fix: 'Gắn lệnh để Giám đốc biết chi tiền cho việc gì',
      })
    }
    if (!po.expected_at) {
      checks.push({ level: 'warn', what: 'Chưa có hạn giao', fix: 'Đặt hạn để hệ thống canh trễ' })
    } else if (late === 'overdue') {
      checks.push({
        level: 'warn',
        what: `Hạn giao ${day(po.expected_at)} đã qua`,
        fix: 'Cập nhật hạn hoặc ghi lý do trễ',
      })
    }
  }
  const blockers = checks.filter((c) => c.level === 'stop')

  /* Tổng tiền CHỈ cộng dòng đã có giá. Cộng cả dòng trống giá thì con số ra
     nhỏ hơn thực tế mà không dấu hiệu gì — đúng loại "số nói dối" đã vá ở
     chỗ tiền hai loại tiền tệ. Dòng thiếu giá được đếm riêng (noPriceCount)
     và nói ra ngay dưới bảng. */
  const totalAmount = lines.reduce((acc, l) => {
    if (l.unit_price == null) return acc
    const qty = l.price_basis === 'unit2' ? (l.qty2 ?? 0) : l.qty_ordered
    return acc + qty * l.unit_price
  }, 0)

  /*
    TỜ CHỨNG TỪ LIỀN MẠCH, TRÀN SÁT MÉP.

    Khác biệt CẤU TRÚC giữa màn này và mẫu ở /design-lab/mau-erp — và là thứ
    làm nó vẫn "trông như thiết kế cũ" dù từng khối đã đúng:

    · `gap-5` đẩy mỗi khối cách nhau 20px trên nền xám, mắt đọc thành BẢY CÁI
      THẺ xếp chồng — đúng ngôn ngữ web. ERP là MỘT tờ chứng từ: các phần ngăn
      nhau bằng vạch kẻ của chính chúng (mỗi khối đã có border-bottom sẵn),
      không bằng khoảng trống.
    · `-m-6` khử đúng 24px padding của <main> để tờ chứng từ tràn sát mép như
      mẫu. Chứng từ ERP dùng hết bề ngang; bảng 12 cột không có chỗ cho hai
      dải lề 24px.

    BẪY đã dính hai lần trong phiên: chú thích JSX đặt TRƯỚC phần tử gốc bên
    trong `return (…)` làm hai con — phải viết bằng chú thích JS ở đây.
  */
  return (
    <div className="theme-v3 kit text-foreground -m-6 flex flex-col">
      <TopProgressBar active={act.busy} />

      <Crumb
        path={['Cung ứng', 'Đơn đặt vật tư', po.code]}
        position={position ? [position.index, position.total] : undefined}
      />

      {/*
        THANH HÀNH ĐỘNG CÓ TAB — Dynamics 365 F&O.

        Ba tab, và cả ba đều CÓ NÚT THẬT. Mẫu ở /design-lab/mau-erp vẽ bốn tab
        nhưng ở đây "Tài chính" chưa có phân hệ nên sẽ rỗng — bày một tab rỗng
        là nói dối rằng có chức năng.

        Nút KHÔNG bị ẩn khi chưa dùng được: hiện mờ kèm `title` nói lý do. Ẩn
        đi thì người dùng không học được là nó tồn tại, và mỗi lần đổi trạng
        thái thanh công cụ lại nhảy chỗ — thứ phá đúng cái trí nhớ vị trí mà
        Action Pane sinh ra để nuôi.
      */}
      {/*
        THANH HÀNH ĐỘNG — Dynamics 365 F&O.

        BÀY ĐỦ NĂM NHÓM CÙNG LÚC. Bản trước tôi cho tab LỌC nhóm, kết quả là
        ẩn mất 9/16 nút — hỏng đúng thứ Action Pane sinh ra để làm: người dùng
        mở màn này vài chục lần mỗi ngày và bấm bằng trí nhớ vị trí, mà vị trí
        chỉ có nghĩa khi nút luôn ở đó.

        Nút chưa dùng được thì HIỆN MỜ kèm `title` nói lý do, không ẩn — ẩn thì
        thanh công cụ nhảy chỗ mỗi lần đổi trạng thái.
      */}
      <ActionPane
        tabs={[
          { label: 'Đơn hàng', active: true },
          {
            label: 'Nhận hàng',
            disabled: true,
            title:
              'Ghi nhận nhập kho làm ở phân hệ Kho — thao tác nhận hàng của đơn nằm ở nhóm "Nhận hàng" bên dưới',
          },
          { label: 'Tài chính', disabled: true, title: 'Phân hệ Kế toán chưa mở' },
          { label: 'Hiển thị', disabled: true, title: 'Tuỳ biến cột và khung nhìn chưa mở' },
        ]}
      >
        <ActionGroup label="Duy trì">
          <Action
            strong
            disabled={!canEdit || po.status !== 'draft'}
            title={po.status !== 'draft' ? 'Chỉ sửa được khi đơn còn ở bước Nháp' : undefined}
            onClick={() => router.push(`/planning/pos/${po.id}/edit`)}
          >
            Sửa đơn
          </Action>
          <Action disabled={!isSupply} onClick={() => router.push('/planning/pos/new')}>
            Mới
          </Action>
          <Action
            disabled={!isSupply}
            onClick={() => router.push(`/planning/pos/${po.id}/edit?duplicate=1`)}
          >
            {po.status === 'cancelled' ? 'Tạo lại từ đơn' : 'Nhân bản đơn'}
          </Action>
          <Action
            disabled={!canEdit || po.status !== 'draft'}
            title={po.status !== 'draft' ? 'Chỉ xoá được đơn còn ở bước Nháp' : undefined}
            onClick={() => void removeDraft()}
          >
            Xoá nháp
          </Action>
        </ActionGroup>

        <ActionGroup label="Luồng phê duyệt">
          {primary && (
            <Action
              primary
              onClick={primary.onClick}
              disabled={act.busy || blockers.length > 0}
              title={
                blockers.length > 0
                  ? `Còn ${blockers.length} lỗi chặn — xem bảng kiểm phía trên`
                  : undefined
              }
            >
              {primary.label}
            </Action>
          )}
          <Action
            disabled={!canEdit || !canReschedule(po.status).ok}
            title={
              canReschedule(po.status).ok
                ? undefined
                : 'Chỉ đổi hẹn được khi đơn đã gửi nhà cung cấp'
            }
            onClick={() =>
              setRescheduling({ po, date: po.expected_at?.slice(0, 10) ?? '', reason: '' })
            }
          >
            Đổi hẹn giao
          </Action>
          <Action
            disabled={!canReassign || ['received', 'cancelled'].includes(po.status)}
            onClick={() => setReassigning({ po, toId: '' })}
          >
            Bàn giao phụ trách
          </Action>
          <Action
            disabled={!canEdit || ['draft', 'received', 'cancelled'].includes(po.status)}
            title={po.status === 'draft' ? 'Đơn nháp thì xoá, không cần huỷ' : undefined}
            onClick={() => setReasoning({ po, kind: 'cancel', reason: '' })}
          >
            Huỷ đơn
          </Action>
        </ActionGroup>

        <ActionGroup label="Nhận hàng">
          <Action
            disabled={!canAcceptByHand}
            title={
              canAcceptByHand
                ? undefined
                : 'Chỉ dùng cho đơn có dòng ngoài sổ kho, khi đã gửi NCC'
            }
            onClick={() => setConfirming('add')}
          >
            Nghiệm thu ngoài sổ
          </Action>
          <Action
            disabled={!canEdit || openStockLines.length === 0}
            title={openStockLines.length === 0 ? 'Không còn dòng nào đang chờ về' : undefined}
            onClick={() =>
              setReasoning({
                po,
                kind: 'close_short',
                reason: '',
                lineId: null,
                detail: `${openStockLines.length} dòng còn thiếu sẽ được chốt`,
              })
            }
          >
            Chốt phần thiếu
          </Action>
        </ActionGroup>

        <ActionGroup label="In &amp; xuất">
          <Action onClick={() => window.open(`/print/supply/${po.id}`, '_blank')}>
            Phiếu đặt hàng
          </Action>
          <Action onClick={() => window.open(`/api/dept/supply/pos/${po.id}/export`, '_blank')}>
            Xuất Excel
          </Action>
        </ActionGroup>

        <ActionGroup label="Chứng từ liên quan">
          {chain.filter((n) => !n.current && n.href).length === 0 ? (
            <Action disabled title="Đơn này chưa gắn với chứng từ nào">
              Chưa có
            </Action>
          ) : (
            chain
              .filter((n) => !n.current && n.href)
              .map((n) => (
                <Action key={n.href} onClick={() => router.push(n.href!)}>
                  {n.label}
                </Action>
              ))
          )}
        </ActionGroup>
      </ActionPane>

      <DocHead
        kind="Đơn đặt vật tư"
        code={po.code}
        sub={
          <>
            {po.supplier_name ?? 'Chưa chọn nhà cung cấp'}
            {po.assignee_name ? ` · phụ trách ${po.assignee_name}` : ''}
            {po.created_at ? ` · lập ${day(po.created_at)}` : ''}
          </>
        }
      >
        <StatusTrack label="Trạng thái đơn" steps={DOC_STEPS} at={docStepAt} />
        <StatusTrack
          label="Nhận hàng"
          steps={['Chưa nhận', 'Một phần', 'Đủ']}
          at={recvStepAt}
        />
        <StatusTrack label="Thanh toán" steps={['Chưa', 'Một phần', 'Xong']} at={0} />
      </DocHead>

      <HolderBar
        mine={holder.mine}
        who={holder.who}
        what={holder.what}
        age={heldDays == null ? undefined : `${heldDays} ngày`}
      />

      {!canEdit && !canApprove && (
        <HolderBar who="Chế độ chỉ đọc" what="Bạn đang xem đơn của nhân sự khác" />
      )}

      <Checks title="Chưa gửi duyệt được" items={checks} />

      <DocBody
        aside={
          <FactBox>
            <FactSection title="Nhà cung cấp">
              <div className="k-strong">{po.supplier_name ?? 'Chưa chọn'}</div>
              <FactKv
                rows={[
                  [
                    'Giao đúng hẹn',
                    facts?.onTime ? (
                      <span key="ot" className="num">
                        {facts.onTime.hit} / {facts.onTime.of} đơn
                      </span>
                    ) : (
                      // KHÔNG hiện "0/0" hay "100%": chưa đơn nào của NCC này
                      // được nhận đủ nên chưa có mẫu để tính. Cả hai cách hiện
                      // kia đều là nói dối, theo hai hướng ngược nhau.
                      <span key="ot" className="k-t-warn">chưa có lịch sử</span>
                    ),
                  ],
                  ['Đã đặt', <span key="n" className="num">{facts?.orders ?? 0} đơn</span>],
                  ['Đã nhận đủ', <span key="r" className="num">{facts?.received ?? 0} đơn</span>],
                  [
                    'Mua gần nhất',
                    <span key="l" className="num">
                      {facts?.lastOrderAt ? day(facts.lastOrderAt) : '—'}
                    </span>,
                  ],
                  ['Mã NCC', <span key="c" className="num">{supplier?.code ?? '—'}</span>],
                  ['Mã số thuế', <span key="t" className="num">{supplier?.tax_no ?? '—'}</span>],
                ]}
              />
            </FactSection>

            <FactSection title="Chứng từ liên quan">
              {chain.filter((n) => !n.current).length === 0 ? (
                <div className="k-t-warn">Chưa gắn chứng từ nào</div>
              ) : (
                <FactKv
                  rows={chain
                    .filter((n) => !n.current)
                    .map((n) => [
                      <span key={n.label} className="num">
                        {n.label}
                      </span>,
                      '',
                    ])}
                />
              )}
            </FactSection>

            <FactSection title="Người theo dõi">
              <FactKv
                rows={[
                  [po.assignee_name ?? me.name, 'phụ trách'],
                  ...history
                    .filter((h) => h.action === 'approved' && h.actor_name)
                    .slice(0, 1)
                    .map((h) => [h.actor_name as string, 'đã duyệt'] as [string, string]),
                ]}
              />
            </FactSection>

            <FactSection title="Chứng từ kho">
              {warehouseDocs.length === 0 ? (
                <div className="k-t-warn">Chưa có phiếu nhập nào</div>
              ) : (
                <FactKv
                  rows={warehouseDocs.slice(0, 5).map((d) => [
                    <span key={d.code} className="num">
                      {d.code}
                    </span>,
                    day(d.at),
                  ])}
                />
              )}
            </FactSection>
          </FactBox>
        }
      >
        <FastTab
          title="Tổng quan & Mặt hàng"
          defaultOpen
          summary={[
            ['Số dòng', <span key="a" className="num">{lines.length}</span>],
            ...(noPriceCount > 0
              ? [
                  ['Chưa có giá', <span key="b" className="num k-t-warn">{noPriceCount}</span>] as [
                    string,
                    React.ReactNode,
                  ],
                ]
              : []),
          ]}
        >
          <FieldGrid
            note={
              <>
                Ô nền nhạt là <b>giá trị kế thừa từ hồ sơ nhà cung cấp</b> — sửa ở đây chỉ đổi
                cho đơn này.
              </>
            }
          >
            <Field label="Nhà cung cấp">{po.supplier_name ?? '—'}</Field>
            <Field label="Mã NCC">
              <span className="num">{supplier?.code ?? '—'}</span>
            </Field>
            <Field label="Mã số thuế">
              <span className="num">{supplier?.tax_no ?? '—'}</span>
            </Field>
            <Field label="Người liên hệ">{supplier?.phone ?? '—'}</Field>
            <Field label="Lệnh sản xuất">
              {lsxCodes ? (
                <span className="num">
                  {lsxCodes}
                  {extraLsx.length > 0 && ` (gộp ${extraLsx.length + 1} lệnh)`}
                </span>
              ) : (
                'Đơn ngoài lệnh'
              )}
            </Field>
            <Field label="Đơn hàng khách">
              {po.order_code ? <span className="num">{po.order_code}</span> : '—'}
            </Field>
            <Field label="Người phụ trách">{po.assignee_name ?? '—'}</Field>
            <Field label="Ngày đặt">
              <span className="num">{day(po.created_at)}</span>
            </Field>
            <Field label="Hạn giao" tone={late === 'overdue' ? 'stop' : undefined}>
              <span className="num">{day(po.expected_at)}</span>
            </Field>
            <Field label="Loại tiền">
              <span className="num">{po.currency ?? 'VND'}</span>
            </Field>
            <Field label="Thuế suất">
              <span className="num">
                {po.vat_rate ?? 0}%{po.price_includes_vat ? ' (đã gồm)' : ''}
              </span>
            </Field>
            <Field label="Số hợp đồng">
              {po.contract_no ? <span className="num">{po.contract_no}</span> : '—'}
            </Field>
            <Field label="Điều khoản TT">{po.terms_payment ?? '—'}</Field>
            <Field label="Điều kiện giao">{po.terms_delivery_place ?? '—'}</Field>
            <Field label="Chiết khấu">
              {po.discount_amount ? (
                <span className="num">{money(po.discount_amount)}</span>
              ) : (
                'Không có'
              )}
            </Field>
            <Field label="Nguồn nhu cầu">
              <span className="num">
                {extraLsx.length + (po.lsx_code ? 1 : 0) || '—'}
                {po.lsx_code ? ' lệnh sản xuất' : ''}
              </span>
            </Field>
          </FieldGrid>

          {po.note && <div className="k-note">{po.note}</div>}

          <div className="k-sec">
            <div className="k-sec-t">Dòng đơn hàng ({lines.length} dòng)</div>
          </div>

          {/*
            THANH CÔNG CỤ LƯỚI — chỉ nút CÓ THẬT.

            Mẫu vẽ "+ Thêm dòng / Xoá dòng / Sao chép" vì nó minh hoạ lưới sửa
            tại chỗ. Màn này sửa dòng qua form riêng (`/edit`), nên bày ba nút
            đó ở đây là vẽ chức năng không tồn tại. Ô tick giữ lại vì nó DẪN
            tới một hành động thật: chốt phần thiếu cho đúng dòng đang chọn.
          */}
          <GridToolbar
            count={sel.length > 0 ? `${sel.length} dòng đã chọn` : `${lines.length} dòng`}
          >
            <GridBtn
              disabled={!canEdit || po.status !== 'draft'}
              title={po.status !== 'draft' ? 'Chỉ sửa được khi đơn còn ở bước Nháp' : undefined}
              onClick={() => router.push(`/planning/pos/${po.id}/edit`)}
            >
              Chỉnh sửa vật tư
            </GridBtn>
            <GridSep />
            <GridBtn
              disabled={sel.length !== 1 || openStockLines.length === 0}
              title={
                sel.length !== 1
                  ? 'Chọn đúng một dòng còn đang chờ về'
                  : openStockLines.length === 0
                    ? 'Không còn dòng nào đang chờ về'
                    : undefined
              }
              onClick={() => {
                const line = statusLines.find((l) => l.id === sel[0])
                if (!line) return
                setReasoning({
                  po,
                  kind: 'close_short',
                  reason: '',
                  lineId: line.id,
                  detail: `${line.material_name} — thiếu ${money(line.qty_missing)} ${line.material_unit}`,
                })
              }}
            >
              Chốt phần thiếu
            </GridBtn>
          </GridToolbar>

          <Grid minWidth={1100}>
            <GridHead>
              <Th width={26} />
              <Th width={30}>#</Th>
              <Th>Mã vật tư</Th>
              <Th>Tên vật tư</Th>
              <Th>Quy cách</Th>
              <Th num>SL đặt</Th>
              <Th>ĐVT mua</Th>
              <Th num>Quy đổi kho</Th>
              <Th num>Tồn</Th>
              <Th num>Đơn giá</Th>
              <Th num>Thành tiền</Th>
              <Th>Trạng thái</Th>
              <Th>Cho lệnh SX</Th>
            </GridHead>
            <GridBody>
              {lines.map((l, i) => {
                const st = statusLines.find((s) => s.id === l.id)
                const kind = lineStatusOf(st)
                const amount =
                  l.unit_price == null
                    ? null
                    : (l.price_basis === 'unit2' ? (l.qty2 ?? 0) : l.qty_ordered) * l.unit_price
                return (
                  <GridRow key={l.id} selected={sel.includes(l.id)}>
                    <GridCheck
                      checked={sel.includes(l.id)}
                      onChange={() => toggleLine(l.id)}
                      label={`Chọn dòng ${l.material_code || l.material_name}`}
                    />
                    <Td num>{i + 1}</Td>
                    <Td>
                      {l.material_code ? <DocChip>{l.material_code}</DocChip> : '—'}
                    </Td>
                    <Td>{l.material_name}</Td>
                    <Td>{l.spec ?? '—'}</Td>
                    <Td num>{money(l.qty_ordered)}</Td>
                    <Td>{l.material_unit}</Td>
                    <Td num>{l.qty2 == null ? '—' : `${money(l.qty2)} ${l.unit2 ?? ''}`}</Td>
                    <Td num tone={l.material_id != null && (stock[l.material_id] ?? 0) <= 0 ? 'stop' : undefined}>
                      {l.material_id == null ? '—' : money(stock[l.material_id] ?? 0)}
                    </Td>
                    <Td num tone={l.unit_price == null ? 'warn' : undefined}>
                      {l.unit_price == null ? '—' : money(l.unit_price)}
                    </Td>
                    <Td num>
                      {amount == null ? (
                        <span className="k-flag">chưa có giá</span>
                      ) : (
                        money(amount)
                      )}
                    </Td>
                    <Td>
                      <LineStatus kind={kind}>{LINE_STATUS_TEXT[kind]}</LineStatus>
                    </Td>
                    <Td>{po.lsx_code ? <span className="num">{po.lsx_code}</span> : '—'}</Td>
                  </GridRow>
                )
              })}
            </GridBody>
            <GridFoot>
              <Td />
              <Td colSpan={4}>Cộng {lines.length} dòng</Td>
              <Td num>{money(lines.reduce((s, l) => s + l.qty_ordered, 0))}</Td>
              <Td colSpan={4} />
              <Td num>{money(totalAmount)}</Td>
              <Td colSpan={2} />
            </GridFoot>
          </Grid>

          {noPriceCount > 0 && (
            <div className="k-ft-note">
              Tổng tiền <b>chưa gồm {noPriceCount} dòng chưa có giá</b>. Con số trên là tạm
              tính, không dùng để duyệt chi.
            </div>
          )}
        </FastTab>

        {/* ── TAB 2: KẾ HOẠCH GIAO & ĐỢT HÀNG ────────────────────────────── */}
        <FastTab
          title="Kế hoạch giao & Đợt hàng"
          summary={[
            ['Số đợt', <span key="a" className="num">{liveShipments.length}</span>],
            [
              'Đã nhận',
              <span key="b" className="num">
                {liveShipments.length > 0 ? `${shipmentsDone}/${liveShipments.length}` : '—'}
              </span>,
            ],
          ]}
        >
          <div className="flex flex-col gap-5">
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

          {po.status !== 'cancelled' && receiptBatches.length > 0 && (
            <PoReceiptMatrix
              batches={receiptBatches}
              lines={lines.map((l) => ({
                id: l.id,
                material_code: l.material_code,
                material_name: l.material_name,
                unit: l.material_unit,
                qty_ordered: l.qty_ordered,
              }))}
              status={statusLines}
            />
          )}

          {warehouseDocs.length > 0 && (
            <>
              <div className="k-sec">
                <div className="k-sec-t">
                  <FileText className="text-primary size-4" />
                  Chứng từ kho liên quan ({warehouseDocs.length} phiếu)
                </div>
              </div>
              <div>
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
              </div>
            </>
          )}
          </div>
        </FastTab>

        {/* ── TAB 3: ĐIỀU KHOẢN & HỢP ĐỒNG ─────────────────────────────────── */}
        <FastTab
          title="Điều khoản & Hợp đồng"
          summary={[
            ['Thanh toán', short(po.terms_payment)],
            ['Hạn giao', <span key="b" className="num">{day(po.expected_at)}</span>],
          ]}
        >
          <div className="flex flex-col gap-5">
          <>
            <div className="k-sec">
              <div className="flex items-center justify-between">
                <div className="k-sec-t">
                  <ScrollText className="text-primary size-4" />
                  Điều khoản hợp đồng & Cam kết
                </div>
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
            </div>
            <div className="flex flex-col gap-6">
              <FieldGrid>
                <Field label="Điều 1 · Tiêu chuẩn chất lượng">
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_quality || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
</Field>

                <Field label="Điều 2 · Địa điểm giao hàng">
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_delivery_place || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
</Field>

                <Field label="Điều 3 · Điều kiện thanh toán">
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_payment || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
</Field>

                <Field label="Điều 4 · Hoá đơn & Chứng từ">
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_invoice || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
</Field>

                <Field label="Điều 5 · Thời hạn giao hàng">
                  <span className="text-foreground text-sm font-medium">
                    {po.terms_lead_time || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
</Field>

                <Field label="Đại diện ký đơn (Chức danh)">
                  <span className="text-foreground text-sm font-medium">
                    {po.signer_role || (
                      <span className="text-muted-foreground font-normal">
                        Chưa khai báo
                      </span>
                    )}
                  </span>
</Field>
              </FieldGrid>

              {(po.terms || po.note) && (
                <div className="k-note">
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
            </div>
          </>
          </div>
        </FastTab>

        {/* ── TAB 4: DÒNG THỜI GIAN & LỊCH SỬ DUYỆT ─────────────────────────── */}
        <FastTab
          title="Dòng thời gian"
          summary={[['Số mốc', <span key="a" className="num">{marks.length}</span>]]}
        >
          <div className="flex flex-col gap-5">
          {/*
            TRAO ĐỔI đặt TRƯỚC dòng thời gian máy ghi.

            Người mở tab này hỏi "vì sao đơn đứng im" — câu trả lời nằm ở lời
            người viết, không nằm ở danh sách mốc trạng thái. Mốc máy ghi đã
            được trộn vào chính dòng trao đổi bên dưới ô nhập, nên thẻ "Dòng
            thời gian" phía dưới giữ lại cho ai muốn xem riêng phần máy ghi
            kèm chi tiết đợt giao / phiếu nhập.
          */}
          <>
            <div className="k-sec">
              <div className="k-sec-t">
                <History className="text-primary size-4" />
                Trao đổi về đơn này
              </div>
            </div>
            <div>
              <PoNotesPanel
                poId={po.id}
                meId={me.id}
                meName={me.name}
                marks={marks.map((m) => ({
                  key: m.key,
                  at: m.at,
                  label: m.label,
                  actor: m.actor,
                }))}
                followerNames={[po.assignee_name].filter((x): x is string => !!x)}
              />
            </div>
          </>

          <>
            <div className="k-sec">
              <div className="k-sec-t">
                <History className="text-primary size-4" />
                Dòng thời gian & Nhật ký xử lý ({marks.length} mốc sự kiện)
              </div>
            </div>
            <div>
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
            </div>
          </>
          </div>
        </FastTab>

        {/* ── TAB 5: TÀI LIỆU ĐÍNH KÈM ─────────────────────────────────────── */}
        <FastTab
          title="Tài liệu đính kèm"
        >
          <div className="flex flex-col gap-5">
          <>
            <div className="k-sec">
              <div className="k-sec-t">
                <Paperclip className="text-primary size-4" />
                Hồ sơ & Tài liệu đính kèm
              </div>
            </div>
            <div>
              <DocumentFiles
                kind="purchase_order"
                id={po.id}
                canEdit={isSupply || canApprove}
                title="Báo giá NCC · Hợp đồng mua bán · Chứng từ giao nhận"
              />
            </div>
          </>
          </div>
        </FastTab>
      </DocBody>

      {/* Thanh trạng thái đáy — SAP GUI. Nghe thừa với người quen web, nhưng ERP
          chạy nhiều đơn vị trên cùng phần mềm và nhìn nhầm chỗ là hỏng sổ. */}
      <StatusBar
        left={[
          <>
            <b>{me.name}</b> · Cung ứng
          </>,
          po.supplier_name ?? 'Chưa chọn nhà cung cấp',
        ]}
        right={po.code}
      />

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
