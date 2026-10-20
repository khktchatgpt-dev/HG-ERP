'use client'

import { useState } from 'react'
import {
  Btn,
  Code,
  Consequence,
  DateInput,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  NumInput,
  Sheet,
  SheetActions,
  Tag,
  Td,
  TextArea,
  Th,
} from '@/components/kit'
import { parseNum } from '@/lib/cut-plan/paste'
import { validateSplitRest, type ShipmentInput, type SplitPlan } from '@/lib/po-shipments'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

type Line = { id: string; code: string | null; name: string; unit: string; qty_ordered: number } // prettier-ignore

/**
 * HỘP "TÁCH THEO PHIẾU NHẬP" (07/10/2026 — artboard đã duyệt, PO-2026-0084).
 *
 * Xem trước rồi mới ghi: mỗi phiếu nhập một cột "Đã nhận" (phiếu sớm nhất ở
 * lại đợt gốc, giữ mã + ngày hẹn cũ), phần còn chờ một hay nhiều cột hẹn mới.
 * Kiểm bằng ĐÚNG hàm server dùng (`validateSplitRest`) — bấm Tách là qua.
 */
export function TachDotSheet({
  shipment,
  plan,
  lines,
  today,
  busy,
  onClose,
  onSubmit,
}: {
  shipment: { code: string | null; seq: number; expected_date: string }
  plan: SplitPlan
  lines: Line[]
  today: string
  busy: boolean
  onClose: () => void
  onSubmit: (body: { reason: string; rest: ShipmentInput[] }) => Promise<boolean>
}) {
  const label = shipment.code ?? `đợt ${shipment.seq}`
  const restOf = new Map(plan.rest.map((l) => [l.po_line_id, l.qty]))
  const used = new Set([...plan.receipts.flatMap((r) => r.lines.map((l) => l.po_line_id)), ...restOf.keys()]) // prettier-ignore
  const rows = lines.filter((l) => used.has(l.id))
  const names = new Map(lines.map((l) => [l.id, l.name]))
  const qtyIn = (r: { lines: { po_line_id: string; qty: number }[] }, id: string) =>
    r.lines.find((l) => l.po_line_id === id)?.qty ?? 0

  // Phần còn chờ: mặc định MỘT đợt hẹn, ngày để trống bắt chọn (Q2 duyệt 07/10).
  const [hen, setHen] = useState<{ date: string; qty: Record<string, number> }[]>(
    () =>
    plan.rest.length ? [{ date: '', qty: Object.fromEntries(plan.rest.map((l) => [l.po_line_id, l.qty])) }] : [], // prettier-ignore
  )
  const [reason, setReason] = useState('')
  const rest: ShipmentInput[] = hen.map((h) => ({
    expected_date: h.date,
    lines: Object.entries(h.qty)
      .filter(([, q]) => q > 1e-4)
      .map(([po_line_id, qty]) => ({ po_line_id, qty })),
  }))
  const errors = validateSplitRest(plan, rest, today, names)
  const why = errors[0] ?? (!reason.trim() ? 'Ghi lý do tách đợt' : null)
  const nDot = plan.receipts.length + hen.length
  const setQty = (i: number, id: string, raw: string) =>
    setHen((hs) => hs.map((h, j) => (j === i ? { ...h, qty: { ...h.qty, [id]: parseNum(raw) ?? 0 } } : h))) // prettier-ignore

  return (
    <Sheet
      open
      onClose={onClose}
      stakes="vua"
      width={Math.min(1100, 520 + 150 * nDot)}
      title={`Tách ${label} theo phiếu nhập`}
      subtitle={`Đang hẹn ${dmy(shipment.expected_date)} · ${plan.receipts.length} phiếu nhập`}
      footer={
        <SheetActions
          stakes="vua"
          busy={busy}
          disabled={!!why}
          onCancel={onClose}
          onConfirm={() => {
            if (why) return
            void onSubmit({ reason: reason.trim(), rest }).then((ok) => ok && onClose())
          }}
          confirmLabel={`Tách thành ${nDot} đợt`}
        />
      }
    >
      <Consequence>
        Mỗi phiếu nhập thành một đợt &quot;Đã nhận&quot;. {label} giữ mã và ngày hẹn cũ,
        nhận phiếu sớm nhất. Phần chưa về thành đợt hẹn mới. Số trong sổ kho, tồn và công
        nợ không đổi.
      </Consequence>
      <Grid minWidth={420 + 140 * nDot}>
        <GridHead>
          <Th>Vật tư</Th>
          <Th num width={100}>
            SL đặt
          </Th>
          {plan.receipts.map((r, i) => (
            <Th key={r.doc_id} num width={140}>
              <span className="grid justify-items-end leading-tight normal-case">
                <span className="uppercase">Đợt {i === 0 ? shipment.seq : 'mới'}</span>
                <Code>{r.doc_code}</Code>
                <span className="font-normal tracking-normal">về {dmy(r.date)}</span>
              </span>
            </Th>
          ))}
          {hen.map((_, i) => (
            <Th key={`h${i}`} num width={130}>
              <span className="grid justify-items-end leading-tight">
                <span>Hẹn mới {hen.length > 1 ? i + 1 : ''}</span>
                <span className="font-normal tracking-normal normal-case">còn chờ</span>
              </span>
            </Th>
          ))}
          <Th num width={70}>
            Khớp
          </Th>
        </GridHead>
        <GridBody>
          {rows.map((l) => {
            const want = restOf.get(l.id) ?? 0
            const got = hen.reduce((a, h) => a + (h.qty[l.id] ?? 0), 0)
            const ok = Math.abs(want - got) <= 1e-4
            return (
              <GridRow key={l.id}>
                <Td>
                  {l.name}{' '}
                  <span className="num text-[var(--ink-3)]" style={{ textAlign: 'left' }}>
                    {l.code}
                  </span>
                </Td>
                <Td num>
                  {so(l.qty_ordered)}{' '}
                  <span className="text-[var(--ink-3)]">{l.unit}</span>
                </Td>
                {plan.receipts.map((r) => (
                  <Td key={r.doc_id} num>
                    {qtyIn(r, l.id) ? so(qtyIn(r, l.id)) : '—'}
                  </Td>
                ))}
                {hen.map((h, i) => (
                  <Td key={`h${i}`} num>
                    {want > 0 ? (
                      <NumInput
                        value={so(h.qty[l.id] ?? 0)}
                        aria-label={`Hẹn mới ${i + 1} · ${l.name}`}
                        onCommit={(raw) => setQty(i, l.id, raw)}
                      />
                    ) : (
                      '—'
                    )}
                  </Td>
                ))}
                <Td num tone={ok ? 'done' : 'warn'}>
                  {ok ? '✓' : so(want - got)}
                </Td>
              </GridRow>
            )
          })}
        </GridBody>
        <GridFoot>
          <Td colSpan={2}>Sau khi tách</Td>
          {plan.receipts.map((r) => (
            <Td key={r.doc_id} num>
              <Tag tone="done">Đã nhận</Tag>
            </Td>
          ))}
          {hen.map((_, i) => (
            <Td key={`h${i}`} num>
              <Tag>Kế hoạch</Tag>
            </Td>
          ))}
          <Td />
        </GridFoot>
      </Grid>

      {hen.length > 0 && (
        <div className="mt-3 grid gap-2">
          {hen.map((h, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1">
                <span className="text-k-label font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
                  Ngày hẹn mới {hen.length > 1 ? i + 1 : ''}
                </span>
                <DateInput
                  value={h.date}
                  onChange={(d) => setHen((hs) => hs.map((x, j) => (j === i ? { ...x, date: d } : x)))} // prettier-ignore
                  label={`Ngày hẹn mới ${i + 1}`}
                />
              </label>
              {i > 0 && (
                <Btn onClick={() => setHen((hs) => hs.filter((_, j) => j !== i))}>
                  Bỏ đợt này
                </Btn>
              )}
            </div>
          ))}
          <Btn
            icon="them"
            onClick={() => setHen((hs) => [...hs, { date: '', qty: {} }])}
            disabled={hen.length >= 6}
          >
            Chia phần còn chờ thành nhiều đợt
          </Btn>
        </div>
      )}

      <label className="mt-3 block">
        <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
          Lý do
        </span>
        <TextArea
          value={reason}
          onChange={setReason}
          rows={2}
          placeholder="NCC giao làm nhiều chuyến, lúc xác nhận đơn chưa chia đợt…"
        />
      </label>
      {why && (
        <p className="text-k-sm mt-2 text-[var(--ink-2)]">Chưa tách được: {why}.</p>
      )}
    </Sheet>
  )
}
