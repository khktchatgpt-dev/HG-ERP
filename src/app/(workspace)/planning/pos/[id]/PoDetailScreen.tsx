'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { DocumentFiles } from '@/components/DocumentFiles'
import { PageHeader } from '@/components/erp/PageHeader'
import { RefChain, type ChainNode } from '@/components/erp/RefChain'
import { TopProgressBar } from '@/components/erp/Spinner'
import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import { poLineAmount, poMoney, qtyTotals } from '@/lib/po-line'
import { canReschedule } from '@/lib/po-reschedule'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { PO_NEXT_HINT, PO_STATUS_LABEL, PO_STATUS_TONE } from '@/lib/po-status'
import type { PoStatus } from '@/lib/po-status'
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
import type { PoLine, StatusLine } from '../po-types'

/**
 * TRANG CHI TIẾT ĐƠN ĐẶT VẬT TƯ — thay cái modal cũ.
 *
 * Bố cục theo hai câu hỏi khác nhau của cùng một người:
 *   TRÁI  —"đơn này gồm những gì ": dòng hàng, điều khoản, hồ sơ đính kèm.
 *   PHẢI  —"giờ tôi phải làm gì ": tóm tắt + đúng những nút hợp lệ ở trạng thái
 *           hiện tại, dính theo cuộn nên đơn 30 dòng vẫn với tới được; dưới đó
 *           là lịch sử để biết đơn đã qua tay ai.
 *
 * Nút hiện ra theo TỪNG trạng thái chứ không xám đi: một nút xám giữa mười nút
 * khác vẫn bắt người ta đọc rồi mới hiểu là bấm không được.
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

const card =
  'rounded-xl border border-border bg-card'
const cardHead =
  'flex flex-wrap items-center gap-2 border-b border-border/70 px-3.5 py-2.5 text-[13px]'
const btn =
  'w-full rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted'
const btnPrimary =
  'w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90'
const btnGreen =
  'w-full rounded-md bg-[var(--done)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90'
const btnDanger =
  'w-full rounded-md border border-[var(--stop)]/40 px-3 py-1.5 text-sm text-[var(--stop)] hover:bg-[var(--stop)]/10'

export function PoDetailScreen({
  po,
  lines,
  statusLines,
  extraLsx,
  history,
  canEdit,
  isSupply,
  canApprove,
  canReassign,
  staff,
}: {
  po: PoDetailPo
  lines: PoLine[]
  statusLines: StatusLine[]
  /** LSX PHỤ gộp vào đơn (0125). */
  extraLsx: { id: string; code: string }[]
  history: ApprovalEvent[]
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

  const receivedById = new Map(statusLines.map((s) => [s.id, s]))
  //"Đã về / còn thiếu " chỉ có nghĩa từ lúc đơn rời bàn duyệt trở đi.
  const showReceived = !['draft', 'pending_approval', 'approved', 'cancelled'].includes(
    po.status,
  )
  const m = poMoney({
    subtotalRaw: lines.reduce((s, l) => s + poLineAmount(l), 0),
    discount: po.discount_amount,
    vatRate: po.vat_rate,
    priceIncludesVat: po.price_includes_vat,
  })
  const today = new Date().toISOString().slice(0, 10)
  const late = assessPoLate(po, today)
  const lsxCodes = po.lsx_code
    ? [po.lsx_code, ...extraLsx.map((l) => l.code)].join(' + ')
    : null

  const chain: ChainNode[] = [
    ...(po.order_code ? [{ label: 'Đơn hàng', value: po.order_code }] : []),
    ...(lsxCodes ? [{ label: 'Lệnh SX', value: lsxCodes }] : []),
    { label: 'Đơn đặt vật tư', value: po.code, current: true },
  ]

  /** Xoá nháp xong thì đơn không còn — ở lại trang này là ở lại một trang 404. */
  async function removeDraft() {
    if (await act.deleteDraft(po)) router.push('/planning/pos')
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      <TopProgressBar active={act.busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Đơn đặt vật tư', href: '/planning/pos' },
          { label: po.code },
        ]}
        title={`Đơn đặt ${po.code}`}
        description={`${po.supplier_name} · ${lsxCodes ? `LSX ${lsxCodes}` : 'đơn ngoài LSX'}${
          po.contract_no ? ` · theo HĐ ${po.contract_no}` : ''
        }`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`/print/supply/${po.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm shadow-xs hover:bg-muted"
            >
              <Printer className="size-4" aria-hidden /> In đơn đặt hàng
            </a>
            <Link
              href="/planning/pos"
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="size-4" aria-hidden /> Về danh sách
            </Link>
          </div>
        }
      />

      <RefChain nodes={chain} />

      <div className={card}>
        <div className="px-3.5 py-3">
          <PoStatusStepper
            status={po.status}
            dates={{
              draft: po.created_at,
              // Đơn cũ (trước 0116) tạo là vào thẳng chờ duyệt nên created_at
              // chính là mốc gửi; đơn nháp thì chưa gửi — không có mốc.
              pending_approval: po.status === 'draft' ? null : po.created_at,
              approved: po.approved_at,
              ordered: po.ordered_at,
            }}
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── TRÁI: đơn này gồm những gì ─────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className={`${card} min-w-0`}>
            <div className={cardHead}>
              <b>Dòng hàng</b>
              <span className="text-muted-foreground">{lines.length} dòng</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                    <th className="py-2 pr-2 pl-3.5">Vật tư</th>
                    <th className="w-24 py-2 pr-2">Quy cách</th>
                    <th className="w-20 py-2 pr-2 text-right">SL đặt</th>
                    {showReceived && (
                      <>
                        <th className="w-20 py-2 pr-2 text-right">Đã về</th>
                        <th className="w-20 py-2 pr-2 text-right">Còn thiếu</th>
                      </>
                    )}
                    <th className="w-24 py-2 pr-2 text-right">Đơn giá</th>
                    <th className="w-28 py-2 pr-3.5 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const st = receivedById.get(l.id)
                    return (
                      <tr
                        key={l.id}
                        className="border-b border-border/60"
                      >
                        <td className="py-1.5 pr-2 pl-3.5">
                          <div className="flex flex-col">
                            <span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {l.material_code}
                              </span>{' '}
                              {l.material_name}
                            </span>
                            {(l.qty2 != null || l.note) && (
                              <span className="text-xs text-muted-foreground">
                                {l.qty2 != null && `${money(l.qty2)} ${l.unit2 ?? ''}`}
                                {l.qty2 != null && l.note && ' · '}
                                {l.note}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 pr-2 text-xs">{l.spec ?? '—'}</td>
                        <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                          {money(l.qty_ordered)} {l.material_unit}
                        </td>
                        {showReceived && (
                          <>
                            <td className="py-1.5 pr-2 text-right">
                              {money(st?.qty_received ?? 0)}
                            </td>
                            <td className="py-1.5 pr-2 text-right">
                              {st && st.qty_missing > 0 ? (
                                <span className="font-medium text-amber-600">
                                  {money(st.qty_missing)}
                                </span>
                              ) : (
                                <Badge tone="green">Đủ</Badge>
                              )}
                            </td>
                          </>
                        )}
                        <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                          {l.unit_price != null ? (
                            <>
                              {money(l.unit_price)}
                              {l.price_basis === 'unit2' && l.unit2 && (
                                <span className="text-xs text-violet-600">
                                  /{l.unit2}
                                </span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-1.5 pr-3.5 text-right font-medium">
                          {l.unit_price != null ? money(poLineAmount(l)) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/*
                  TỔNG SỐ LƯỢNG — cùng con số với phiếu in mà NCC đang cầm.
                  Đơn tính theo kg thì tổng là KG (mua nhôm/inox ai cũng hỏi
                  "bao nhiêu kg"), còn lại gộp theo từng ĐVT: cộng 500 con vít
                  với 3 kg nhôm ra một con số vô nghĩa.
                */}
                {qtyTotals(
                  lines.some((l) => l.price_basis === 'unit2' && l.unit2),
                  lines,
                ).length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border">
                      <td
                        colSpan={showReceived ? 6 : 4}
                        className="py-2 pr-2 pl-3.5 text-right text-xs text-muted-foreground"
                      >
                        {qtyTotals(
                          lines.some((l) => l.price_basis === 'unit2' && l.unit2),
                          lines,
                        )
                          .map((t) => `${t.label}: ${money(t.value)}`)
                          .join('  ·  ')}
                      </td>
                      <td className="py-2 pr-3.5 text-right text-xs font-semibold">
                        {money(m.subtotal)} {po.currency}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          <PoTerms po={po} />

          {/* Đơn gộp (0125) — nói rõ tiền này mua cho những lệnh nào. */}
          {extraLsx.length > 0 && (
            <section className={card}>
              <div className={cardHead}>
                <b>Mua chung cho nhiều lệnh</b>
                <span className="text-muted-foreground">{extraLsx.length + 1} lệnh</span>
              </div>
              <div className="flex flex-wrap gap-1.5 px-3.5 py-3">
                {[{ id: po.production_order_id ?? '', code: po.lsx_code ?? '—' }]
                  .concat(extraLsx)
                  .map((l, i) => (
                    <span
                      key={l.id || i}
                      className="rounded-full bg-violet-50 px-2 py-0.5 font-mono text-[11px] font-medium text-violet-700"
                    >
                      {l.code}
                      {i === 0 && ' · lệnh chính'}
                    </span>
                  ))}
              </div>
            </section>
          )}

          {/* Hồ sơ mua hàng (FR-SUP-07): báo giá NCC, hợp đồng, chứng từ giao nhận */}
          <section className={`${card} p-3.5`}>
            <DocumentFiles
              kind="purchase_order"
              id={po.id}
              canEdit={isSupply || canApprove}
              title="Hồ sơ mua hàng (báo giá NCC, hợp đồng, chứng từ)"
            />
          </section>
        </div>

        {/* ── PHẢI: giờ tôi phải làm gì ──────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            <section className={card}>
              <div className={cardHead}>
                <Badge tone={PO_STATUS_TONE[po.status]}>
                  {PO_STATUS_LABEL[po.status]}
                </Badge>
                {PO_NEXT_HINT[po.status] && (
                  <span className="text-[11px] text-muted-foreground">
                    → {PO_NEXT_HINT[po.status]}
                  </span>
                )}
              </div>
              <dl className="flex flex-col gap-2 px-3.5 py-3 text-[13px]">
                <Row label="Nhà cung cấp" value={po.supplier_name} />
                <Row label="Phụ trách" value={po.assignee_name ?? '— chưa có —'} />
                <Row
                  label="Hẹn giao"
                  value={
                    po.expected_at ? (
                      <span
                        className={
                          late === 'overdue'
                            ? 'font-medium text-[var(--stop)]'
                            : ''
                        }
                      >
                        {day(po.expected_at)}
                        {late === 'overdue' && ' ⚠ quá hẹn'}
                      </span>
                    ) : isMissingEta(po) ? (
                      <span className="font-medium text-amber-600">
                        ⚠ chưa hẹn giao
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <Row label="Ngày tạo" value={day(po.created_at)} />
                <div className="mt-1 border-t border-border/70 pt-2">
                  <Row label="Tiền hàng" value={`${money(m.subtotal)} ${po.currency}`} />
                  {m.discountAmount > 0 && (
                    <Row label="Chiết khấu" value={`− ${money(m.discountAmount)}`} />
                  )}
                  {po.vat_rate != null && (
                    <Row
                      label={`VAT ${po.vat_rate}% (${po.price_includes_vat ? 'đã gồm' : 'chưa gồm'})`}
                      value={money(m.vatAmount)}
                    />
                  )}
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                      Tổng thanh toán
                    </span>
                    <b className="text-base tabular-nums">
                      {money(m.grandTotal)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        {po.currency}
                      </span>
                    </b>
                  </div>
                </div>
              </dl>
            </section>

            <section className={card}>
              <div className={cardHead}>
                <b>Thao tác</b>
              </div>
              <div className="flex flex-col gap-2 px-3.5 py-3">
                {/* NHÁP (0116): người soạn toàn quyền — đơn chưa tới bàn sếp. */}
                {canEdit && po.status === 'draft' && (
                  <>
                    <button className={btnPrimary} onClick={() => void act.submitPo(po)}>
                      Gửi GĐ duyệt
                    </button>
                    <Link
                      href={`/planning/pos/${po.id}/edit`}
                      className={`${btn} block text-center`}
                    >
                      Sửa đơn
                    </Link>
                    <button className={btnDanger} onClick={() => void removeDraft()}>
                      Xoá nháp
                    </button>
                  </>
                )}
                {/* Chờ duyệt (0128): không sửa trực tiếp — rút về nháp rồi sửa. */}
                {canEdit && po.status === 'pending_approval' && (
                  <button className={btn} onClick={() => void act.withdrawPo(po)}>
                    Rút về nháp để sửa
                  </button>
                )}
                {canApprove && po.status === 'pending_approval' && (
                  <>
                    <button className={btnGreen} onClick={() => void act.approve(po)}>
                      Duyệt đơn đặt
                    </button>
                    <button
                      className={btnDanger}
                      onClick={() => setReasoning({ po, kind: 'reject', reason: '' })}
                    >
                      Từ chối
                    </button>
                  </>
                )}
                {canEdit && po.status === 'approved' && (
                  <button
                    className={btnPrimary}
                    onClick={() => void act.advance(po, 'ordered')}
                  >
                    Gửi NCC
                  </button>
                )}
                {canEdit && po.status === 'ordered' && (
                  <button
                    className={btn}
                    onClick={() => void act.advance(po, 'confirmed')}
                  >
                    NCC xác nhận
                  </button>
                )}
                {canEdit && ['ordered', 'confirmed'].includes(po.status) && (
                  <button
                    className={btn}
                    onClick={() => void act.advance(po, 'in_transit')}
                  >
                    Đang giao
                  </button>
                )}
                {canEdit && canReschedule(po.status).ok && (
                  <button
                    className={btn}
                    onClick={() =>
                      setRescheduling({
                        po,
                        date: po.expected_at?.slice(0, 10) ?? '',
                        reason: '',
                      })
                    }
                  >
                    Đổi hẹn giao
                  </button>
                )}
                {canReassign && !['received', 'cancelled'].includes(po.status) && (
                  <button
                    className={btn}
                    onClick={() => setReassigning({ po, toId: '' })}
                  >
                    Bàn giao người phụ trách
                  </button>
                )}
                {/*
                  NHÂN BẢN mở cho MỌI trạng thái, không riêng đơn đã huỷ: mua
                  lặp lại cùng một rổ vật tư từ cùng một NCC là việc hằng tháng,
                  và chép tay 15 dòng là chỗ sinh sai số.
                */}
                {isSupply && (
                  <Link
                    href={`/planning/pos/${po.id}/edit?duplicate=1`}
                    className={`${btn} block text-center`}
                  >
                    {po.status === 'cancelled' ? 'Tạo lại từ đơn này' : 'Nhân bản đơn'}
                  </Link>
                )}
                {/* Nháp không có"Huỷ" — xoá hẳn ở trên; huỷ-có-lý-do dành cho
                    đơn đã gửi đi và cần để lại dấu vết. */}
                {canEdit && !['draft', 'received', 'cancelled'].includes(po.status) && (
                  <button
                    className={btnDanger}
                    onClick={() => setReasoning({ po, kind: 'cancel', reason: '' })}
                  >
                    Huỷ đơn
                  </button>
                )}
                {!canEdit && !canApprove && (
                  <p className="text-muted-foreground text-xs">
                    Bạn đang xem đơn của người khác — chỉ đọc.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className={card}>
            <div className={cardHead}>
              <b>Lịch sử</b>
              <span className="text-muted-foreground">{history.length} mốc</span>
            </div>
            {history.length === 0 ? (
              <p className="text-muted-foreground px-3.5 py-3 text-xs">
                Chưa có mốc nào — đơn còn nằm ở người soạn.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5 px-3.5 py-3">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-col gap-0.5 text-xs">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={HISTORY_TONE[h.action]}>
                        {HISTORY_LABEL[h.action]}
                      </Badge>
                      <span className="text-muted-foreground">{h.actor_name ?? 'hệ thống'}</span>
                    </span>
                    <span className="text-muted-foreground">{stamp(h.created_at)}</span>
                    {h.reason && (
                      <span className="text-muted-foreground">
                        “{h.reason}”
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

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
              : await act.cancelPo(st.po, st.reason)
          if (ok) setReasoning(null)
        }}
        busy={act.busy}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground shrink-0 text-xs">{label}</dt>
      <dd className="min-w-0 truncate text-right">{value}</dd>
    </div>
  )
}

/**
 * ĐIỀU KHOẢN ĐẦY ĐỦ — đúng những dòng in ra cho nhà cung cấp.
 *
 * Bản trước chỉ hiện mỗi `terms` (dòng gộp) nên năm điều khoản riêng — chất
 * lượng, nơi giao, thanh toán, hoá đơn, thời gian giao — chỉ tồn tại trên phiếu
 * in. Người phụ trách muốn kiểm lại "mình đã hẹn thanh toán bao nhiêu ngày "
 * phải mở tab in ra xem, mà tờ in thì lại là thứ NCC đang cầm: sai một chữ ở đó
 * là sai cam kết.
 */
function PoTerms({ po }: { po: PoDetailPo }) {
  const rows: [string, string | null][] = [
    ['Mẫu đơn', poTemplateMeta(po.template as PoTemplate).label],
    ['Chất lượng', po.terms_quality],
    ['Nơi giao hàng', po.terms_delivery_place],
    ['Thanh toán', po.terms_payment],
    ['Hoá đơn', po.terms_invoice],
    ['Thời gian giao', po.terms_lead_time],
    ['Người ký', po.signer_role],
  ]
  const shown = rows.filter(([, v]) => v)
  if (shown.length === 0 && !po.terms && !po.note) return null

  return (
    <section className={card}>
      <div className={cardHead}>
        <b>Điều khoản & ghi chú</b>
      </div>
      <dl className="grid gap-x-4 gap-y-1.5 px-3.5 py-3 text-[13px] sm:grid-cols-2">
        {shown.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-muted-foreground w-28 shrink-0 text-xs">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {(po.terms || po.note) && (
        <div className="flex flex-col gap-1.5 border-t border-border/70 px-3.5 py-3 text-xs text-muted-foreground">
          {po.terms && <p>{po.terms}</p>}
          {po.note && <p>{po.note}</p>}
        </div>
      )}
    </section>
  )
}
