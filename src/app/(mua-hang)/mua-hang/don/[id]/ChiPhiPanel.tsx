'use client'

import { useState } from 'react'
import {
  Btn,
  Consequence,
  Empty,
  FieldGroup,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  Menu,
  Sheet,
  SheetActions,
  Tag,
  Td,
  TextArea,
  Th,
} from '@/components/kit'
import { todayVn } from '@/lib/date-vn'
import { fmtMoney } from '@/lib/po-line'
import {
  costStateTag,
  dmy,
  modeLabel,
  payerLabel,
  type CostRow,
} from '../../van-chuyen/van-chuyen.shared'

export type { CostRow }
export { GhiPhiSheet } from '../../van-chuyen/GhiPhiSheet'

/**
 * CHI PHÍ VẬN CHUYỂN TRÊN ĐƠN MUA (0211 + 0215).
 *
 * Khối trên đơn chỉ BÀY phiếu gắn đơn này và mở hộp ghi / huỷ; hộp ghi phiếu
 * dùng chung với sổ chuyến (`/mua-hang/van-chuyen`). Phí chưa vào giá nhập
 * kho — Kế toán theo dõi riêng. Không sửa, không xoá: sai thì huỷ kèm lý do.
 */

const m = (v: number, cur: string) => fmtMoney(v, cur)

/** Phần phí (chưa VAT) của MỘT đơn — cộng các phiếu còn hiệu lực. Nguồn duy nhất cho khối, ô đếm và cột phải. */
export function costShareOf(costs: CostRow[], poId: string): number {
  return costs
    .filter((c) => !c.voided_at)
    .reduce((s, c) => s + (c.allocations.find((a) => a.po_id === poId)?.amount ?? 0), 0)
}

/* ══ 1. BẢNG PHIẾU PHÍ CỦA ĐƠN ══════════════════════════════════════════════ */
export function ChiPhiGrid({
  costs,
  poId,
  currency,
  canRecord,
  onRecord,
  onVoid,
  onOpenPo,
}: {
  costs: CostRow[]
  poId: string
  currency: string
  /** Được ghi phí không (đơn đã duyệt trở đi + có quyền) — rỗng thì mới mời ghi. */
  canRecord: boolean
  onRecord: () => void
  onVoid: (c: CostRow) => void
  onOpenPo: (id: string) => void
}) {
  const today = todayVn()
  if (costs.length === 0) {
    return (
      <Empty
        level={4}
        headline="Chưa ghi phí nào cho đơn này."
        reason="Phí vận chuyển ghi khi hàng về hoặc khi có biên nhận nhà xe — đơn giao ra bãi xe thường có phí. Đơn NCC giao tận xưởng thì không có là bình thường."
        next={
          canRecord ? (
            <Btn icon="tien" onClick={onRecord}>
              Ghi phí vận chuyển
            </Btn>
          ) : (
            'Đơn chưa duyệt — phí chỉ ghi khi hàng đã về / có biên nhận.'
          )
        }
      />
    )
  }
  const live = costs.filter((c) => !c.voided_at)
  return (
    <>
      <Grid minWidth={1040}>
        <GridHead>
          <Th width={88}>Ngày</Th>
          <Th width={110}>Hình thức</Th>
          <Th>Người thu</Th>
          <Th width={92}>Số phiếu</Th>
          <Th num width={110}>
            Cả phiếu
          </Th>
          <Th num width={96}>
            VAT
          </Th>
          <Th width={130}>Cùng chuyến</Th>
          <Th num width={110}>
            Phần đơn này
          </Th>
          <Th width={150}>Ai trả</Th>
          <Th width={130}>Tiền</Th>
          <Th width={44} />
        </GridHead>
        <GridBody>
          {costs.map((c) => {
            const mine = c.allocations.find((a) => a.po_id === poId)
            const others = c.allocations.filter((a) => a.po_id !== poId)
            const voided = !!c.voided_at
            const payer = payerLabel(c)
            const st = costStateTag(c, today)
            return [
              <GridRow key={c.id}>
                <Td>
                  <span className="num">{dmy(c.cost_date)}</span>
                </Td>
                <Td>{modeLabel(c.transport_mode)}</Td>
                <Td>
                  {c.payee_name ?? '—'}
                  {c.payee_phone && (
                    <span className="text-k-sm k-t-mut"> · {c.payee_phone}</span>
                  )}
                </Td>
                <Td>
                  <span className="num">{c.doc_no ?? '—'}</span>
                </Td>
                <Td num>{m(c.amount, c.currency)}</Td>
                <Td num>
                  {c.vat_rate == null || c.vat_rate === 0
                    ? 'không VAT'
                    : `${c.vat_rate}% · ${m(c.vat_amount, c.currency)}`}
                </Td>
                <Td>
                  {others.length === 0 ? (
                    <span className="k-t-mut">chỉ đơn này</span>
                  ) : (
                    others.map((a, i) => (
                      <span key={a.po_id}>
                        {i > 0 && ' · '}
                        <GridBtn
                          title={`Mở đơn ${a.po_code ?? ''}`}
                          onClick={() => onOpenPo(a.po_id)}
                        >
                          {/* Số đuôi đủ nhận ra đơn cùng năm; mã đầy đủ ở title. */}
                          {(a.po_code ?? '?').replace(/^PO-\d{4}-/, '')}
                        </GridBtn>
                      </span>
                    ))
                  )}
                </Td>
                <Td num>
                  <span
                    className={voided ? 'k-t-mut line-through' : 'k-strong'}
                    title={
                      mine
                        ? `${m(c.amount, c.currency)} × ${m(mine.base, c.currency)} ÷ ${m(
                            c.allocations.reduce((s, a) => s + a.base, 0),
                            c.currency,
                          )} (tiền hàng đơn này ÷ tổng tiền hàng các đơn cùng phiếu)`
                        : undefined
                    }
                  >
                    {mine ? m(mine.amount, c.currency) : '—'}
                  </span>
                </Td>
                <Td>
                  {payer.who}
                  {payer.how && <span className="text-k-sm k-t-mut"> · {payer.how}</span>}
                </Td>
                <Td>
                  <Tag tone={st.tone}>{st.label}</Tag>
                </Td>
                <Td>
                  {!voided && (
                    <Menu
                      ariaLabel={`Việc với phiếu phí ${c.doc_no ?? dmy(c.cost_date)}`}
                      items={[
                        { label: 'Huỷ phiếu', danger: true, onClick: () => onVoid(c) },
                      ]}
                    />
                  )}
                </Td>
              </GridRow>,
              voided ? (
                <GridRow key={`${c.id}-huy`}>
                  <Td colSpan={11}>
                    <span className="text-k-sm k-t-mut">
                      Huỷ {c.voided_at ? dmy(todayVn(new Date(c.voided_at))) : ''} ·{' '}
                      {c.voided_by_name ?? '—'} — “{c.void_reason}” · không tính vào tổng
                    </span>
                  </Td>
                </GridRow>
              ) : null,
            ]
          })}
        </GridBody>
        <GridFoot>
          <Td colSpan={7}>Cộng phí của đơn này · {live.length} phiếu</Td>
          <Td num>{m(costShareOf(costs, poId), currency)}</Td>
          <Td colSpan={3} />
        </GridFoot>
      </Grid>
      <p className="text-k-sm px-[var(--gutter)] py-2 text-[var(--ink-2)]">
        Tổng KHÔNG gồm: VAT của phí (khấu trừ riêng), phiếu đã huỷ. Phí CHƯA cộng vào giá
        nhập kho vật tư — Kế toán theo dõi riêng. Phần chia theo tiền hàng mỗi đơn — rê
        chuột lên số để xem phép chia. Sổ mọi chuyến ở Mua hàng › Vận chuyển.
      </p>
    </>
  )
}

