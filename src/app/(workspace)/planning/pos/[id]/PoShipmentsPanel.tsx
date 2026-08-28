'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Truck, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/erp/Spinner'
import {
  allocateReceiptsToShipments,
  shipmentAmount,
  validateShipments,
  type PoLineForShipment,
  type ShipmentInput,
  type ShipmentLineMoney,
} from '@/lib/po-shipments'

/**
 * ĐỢT GIAO trên trang chi tiết đơn (0152 — plan-po-giao-nhan GĐ1).
 *
 * NCC không đăng nhập: form "NCC xác nhận" là NV cung ứng ghi lại cam kết sau
 * cuộc gọi/Zalo — từng dòng NCC hứa bao nhiêu, ngày nào; một dòng tách được
 * nhiều đợt (2.000 kg → 1.000/19-08 + 1.000/22-08). Các mảnh giao cùng NGÀY
 * gộp thành một đợt khi gửi lên server.
 */

/** Bản client của PoShipment — không import repo server vào client bundle. */
export type ShipmentView = {
  id: string
  seq: number
  expected_date: string
  method: string | null
  place: string | null
  note: string | null
  status: string
  /** Mốc KHAI đợt — timeline GĐ3 dùng (đợt không lưu timestamp từng bước chuyển). */
  created_at: string
  lines: { po_line_id: string; qty: number }[]
}

export type ShipmentLineRef = {
  id: string
  name: string
  unit: string
  qty_ordered: number
  /**
   * Thành tiền cả dòng + cờ giá-theo-kg (0053) — nuôi TIỀN THEO ĐỢT (28/08:
   * đơn lớn 1 vật tư chia đợt, người mua cần "đợt này khoảng bao nhiêu" ngay
   * trên kế hoạch giao, không tách PO con). null = dòng chưa có giá.
   */
  amount: number | null
  price_approx: boolean
}

const dmy = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

const SHIPMENT_STATUS: Record<
  string,
  { label: string; tone: 'gray' | 'blue' | 'green' | 'amber' | 'red' }
> = {
  planned: { label: 'Đang hẹn', tone: 'amber' },
  arrived: { label: 'Xe tới', tone: 'blue' },
  received: { label: 'Đã nhận', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'gray' },
}

// ── Dialog "NCC xác nhận" / "Thêm đợt" ────────────────────────────────

type Batch = { date: string; qty: number | '' }

