'use client'

import { useState } from 'react'
import { CalendarDays, Plus, Truck, X } from 'lucide-react'
import { DateField } from '@/components/erp/DateField'
import { validateShipments, shipmentAmount } from '@/lib/po-shipments'
import type { Line } from '../po-line'

/**
 * CHIA ĐỢT GIAO NGAY TRONG FORM SOẠN ĐƠN (28/08/2026).
 *
 * Trước đây đợt chỉ khai được ở bước "NCC xác nhận" — tức là SAU khi phiếu đã
 * gửi đi. Hệ quả: tờ giấy NCC cầm, thứ duy nhất họ ký, không nói được "1.200
 * tấm xin giao 600 ngày 15 + 600 ngày 18"; người mua phải nhét vào ô ghi chú.
 * Và Giám đốc duyệt đơn cũng không thấy tiến độ nhận hàng, chỉ thấy tổng tiền.
 *
 * Khối này GẤP GỌN mặc định: khoảng 90% đơn giao một lần, bắt cả phòng nhìn
 * thêm một bảng nữa là trả giá cho số ít. Bấm mở mới hiện.
 *
 * Không đẻ khái niệm mới: mỗi dòng hàng tách được nhiều mảnh (SL + ngày), các
 * mảnh CÙNG NGÀY gộp thành một đợt lúc gửi lên — đúng cách dialog "NCC xác
 * nhận" đang làm, để hai chỗ khai ra cùng một hình dạng dữ liệu.
 */

export type DraftShipment = {
  expected_date: string
  lines: { line_index: number; qty: number }[]
}

type Batch = { date: string; qty: number | '' }

/** Gom mảnh của mọi dòng theo NGÀY thành bộ đợt gửi server. */
export function batchesToShipments(batches: Record<number, Batch[]>): DraftShipment[] {
  const byDate = new Map<string, { line_index: number; qty: number }[]>()
  for (const [idx, list] of Object.entries(batches)) {
    for (const b of list) {
      const qty = typeof b.qty === 'number' ? b.qty : 0
      if (!b.date || qty <= 0) continue
      const cur = byDate.get(b.date) ?? []
      cur.push({ line_index: Number(idx), qty })
      byDate.set(b.date, cur)
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, lines]) => ({ expected_date: date, lines }))
}

