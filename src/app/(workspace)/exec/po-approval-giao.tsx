'use client'

import { Ico, Tag, type TagTone } from '@/components/kit'
import { cn } from '@/lib/utils'
import { poLineAmount } from '@/lib/po-line'
import { shipmentAmount, type ShipmentLineMoney } from '@/lib/po-shipments'
import { money } from './approval-helpers'
import { daysUntil, dueBadge, DUE_TEXT, fmtD, fmtVnd } from './approval-parts'
import type { PendingPo } from './approval-types'

type Ship = NonNullable<PendingPo['shipments']>[number]

const SHIP_STATUS: Record<Ship['status'], { label: string; tone: TagTone }> = {
  planned: { label: 'Kế hoạch', tone: 'neutral' },
  arrived: { label: 'Xe đã tới', tone: 'run' },
  received: { label: 'Đã nhận', tone: 'done' },
}

/** Đợt hẹn SAU ngày xuất của lệnh — dải cảnh báo đầu màn đếm cùng hàm này. */
export function shipmentsAfterShip(p: PendingPo): Ship[] {
  const ship = p.lsx?.ship_date
  if (!ship) return []
  return (p.shipments ?? []).filter(
    (s) => s.status === 'planned' && s.expected_date > ship,
  )
}

/**
 * KẾ HOẠCH GIAO — 07/10/2026, chủ dự án: màn ký "không hiển đủ … đợt giao".
 *
 * Cung ứng lập đợt giao từ lúc nháp (0152), nên lịch "1.200 tấm chia 3 đợt"
 * có TRƯỚC chữ ký — Giám đốc ký là ký luôn lịch ấy, mà màn cũ không bày.
 *
 * Bày dạng LƯỚI DÒNG × ĐỢT (user duyệt 07/10): cộng ngang là kiểm được ngay
 * các đợt có khớp SL đặt không; cột "Chưa xếp đợt" nói phần còn treo. Tiền
 * đợt chia theo TỶ LỆ SL (`shipmentAmount`) — cùng hàm với trang đơn Mua hàng.
 *
 * Đơn không chia đợt hoặc chỉ một đợt (108/114 đơn đo 07/10) thì một dòng,
 * không dựng bảng cho màn dài thêm vô ích.
 */