/* ══ 2. HỘP HUỶ PHIẾU ═══════════════════════════════════════════════════════ */
export function HuyPhiSheet({
  cost,
  busy,
  onClose,
  onSubmit,
}: {
  cost: CostRow
  busy: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState('')
  const ok = reason.trim().length >= 5
  const n = cost.allocations.length
  return (
    <Sheet
      open
      onClose={onClose}
      width={520}
      stakes="nang"
      title={`Huỷ phiếu phí ${cost.doc_no ?? dmy(cost.cost_date)}?`}
      subtitle="Phiếu không mất — còn trong sổ với dấu “Đã huỷ” và lý do. Ghi lại phiếu đúng sau khi huỷ."
      footer={
        <SheetActions
          busy={busy}
          disabled={!ok || busy}
          stakes="nang"
          onCancel={onClose}
          cancelLabel="Không huỷ"
          confirmLabel="Huỷ phiếu"
          onConfirm={() => ok && void onSubmit(reason.trim()).then((r) => r && onClose())}
        />
      }
    >
      <Consequence>
        {n > 1
          ? `Phiếu này chia cho ${n} đơn — huỷ là huỷ phần phí ở cả ${n}: ${cost.allocations.map((a) => a.po_code).join(' · ')}.`
          : `Phần phí ${m(cost.amount, cost.currency)} ${cost.currency} của đơn sẽ không còn tính.`}
        {cost.paid_by &&
          !cost.reimbursed_at &&
          ' Phiếu đang chờ Kế toán hoàn chi hộ — huỷ thì khoản hoàn cũng thôi.'}
      </Consequence>
      <FieldGroup title="Lý do">
        <TextArea
          value={reason}
          onChange={setReason}
          rows={3}
          placeholder="Ví dụ: ghi nhầm số tiền, hoá đơn nhà xe là 3.600.000"
        />
      </FieldGroup>
      {!ok && <p className="text-k-sm k-t-mut">Ghi lý do ít nhất 5 ký tự.</p>}
    </Sheet>
  )
}
