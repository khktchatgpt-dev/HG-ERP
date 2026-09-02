'use client'

import { useState } from 'react'
import { Plus, Truck, X } from 'lucide-react'
import { DateField } from '@/components/erp/DateField'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { SectionToggle } from '@/components/erp/SectionToggle'
import { shipmentAmount, validateShipments } from '@/lib/po-shipments'
import type { Line } from '../po-line'

/**
 * CHIA ĐỢT GIAO NGAY TRONG FORM SOẠN ĐƠN (28/08/2026).
 *
 * Trước đây đợt chỉ khai được ở bước "NCC xác nhận" — tức là SAU khi phiếu đã
 * gửi đi. Hệ quả: tờ giấy NCC cầm, thứ duy nhất họ ký, không nói được "1.200
 * tấm xin giao 700 ngày 10 + 500 ngày 20"; người mua phải nhét vào ô ghi chú.
 *
 * MỖI ĐỢT LÀ MỘT CỘT (không phải một hàng phụ dưới dòng hàng — bản đầu làm
 * vậy, user chốt đổi 28/08). Lý do là nghiệp vụ: NCC giao theo CHUYẾN, cả
 * chuyến cùng một ngày. Cột dọc thì ngày khai MỘT lần cho mọi vật tư trong
 * chuyến, và người mua đọc ngang một hàng là thấy trọn đường đi của một vật tư
 * — đúng cách họ đọc bảng kê trên giấy.
 *
 * Khối GẤP GỌN mặc định: khoảng 90% đơn giao một lần, bắt cả phòng nhìn thêm
 * một bảng nữa là trả giá cho số ít.
 */

/** Một ĐỢT = một cột: ngày giao + số lượng của từng dòng hàng (theo chỉ số). */
export type PlanColumn = { date: string; qty: Record<number, number | ''> }

export type DraftShipment = {
  expected_date: string
  lines: { line_index: number; qty: number }[]
}

/** Cột → bộ đợt gửi server. Cột chưa có ngày hoặc chưa có số nào thì bỏ. */
export function columnsToShipments(cols: PlanColumn[]): DraftShipment[] {
  const out: DraftShipment[] = []
  for (const c of cols) {
    if (!c.date) continue
    const lines = Object.entries(c.qty)
      .map(([idx, q]) => ({
        line_index: Number(idx),
        qty: typeof q === 'number' ? q : 0,
      }))
      .filter((l) => l.qty > 0)
    if (lines.length > 0) out.push({ expected_date: c.date, lines })
  }
  return out.sort((a, b) => a.expected_date.localeCompare(b.expected_date))
}