const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export function ShipmentPlanPanel({
  lines,
  batches,
  currency,
  onChange,
}: {
  lines: Line[]
  batches: Record<number, Batch[]>
  currency: string
  onChange: (next: Record<number, Batch[]>) => void
}) {
  const [open, setOpen] = useState(() => Object.keys(batches).length > 0)

  const stock = lines.filter((l) => !l.is_free)
  if (stock.length === 0) return null

  const qtyOf = (l: Line) => (typeof l.qty === 'number' ? l.qty : 0)
  const setBatch = (idx: number, i: number, patch: Partial<Batch>) =>
    onChange({
      ...batches,
      [idx]: (batches[idx] ?? []).map((b, j) => (j === i ? { ...b, ...patch } : b)),
    })

  // Kiểm bằng CHÍNH hàm server dùng — chỉ số dòng đóng vai id, nên cảnh báo ở
  // form và lỗi ở server không bao giờ nói hai chuyện khác nhau.
  const drafts = batchesToShipments(batches)
  const v = validateShipments(
    drafts.map((d) => ({
      expected_date: d.expected_date,
      lines: d.lines.map((l) => ({ po_line_id: String(l.line_index), qty: l.qty })),
    })),
    lines.map((l, i) => ({ id: String(i), qty_ordered: qtyOf(l), name: l.name })),
  )
  const money = new Map(
    lines.map((l, i) => [
      String(i),
      {
        amount:
          l.price === ''
            ? null
            : Number(l.price) * (typeof l.qty === 'number' ? l.qty : 0),
        qty_ordered: qtyOf(l),
        approx: false,
      },
    ]),
  )
  const planned = drafts.length

  return (
    <section className="border-border bg-card rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px]"
      >
        <Truck className="text-muted-foreground size-4" strokeWidth={1.8} aria-hidden />
        <b>Chia đợt giao</b>
        <span className="text-muted-foreground text-xs">
          {planned > 0
            ? `${planned} đợt — in lên phiếu gửi NCC`
            : 'tuỳ chọn — hàng về làm nhiều chuyến'}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">
          {open ? 'Thu gọn' : 'Mở'}
        </span>
      </button>

      {open && (
        <div className="border-border/70 flex flex-col gap-3 border-t px-3.5 py-3">
          <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-xs">
            Đây là lịch <b>đề nghị</b> gửi NCC — in thẳng lên đơn đặt hàng. Sau khi NCC
            trả lời, sửa lại ở nút “NCC xác nhận” trên trang chi tiết. Bỏ trống thì đơn
            giao một lần theo ô Hẹn giao.
          </p>

          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-[13px]">
              <thead className="t-label text-muted-foreground bg-muted/50 border-b text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Vật tư</th>
                  <th className="w-24 px-2 py-2 text-right font-medium">SL đặt</th>
                  <th className="w-28 px-2 py-2 text-right font-medium">SL đợt</th>
                  <th className="w-40 px-2 py-2 font-medium">Ngày giao</th>
                  <th className="w-8 px-1 py-2" />
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {lines.map((l, idx) => {
                  if (l.is_free) return null
                  const list = batches[idx] ?? []
                  if (list.length === 0) {
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-1.5">
                          <span className="min-w-0">{l.name || '—'}</span>{' '}
                          <span className="text-muted-foreground text-[11px]">
                            {l.unit}
                          </span>
                        </td>
                        <td className="t-data px-2 py-1.5 text-right">{num(qtyOf(l))}</td>
                        <td className="text-muted-foreground px-2 py-1.5 text-right text-[12px]">
                          giao 1 lần
                        </td>
                        <td className="px-2 py-1.5" />
                        <td className="px-1 py-1.5">
                          <button
                            type="button"
                            title="Chia dòng này thành nhiều đợt"
                            aria-label={`Chia đợt cho ${l.name}`}
                            onClick={() =>
                              onChange({
                                ...batches,
                                [idx]: [{ date: '', qty: qtyOf(l) }],
                              })
                            }
                            className="text-muted-foreground hover:text-foreground grid size-6 place-items-center rounded-md"
                          >
                            <CalendarDays className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  }
                  return list.map((b, i) => (
                    <tr key={`${idx}-${i}`}>
                      <td className="px-3 py-1.5">
                        {i === 0 ? (
                          <>
                            <span className="min-w-0">{l.name || '—'}</span>{' '}
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
                        {i === 0 ? num(qtyOf(l)) : ''}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          inputMode="decimal"
                          value={b.qty}
                          onChange={(e) => {
                            const raw = e.target.value.replace(',', '.')
                            setBatch(idx, i, {
                              qty: raw === '' ? '' : Number(raw) >= 0 ? Number(raw) : '',
                            })
                          }}
                          className="border-input focus:border-ring t-data h-7 w-full rounded-md border px-2 text-right outline-none"
                          aria-label={`SL đợt ${i + 1} của ${l.name}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <DateField
                          value={b.date}
                          onChange={(iso) => setBatch(idx, i, { date: iso })}
                          aria-label={`Ngày giao đợt ${i + 1} của ${l.name}`}
                          className="h-7 text-[12px]"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          aria-label={i === 0 ? `Thêm đợt cho ${l.name}` : 'Bỏ đợt này'}
                          title={i === 0 ? 'Thêm một đợt nữa' : 'Bỏ đợt này'}
                          onClick={() =>
                            i === 0
                              ? onChange({
                                  ...batches,
                                  [idx]: [...list, { date: '', qty: '' }],
                                })
                              : onChange({
                                  ...batches,
                                  [idx]: list.filter((_, j) => j !== i),
                                })
                          }
                          className={`grid size-6 place-items-center rounded-md ${
                            i === 0
                              ? 'text-muted-foreground hover:text-foreground'
                              : 'text-muted-foreground hover:text-[var(--stop)]'
                          }`}
                        >
                          {i === 0 ? (
                            <Plus className="size-3.5" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>

          {/* Tiền từng đợt — người mua đọc cho NCC nghe ngay lúc gọi điện. */}
          {drafts.length > 0 && (
            <div className="flex flex-col gap-1 text-[12px]">
              {drafts.map((d, i) => {
                const m = shipmentAmount(
                  d.lines.map((l) => ({
                    po_line_id: String(l.line_index),
                    qty: l.qty,
                  })),
                  money,
                )
                return (
                  <div
                    key={d.expected_date}
                    className="text-muted-foreground flex items-baseline justify-between gap-3"
                  >
                    <span>
                      Đợt {i + 1} ·{' '}
                      <span className="t-data">
                        {new Date(d.expected_date).toLocaleDateString('vi-VN')}
                      </span>
                    </span>
                    {m.priced && (
                      <span className="t-data text-foreground font-medium">
                        {num(Math.round(m.amount))} {currency}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {v.errors.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-[var(--stop)]">
              {v.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
          {v.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-[var(--warn)]">
              {v.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
