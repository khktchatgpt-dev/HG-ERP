'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Btn,
  Combobox,
  Consequence,
  DateInput,
  Empty,
  Field,
  FieldGroup,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  Menu,
  NoticeBar,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  Td,
  TextArea,
  TextInput,
  Th,
  Tick,
  WhyBox,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { todayVn } from '@/lib/date-vn'
import {
  allocateCost,
  costMoney,
  PO_COST_KIND_LABEL,
  type PoCostKind,
} from '@/lib/po-cost'
import { fmtMoney } from '@/lib/po-line'
import type { CostCandidate } from '@/modules/dept/supply/po-costs.service'

/**
 * PHÍ VẬN CHUYỂN TRÊN ĐƠN MUA (0211, artboard 11–11c — duyệt 26/09/2026).
 *
 * Một phiếu chi phí = người nhận tiền (NCC của đơn HOẶC nhà xe) + tiền chưa
 * VAT + VAT riêng + MỘT HAY NHIỀU đơn đi cùng chuyến; máy chia theo tiền hàng
 * mỗi đơn. Phí chưa vào giá nhập kho — Kế toán theo dõi riêng. Không sửa, không
 * xoá: sai thì huỷ kèm lý do rồi ghi lại.
 */

/** Phiếu phí như trang đơn cần — bản rút gọn, tuần tự hoá được của `PoCost`. */
export type CostRow = {
  id: string
  kind: PoCostKind
  cost_date: string
  payee_name: string | null
  doc_no: string | null
  currency: string
  amount: number
  vat_rate: number | null
  vat_amount: number
  note: string | null
  created_by_name: string | null
  voided_at: string | null
  voided_by_name: string | null
  void_reason: string | null
  allocations: { po_id: string; po_code: string | null; base: number; amount: number }[]
}

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
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
  if (costs.length === 0) {
    return (
      <Empty
        level={4}
        headline="Chưa ghi phí nào cho đơn này."
        reason="Phí vận chuyển ghi khi hàng về hoặc khi có hoá đơn nhà xe — đơn giao ra bãi xe thường có phí. Đơn NCC giao tận xưởng thì không có là bình thường."
        next={
          canRecord ? (
            <Btn icon="tien" onClick={onRecord}>
              Ghi phí vận chuyển
            </Btn>
          ) : (
            'Đơn chưa duyệt — phí chỉ ghi khi hàng đã về / có hoá đơn.'
          )
        }
      />
    )
  }
  const live = costs.filter((c) => !c.voided_at)
  return (
    <>
      <Grid minWidth={900}>
        <GridHead>
          <Th width={92}>Ngày</Th>
          <Th width={110}>Loại</Th>
          <Th>Người nhận tiền</Th>
          <Th width={96}>Số HĐ</Th>
          <Th num width={118}>
            Cả phiếu
          </Th>
          <Th num width={118}>
            VAT
          </Th>
          <Th width={150}>Cùng chuyến</Th>
          <Th num width={118}>
            Phần đơn này
          </Th>
          <Th width={44} />
        </GridHead>
        <GridBody>
          {costs.map((c) => {
            const mine = c.allocations.find((a) => a.po_id === poId)
            const others = c.allocations.filter((a) => a.po_id !== poId)
            const voided = !!c.voided_at
            return [
              <GridRow key={c.id}>
                <Td>
                  <span className="num">{dmy(c.cost_date)}</span>
                </Td>
                <Td>
                  {PO_COST_KIND_LABEL[c.kind]} {voided && <Tag>Đã huỷ</Tag>}
                </Td>
                <Td>{c.payee_name ?? '—'}</Td>
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
                  <Td colSpan={9}>
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
          <Td />
        </GridFoot>
      </Grid>
      <p className="text-k-sm px-[var(--gutter)] py-2 text-[var(--ink-2)]">
        Tổng KHÔNG gồm: VAT của phí (khấu trừ riêng), phiếu đã huỷ. Phí CHƯA cộng vào giá
        nhập kho vật tư — Kế toán theo dõi riêng. Phần chia theo tiền hàng mỗi đơn — rê
        chuột lên số để xem phép chia.
      </p>
    </>
  )
}

/* ══ 2. HỘP GHI PHIẾU ═══════════════════════════════════════════════════════ */
type Carrier = { id: string; name: string; phone: string | null }

export function GhiPhiSheet({
  poId,
  poCode,
  supplierId,
  supplierName,
  busy,
  onClose,
  onSubmit,
}: {
  poId: string
  poCode: string
  supplierId: string
  supplierName: string
  busy: boolean
  onClose: () => void
  onSubmit: (body: unknown) => Promise<boolean>
}) {
  const [kind, setKind] = useState<PoCostKind>('van_chuyen')
  const [payee, setPayee] = useState<'ncc' | 'xe'>('xe')
  const [carrierId, setCarrierId] = useState('')
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [date, setDate] = useState(() => todayVn())
  const [docNo, setDocNo] = useState('')
  const [amount, setAmount] = useState('')
  const [vat, setVat] = useState('')
  const [note, setNote] = useState('')
  const [me, setMe] = useState<CostCandidate | null>(null)
  const [suggested, setSuggested] = useState<CostCandidate[]>([])
  const [found, setFound] = useState<CostCandidate[]>([])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Map<string, CostCandidate>>(new Map())
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [addErr, setAddErr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([
      api<{ po: CostCandidate; suggested: CostCandidate[] }>(
        `/api/dept/supply/po-costs/candidates?po_id=${poId}`,
      ),
      api<{ carriers: Carrier[] }>('/api/dept/supply/po-costs/carriers'),
    ])
      .then(([c, k]) => {
        if (!live) return
        setMe(c.po)
        setSuggested(c.suggested)
        setCarriers(k.carriers)
      })
      .catch((e) => live && setLoadErr(apiErrorText(e)))
    return () => {
      live = false
    }
  }, [poId])

  async function search(v: string) {
    setQ(v)
    if (!v.trim()) return setFound([])
    try {
      const r = await api<{ found: CostCandidate[] }>(
        `/api/dept/supply/po-costs/candidates?po_id=${poId}&q=${encodeURIComponent(v.trim())}`,
      )
      setFound(r.found)
    } catch (e) {
      setLoadErr(apiErrorText(e))
    }
  }

  async function addCarrier() {
    setAddErr(null)
    try {
      const r = await api<{ carrier: Carrier }>('/api/dept/supply/po-costs/carriers', {
        method: 'POST',
        body: { name: newName, phone: newPhone || null },
      })
      setCarriers((cs) =>
        cs.some((c) => c.id === r.carrier.id) ? cs : [...cs, r.carrier],
      )
      setCarrierId(r.carrier.id)
      setAdding(false)
      setNewName('')
      setNewPhone('')
    } catch (e) {
      setAddErr(apiErrorText(e))
    }
  }

  const toggle = (c: CostCandidate, on: boolean) =>
    setPicked((s) => {
      const n = new Map(s)
      if (on) n.set(c.id, c)
      else n.delete(c.id)
      return n
    })

  const currency = me?.currency ?? 'VND'
  const trip = useMemo(() => (me ? [me, ...picked.values()] : []), [me, picked])
  const amt = Number(amount) || 0
  const money = costMoney(amt, vat === '' ? null : Number(vat), currency)
  const alloc = useMemo(
    () =>
      allocateCost(
        money.amount,
        trip.map((t) => ({ po_id: t.id, base: t.base })),
        currency,
      ),
    [money.amount, trip, currency],
  )
  const sumBase = trip.reduce((s, t) => s + t.base, 0)
  const mineAlloc = alloc[0]

  const payeeId = payee === 'ncc' ? supplierId : carrierId
  const problems = [
    !payeeId && 'chưa chọn người nhận tiền',
    !(amt > 0) && 'chưa ghi tiền phí',
    !date && 'chưa ghi ngày phát sinh',
    trip.some((t) => t.currency !== currency) && 'có đơn khác tiền tệ — tách phiếu riêng',
  ].filter(Boolean) as string[]
  const canSend = !busy && !!me && problems.length === 0

  const cand = (c: CostCandidate, checked: boolean, locked = false) => {
    const other = c.currency !== currency
    return (
      <GridRow key={c.id}>
        <Td>
          <Tick
            label={`Chọn ${c.code}`}
            checked={checked}
            disabled={locked || other}
            onChange={(v) => toggle(c, v)}
          />
        </Td>
        <Td>
          <span className="num k-strong">{c.code}</span>
        </Td>
        <Td>
          {c.supplier_name ?? '—'}
          {other && (
            <span className="text-k-sm k-t-mut">
              {' '}
              · khác tiền tệ ({c.currency}) — ghi phiếu riêng
            </span>
          )}
        </Td>
        <Td num>{m(c.base, c.currency)}</Td>
        <Td num>
          {c.received_on ? `nhập ${dmy(c.received_on).slice(0, 5)}` : 'chưa nhập'}
        </Td>
      </GridRow>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      width={680}
      title={`Ghi phiếu chi phí mua hàng · ${poCode}`}
      subtitle="Phí vận chuyển, bốc xếp… trả cho NCC hoặc nhà xe. Chưa cộng vào giá nhập kho — Kế toán theo dõi riêng. Ghi xong không sửa được — sai thì huỷ kèm lý do rồi ghi lại."
      footer={
        <SheetActions
          busy={busy}
          disabled={!canSend}
          onCancel={onClose}
          onConfirm={() => {
            if (!canSend) return
            void onSubmit({
              payee_supplier_id: payeeId,
              kind,
              cost_date: date,
              doc_no: docNo.trim() || null,
              amount: money.amount,
              vat_rate: vat === '' ? null : Number(vat),
              note: note.trim() || null,
              po_ids: trip.map((t) => t.id),
            }).then((ok) => ok && onClose())
          }}
          confirmLabel="Ghi phiếu"
        />
      }
    >
      {loadErr && (
        <NoticeBar tone="stop" tag="Lỗi tải">
          {loadErr}
        </NoticeBar>
      )}
      <FieldGroup title="Phiếu">
        <Field label="Loại phí">
          <Pick
            label="Loại phí"
            value={kind}
            onChange={(v) => setKind(v as PoCostKind)}
            options={Object.entries(PO_COST_KIND_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>
        <Field label="Người nhận tiền">
          <Pick
            label="Người nhận tiền"
            value={payee}
            onChange={(v) => setPayee(v as 'ncc' | 'xe')}
            options={[
              { value: 'xe', label: 'Nhà xe / đơn vị khác' },
              {
                value: 'ncc',
                label: `NCC của đơn — ${supplierName} (phí trên hoá đơn NCC)`,
              },
            ]}
          />
        </Field>
        {payee === 'xe' && (
          <Field label="Nhà xe">
            <span className="flex flex-wrap items-center gap-2">
              <Combobox
                label="Nhà xe"
                value={carrierId}
                onChange={setCarrierId}
                emptyLabel={
                  carriers.length ? '— chọn nhà xe —' : 'chưa có nhà xe nào — thêm mới'
                }
                placeholder="Gõ tên nhà xe…"
                options={carriers.map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.phone ?? undefined,
                }))}
              />
              {!adding && (
                <Btn icon="them" onClick={() => setAdding(true)}>
                  Thêm nhà xe mới
                </Btn>
              )}
            </span>
          </Field>
        )}
        {payee === 'xe' && adding && (
          <Field label="Nhà xe mới">
            <span className="flex flex-wrap items-center gap-2">
              <TextInput
                label="Tên nhà xe"
                value={newName}
                onCommit={setNewName}
                placeholder="Nhà xe Hùng Vịnh"
              />
              <TextInput
                label="Số điện thoại"
                value={newPhone}
                onCommit={setNewPhone}
                placeholder="SĐT"
                mono
              />
              <Btn
                icon="them"
                primary
                disabled={newName.trim().length < 2}
                onClick={() => void addCarrier()}
              >
                Thêm
              </Btn>
              <Btn onClick={() => setAdding(false)}>Thôi</Btn>
              {addErr && <span className="text-k-sm k-t-stop">{addErr}</span>}
            </span>
          </Field>
        )}
        <Field label="Ngày phát sinh">
          <DateInput label="Ngày phát sinh" value={date} onChange={setDate} />
        </Field>
        <Field label="Số HĐ / phiếu">
          <TextInput
            label="Số hoá đơn / phiếu nhà xe"
            value={docNo}
            onCommit={setDocNo}
            mono
          />
        </Field>
        <Field label={`Tiền chưa VAT (${currency})`}>
          <NumInput aria-label="Tiền chưa VAT" value={amount} onCommit={setAmount} />
        </Field>
        <Field label="VAT %">
          <span className="flex items-center gap-2">
            <NumInput aria-label="Thuế suất VAT của phí" value={vat} onCommit={setVat} />
            <span className="text-k-sm text-[var(--ink-2)]">
              {vat === ''
                ? 'để trống = không hoá đơn VAT'
                : `VAT ${m(money.vat_amount, currency)} · tổng ${m(money.total, currency)}`}
            </span>
          </span>
        </Field>
      </FieldGroup>

      <FieldGroup title="Chuyến này chở hàng của đơn nào?">
        <Grid minWidth={560}>
          <GridHead>
            <Th width={36} />
            <Th width={120}>Đơn</Th>
            <Th>NCC</Th>
            <Th num width={130}>
              Tiền hàng
            </Th>
            <Th num width={90}>
              Nhập kho
            </Th>
          </GridHead>
          <GridBody>
            {me && cand(me, true, true)}
            {suggested.length > 0 && (
              <GridRow>
                <Td colSpan={5}>
                  <span className="text-k-sm k-t-mut">
                    Gợi ý — cùng nơi giao{me?.place ? ` “${me.place}”` : ''}, nhập kho
                    trong ±3 ngày · không tick sẵn, chọn đơn đi chung chuyến
                  </span>
                </Td>
              </GridRow>
            )}
            {suggested.map((c) => cand(c, picked.has(c.id)))}
            {found
              .filter((c) => !suggested.some((s) => s.id === c.id))
              .map((c) => cand(c, picked.has(c.id)))}
          </GridBody>
        </Grid>
        <div className="mt-2 flex items-center gap-2">
          <TextInput
            label="Tìm đơn khác"
            value={q}
            onCommit={(v) => void search(v)}
            placeholder="Gõ mã đơn hoặc tên NCC rồi Enter"
          />
          <span className="text-k-sm k-t-mut">đơn nháp / chờ duyệt / huỷ không hiện</span>
        </div>
      </FieldGroup>

      {amt > 0 && trip.length > 0 && (
        <FieldGroup title="Chia theo tiền hàng mỗi đơn (chưa VAT)">
          <Grid minWidth={480}>
            <GridHead>
              <Th>Đơn</Th>
              <Th num>Tiền hàng</Th>
              <Th num>Tỷ lệ</Th>
              <Th num>Phần phí</Th>
            </GridHead>
            <GridBody>
              {alloc.map((a, i) => (
                <GridRow key={a.po_id}>
                  <Td>
                    <span className="num">{trip[i].code}</span>
                    {i === 0 && <Tag>đơn đang mở</Tag>}
                  </Td>
                  <Td num>{m(a.base, currency)}</Td>
                  <Td num>
                    {sumBase > 0
                      ? `${((a.base / sumBase) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
                      : 'chia đều'}
                  </Td>
                  <Td num>
                    <span className="k-strong">{m(a.amount, currency)}</span>
                  </Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td>Cộng {trip.length} đơn</Td>
              <Td num>{m(sumBase, currency)}</Td>
              <Td num>100%</Td>
              <Td num>{m(money.amount, currency)}</Td>
            </GridFoot>
          </Grid>
          {mineAlloc && trip.length > 1 && sumBase > 0 && (
            <WhyBox
              lines={[
                `${m(money.amount, currency)} × ${m(trip[0].base, currency)} (tiền hàng ${trip[0].code})`,
                `÷ ${m(sumBase, currency)} (tổng tiền hàng ${trip.length} đơn)`,
                'làm tròn về đồng; đồng lẻ còn lệch dồn vào đơn tiền hàng lớn nhất',
              ]}
              result={`${m(mineAlloc.amount, currency)} ${currency}`}
            />
          )}
        </FieldGroup>
      )}

      <FieldGroup title="Ghi chú">
        <TextArea
          value={note}
          onChange={setNote}
          rows={2}
          placeholder="Ví dụ: xe 5 tấn, 1 chuyến bãi Q12 → xưởng"
        />
      </FieldGroup>

      {problems.length > 0 && (
        <p className="text-k-sm k-t-stop mt-2">Chưa ghi được: {problems.join(' · ')}.</p>
      )}
    </Sheet>
  )
}

/* ══ 3. HỘP HUỶ PHIẾU ═══════════════════════════════════════════════════════ */
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