export function PoConfirmDialog({
  open,
  mode,
  poCode,
  defaultDate,
  lines,
  /** SL đã nằm ở các đợt còn sống (mode 'add') — validate cộng dồn. */
  existing,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'confirm' | 'add'
  poCode: string
  defaultDate: string
  lines: ShipmentLineRef[]
  existing: Map<string, number>
  busy: boolean
  onClose: () => void
  onSubmit: (shipments: ShipmentInput[], note: string) => Promise<boolean>
}) {
  const remainingOf = (l: ShipmentLineRef) =>
    Math.max(l.qty_ordered - (existing.get(l.id) ?? 0), 0)

  const [note, setNote] = useState('')
  const [batches, setBatches] = useState<Record<string, Batch[]>>({})
  const [allDate, setAllDate] = useState(defaultDate)

  // Mở lại dialog là làm lại từ đầu — state cũ của lần trước không được rò sang.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setNote('')
      setAllDate(defaultDate)
      setBatches(
        Object.fromEntries(
          lines.map((l) => [l.id, [{ date: defaultDate, qty: remainingOf(l) }]]),
        ),
      )
    }
  }

  const shipments = useMemo((): ShipmentInput[] => {
    const byDate = new Map<string, { po_line_id: string; qty: number }[]>()
    for (const l of lines) {
      for (const b of batches[l.id] ?? []) {
        const qty = typeof b.qty === 'number' ? b.qty : 0
        if (qty <= 0) continue
        const list = byDate.get(b.date) ?? []
        list.push({ po_line_id: l.id, qty })
        byDate.set(b.date, list)
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, ls]) => ({ expected_date: date, lines: ls }))
  }, [batches, lines])

  const poLines: PoLineForShipment[] = useMemo(
    () => lines.map((l) => ({ id: l.id, qty_ordered: l.qty_ordered, name: l.name })),
    [lines],
  )
  const v = useMemo(
    () => validateShipments(shipments, poLines, existing),
    [shipments, poLines, existing],
  )
  // Tiền sống theo những gì đang gõ — người mua đối chiếu ngay với con số NCC
  // đọc qua điện thoại, khỏi bấm máy tính.
  const draftMoney = useMemo(
    () =>
      shipmentAmount(
        shipments.flatMap((s) => s.lines),
        new Map(
          lines.map((l) => [
            l.id,
            { amount: l.amount, qty_ordered: l.qty_ordered, approx: l.price_approx },
          ]),
        ),
      ),
    [shipments, lines],
  )
  // Mode 'add' giao bù MỘT phần là chuyện thường — cảnh báo "chưa đủ" chỉ có
  // nghĩa ở lần xác nhận đầu, khi đang chép nguyên cam kết của NCC.
  const warnings = mode === 'confirm' ? v.warnings : []

  const setBatch = (lineId: string, i: number, patch: Partial<Batch>) =>
    setBatches((s) => ({
      ...s,
      [lineId]: (s[lineId] ?? []).map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === 'confirm' ? `NCC xác nhận — ${poCode}` : `Thêm đợt giao — ${poCode}`
      }
      maxWidth="sm:max-w-2xl"
    >
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-xs">
          {mode === 'confirm'
            ? 'Ghi lại cam kết của nhà cung cấp sau khi gọi điện / nhắn tin: từng dòng NCC hứa giao bao nhiêu, ngày nào. Một dòng tách được nhiều đợt; các dòng giao cùng ngày tự gộp thành một đợt.'
            : 'Khai đợt NCC hẹn giao bổ sung. Tổng các đợt của một dòng không vượt số lượng đặt.'}
        </p>

        <label className="flex items-center gap-2">
          <span className="shrink-0 font-medium">Tất cả giao ngày</span>
          <input
            type="date"
            value={allDate}
            onChange={(e) => setAllDate(e.target.value)}
            className="border-input focus:border-ring h-8 rounded-md border px-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() =>
              setBatches((s) =>
                Object.fromEntries(
                  Object.entries(s).map(([id, bs]) => [
                    id,
                    bs.map((b) => ({ ...b, date: allDate })),
                  ]),
                ),
              )
            }
            className="border-input hover:bg-muted rounded-md border px-2.5 py-1 text-xs"
          >
            Áp cho mọi dòng
          </button>
        </label>

        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="t-label text-muted-foreground bg-muted/50 border-b text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Vật tư</th>
                <th className="w-24 px-2 py-2 text-right font-medium">
                  {mode === 'confirm' ? 'SL đặt' : 'Còn lại'}
                </th>
                <th className="w-28 px-2 py-2 text-right font-medium">SL giao</th>
                <th className="w-36 px-2 py-2 font-medium">Ngày giao</th>
                <th className="w-8 px-1 py-2" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {lines.map((l) => {
                const bs = batches[l.id] ?? []
                const cap = mode === 'confirm' ? l.qty_ordered : remainingOf(l)
                return bs.map((b, i) => (
                  <tr key={`${l.id}-${i}`}>
                    <td className="px-3 py-1.5">
                      {i === 0 ? (
                        <>
                          <span className="min-w-0">{l.name}</span>{' '}
                          <span className="text-muted-foreground text-[11px]">
                            {l.unit}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground pl-3 text-[11.5px]">
                          ↳ đợt {i + 1}
                        </span>
                      )}
                    </td>
                    <td className="t-data px-2 py-1.5 text-right">
                      {i === 0 ? num(cap) : ''}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        inputMode="decimal"
                        value={b.qty}
                        onChange={(e) => {
                          const raw = e.target.value.replace(',', '.')
                          setBatch(l.id, i, {
                            qty: raw === '' ? '' : Number(raw) >= 0 ? Number(raw) : '',
                          })
                        }}
                        className="border-input focus:border-ring t-data h-7 w-full rounded-md border px-2 text-right outline-none"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={b.date}
                        onChange={(e) => setBatch(l.id, i, { date: e.target.value })}
                        className="border-input focus:border-ring h-7 w-full rounded-md border px-1.5 text-[12px] outline-none"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      {i === 0 ? (
                        <button
                          type="button"
                          title="Tách thêm đợt cho dòng này"
                          aria-label={`Tách thêm đợt cho ${l.name}`}
                          onClick={() =>
                            setBatches((s) => ({
                              ...s,
                              [l.id]: [...(s[l.id] ?? []), { date: allDate, qty: '' }],
                            }))
                          }
                          className="text-muted-foreground hover:text-foreground grid size-6 place-items-center rounded-md transition-colors"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Bỏ đợt này"
                          onClick={() =>
                            setBatches((s) => ({
                              ...s,
                              [l.id]: (s[l.id] ?? []).filter((_, j) => j !== i),
                            }))
                          }
                          className="text-muted-foreground grid size-6 place-items-center rounded-md transition-colors hover:text-[var(--stop)]"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>

        {draftMoney.priced && shipments.length > 0 && (
          <p className="text-muted-foreground -mt-2 text-right text-xs">
            Tiền theo các đợt đang khai:{' '}
            <span className="t-data text-foreground font-semibold">
              {draftMoney.approx && '≈ '}
              {num(Math.round(draftMoney.amount))}
            </span>
          </p>
        )}

        {v.errors.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-[var(--stop)]">
            {v.errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-[var(--warn)]">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        )}

        {mode === 'confirm' && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Ghi chú cam kết</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="VD: chị Hoa bên Nam Kim xác nhận qua Zalo 15/08"
              className="border-input focus:border-ring h-9 rounded-md border px-2 text-sm outline-none"
            />
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="border-input hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            Để sau
          </button>
          <button
            disabled={busy || v.errors.length > 0 || shipments.length === 0}
            onClick={async () => {
              if (await onSubmit(shipments, note.trim())) onClose()
            }}
            className="bg-primary inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {mode === 'confirm' ? 'Ghi nhận xác nhận' : 'Thêm đợt'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Thẻ "Kế hoạch giao" ───────────────────────────────────────────────

type ShipmentAsk = {
  id: string
  kind: 'reschedule' | 'cancel'
  date: string
  reason: string
}

export function PoShipmentsCard({
  shipments,
  linesById,
  currency,
  receivedByLine,
  linkedReceipts,
  confirmedNote,
  canEdit,
  canAddMore,
  busy,
  today,
  onArrived,
  onReschedule,
  onCancel,
  onAdd,
}: {
  shipments: ShipmentView[]
  linesById: Map<string, ShipmentLineRef>
  currency: string
  /** SL đã về theo DÒNG (sổ kho, BR-08) — nguồn cho suy diễn "đợt này về mấy". */
  receivedByLine: Map<string, number>
  /** Đã về CÓ CHỨNG TỪ theo đợt (PNK nối shipment_id, 0153) — số thật. */
  linkedReceipts: Map<string, Map<string, number>>
  confirmedNote: string | null
  canEdit: boolean
  canAddMore: boolean
  busy: boolean
  today: string
  onArrived: (id: string) => void
  onReschedule: (id: string, date: string, reason: string) => Promise<boolean>
  onCancel: (id: string, reason: string) => Promise<boolean>
  onAdd: () => void
}) {
  const [ask, setAsk] = useState<ShipmentAsk | null>(null)

  // TIỀN THEO ĐỢT (28/08) — chia tỷ lệ từ thành tiền dòng, xem shipmentAmount.
  const moneyByLine = new Map<string, ShipmentLineMoney>(
    [...linesById.values()].map((l) => [
      l.id,
      { amount: l.amount, qty_ordered: l.qty_ordered, approx: l.price_approx },
    ]),
  )
  const aliveShipments = shipments.filter((s) => s.status !== 'cancelled')
  const planTotal = shipmentAmount(
    aliveShipments.flatMap((s) => s.lines),
    moneyByLine,
  )
  // "Đợt này về mấy": PNK nối đợt là số thật; phần không nối mới suy diễn —
  // xem allocateReceiptsToShipments. Số đối chiếu, sổ thật là cột Đã về của dòng.
  const receivedByShipment = allocateReceiptsToShipments(
    shipments,
    receivedByLine,
    linkedReceipts,
  )
  const anyReceived = [...receivedByLine.values()].some((v) => v > 0)

  return (
    <section className="border-border bg-card rounded-xl border">
      <div className="border-border/70 flex flex-wrap items-center gap-2 border-b px-3.5 py-2.5 text-[13px]">
        <Truck className="text-muted-foreground size-4" strokeWidth={1.8} />
        <b>Kế hoạch giao</b>
        <span className="text-muted-foreground">{shipments.length} đợt</span>
        {canEdit && canAddMore && (
          <button
            onClick={onAdd}
            className="border-input hover:bg-muted ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
          >
            <Plus className="size-3.5" /> Thêm đợt
          </button>
        )}
      </div>
      {confirmedNote && (
        <p className="text-muted-foreground border-border/70 border-b px-3.5 py-2 text-xs">
          “{confirmedNote}”
        </p>
      )}
      <div className="divide-border/60 divide-y">
        {shipments.map((s) => {
          const st = SHIPMENT_STATUS[s.status] ?? SHIPMENT_STATUS.planned
          const alive = s.status === 'planned' || s.status === 'arrived'
          const overdue = alive && s.expected_date < today
          const money = shipmentAmount(s.lines, moneyByLine)
          return (
            <div key={s.id} className="flex flex-col gap-1.5 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-data text-[12px] font-semibold">Đợt {s.seq}</span>
                <span
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium"
                  style={overdue ? { color: 'var(--stop)' } : undefined}
                >
                  <CalendarDays className="size-3.5" strokeWidth={1.8} />
                  {dmy(s.expected_date)}
                  {overdue && ' · quá hẹn'}
                </span>
                <Badge tone={overdue ? 'red' : st.tone}>{st.label}</Badge>
                {canEdit && alive && (
                  <span className="ml-auto flex items-center gap-1">
                    {s.status === 'planned' && (
                      <button
                        disabled={busy}
                        onClick={() => onArrived(s.id)}
                        className="border-input hover:bg-muted rounded-md border px-2 py-0.5 text-[11.5px] disabled:opacity-50"
                      >
                        Xe tới
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() =>
                        setAsk({
                          id: s.id,
                          kind: 'reschedule',
                          date: s.expected_date,
                          reason: '',
                        })
                      }
                      className="border-input hover:bg-muted rounded-md border px-2 py-0.5 text-[11.5px] disabled:opacity-50"
                    >
                      Dời ngày
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        setAsk({ id: s.id, kind: 'cancel', date: '', reason: '' })
                      }
                      className="rounded-md border border-[var(--stop)]/40 px-2 py-0.5 text-[11.5px] text-[var(--stop)] hover:bg-[var(--stop)]/10 disabled:opacity-50"
                    >
                      Huỷ
                    </button>
                  </span>
                )}
              </div>
              <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]">
                {s.lines.map((l) => {
                  const ref = linesById.get(l.po_line_id)
                  const got = receivedByShipment.get(s.id)?.get(l.po_line_id)
                  return (
                    <span key={l.po_line_id}>
                      {ref?.name ?? '?'}{' '}
                      <span className="t-data">
                        {num(l.qty)} {ref?.unit ?? ''}
                      </span>
                      {/* Chỉ chú "về …" khi đơn ĐÃ có hàng về — đơn chưa về
                          gì thì chip trạng thái đợt đã nói đủ, chua thêm
                          "về 0" vào từng dòng chỉ thêm rác. */}
                      {anyReceived && s.status !== 'cancelled' && (
                        <span
                          className="t-data font-medium"
                          style={{
                            color:
                              (got?.qty ?? 0) >= l.qty - 0.000001
                                ? 'var(--done)'
                                : (got?.qty ?? 0) > 0
                                  ? 'var(--warn)'
                                  : 'var(--stop)',
                          }}
                          title={
                            got && !got.exact
                              ? 'Ước theo thứ tự đợt — phiếu nhập không ghi rõ đợt'
                              : undefined
                          }
                        >
                          {' '}
                          · về {got && !got.exact ? '≈' : ''}
                          {num(got?.qty ?? 0)}
                        </span>
                      )}
                    </span>
                  )
                })}
                {/* Tiền kế hoạch của đợt — số đối chiếu với NCC; tiền phải trả
                    thật vẫn theo PNK (công nợ). Giá kg thì kg thật cân lúc nhận
                    nên mang dấu ≈. Đợt huỷ không hiện tiền — không còn là kế
                    hoạch nữa. */}
                {money.priced && s.status !== 'cancelled' && (
                  <span className="t-data text-foreground ml-auto font-medium whitespace-nowrap">
                    {money.approx && '≈ '}
                    {num(Math.round(money.amount))} {currency}
                  </span>
                )}
              </div>
              {s.note && (
                <p className="text-muted-foreground text-[11.5px]">“{s.note}”</p>
              )}
            </div>
          )
        })}
      </div>

      {/* TỔNG ĐỐI CHIẾU: từng vật tư đã hẹn bao nhiêu / đặt bao nhiêu — trả
          lời "còn bao nhiêu CHƯA có đợt" mà không phải tự cộng nhẩm; kèm tổng
          tiền các đợt. Hiện khi có ≥2 đợt sống hoặc còn phần chưa hẹn (một đợt
          phủ đủ thì hàng tổng chỉ lặp lại hàng đợt). */}
      {(() => {
        const scheduled = new Map<string, number>()
        for (const s of aliveShipments) {
          for (const l of s.lines) {
            scheduled.set(l.po_line_id, (scheduled.get(l.po_line_id) ?? 0) + l.qty)
          }
        }
        const rows = [...linesById.values()].map((l) => ({
          ...l,
          done: scheduled.get(l.id) ?? 0,
          left: Math.max(l.qty_ordered - (scheduled.get(l.id) ?? 0), 0),
        }))
        const anyLeft = rows.some((r) => r.left > 0.000001)
        if (aliveShipments.length === 0 || (aliveShipments.length < 2 && !anyLeft)) {
          return null
        }
        return (
          <div className="border-border/70 flex flex-col gap-1 border-t px-3.5 py-2 text-[12px]">
            <div className="text-muted-foreground flex items-baseline justify-between gap-3">
              <span>Cộng {aliveShipments.length} đợt</span>
              {planTotal.priced && (
                <span className="t-data text-foreground font-semibold">
                  {planTotal.approx && '≈ '}
                  {num(Math.round(planTotal.amount))} {currency}
                </span>
              )}
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
              {rows.map((r) => (
                <span key={r.id}>
                  {r.name}{' '}
                  <span className="t-data text-foreground">
                    {num(r.done)}/{num(r.qty_ordered)} {r.unit}
                  </span>
                  {r.left > 0.000001 && (
                    <span className="font-medium text-[var(--warn)]">
                      {' '}
                      · còn {num(r.left)} chưa hẹn
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      <Modal
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.kind === 'cancel' ? 'Huỷ đợt giao' : 'Dời ngày đợt giao'}
        maxWidth="sm:max-w-md"
      >
        {ask && (
          <div className="flex flex-col gap-3 text-sm">
            {ask.kind === 'reschedule' && (
              <label className="flex flex-col gap-1">
                <span className="font-medium">
                  Ngày giao mới <span className="text-[var(--stop)]">*</span>
                </span>
                <input
                  type="date"
                  value={ask.date}
                  onChange={(e) => setAsk({ ...ask, date: e.target.value })}
                  className="border-input focus:border-ring h-9 rounded-md border px-2 outline-none"
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="font-medium">
                Lý do <span className="text-[var(--stop)]">*</span>
              </span>
              <textarea
                rows={2}
                maxLength={1000}
                autoFocus={ask.kind === 'cancel'}
                value={ask.reason}
                onChange={(e) => setAsk({ ...ask, reason: e.target.value })}
                placeholder={
                  ask.kind === 'cancel'
                    ? 'NCC báo huỷ chuyến · gộp vào đợt sau…'
                    : 'NCC báo trễ xe · xưởng giục sớm…'
                }
                className="border-input focus:border-ring w-full rounded-md border px-2 py-1.5 outline-none"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAsk(null)}
                className="border-input hover:bg-muted rounded-md border px-3 py-1.5"
              >
                Quay lại
              </button>
              <button
                disabled={
                  busy || !ask.reason.trim() || (ask.kind === 'reschedule' && !ask.date)
                }
                onClick={async () => {
                  const ok =
                    ask.kind === 'cancel'
                      ? await onCancel(ask.id, ask.reason.trim())
                      : await onReschedule(ask.id, ask.date, ask.reason.trim())
                  if (ok) setAsk(null)
                }}
                className={
                  ask.kind === 'cancel'
                    ? 'inline-flex items-center gap-2 rounded-md bg-[var(--stop)] px-4 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-50'
                    : 'bg-primary inline-flex items-center gap-2 rounded-md px-4 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-50'
                }
              >
                {busy && <Spinner size={14} />}
                {ask.kind === 'cancel' ? 'Huỷ đợt' : 'Lưu ngày mới'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