export function ShipmentPlan({ p, nowIso }: { p: PendingPo; nowIso: string }) {
  const ships = p.shipments ?? []
  const lines = p.lines ?? []
  const shipDate = p.lsx?.ship_date ?? null

  if (ships.length < 2) {
    const one = ships[0]
    const date = one?.expected_date ?? p.expected_at
    const due = dueBadge(daysUntil(date, nowIso))
    const late = !!(date && shipDate && date > shipDate)
    return (
      <Head>
        <span className="text-k-sm font-normal tracking-normal text-[var(--ink-2)] normal-case">
          {date ? (
            <>
              Giao <b className="text-[var(--ink)]">một lần</b>
              {one?.code && <span className="num"> · {one.code}</span>} · hẹn về{' '}
              <span className={cn('num', late ? 'font-semibold text-[var(--warn)]' : 'text-[var(--ink)]')}>
                {fmtD(date)}
              </span>
              {' · '}
              <span className={DUE_TEXT[due.tone]}>{due.text}</span>
              {late && <span className="text-[var(--warn)]"> · sau ngày xuất lệnh {fmtD(shipDate)}</span>}
              {one && <> · <Tag tone={SHIP_STATUS[one.status].tone}>{SHIP_STATUS[one.status].label}</Tag></>}
            </>
          ) : (
            <span className="font-semibold text-[var(--warn)]">Chưa hẹn ngày giao</span>
          )}
        </span>
      </Head>
    ) // prettier-ignore
  }

  // Tiền + SL theo dòng, để chia tỷ lệ cho từng đợt.
  const moneyByLine = new Map<string, ShipmentLineMoney>(
    lines.map((ln) => [
      ln.id,
      {
        qty_ordered: Number(ln.qty_ordered),
        amount: ln.unit_price != null ? poLineAmount(ln) : null,
        approx: ln.price_basis === 'unit2',
      },
    ]),
  )
  const qtyOf = (s: Ship, lineId: string) =>
    s.lines.filter((x) => x.po_line_id === lineId).reduce((a, x) => a + Number(x.qty), 0)
  const rest = (lineId: string, ordered: number) =>
    ordered - ships.reduce((a, s) => a + qtyOf(s, lineId), 0)
  const amounts = ships.map((s) => shipmentAmount(s.lines, moneyByLine))
  const restAmount = lines.reduce((a, ln) => {
    const m = moneyByLine.get(ln.id)
    if (!m || m.amount == null || !(m.qty_ordered > 0)) return a
    return a + m.amount * (Math.max(0, rest(ln.id, m.qty_ordered)) / m.qty_ordered)
  }, 0)
  const notes = ships.filter((s) => s.note)
  const th =
    'text-k-label border-b border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 font-bold tracking-[.06em] whitespace-nowrap text-[var(--ink-label)] uppercase align-bottom' // prettier-ignore

  return (
    <>
      <Head>
        <span className="num font-normal tracking-normal text-[var(--ink-3)] normal-case">
          {ships.length} đợt · {fmtD(ships[0].expected_date)} → {fmtD(ships.at(-1)!.expected_date)}
        </span>
      </Head>
      <div className="overflow-x-auto">
        <table className="text-k-body w-full border-collapse">
          <thead>
            <tr>
              <th className={th} style={{ width: 30 }} />
              <th className={cn(th, 'text-left')}>Vật tư</th>
              <th className={cn(th, 'text-right')} style={{ width: 96 }}>SL đặt</th>
              {ships.map((s) => {
                const late = !!(shipDate && s.status === 'planned' && s.expected_date > shipDate)
                return (
                  <th key={s.seq} className={cn(th, 'text-right')} style={{ width: 140 }}>
                    <span className="grid justify-items-end gap-0.5">
                      <span>Đợt {s.seq}</span>
                      <span className={cn('num text-k-sm tracking-normal normal-case', late ? 'text-[var(--warn)]' : 'text-[var(--ink)]')}>
                        {fmtD(s.expected_date)}
                      </span>
                      {s.code && <span className="num font-normal tracking-normal text-[var(--ink-3)] normal-case">{s.code}</span>}
                      <span className="tracking-normal normal-case">
                        <Tag tone={late ? 'warn' : SHIP_STATUS[s.status].tone}>
                          {late ? 'Sau ngày xuất' : SHIP_STATUS[s.status].label}
                        </Tag>
                      </span>
                    </span>
                  </th>
                )
              })}
              <th className={cn(th, 'text-right')} style={{ width: 112 }}>Chưa xếp đợt</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((ln, i) => {
              const left = rest(ln.id, Number(ln.qty_ordered))
              return (
                <tr key={ln.id} className="border-b border-[var(--hair)]">
                  <td className="num h-[28px] px-2 text-right text-[var(--ink-3)]">{i + 1}</td>
                  <td className="px-2">
                    {ln.material_name}{' '}
                    <span className="num text-k-label text-[var(--ink-3)]">{ln.material_code}</span>
                  </td>
                  <td className="num px-2 text-right">{fmtVnd(Number(ln.qty_ordered))}</td>
                  {ships.map((s) => {
                    const q = qtyOf(s, ln.id)
                    return (
                      <td key={s.seq} className="num px-2 text-right">
                        {q ? fmtVnd(q) : <span className="text-[var(--ink-3)]">—</span>}
                      </td>
                    )
                  })}
                  <td className={cn('num px-2 text-right whitespace-nowrap', left > 0 ? 'font-semibold text-[var(--warn)]' : left < 0 ? 'font-semibold text-[var(--stop)]' : 'text-[var(--done)]')}>
                    {left === 0 ? <><Ico name="xong" size={12} aria-hidden /> 0</> : left < 0 ? `vượt ${fmtVnd(-left)}` : fmtVnd(left)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--surface-raised)]">
              <td colSpan={3} className="h-[30px] border-t border-[var(--line)] px-2 text-right font-semibold">
                Tiền hàng từng đợt (chưa VAT)
              </td>
              {amounts.map((a, i) => (
                <td key={i} className="num border-t border-[var(--line)] px-2 text-right font-semibold whitespace-nowrap">
                  {a.priced ? (a.approx ? '≈ ' : '') + money(a.amount, p.currency) : '—'}
                </td>
              ))}
              <td className="num border-t border-[var(--line)] px-2 text-right whitespace-nowrap">
                {restAmount > 0.5 ? money(restAmount, p.currency) : '0'}
              </td>
            </tr>
            {notes.length > 0 && (
              <tr>
                <td colSpan={ships.length + 4} className="text-k-sm px-2 py-1.5 text-[var(--ink-2)]">
                  {notes.map((s) => (
                    <div key={s.seq}>
                      <b className="text-[var(--ink)]">Đợt {s.seq}:</b> {s.note}
                    </div>
                  ))}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </>
  ) // prettier-ignore
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-k-label flex min-h-[26px] flex-wrap items-center gap-1.5 border-y border-[var(--hair)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1 font-bold tracking-[.08em] text-[var(--ink-label)] uppercase">
      <Ico name="hen" size={14} />
      Kế hoạch giao
      <span className="ml-1">{children}</span>
    </div>
  )
}
