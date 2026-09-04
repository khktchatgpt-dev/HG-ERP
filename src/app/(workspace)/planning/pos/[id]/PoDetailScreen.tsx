'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Ban,
  CalendarClock,
  Copy,
  History,
  Layers,
  MoreHorizontal,
  PackageCheck,
  PackageSearch,
  Paperclip,
  Pencil,
  Printer,
  ScrollText,
  Trash2,
  UserCog,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { DocumentFiles } from '@/components/DocumentFiles'
import { Breadcrumbs } from '@/components/erp/Breadcrumbs'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { DocBlock, DocFact, LedgerMark, StatusStamp, type DocTone } from './PoDocParts'
import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import { fmtMoney, poLineAmount, poMoney, qtyTotals, roundMoney } from '@/lib/po-line'
import { canReschedule } from '@/lib/po-reschedule'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { PO_NEXT_HINT, PO_STATUS_LABEL, PO_STATUS_TONE } from '@/lib/po-status'
import type { PoStatus } from '@/lib/po-status'
import type { ApprovalEvent } from '@/modules/core/approvals/approvals.repo'
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

/**
 * CHI TIẾT ĐƠN ĐẶT VẬT TƯ — dựng như TỜ PHIẾU, không như bảng điều khiển
 * (thiết kế lại 04/09/2026).
 *
 * Bản trước là sáu thẻ bo góc giống hệt nhau, tiền nằm tận cột phải, trạng thái
 * là dải 8 bước nằm ngang ăn hết bề ngang. Nhưng thứ người mua đang cầm không
 * phải dashboard: nó là tờ ĐƠN ĐẶT HÀNG chính họ in ra, ký, rồi gửi Zalo cho
 * NCC — cả phòng gọi nhau bằng "tờ 6/2026-HG/ATP".
 *
 * Bốn quyết định của bản mới, mỗi cái trả lời một câu hỏi có thật:
 *   ĐẦU PHIẾU  — "tờ nào, của ai": số đơn cỡ lớn bằng chữ máy + bên bán + lệnh,
 *                 và CON DẤU trạng thái đóng lệch ở góc. Trong phòng làm việc,
 *                 tình trạng một chứng từ LÀ con dấu; nhãn bo tròn đọc ra phần
 *                 mềm, con dấu đọc ra hồ sơ. Đây là điểm nhấn DUY NHẤT của trang.
 *   LỀ TRÁI    — "tờ này đã đi tới đâu": nhật ký xếp DỌC. Vòng đời thật có mười
 *                 mấy mốc (gửi, xác nhận, từng đợt, từng phiếu nhập) — dải ngang
 *                 8 bước chỉ vẽ nổi 8 mốc rồi đẩy phần còn lại xuống một thẻ
 *                 riêng cuối trang, thành hai chỗ kể một câu chuyện.
 *   THÂN PHIẾU — "trên tờ có gì": bảng hàng chiếm hết bề ngang, và TIỀN nằm ngay
 *                 chân bảng như mọi hoá đơn giấy, không phải ở cột bên kia màn
 *                 hình — đối chiếu "dòng này × giá này = tổng kia" trong một tầm
 *                 mắt.
 *   THANH ĐÁY  — "giờ làm gì": đọc xong tờ phiếu thì tay đã ở cuối trang. Đúng
 *                 MỘT nút tô màu cho việc của trạng thái hiện tại; việc phụ nằm
 *                 trong menu — không xám đi mà cũng không giành chỗ.
 *
 * Mảnh ghép hình nằm ở `PoDocParts.tsx`.
 */

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
  /** NCC xác nhận (0152) — NV cung ứng ghi lại cam kết. */
  confirmed_at: string | null
  confirmed_note: string | null
  created_at: string
}

const money = (n: number) => n.toLocaleString('vi-VN')
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')
const stamp = (s: string) => new Date(s).toLocaleString('vi-VN')