const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export function ShipmentPlanPanel({
  lines,
  columns,
  currency,
  onChange,
}: {
  lines: Line[]
  columns: PlanColumn[]
  currency: string
  onChange: (next: PlanColumn[]) => void
}) {
  const [open, setOpen] = useState(() => columns.length > 0)

  // Dòng tự do (gỗ/gia công) nghiệm thu ngoài sổ kho — không đi theo đợt.
  const rows = lines.map((l, i) => ({ l, i })).filter(({ l }) => !l.is_free)
  if (rows.length === 0) return null

  const qtyOf = (l: Line) => (typeof l.qty === 'number' ? l.qty : 0)
  const setCol = (ci: number, patch: Partial<PlanColumn>) =>
    onChange(columns.map((c, j) => (j === ci ? { ...c, ...patch } : c)))
  const setQty = (ci: number, li: number, v: number | '') =>
    onChange(columns.map((c, j) => (j === ci ? { ...c, qty: { ...c.qty, [li]: v } } : c)))

  /** Phần chưa xếp vào đợt nào — con số để gọi điện đòi NCC chốt nốt. */
  const leftOf = (li: number, ordered: number) =>
    ordered -
    columns.reduce((t, c) => {
      const q = c.qty[li]
      return t + (typeof q === 'number' ? q : 0)
    }, 0)

  const drafts = columnsToShipments(columns)
  // Kiểm bằng CHÍNH hàm server dùng (chỉ số dòng đóng vai id) — cảnh báo ở form
  // và lỗi ở server không bao giờ nói hai chuyện khác nhau.
  const v = validateShipments(
    drafts.map((d) => ({
      expected_date: d.expected_date,
      lines: d.lines.map((l) => ({ po_line_id: String(l.line_index), qty: l.qty })),
    })),
    rows.map(({ l, i }) => ({ id: String(i), qty_ordered: qtyOf(l), name: l.name })),
  )
  const money = new Map(
    lines.map((l, i) => [
      String(i),
      {
        amount: l.price === '' ? null : Number(l.price) * qtyOf(l),
        qty_ordered: qtyOf(l),
        approx: false,
      },
    ]),
  )

  const addColumn = () => onChange([...columns, { date: '', qty: {} }])

  return (
    <section className="border-border bg-card rounded-xl border">
      <SectionToggle
        icon={Truck}
        title="Chia đợt giao"
        summary={
          drafts.length > 0
            ? `${drafts.length} đợt — in lên phiếu gửi NCC`
            : 'tuỳ chọn — hàng về làm nhiều chuyến'
        }
        open={open}
        onToggle={() => setOpen((o) => !o)}
      />

      {open && (
        <div className="border-border/70 flex flex-col gap-3 border-t px-3.5 py-3">
          <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-xs">
            Lịch <b>đề nghị</b> gửi NCC — in thẳng lên đơn đặt hàng. Mỗi đợt là một chuyến
            giao: khai ngày một lần, điền số lượng cho từng vật tư. Sau khi NCC trả lời,
            sửa lại ở nút “NCC xác nhận” trên trang chi tiết.
          </p>

          {columns.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={addColumn}
              className="text-muted-foreground hover:border-primary hover:text-primary h-auto rounded-lg border-dashed py-3 text-[13px] font-normal shadow-none"
            >
              <Plus aria-hidden /> Thêm đợt giao đầu tiên
            </Button>
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              {/* eslint-disable-next-line hg/no-raw-control -- LƯỚI NHẬP kiểu bảng
                  tính (vật tư × đợt giao), không phải bảng danh sách: mỗi ô là một
                  input, cột sinh động theo số đợt, không sắp xếp/phân trang.
                  DataTable không mô tả được hình này. */}
              <table className="w-full text-[13px]">
                <thead className="t-label text-muted-foreground bg-muted/50 border-b text-left">
                  <tr>
                    <th className="min-w-[150px] px-3 py-2 font-medium">Vật tư</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">SL đặt</th>
                    {columns.map((c, ci) => (
                      <th key={ci} className="w-[152px] px-2 py-1.5 font-medium">
                        <div className="flex items-center justify-between gap-1">
                          <span>Đợt {ci + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Bỏ đợt ${ci + 1}`}
                            title="Bỏ đợt này"
                            onClick={() => onChange(columns.filter((_, j) => j !== ci))}
                            className="text-muted-foreground size-5 rounded hover:text-[var(--stop)]"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                        <DateField
                          value={c.date}
                          onChange={(iso) => setCol(ci, { date: iso })}
                          aria-label={`Ngày giao đợt ${ci + 1}`}
                          className="mt-1 h-7 text-[12px] font-normal"
                        />
                      </th>
                    ))}
                    <th className="w-24 px-2 py-2 text-right font-medium">Chưa chia</th>
                    <th className="w-9 px-1 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={addColumn}
                        aria-label="Thêm một đợt giao"
                        title="Thêm một đợt giao"
                        className="text-muted-foreground hover:border-primary hover:text-primary size-6 border-dashed shadow-none"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {rows.map(({ l, i }) => {
                    const ordered = qtyOf(l)
                    const left = leftOf(i, ordered)
                    return (
                      <tr key={i}>
                        <td className="px-3 py-1.5">
                          <span className="min-w-0">{l.name || '—'}</span>{' '}
                          <span className="text-muted-foreground text-[11px]">
                            {l.unit}
                          </span>
                        </td>
                        <td className="t-data px-2 py-1.5 text-right">{num(ordered)}</td>
                        {columns.map((c, ci) => (
                          <td key={ci} className="px-2 py-1.5">
                            <Input
                              inputMode="decimal"
                              value={c.qty[i] ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(',', '.')
                                setQty(
                                  ci,
                                  i,
                                  raw === '' ? '' : Number(raw) >= 0 ? Number(raw) : '',
                                )
                              }}
                              placeholder="—"
                              aria-label={`SL đợt ${ci + 1} của ${l.name}`}
                              className="t-data h-7 px-2 text-right shadow-none"
                            />
                          </td>
                        ))}
                        <td
                          className="t-data px-2 py-1.5 text-right"
                          style={{
                            color:
                              Math.abs(left) < 1e-6
                                ? 'var(--done)'
                                : left < 0
                                  ? 'var(--stop)'
                                  : 'var(--warn)',
                          }}
                        >
                          {Math.abs(left) < 1e-6 ? '✓ đủ' : num(left)}
                        </td>
                        <td className="px-1 py-1.5" />
                      </tr>
                    )
                  })}
                </tbody>
                {/* Tiền từng đợt nằm ngay DƯỚI cột của đợt đó — người mua đọc
                    cho NCC nghe lúc gọi điện mà không phải dò hàng khác. */}
                <tfoot className="border-border/70 border-t">
                  <tr className="text-[12px]">
                    <td className="text-muted-foreground px-3 py-1.5" colSpan={2}>
                      Tạm tính ({currency})
                    </td>
                    {columns.map((c, ci) => {
                      const d = drafts.find((x) => x.expected_date === c.date)
                      const m = d
                        ? shipmentAmount(
                            d.lines.map((l) => ({
                              po_line_id: String(l.line_index),
                              qty: l.qty,
                            })),
                            money,
                          )
                        : null
                      return (
                        <td
                          key={ci}
                          className="t-data px-2 py-1.5 text-right font-medium"
                        >
                          {m?.priced ? num(Math.round(m.amount)) : ''}
                        </td>
                      )
                    })}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
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
