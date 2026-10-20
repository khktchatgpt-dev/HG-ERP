'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Code,
  Consequence,
  DateInput,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  LineStatus,
  Menu,
  NumInput,
  Sheet,
  SheetActions,
  Tag,
  Td,
  TextArea,
  TextInput,
  Th,
} from '@/components/kit'
import {
  allocateReceiptsToShipments,
  shipmentAmount,
  validateShipments,
  type ShipmentInput,
  type ShipmentLineMoney,
} from '@/lib/po-shipments'
import type { ReceiptBatch } from '@/modules/dept/supply/po-receipts.service'
import {
  batchesToShipments,
  lineShortAction,
  receiptVerdict,
  scheduleRows,
  shipmentBadge,
  type Batch,
  type ShipmentLineRef,
  type ShipmentLite,
} from './nhan-hang'

/**
 * GIAO & NHẬN HÀNG trên màn chứng từ đơn mua (kit; logic thuần ở `lib/po-shipments`
 * + `nhan-hang.ts`). Ba khối: Kế hoạch giao = NCC HẸN gì (đợt 0152) · Nhận theo đợt
 * = Kho THỰC NHẬN gì (ma trận dòng × phiếu, B3) · Chứng từ kho. Hai sổ khác nhau —
 * trộn làm một là người mua không còn biết NCC trễ hay Kho chưa ghi.
 */

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/* ══ 1. KẾ HOẠCH GIAO ════════════════════════════════════════════════ */
export function DotGiaoGrid({
  shipments,
  linesById,
  currency,
  receivedByLine,
  linkedReceipts,
  confirmedNote,
  emptyHint,
  canAct,
  busy,
  today,
  onArrived,
  onReschedule,
  onCancel,
  onEdit,
  onSplit,
}: {
  shipments: ShipmentLite[]
  linesById: Map<string, ShipmentLineRef>
  currency: string
  /** SL đã về theo DÒNG (sổ kho) — nguồn cho suy diễn "đợt này về mấy". */
  receivedByLine: Map<string, number>
  /** Đã về CÓ CHỨNG TỪ theo đợt (PNK nối shipment_id) — số thật. */
  linkedReceipts: Map<string, Map<string, number>>
  confirmedNote: string | null
  emptyHint: string
  /** Được thao tác trên đợt (xe tới / dời / huỷ). */
  canAct: boolean
  busy: boolean
  today: string
  onArrived: (id: string) => void
  onReschedule: (s: ShipmentLite) => void
  onCancel: (s: ShipmentLite) => void
  /** Sửa SL từng dòng + ngày của đợt đang hẹn (27/09/2026). */
  onEdit: (s: ShipmentLite) => void
  /** Lấy trước một phần đợt (hàng gấp) → đợt mới ngày sớm hơn. */
  onSplit: (s: ShipmentLite) => void
}) {
  const moneyByLine = useMemo(
    () =>
      new Map<string, ShipmentLineMoney>(
        [...linesById.values()].map((l) => [l.id, { amount: l.amount, qty_ordered: l.qty_ordered, approx: l.price_approx }]), // prettier-ignore
      ),
    [linesById],
  )
  const alive = shipments.filter((s) => s.status !== 'cancelled')
  const planTotal = shipmentAmount(
    alive.flatMap((s) => s.lines),
    moneyByLine,
  )
  const got = allocateReceiptsToShipments(shipments, receivedByLine, linkedReceipts)
  const anyReceived = [...receivedByLine.values()].some((v) => v > 0)
  const rows = scheduleRows([...linesById.values()], shipments)
  const anyLeft = rows.some((r) => r.left > 0.000001)

  if (shipments.length === 0) {
    return (
      <div className="text-k-sm px-[var(--gutter)] py-3 text-[var(--ink-2)]">
        <b>Chưa chia đợt</b> — hiểu là giao một lần vào hạn giao của đơn. {emptyHint}
      </div>
    )
  }

  return (
    <>
      {confirmedNote && (
        <div className="text-k-sm border-b border-[var(--hair)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
          NCC cam kết: “{confirmedNote}”
        </div>
      )}
      <Grid minWidth={860}>
        <GridHead>
          <Th width={116}>Đợt giao</Th>
          <Th width={96}>Ngày hẹn</Th>
          <Th width={90}>Trạng thái</Th>
          <Th>Hàng trong đợt</Th>
          <Th num>Tiền kế hoạch</Th>
          <Th>Ghi chú</Th>
          {canAct && <Th width={210} />}
        </GridHead>
        <GridBody>
          {shipments.map((s) => {
            const live = s.status === 'planned' || s.status === 'arrived'
            const overdue = live && s.expected_date < today
            const badge = shipmentBadge(s.status, overdue)
            const money = shipmentAmount(s.lines, moneyByLine)
            const per = got.get(s.id)
            return (
              <GridRow key={s.id}>
                {/* MÃ chứ không phải số thứ tự: đợt là chứng từ Kho mở ra làm
                    việc, và hai bên phải gọi nó bằng cùng một cái tên. Đợt cũ
                    chưa có mã thì vẫn hiện số thứ tự, không để ô trống. */}
                <Td>
                  {s.code ? (
                    <Code>{s.code}</Code>
                  ) : (
                    <span className="num">đợt {s.seq}</span>
                  )}
                </Td>
                <Td num tone={overdue ? 'stop' : undefined}>
                  {dmy(s.expected_date)}
                </Td>
                <Td>
                  <Tag tone={badge.tone}>{badge.label}</Tag>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 whitespace-normal">
                    {s.lines.map((l) => {
                      const ref = linesById.get(l.po_line_id)
                      const g = per?.get(l.po_line_id)
                      const q = g?.qty ?? 0
                      const tone = q >= l.qty - 0.000001 ? 'k-t-done' : q > 0 ? 'k-t-warn' : 'k-t-stop' // prettier-ignore
                      return (
                        <span key={l.po_line_id}>
                          {ref?.name ?? '?'}{' '}
                          <span className="num">
                            {num(l.qty)} {ref?.unit ?? ''}
                          </span>
                          {anyReceived && s.status !== 'cancelled' && (
                            <span
                              className={`num ${tone}`}
                              title={g && !g.exact ? 'Ước theo thứ tự đợt — phiếu nhập không ghi rõ đợt' : undefined} // prettier-ignore
                            >
                              {' '}
                              · về {g && !g.exact ? '≈' : ''}
                              {num(q)}
                            </span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </Td>
                <Td num>
                  {money.priced && s.status !== 'cancelled'
                    ? `${money.approx ? '≈ ' : ''}${num(Math.round(money.amount))} ${currency}`
                    : '—'}
                </Td>
                <Td>{s.note ?? ''}</Td>
                {canAct && (
                  <Td>
                    {/* Đợt ĐANG HẸN: hai việc hay làm nằm ngoài (xe tới, lấy hàng
                        gấp), việc sửa lịch gom vào ⋯. Đợt xe đã tới (đang nhận
                        dở) chỉ còn dời / huỷ — số lượng đã có phiếu bám vào. */}
                    {s.status === 'planned' && (
                      <span className="flex items-center gap-1">
                        <GridBtn disabled={busy} onClick={() => onArrived(s.id)}>
                          Xe tới
                        </GridBtn>
                        <GridBtn disabled={busy} onClick={() => onSplit(s)}>
                          Lấy trước
                        </GridBtn>
                        <Menu
                          label="⋯"
                          ariaLabel={`Việc khác của ${s.code ?? `đợt ${s.seq}`}`}
                          items={[
                            { label: 'Sửa số lượng / ngày', onClick: () => onEdit(s), disabled: busy }, // prettier-ignore
                            { label: 'Dời ngày', onClick: () => onReschedule(s), disabled: busy }, // prettier-ignore
                            { label: 'Huỷ đợt', onClick: () => onCancel(s), danger: true, disabled: busy }, // prettier-ignore
                          ]}
                        />
                      </span>
                    )}
                    {s.status === 'arrived' && (
                      <span className="flex gap-1">
                        <GridBtn disabled={busy} onClick={() => onReschedule(s)}>
                          Dời ngày
                        </GridBtn>
                        <GridBtn disabled={busy} onClick={() => onCancel(s)}>
                          Huỷ đợt
                        </GridBtn>
                      </span>
                    )}
                  </Td>
                )}
              </GridRow>
            )
          })}
        </GridBody>
        {alive.length > 0 && (
          <GridFoot>
            <Td colSpan={3}>Cộng {alive.length} đợt</Td>
            <Td>
              {(alive.length >= 2 || anyLeft) && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-normal whitespace-normal">
                  {rows.map((r) => (
                    <span key={r.id}>
                      {r.name}{' '}
                      <span className="num">
                        {num(r.done)}/{num(r.qty_ordered)} {r.unit}
                      </span>
                      {r.left > 0.000001 && (
                        <span className="k-t-warn"> · còn {num(r.left)} chưa hẹn</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </Td>
            <Td num>
              {planTotal.priced
                ? `${planTotal.approx ? '≈ ' : ''}${num(Math.round(planTotal.amount))} ${currency}`
                : ''}
            </Td>
            <Td colSpan={canAct ? 2 : 1} />
          </GridFoot>
        )}
      </Grid>
    </>
  )
}

/* ══ 2. NHẬN THEO ĐỢT — ma trận dòng × phiếu nhập ══════════════════════ */
export function NhanTheoDotGrid({
  batches,
  lines,
  status,
  poStatus,
  canEdit,
  busy,
  onCloseShort,
  onReopen,
  readOnly = false,
}: {
  /**
   * Chỉ XEM — không vẽ nút Chốt thiếu / Mở lại (trang đơn từ 01/10/2026: việc
   * đó làm ở hộp Giao nhận trên Theo dõi đơn hàng). Khác `canEdit`: khoá theo
   * quyền sẽ nói "chỉ người phụ trách…" — sai lý do với người đang xem.
   */
  readOnly?: boolean
  batches: ReceiptBatch[]
  lines: { id: string; code: string; name: string; unit: string; qty_ordered: number }[]
  status: { id: string; qty_received: number; qty_missing: number; qty_open: number; closed_short_at: string | null }[] // prettier-ignore
  poStatus: string
  canEdit: boolean
  busy: boolean
  /** Chốt phần thiếu của ĐÚNG dòng này (bắt lý do ở sheet của màn). */
  onCloseShort: (line: { id: string; label: string; missing: number; unit: string }) => void // prettier-ignore
  /** NCC đổi ý giao bù → mở lại dòng đã chốt. */
  onReopen: (line: { id: string; label: string }) => void
}) {
  const statusById = new Map(status.map((s) => [s.id, s]))
  // Chỉ dòng có vật tư kho mới có phiếu; dòng tự do không nằm ở đây.
  const rows = lines.filter((l) => batches.some((b) => b.by_line[l.id]) || statusById.has(l.id)) // prettier-ignore
  return (
    <Grid minWidth={640 + batches.length * 110}>
      <GridHead>
        <Th>Vật tư</Th>
        <Th num>Đặt</Th>
        {batches.map((b, i) => (
          <Th key={b.doc_id ?? `day:${b.date}`} num>
            Đợt {i + 1} · {dmy(b.date).slice(0, 5)}
            <div className="text-k-label font-normal tracking-normal text-[var(--ink-3)]">
              {b.doc_code ?? 'không phiếu'}
              {b.supplier_doc_no ? ` · NCC ${b.supplier_doc_no}` : ''}
            </div>
          </Th>
        ))}
        <Th num>Tổng nhận</Th>
        <Th num>Còn thiếu</Th>
        <Th width={120}>Kết luận</Th>
        <Th width={104}>Việc</Th>
      </GridHead>
      <GridBody>
        {rows.map((l) => {
          const v = receiptVerdict(l.qty_ordered, statusById.get(l.id))
          return (
            <GridRow key={l.id}>
              <Td>
                <span className="num k-strong">{l.code}</span> · {l.name}
              </Td>
              <Td num>
                {num(l.qty_ordered)} {l.unit}
              </Td>
              {batches.map((b) => {
                const c = b.by_line[l.id]
                return (
                  <Td key={b.doc_id ?? `day:${b.date}`} num>
                    {c ? num(c.qty) : '—'}
                    {c && c.rejected > 0 && (
                      <span className="k-t-stop text-k-label block">
                        loại {num(c.rejected)}
                      </span>
                    )}
                  </Td>
                )
              })}
              <Td num>
                <b>{num(v.received)}</b>
              </Td>
              <Td num tone={v.missing > 0 ? 'stop' : undefined}>
                {num(Math.max(v.missing, 0))}
              </Td>
              <Td>
                <LineStatus kind={v.kind}>{v.label}</LineStatus>
              </Td>
              <Td>
                {/* Việc theo TỪNG dòng: đơn 12 mã mà NCC hết đúng 1 mã thì chốt
                    cả đơn là nói dối sổ — 11 mã kia vẫn đang chờ về thật. */}
                {(() => {
                  const act = lineShortAction(statusById.get(l.id), { poStatus, canEdit }) // prettier-ignore
                  if (readOnly || act.kind === 'none') return null
                  const label = `${l.code} · ${l.name}`
                  return (
                    <GridBtn
                      disabled={busy || !!act.blocked}
                      title={act.blocked}
                      onClick={
                        () =>
                        act.kind === 'reopen'
                          ? onReopen({ id: l.id, label })
                          : onCloseShort({ id: l.id, label, missing: Math.max(v.missing, 0), unit: l.unit }) // prettier-ignore
                      }
                    >
                      {act.kind === 'reopen' ? 'Mở lại' : 'Chốt thiếu'}
                    </GridBtn>
                  )
                })()}
              </Td>
            </GridRow>
          )
        })}
      </GridBody>
    </Grid>
  )
}

/* ══ 4. HỘP "NCC XÁC NHẬN" / "THÊM ĐỢT" ═══════════════════════════════════
   NCC không đăng nhập: NV cung ứng ghi lại cam kết sau cuộc gọi/Zalo — từng
   dòng NCC hứa bao nhiêu, ngày nào. Một dòng tách được nhiều mảnh; các mảnh
   cùng ngày gộp thành một đợt khi gửi (batchesToShipments). */
export function XacNhanSheet({
  mode,
  poCode,
  defaultDate,
  lines,
  existing,
  busy,
  onClose,
  onSubmit,
}: {
  mode: 'confirm' | 'add'
  poCode: string
  defaultDate: string
  lines: ShipmentLineRef[]
  /** SL đã nằm ở các đợt còn sống (mode 'add') — validate cộng dồn. */
  existing: Map<string, number>
  busy: boolean
  onClose: () => void
  onSubmit: (shipments: ShipmentInput[], note: string) => Promise<boolean>
}) {
  const remainingOf = (l: ShipmentLineRef) => Math.max(l.qty_ordered - (existing.get(l.id) ?? 0), 0) // prettier-ignore
  const [note, setNote] = useState('')
  const [allDate, setAllDate] = useState(defaultDate)
  const [batches, setBatches] = useState<Record<string, Batch[]>>(
    () =>
    Object.fromEntries(lines.map((l) => [l.id, [{ date: defaultDate, qty: remainingOf(l) }]])), // prettier-ignore
  )
  const shipments = useMemo(() => batchesToShipments(lines.map((l) => l.id), batches), [batches, lines]) // prettier-ignore
  const v = useMemo(
    () => validateShipments(shipments, lines.map((l) => ({ id: l.id, qty_ordered: l.qty_ordered, name: l.name })), existing), // prettier-ignore
    [shipments, lines, existing],
  )
  const draftMoney = shipmentAmount(
    shipments.flatMap((s) => s.lines),
    new Map(lines.map((l) => [l.id, { amount: l.amount, qty_ordered: l.qty_ordered, approx: l.price_approx }])), // prettier-ignore
  )
  // Mode 'add' giao bù MỘT phần là chuyện thường — "chưa đủ" chỉ có nghĩa ở
  // lần xác nhận đầu, khi đang chép nguyên cam kết của NCC.
  const warnings = mode === 'confirm' ? v.warnings : []
  const setBatch = (id: string, i: number, part: Partial<Batch>) =>
    setBatches((s) => ({ ...s, [id]: (s[id] ?? []).map((b, j) => (j === i ? { ...b, ...part } : b)) })) // prettier-ignore
  const canSend = !busy && v.errors.length === 0 && shipments.length > 0

  return (
    <Sheet
      open
      onClose={onClose}
      width={760}
      title={
        mode === 'confirm' ? `NCC xác nhận · ${poCode}` : `Thêm đợt giao · ${poCode}`
      }
      subtitle={
        mode === 'confirm'
          ? 'Ghi lại cam kết của nhà cung cấp: từng dòng hứa giao bao nhiêu, ngày nào. Các dòng cùng ngày tự gộp thành một đợt.'
          : 'Đợt NCC hẹn giao bổ sung. Tổng các đợt của một dòng không vượt số lượng đặt.'
      }
      footer={
        <SheetActions
          busy={busy}
          disabled={!canSend}
          onCancel={onClose}
          onConfirm={() => {
            if (!canSend) return
            void onSubmit(shipments, note.trim()).then((ok) => ok && onClose())
          }}
          confirmLabel={mode === 'confirm' ? 'Ghi nhận xác nhận' : 'Thêm đợt'}
        />
      }
    >
      <div className="text-k-sm mb-2 flex items-center gap-2">
        <span className="k-strong">Tất cả giao ngày</span>
        <span className="w-[130px]">
          <DateInput value={allDate} onChange={setAllDate} label="Tất cả giao ngày" />
        </span>
        <Btn
          onClick={
            () =>
            setBatches((s) => Object.fromEntries(Object.entries(s).map(([id, bs]) => [id, bs.map((b) => ({ ...b, date: allDate }))]))) // prettier-ignore
          }
        >
          Áp cho mọi dòng
        </Btn>
      </div>

      <Grid minWidth={620}>
        <GridHead>
          <Th>Vật tư</Th>
          <Th num width={90}>
            {mode === 'confirm' ? 'SL đặt' : 'Còn lại'}
          </Th>
          <Th num width={110}>
            SL giao
          </Th>
          <Th width={150}>Ngày giao</Th>
          <Th width={70} />
        </GridHead>
        <GridBody>
          {lines.map((l) => {
            const bs = batches[l.id] ?? []
            const cap = mode === 'confirm' ? l.qty_ordered : remainingOf(l)
            return bs.map((b, i) => (
              <GridRow key={`${l.id}-${i}`}>
                <Td>
                  {i === 0 ? (
                    <>
                      {l.name} <span className="text-[var(--ink-3)]">{l.unit}</span>
                    </>
                  ) : (
                    <span className="pl-3 text-[var(--ink-3)]">↳ mảnh {i + 1}</span>
                  )}
                </Td>
                <Td num>{i === 0 ? num(cap) : ''}</Td>
                <Td num>
                  <NumInput
                    value={b.qty === '' ? '' : String(b.qty)}
                    aria-label={`SL giao ${l.name}`}
                    onCommit={(raw) => {
                      const n = Number(raw.replace(',', '.'))
                      setBatch(l.id, i, { qty: raw.trim() === '' || !(n >= 0) ? '' : n })
                    }}
                  />
                </Td>
                <Td>
                  <DateInput
                    value={b.date}
                    onChange={(d) => setBatch(l.id, i, { date: d })}
                    label={`Ngày giao ${l.name}`}
                  />{' '}
                  {/* prettier-ignore */}
                </Td>
                <Td>
                  {i === 0 ? (
                    <GridBtn
                      title="Tách thêm mảnh cho dòng này"
                      onClick={() => setBatches((s) => ({ ...s, [l.id]: [...(s[l.id] ?? []), { date: allDate, qty: '' }] }))} // prettier-ignore
                    >
                      + Tách
                    </GridBtn>
                  ) : (
                    <GridBtn
                      onClick={() =>
                        setBatches((s) => ({
                          ...s,
                          [l.id]: (s[l.id] ?? []).filter((_, j) => j !== i),
                        }))
                      }
                    >
                      {' '}
                      {/* prettier-ignore */}
                      Bỏ
                    </GridBtn>
                  )}
                </Td>
              </GridRow>
            ))
          })}
        </GridBody>
      </Grid>

      {draftMoney.priced && shipments.length > 0 && (
        <p className="text-k-sm mt-2 text-right text-[var(--ink-2)]">
          Tiền theo các đợt đang khai:{' '}
          <b className="num text-[var(--ink)]">
            {draftMoney.approx && '≈ '}
            {num(Math.round(draftMoney.amount))}
          </b>
        </p>
      )}
      {v.errors.length > 0 && (
        <ul className="k-t-stop text-k-sm mt-2">
          {v.errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="k-t-warn text-k-sm mt-2">
          {warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}
      {mode === 'confirm' && (
        <label className="mt-3 block">
          <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
            Ghi chú cam kết
          </span>
          <TextInput
            value={note}
            onCommit={setNote}
            maxLength={500}
            placeholder="VD: chị Hoa bên Nam Kim xác nhận qua Zalo 15/08"
            label="Ghi chú cam kết"
          />
        </label>
      )}
    </Sheet>
  )
}

/* ══ 5. DỜI NGÀY / HUỶ MỘT ĐỢT ═══════════════════════════════════════════ */
export function DotSheet({
  kind,
  shipment,
  busy,
  onClose,
  onSubmit,
}: {
  kind: 'reschedule' | 'cancel'
  shipment: ShipmentLite
  busy: boolean
  onClose: () => void
  onSubmit: (date: string, reason: string) => Promise<boolean>
}) {
  const [date, setDate] = useState(shipment.expected_date)
  const [reason, setReason] = useState('')
  const invalid = !reason.trim() || (kind === 'reschedule' && !date)
  return (
    <Sheet
      open
      onClose={onClose}
      stakes={kind === 'cancel' ? 'nang' : 'vua'}
      title={
        kind === 'cancel' ? `Huỷ đợt ${shipment.seq}` : `Dời ngày đợt ${shipment.seq}`
      }
      subtitle={`Đang hẹn ${dmy(shipment.expected_date)}`}
      footer={
        <SheetActions
          stakes={kind === 'cancel' ? 'nang' : 'vua'}
          busy={busy}
          disabled={invalid}
          onCancel={onClose}
          onConfirm={() => {
            if (invalid) return
            void onSubmit(date, reason.trim()).then((ok) => ok && onClose())
          }}
          confirmLabel={kind === 'cancel' ? 'Huỷ đợt' : 'Lưu ngày mới'}
        />
      }
    >
      {kind === 'cancel' && (
        <Consequence>
          Đợt rời khỏi lịch hàng về; phần hàng của đợt quay về “chưa hẹn”. Muốn NCC giao
          lại thì thêm đợt mới.
        </Consequence>
      )}
      {kind === 'reschedule' && (
        <label className="mb-3 block">
          <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
            Ngày giao mới
          </span>
          <DateInput value={date} onChange={setDate} label="Ngày giao mới" />
        </label>
      )}
      <label className="block">
        <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
          Lý do
        </span>
        <TextArea
          value={reason}
          onChange={setReason}
          rows={2}
          placeholder={kind === 'cancel' ? 'NCC báo huỷ chuyến · gộp vào đợt sau…' : 'NCC báo trễ xe · xưởng giục sớm…'} // prettier-ignore
        />
      </label>
    </Sheet>
  )
}

/* ══ 6. SỬA ĐỢT / LẤY TRƯỚC (27/09/2026) ═════════════════════════════════
 *
 * Hai việc thực tế mà trước đây chỉ làm được bằng "huỷ đợt rồi khai lại":
 *   · SỬA — NCC báo giao ít/nhiều hơn trong đợt, hoặc gộp thêm một mã vào chuyến;
 *   · LẤY TRƯỚC — hàng gấp, gọi NCC chở trước một phần (hoặc tự đi lấy). Đợt gốc
 *     giữ mã GH + ngày, bớt đúng phần kéo lên; phần kéo lên thành đợt mới.
 * Số chặn cuối cùng vẫn ở server (tổng đợt ≤ SL đặt, lấy trước ≤ số của đợt).
 */
export function DotSuaSheet({
  kind,
  shipment,
  lines,
  others,
  busy,
  onClose,
  onSubmit,
}: {
  kind: 'edit' | 'split'
  shipment: ShipmentLite
  /** Dòng vật tư kho của đơn — sửa đợt được thêm mã chưa có trong đợt. */
  lines: ShipmentLineRef[]
  /**
   * SL đã nằm trong các đợt SỐNG KHÁC (theo dòng) — để báo "vượt SL đặt" ngay
   * trong hộp thay vì bấm Lưu rồi mới ăn lỗi server.
   */
  others: Map<string, number>
  busy: boolean
  onClose: () => void
  onSubmit: (
    date: string,
    reason: string,
    lines: { po_line_id: string; qty: number }[],
  ) => Promise<boolean>
}) {
  const inShip = new Map(shipment.lines.map((l) => [l.po_line_id, l.qty]))
  const rows = kind === 'split' ? lines.filter((l) => inShip.has(l.id)) : lines
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((l) => [
        l.id,
        kind === 'edit' && inShip.has(l.id) ? String(inShip.get(l.id)) : '',
      ]),
    ),
  )
  const [date, setDate] = useState(kind === 'edit' ? shipment.expected_date : '')
  const [reason, setReason] = useState('')
  const picked = rows
    .map((l) => ({
      po_line_id: l.id,
      qty: Number((qty[l.id] ?? '').replace(',', '.')) || 0,
    }))
    .filter((l) => l.qty > 0)
  const over =
    kind === 'split'
      ? rows.find((l) => (Number((qty[l.id] ?? '').replace(',', '.')) || 0) > (inShip.get(l.id) ?? 0) + 1e-4) // prettier-ignore
      : undefined
  const overOrder =
    kind === 'edit'
      ? rows.find(
          (l) =>
            (others.get(l.id) ?? 0) +
              (picked.find((p) => p.po_line_id === l.id)?.qty ?? 0) >
            l.qty_ordered + 1e-4,
        )
      : undefined
  const takesAll =
    kind === 'split' &&
    shipment.lines.every(
      (sl) =>
        (picked.find((p) => p.po_line_id === sl.po_line_id)?.qty ?? 0) >= sl.qty - 1e-4,
    )
  const why = !date
    ? 'Chọn ngày giao'
    : picked.length === 0
      ? kind === 'split'
        ? 'Nhập số lấy trước cho ít nhất một dòng'
        : 'Đợt phải còn ít nhất một dòng'
      : over
        ? `"${over.name}" lấy trước vượt số của đợt`
        : overOrder
          ? `"${overOrder.name}": các đợt khác đã hẹn ${num(others.get(overOrder.id) ?? 0)}, đợt này tối đa ${num(Math.max(overOrder.qty_ordered - (others.get(overOrder.id) ?? 0), 0))} (SL đặt ${num(overOrder.qty_ordered)})`
          : takesAll
            ? 'Lấy trước toàn bộ đợt = dời ngày cả đợt — dùng "Dời ngày"'
            : !reason.trim()
              ? 'Ghi lý do'
              : null
  const label = shipment.code ?? `đợt ${shipment.seq}`
  return (
    <Sheet
      open
      onClose={onClose}
      stakes="vua"
      title={kind === 'split' ? `Lấy trước từ ${label}` : `Sửa ${label}`}
      subtitle={`Đang hẹn ${dmy(shipment.expected_date)}`}
      footer={
        <SheetActions
          stakes="vua"
          busy={busy}
          disabled={!!why}
          onCancel={onClose}
          onConfirm={() => {
            if (why) return
            void onSubmit(date, reason.trim(), picked).then((ok) => ok && onClose())
          }}
          confirmLabel={kind === 'split' ? 'Tách đợt lấy trước' : 'Lưu đợt'}
        />
      }
    >
      <Consequence>
        {kind === 'split'
          ? `Phần nhập dưới đây thành một ĐỢT MỚI vào ngày chọn; ${label} giữ nguyên ngày hẹn và bớt đúng số đó.`
          : `Ghi lại số lượng từng dòng và ngày của ${label}. Tổng mọi đợt không được vượt số lượng đặt.`}
      </Consequence>
      <Grid minWidth={420}>
        <GridHead>
          <Th>Vật tư</Th>
          <Th num width={110}>
            {kind === 'split' ? 'Trong đợt' : 'SL đặt'}
          </Th>
          <Th num width={120}>
            {kind === 'split' ? 'Lấy trước' : 'SL đợt này'}
          </Th>
        </GridHead>
        <GridBody>
          {rows.map((l) => (
            <GridRow key={l.id}>
              <Td>
                {l.name} <span className="text-[var(--ink-3)]">{l.unit}</span>
              </Td>
              <Td num>
                {num(kind === 'split' ? (inShip.get(l.id) ?? 0) : l.qty_ordered)}
              </Td>
              <Td num>
                <NumInput
                  value={qty[l.id] ?? ''}
                  aria-label={`${kind === 'split' ? 'SL lấy trước' : 'SL đợt'} ${l.name}`}
                  onCommit={(raw) => setQty((q) => ({ ...q, [l.id]: raw.trim() }))}
                />
              </Td>
            </GridRow>
          ))}
        </GridBody>
      </Grid>
      <label className="mt-3 mb-3 block">
        <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
          {kind === 'split' ? 'Ngày lấy / giao gấp' : 'Ngày giao'}
        </span>
        <DateInput value={date} onChange={setDate} label="Ngày giao" />
      </label>
      <label className="block">
        <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
          Lý do
        </span>
        <TextArea
          value={reason}
          onChange={setReason}
          rows={2}
          placeholder={kind === 'split' ? 'Xưởng cần gấp cho lệnh 09 · NV tự đi lấy…' : 'NCC báo chuyến này chở được 800…'} // prettier-ignore
        />
      </label>
      {why && <p className="text-k-sm mt-2 text-[var(--ink-2)]">Chưa lưu được: {why}.</p>}
    </Sheet>
  )
}