/** Nhãn tiếng Việt cho mốc lịch sử — cùng bộ từ với nút bấm sinh ra nó. */
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
  /** Đã về CÓ CHỨNG TỪ theo đợt (PNK nối shipment_id) — {đợt: {dòng: SL}}. */
  shipmentReceipts: Record<string, Record<string, number>>
  /** LSX PHỤ gộp vào đơn (0125). */
  extraLsx: { id: string; code: string }[]
  /** Kế hoạch giao theo đợt (0152). */
  shipments: ShipmentView[]
  history: ApprovalEvent[]
  /** PNK / phiếu trả gắn dòng đơn — mốc timeline (GĐ3). */
  warehouseDocs: {
    doc_id: string
    code: string
    kind: 'receipt' | 'return'
    qty_total: number
    at: string
  }[]
  /** Quyền GHI trên ĐƠN NÀY (0128) — người phụ trách / trưởng phòng / admin. */
  canEdit: boolean
  /** Là NV cung ứng — đính kèm hồ sơ, nhân bản đơn đã huỷ. */
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
  /** Dialog xác nhận NCC / thêm đợt giao (0152). */
  const [confirming, setConfirming] = useState<'confirm' | 'add' | null>(null)
  /** Hộp sửa điều khoản & ghi chú (28/08) — chữ trên phiếu, mở tới khi đơn huỷ. */
  const [editingTerms, setEditingTerms] = useState(false)
  /** Dòng thời gian gấp lại còn 4 mốc gần nhất — nhật ký dài là để TRA, không
      phải để chiếm nửa cột nội dung. */
  const [allMarks, setAllMarks] = useState(false)

  // Dòng đơn cho dialog + thẻ đợt giao — chỉ dòng VẬT TƯ KHO (dòng tự do gỗ/gia
  // công nghiệm thu ngoài sổ, không đi theo đợt).
  const shipmentLines = lines
    .filter((l) => l.material_id != null)
    .map((l) => ({
      id: l.id,
      name: l.material_name,
      unit: l.material_unit,
      qty_ordered: l.qty_ordered,
      // Tiền theo đợt (28/08) chia tỷ lệ từ thành tiền dòng; giá theo kg/m²
      // (unit2) là số ước — kg thật cân lúc nhận.
      amount: l.unit_price != null ? poLineAmount(l) : null,
      price_approx: l.price_basis === 'unit2',
    }))
  const shipmentLinesById = new Map(shipmentLines.map((l) => [l.id, l]))
  /** SL đã nằm ở các đợt còn sống — validate cộng dồn khi thêm đợt. */
  const shippedByLine = new Map<string, number>()
  for (const s of shipments) {
    if (s.status === 'cancelled') continue
    for (const l of s.lines) {
      shippedByLine.set(l.po_line_id, (shippedByLine.get(l.po_line_id) ?? 0) + l.qty)
    }
  }

  const receivedById = new Map(statusLines.map((s) => [s.id, s]))
  //"Đã về / còn thiếu " chỉ có nghĩa từ lúc đơn rời bàn duyệt trở đi.
  const showReceived = !['draft', 'pending_approval', 'approved', 'cancelled'].includes(
    po.status,
  )
  // Chốt thiếu (0154): đơn đã gửi NCC và chưa kết thúc. Server enforce lại.
  const canCloseShort = ['ordered', 'confirmed', 'in_transit', 'partial'].includes(
    po.status,
  )
  /** Dải tiến độ "hàng về tới đâu" — mỗi dòng vật tư kho một thanh. */
  const progressLines = statusLines
    .filter((l) => l.material_id != null && l.qty_ordered > 0)
    .map((l) => {
      const line = lines.find((x) => x.id === l.id)
      const received = l.qty_received ?? 0
      const scheduled = Math.min(shippedByLine.get(l.id) ?? 0, l.qty_ordered)
      return {
        id: l.id,
        name: line?.material_name ?? '?',
        unit: line?.material_unit ?? '',
        ordered: l.qty_ordered,
        received,
        unscheduled: Math.max(l.qty_ordered - scheduled, 0),
        pctReceived: Math.min((received / l.qty_ordered) * 100, 100),
        // Phần ĐÃ HẸN nhưng chưa về — vẽ nối sau phần đã về, không vẽ đè.
        pctScheduled: Math.max(
          (Math.min(scheduled, l.qty_ordered) / l.qty_ordered) * 100 -
            Math.min((received / l.qty_ordered) * 100, 100),
          0,
        ),
      }
    })

  /** Dòng vật tư kho còn CHỜ VỀ — nuôi nút "Chốt phần thiếu" cả đơn. */
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
  // Ô TIỀN format theo tiền tệ của đơn (USD đủ 2 số lẻ cent) — `money` ở trên
  // vẫn dùng cho các ô SỐ LƯỢNG.
  const cash = (n: number) => fmtMoney(n, po.currency)
  const today = new Date().toISOString().slice(0, 10)
  const late = assessPoLate(po, today)
  const lsxCodes = po.lsx_code
    ? [po.lsx_code, ...extraLsx.map((l) => l.code)].join(' + ')
    : null

  {
    /* Chuỗi liên kết đơn hàng → lệnh → phiếu nay nằm ngay trong ĐẦU PHIẾU
       (ba ô dữ kiện), không cần một dải chip riêng lặp lại tiêu đề. */
  }

  /*
   * TIMELINE ĐỦ MỐC (GĐ3 plan-po-giao-nhan): khối "Lịch sử" trước đây chỉ có
   * các mốc DUYỆT — nửa sau vòng đời (gửi NCC → xác nhận → từng đợt → từng
   * phiếu nhập/trả → chốt thiếu) phải đi lục ba màn khác. Gộp về một dòng thời
   * gian; dữ liệu đều có sẵn trên trang, không thêm trạng thái nào.
   */
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
    // Mỗi đợt một mốc tại lúc KHAI đợt; trạng thái hiện tại đọc kèm — đợt không
    // lưu timestamp từng bước chuyển, đừng bịa mốc "xe tới lúc…".
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
    // Chốt thiếu (0154): các dòng chốt cùng một lượt chung một mốc.
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

  /** Xoá nháp xong thì đơn không còn — ở lại trang này là ở lại một trang 404. */
  async function removeDraft() {
    if (await act.deleteDraft(po)) router.push('/planning/pos')
  }

  /** Việc CHÍNH của trạng thái hiện tại — cái nút duy nhất tô màu ở thanh đáy. */
  const primary: {
    label: string
    onClick: () => void
    tone?: 'primary' | 'done'
  } | null =
    canEdit && po.status === 'draft'
      ? { label: 'Gửi Giám đốc duyệt', onClick: () => void act.submitPo(po) }
      : canApprove && po.status === 'pending_approval'
        ? { label: 'Duyệt đơn đặt', onClick: () => void act.approve(po), tone: 'done' }
        : canEdit && po.status === 'approved'
          ? { label: 'Gửi cho NCC', onClick: () => void act.advance(po, 'ordered') }
          : canEdit && po.status === 'ordered'
            ? {
                label: 'NCC đã xác nhận',
                onClick: () =>
                  shipmentLines.length > 0
                    ? setConfirming('confirm')
                    : void act.advance(po, 'confirmed'),
              }
            : canEdit && po.status === 'confirmed'
              ? {
                  label: 'Hàng đang trên đường',
                  onClick: () => void act.advance(po, 'in_transit'),
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
                  }
                : null

  /** Nghiệm thu tay — chỉ đơn CÓ dòng tự do (gỗ/gia công) mới cần (0134). */
  const canAcceptByHand =
    canEdit &&
    lines.length > 0 &&
    lines.some((l) => l.material_id == null) &&
    statusLines.every((l) => l.material_id == null || l.qty_open <= 0) &&
    ['ordered', 'confirmed', 'in_transit', 'partial'].includes(po.status)

  return (
    <div className="flex flex-col gap-4 pb-28">
      <TopProgressBar active={act.busy} />
      <Breadcrumbs
        items={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Đơn đặt vật tư', href: '/planning/pos' },
          { label: po.code },
        ]}
      />

      {/*
        ĐẦU PHIẾU — dựng theo tờ giấy thật: số đơn cỡ lớn bằng chữ máy (thứ cả
        phòng gọi tên nhau), hai bên mua/bán, rồi con dấu trạng thái đóng lệch.
      */}
      <header className="bg-card overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10.5px] font-bold tracking-[0.2em] uppercase">
              Đơn đặt hàng · Purchase order
            </p>
            <h1 className="t-data mt-1.5 text-[26px] leading-none font-bold tracking-[0.05em]">
              {po.code}
            </h1>
            <p className="text-muted-foreground mt-2 text-[12.5px]">
              Ngày lập {day(po.created_at)}
              {po.contract_no && (
                <>
                  {' · '}theo hợp đồng <span className="t-data">{po.contract_no}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <StatusStamp
              status={po.status}
              tone={PO_STATUS_TONE[po.status] as DocTone}
              date={
                po.status === 'draft'
                  ? day(po.created_at)
                  : po.ordered_at
                    ? day(po.ordered_at)
                    : po.approved_at
                      ? day(po.approved_at)
                      : null
              }
            />
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-3 border-t px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
          <DocFact label="Bên bán">{po.supplier_name}</DocFact>
          <DocFact label="Lệnh sản xuất" mono>
            {lsxCodes ? (
              <Link href="/planning/lsx" className="hover:underline">
                {lsxCodes}
              </Link>
            ) : (
              <span className="text-muted-foreground">đơn ngoài lệnh</span>
            )}
          </DocFact>
          <DocFact label="Đơn hàng khách" mono>
            {po.order_code ?? <span className="text-muted-foreground">—</span>}
          </DocFact>
          <DocFact label="Người phụ trách">
            {po.assignee_name ?? (
              <span style={{ color: 'var(--warn)' }}>chưa giao ai</span>
            )}
          </DocFact>
        </div>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[212px_minmax(0,1fr)]">
        {/*
          LỀ TRÁI — vòng đời tờ phiếu, xếp DỌC. Vòng đời thật có tới mười mấy
          mốc (gửi, xác nhận, từng đợt, từng phiếu nhập); dải ngang 8 bước của
          bản cũ chỉ vẽ được 8 mốc cố định rồi đẩy phần còn lại xuống một thẻ
          "Dòng thời gian" tận cuối trang, thành ra hai chỗ kể một câu chuyện.
        */}
        <aside className="order-2 min-w-0 lg:order-1">
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <DocBlock title="Hẹn giao" icon={CalendarClock}>
              <div className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-[12px]">NCC hẹn</span>
                  <span
                    className="t-data text-[13px] font-semibold"
                    style={{
                      color:
                        late === 'overdue'
                          ? 'var(--stop)'
                          : isMissingEta(po)
                            ? 'var(--warn)'
                            : undefined,
                    }}
                  >
                    {po.expected_at
                      ? day(po.expected_at)
                      : isMissingEta(po)
                        ? 'chưa hẹn'
                        : '—'}
                  </span>
                </div>
                {late === 'overdue' && (
                  <p className="text-[11.5px]" style={{ color: 'var(--stop)' }}>
                    Đã quá hẹn — gọi NCC hoặc đổi hẹn để lịch vật tư của lệnh còn đúng.
                  </p>
                )}
                {po.confirmed_at && (
                  <p className="text-muted-foreground text-[11.5px]">
                    NCC xác nhận {day(po.confirmed_at)}
                    {po.confirmed_note ? ` · “${po.confirmed_note}”` : ''}
                  </p>
                )}
              </div>
            </DocBlock>

            <DocBlock
              title="Nhật ký phiếu"
              icon={History}
              meta={`${marks.length} mốc`}
              className="min-w-0"
            >
              {marks.length === 0 ? (
                <p className="text-muted-foreground px-4 py-3 text-[12px]">
                  Chưa có mốc nào — phiếu còn nằm ở người soạn.
                </p>
              ) : (
                <ol className="px-4 py-3">
                  {(allMarks ? marks : marks.slice(0, 5)).map((mk, i, arr) => (
                    <LedgerMark
                      key={mk.key}
                      label={mk.label}
                      at={stamp(mk.at)}
                      tone={mk.tone}
                      actor={mk.actor}
                      detail={mk.detail}
                      last={i === arr.length - 1 && (allMarks || marks.length <= 5)}
                    />
                  ))}
                  {marks.length > 5 && (
                    <li className="pt-1">
                      <button
                        onClick={() => setAllMarks((v) => !v)}
                        className="text-[12px] font-medium text-[var(--primary)] hover:underline"
                      >
                        {allMarks ? 'Thu gọn' : `Xem tất cả ${marks.length} mốc`}
                      </button>
                    </li>
                  )}
                </ol>
              )}
            </DocBlock>
          </div>
        </aside>

        {/* ── THÂN PHIẾU ────────────────────────────────────────────────── */}
        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <DocBlock
            title="Hàng hoá"
            icon={PackageSearch}
            meta={`${lines.length} dòng · mẫu ${poTemplateMeta(po.template as PoTemplate).label.toLowerCase()}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="w-8 py-2 pr-2 pl-4 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                      #
                    </th>
                    <th className="py-2 pr-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                      Vật tư
                    </th>
                    <th className="w-28 py-2 pr-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                      Quy cách
                    </th>
                    <th className="w-24 py-2 pr-2 text-right text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                      SL đặt
                    </th>
                    {showReceived && (
                      <th className="w-32 py-2 pr-2 text-right text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                        Về kho
                      </th>
                    )}
                    <th className="w-24 py-2 pr-2 text-right text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                      Đơn giá
                    </th>
                    <th className="w-32 py-2 pr-4 text-right text-[10.5px] font-semibold tracking-[0.08em] uppercase">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const st = receivedById.get(l.id)
                    const pct =
                      st && st.qty_ordered > 0
                        ? Math.min((st.qty_received ?? 0) / st.qty_ordered, 1) * 100
                        : 0
                    return (
                      <tr key={l.id} className="border-border/60 border-b align-top">
                        <td className="t-data text-muted-foreground py-2.5 pr-2 pl-4 text-[11px]">
                          {i + 1}
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="leading-snug">
                              <span className="t-data text-muted-foreground text-[11px]">
                                {l.material_code}
                              </span>{' '}
                              {l.material_name}
                            </span>
                            {(l.qty2 != null || l.note) && (
                              <span className="text-muted-foreground text-[11.5px] leading-snug">
                                {l.qty2 != null && `${money(l.qty2)} ${l.unit2 ?? ''}`}
                                {l.qty2 != null && l.note && ' · '}
                                {l.note}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-muted-foreground py-2.5 pr-2 text-[12px]">
                          {l.spec ?? '—'}
                        </td>
                        <td className="t-data py-2.5 pr-2 text-right whitespace-nowrap">
                          {money(l.qty_ordered)}{' '}
                          <span className="text-muted-foreground text-[11px]">
                            {l.material_unit}
                          </span>
                        </td>
                        {showReceived &&
                          (l.material_id == null ? (
                            <td
                              className="text-muted-foreground py-2.5 pr-2 text-right text-[11.5px]"
                              title="Dòng không gắn vật tư kho — nghiệm thu ngoài sổ kho"
                            >
                              ngoài sổ kho
                            </td>
                          ) : (
                            /*
                              MỘT Ô cho cả "về bao nhiêu / thiếu bao nhiêu" kèm
                              vạch tiến độ ngay dưới: bản cũ tách hai cột số,
                              mắt phải tự trừ mới biết còn thiếu bao nhiêu.
                            */
                            <td className="py-2.5 pr-2 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="t-data text-[12.5px] whitespace-nowrap">
                                  <span
                                    className="font-semibold"
                                    style={{
                                      color:
                                        st && st.qty_missing <= 0
                                          ? 'var(--done)'
                                          : undefined,
                                    }}
                                  >
                                    {money(st?.qty_received ?? 0)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    /{money(l.qty_ordered)}
                                  </span>
                                </span>
                                <span
                                  className="bg-muted block h-1 w-16 overflow-hidden rounded-full"
                                  aria-hidden
                                >
                                  <span
                                    className="block h-full"
                                    style={{
                                      width: `${pct}%`,
                                      background: 'var(--done)',
                                    }}
                                  />
                                </span>
                                {st?.closed_short_at ? (
                                  <span
                                    className="flex flex-col items-end gap-0.5"
                                    title={`Chốt thiếu ${day(st.closed_short_at)}${st.closed_short_reason ? ` — ${st.closed_short_reason}` : ''}`}
                                  >
                                    <Badge tone="gray">
                                      chốt thiếu {money(st.qty_missing)}
                                    </Badge>
                                    {canEdit && po.status !== 'cancelled' && (
                                      <button
                                        className="text-muted-foreground text-[11px] underline-offset-2 hover:underline"
                                        onClick={() => void act.reopenShort(po, st.id)}
                                      >
                                        Mở lại
                                      </button>
                                    )}
                                  </span>
                                ) : (
                                  st &&
                                  st.qty_missing > 0 && (
                                    <span className="flex flex-col items-end gap-0.5">
                                      <span
                                        className="t-data text-[11.5px] font-medium"
                                        style={{ color: 'var(--warn)' }}
                                      >
                                        thiếu {money(st.qty_missing)}
                                      </span>
                                      {canEdit && canCloseShort && st.qty_open > 0 && (
                                        <button
                                          className="text-muted-foreground text-[11px] underline-offset-2 hover:underline"
                                          title="NCC không giao phần thiếu của dòng này nữa"
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
                                    </span>
                                  )
                                )}
                              </div>
                            </td>
                          ))}
                        <td className="t-data py-2.5 pr-2 text-right whitespace-nowrap">
                          {l.unit_price != null ? (
                            <>
                              {cash(l.unit_price)}
                              {l.price_basis === 'unit2' && l.unit2 && (
                                <span className="text-muted-foreground text-[11px]">
                                  /{l.unit2}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'var(--warn)' }}>chưa có giá</span>
                          )}
                        </td>
                        <td className="t-data py-2.5 pr-4 text-right font-semibold whitespace-nowrap">
                          {l.unit_price != null
                            ? cash(roundMoney(poLineAmount(l), po.currency))
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/*
              CHÂN PHIẾU — tiền về đúng chỗ nó thuộc về: cuối bảng hàng, như mọi
              hoá đơn giấy. Bản cũ nhét khối tiền vào cột phải, cách bảng hàng
              cả màn hình, nên đối chiếu "dòng này × giá này = tổng kia" phải
              nhìn chéo qua trang.
            */}
            <div className="grid gap-4 border-t px-4 py-3.5 sm:grid-cols-[1fr_auto]">
              <div className="text-muted-foreground flex flex-col gap-1 text-[12px]">
                {qtyTotals(
                  lines.some((l) => l.price_basis === 'unit2' && l.unit2),
                  lines,
                ).map((t) => (
                  <span key={t.label}>
                    {t.label}: <span className="t-data">{money(t.value)}</span>
                  </span>
                ))}
              </div>
              <dl className="flex min-w-[220px] flex-col gap-1 text-[13px]">
                <div className="flex justify-between gap-6">
                  <dt className="text-muted-foreground">Tiền hàng</dt>
                  <dd className="t-data">{cash(m.subtotal)}</dd>
                </div>
                {m.discountAmount > 0 && (
                  <div className="flex justify-between gap-6">
                    <dt className="text-muted-foreground">Chiết khấu</dt>
                    <dd className="t-data">− {cash(m.discountAmount)}</dd>
                  </div>
                )}
                {po.vat_rate != null && (
                  <div className="flex justify-between gap-6">
                    <dt className="text-muted-foreground">
                      VAT {po.vat_rate}%{' '}
                      <span className="text-[11px]">
                        ({po.price_includes_vat ? 'đã gồm' : 'chưa gồm'})
                      </span>
                    </dt>
                    <dd className="t-data">{cash(m.vatAmount)}</dd>
                  </div>
                )}
                <div className="mt-1 flex items-baseline justify-between gap-6 border-t pt-2">
                  <dt className="text-[11px] font-bold tracking-[0.1em] uppercase">
                    Tổng thanh toán
                  </dt>
                  <dd className="t-data text-[17px] font-bold">
                    {cash(m.grandTotal)}{' '}
                    <span className="text-muted-foreground text-[11px] font-normal">
                      {po.currency}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </DocBlock>

          {po.status !== 'cancelled' && (
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
                        ? 'Bấm “NCC đã xác nhận” ở thanh cuối trang để ghi lịch NCC hẹn — mỗi dòng tách được nhiều đợt.'
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
          )}

          <PoTerms
            po={po}
            onEdit={
              canEdit && po.status !== 'cancelled'
                ? () => setEditingTerms(true)
                : undefined
            }
          />

          {extraLsx.length > 0 && (
            <DocBlock
              title="Mua chung cho nhiều lệnh"
              icon={Layers}
              meta={`${extraLsx.length + 1} lệnh`}
            >
              <div className="flex flex-wrap gap-1.5 px-4 py-3">
                {[{ id: po.production_order_id ?? '', code: po.lsx_code ?? '—' }]
                  .concat(extraLsx)
                  .map((l, i) => (
                    <span
                      key={l.id || i}
                      className="bg-accent t-data text-primary rounded-full px-2 py-0.5 text-[11px] font-medium"
                    >
                      {l.code}
                      {i === 0 && ' · lệnh chính'}
                    </span>
                  ))}
              </div>
            </DocBlock>
          )}

          <DocBlock title="Hồ sơ kèm phiếu" icon={Paperclip}>
            <div className="px-4 py-3">
              <DocumentFiles
                kind="purchase_order"
                id={po.id}
                canEdit={isSupply || canApprove}
                title="Báo giá NCC · hợp đồng · chứng từ giao nhận"
              />
            </div>
          </DocBlock>
        </div>
      </div>

      {/*
        THANH VIỆC dính đáy — đọc xong tờ phiếu thì tay đã ở cuối trang, nút nằm
        ngay đó. Chỉ MỘT nút tô màu (việc của trạng thái hiện tại); mọi việc
        khác nằm trong menu, không xám đi mà cũng không giành chỗ.
      */}
      <div className="pointer-events-none sticky bottom-0 z-20 -mx-4 mt-2 px-4 sm:-mx-6 sm:px-6">
        <div className="bg-card pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-lg border border-b-0 px-4 py-2.5 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="t-data text-[15px] font-bold">{cash(m.grandTotal)}</span>
            <span className="text-muted-foreground text-[11px]">{po.currency}</span>
          </div>
          <span className="text-muted-foreground hidden text-[12px] sm:inline">
            {PO_NEXT_HINT[po.status] ?? PO_STATUS_LABEL[po.status]}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {canAcceptByHand && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void act.advance(po, 'received')}
              >
                <PackageCheck /> Đã nhận đủ
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
                className="border-[var(--stop)]/40 text-[var(--stop)] hover:bg-[var(--stop)]/10"
              >
                Từ chối
              </Button>
            )}
            {primary && (
              <Button
                size="sm"
                onClick={primary.onClick}
                disabled={act.busy}
                style={
                  primary.tone === 'done'
                    ? { background: 'var(--done)', color: '#fff' }
                    : undefined
                }
              >
                {act.busy && <Spinner size={14} />}
                {primary.label}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Việc khác trên phiếu">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <a href={`/print/supply/${po.id}`} target="_blank" rel="noopener">
                    <Printer /> In đơn đặt hàng
                  </a>
                </DropdownMenuItem>
                {canEdit && po.status === 'draft' && (
                  <DropdownMenuItem asChild>
                    <Link href={`/planning/pos/${po.id}/edit`}>
                      <Pencil /> Sửa đơn
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
                    <CalendarClock /> Đổi hẹn giao
                  </DropdownMenuItem>
                )}
                {canReassign && !['received', 'cancelled'].includes(po.status) && (
                  <DropdownMenuItem onSelect={() => setReassigning({ po, toId: '' })}>
                    <UserCog /> Bàn giao phụ trách
                  </DropdownMenuItem>
                )}
                {isSupply && (
                  <DropdownMenuItem asChild>
                    <Link href={`/planning/pos/${po.id}/edit?duplicate=1`}>
                      <Copy />
                      {po.status === 'cancelled' ? 'Tạo lại từ đơn' : 'Nhân bản đơn'}
                    </Link>
                  </DropdownMenuItem>
                )}
                {canEdit && po.status === 'draft' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void removeDraft()}
                      className="text-[var(--stop)]"
                    >
                      <Trash2 /> Xoá nháp
                    </DropdownMenuItem>
                  </>
                )}
                {canEdit && !['draft', 'received', 'cancelled'].includes(po.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setReasoning({ po, kind: 'cancel', reason: '' })}
                      className="text-[var(--stop)]"
                    >
                      <Ban /> Huỷ đơn
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {!canEdit && !canApprove && (
            <p className="text-muted-foreground w-full text-[11.5px]">
              Bạn đang xem phiếu của người khác — chỉ đọc.
            </p>
          )}
        </div>
      </div>

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

/**
 * ĐIỀU KHOẢN — in ra là chữ NCC đọc, nên trình bày như văn bản có ĐIỀU đánh số
 * chứ không phải bảng thuộc tính. Trên tờ hợp đồng thật chúng đúng là
 * "ARTICLE 1..6"; giữ cấu trúc đó thì người soát dò theo số điều, không phải
 * đọc lướt tìm chữ.
 */
function PoTerms({ po, onEdit }: { po: PoDetailPo; onEdit?: () => void }) {
  const articles: [string, string | null][] = [
    ['Chất lượng', po.terms_quality],
    ['Nơi giao hàng', po.terms_delivery_place],
    ['Thanh toán', po.terms_payment],
    ['Hoá đơn', po.terms_invoice],
    ['Thời gian giao', po.terms_lead_time],
  ]
  const shown = articles.filter(([, v]) => v)
  if (shown.length === 0 && !po.terms && !po.note && !onEdit) return null

  return (
    <DocBlock
      title="Điều khoản & ghi chú"
      icon={ScrollText}
      meta={po.signer_role ? `người ký: ${po.signer_role}` : undefined}
      action={
        onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil /> Sửa
          </Button>
        )
      }
    >
      {shown.length > 0 && (
        <ol className="divide-border/60 divide-y">
          {shown.map(([k, v], i) => (
            <li key={k} className="flex gap-3 px-4 py-2.5">
              <span className="t-data text-muted-foreground w-10 shrink-0 text-[11px]">
                Điều {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.06em] uppercase">
                  {k}
                </p>
                <p className="text-[13px] leading-snug">{v}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {(po.terms || po.note) && (
        <div className="text-muted-foreground flex flex-col gap-1.5 border-t px-4 py-3 text-[12.5px] leading-snug">
          {po.terms && <p>{po.terms}</p>}
          {po.note && <p>{po.note}</p>}
        </div>
      )}
    </DocBlock>
  )
}

/**
 * HỘP SỬA ĐIỀU KHOẢN & GHI CHÚ (28/08) — chỉ CHỮ in lên phiếu. Dòng hàng, giá,
 * NCC không có ở đây: đổi mấy thứ đó là phải rút về nháp đi duyệt lại; còn câu
 * thanh toán gõ nhầm thì không thể bắt huỷ đơn NCC đang giao mới sửa được.
 */
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
  // Nạp giá trị hiện tại mỗi lần MỞ — đóng rồi mở lại phải thấy bản mới nhất.
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
    'border-input focus:border-ring h-9 w-full rounded-md border px-2 text-sm outline-none'
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
      toast.success('Đã lưu điều khoản', 'Phiếu in dùng bản vừa sửa')
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
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-xs">
          Chỉ sửa được phần CHỮ in lên phiếu. Dòng hàng, giá, nhà cung cấp muốn đổi thì
          rút đơn về nháp.
        </p>
        {FIELDS.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <input value={form[k]} onChange={set(k)} className={field} />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">Ghi chú</span>
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="border-input focus:border-ring w-full rounded-md border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="border-input hover:bg-muted rounded-md border px-3 py-1.5"
          >
            Huỷ
          </button>
          <button
            disabled={saving || busy}
            onClick={() => void save()}
            className="bg-primary inline-flex items-center gap-2 rounded-md px-4 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Spinner size={14} />}
            Lưu điều khoản
          </button>
        </div>
      </div>
    </Modal>
  )
}
