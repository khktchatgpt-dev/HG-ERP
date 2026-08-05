'use client'

import { useState } from 'react'
import {
  Check,
  PackageSearch,
  StickyNote,
  Trash2,
  TriangleAlert,
  Weight,
} from 'lucide-react'
import { poTemplateMeta, suggestOrderQty, type PoTemplate } from '@/lib/po-template'
import { PO_FIELDS } from '@/lib/po-fields'
import { LineCell, NoteCell, blurOnWheel, cell } from './PoLineCells'
import { lineAmount, lineProblem, lineQty2, type Line, type Num } from './po-line'

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Ô kế tiếp trong CÙNG MỘT DÒNG, tìm theo `data-cell` bên trong khối `data-line`.
 *
 * Dùng DOM thay vì một mảng ref: dòng dựng động theo mẫu đơn nên số ô mỗi dòng
 * đổi theo mẫu, còn chuỗi nhập thì luôn cố định `SL đặt → Đơn giá → ô tìm`.
 */
function focusInRow(from: HTMLElement, cellName: string): boolean {
  const next = from
    .closest<HTMLElement>('[data-line]')
    ?.querySelector<HTMLInputElement>(`[data-cell="${cellName}"]`)
  if (!next) return false
  next.focus()
  next.select?.()
  return true
}

const cellLabel =
  'mb-1 block text-right text-[10px] font-semibold tracking-wide text-zinc-400 uppercase'

/**
 * DANH SÁCH DÒNG HÀNG của đơn đặt — mỗi dòng là một THẺ HAI TẦNG, không còn bảng
 * 12–13 cột cuộn ngang (phòng Cung ứng phản hồi "bố cục phần vật tư khó nhìn").
 *
 *   · Tầng trên: nhận diện (tên · mã · tồn) + ba ô người mua nhìn nhiều nhất
 *     trên tờ đơn giấy — SL đặt · Đơn giá · Thành tiền — ô to, nhãn ngay trên ô.
 *   · Tầng dưới: thông số riêng của mẫu (kg/m, dài cây, lọt lòng…), đọc từ khai
 *     báo `PO_FIELDS` nên thêm mẫu đơn thứ sáu không phải sửa ở đây. Ô "tổng kg"
 *     tự tính thành pill tím cuối tầng. Ghi chú thu thành nút, bấm mới mở —
 *     đa số dòng của đơn thật không có ghi chú.
 *
 * Hết sticky + cuộn ngang: màn 1366 nhìn trọn dòng, dòng thiếu số báo bằng badge
 * cam ngay chỗ Thành tiền và viền cam đúng ô cần điền (LineCell lo phần ô).
 */
export function PoLineTable({
  template,
  lines,
  suggestions,
  currency,
  onPatch,
  onRemove,
  focusIndex = null,
  onFocused,
  onDoneRow,
}: {
  template: PoTemplate
  /** SL đề xuất từ nhu cầu BOM theo material_id — chỉ hiện, không tự điền. */
  suggestions: Map<string, number>
  lines: Line[]
  currency: string
  onPatch: (i: number, patch: Partial<Line>) => void
  onRemove: (i: number) => void
  /** Dòng vừa được thêm — con trỏ nhảy thẳng vào ô SL đặt của nó. */
  focusIndex?: number | null
  /** Đã nhảy tới nơi — xoá cờ để lần render sau không cướp con trỏ lần nữa. */
  onFocused?: () => void
  /** Gõ xong đơn giá dòng cuối → trả con trỏ về ô tìm để thêm dòng kế. */
  onDoneRow?: () => void
}) {
  const meta = poTemplateMeta(template)
  const cols = PO_FIELDS[template]
  const priceLabel = meta.priceUnit ? `Đơn giá / ${meta.priceUnit}` : 'Đơn giá'
  // Ô tổng tự tính (tổng kg) tách khỏi các ô nhập để render thành pill cuối tầng.
  const calcCol = cols.find((c) => c.kind === 'calc')
  const inputCols = cols.filter((c) => c.kind !== 'calc')

  /**
   * Dòng nào đang MỞ ô ghi chú. Dòng có sẵn ghi chú (mở đơn cũ) luôn mở — giấu
   * đi thì người sửa đơn không biết dòng có lời dặn NCC.
   */
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(new Set())
  const noteOpen = (l: Line) => l.note !== '' || openNotes.has(l.material_id)
  const toggleNote = (l: Line, i: number) => {
    // Đóng ô đang có chữ = xoá ghi chú — chủ ý, như bấm ✕ trên chip.
    if (l.note !== '') onPatch(i, { note: '' })
    setOpenNotes((s) => {
      const next = new Set(s)
      if (next.has(l.material_id) || l.note !== '') next.delete(l.material_id)
      else next.add(l.material_id)
      return next
    })
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <PackageSearch className="size-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
        <p className="text-xs text-zinc-500">
          Chưa có dòng nào — bấm <b>Chọn vật tư</b> ở thanh ngay dưới để bắt đầu.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {lines.map((l, i) => {
        const amount = lineAmount(template, l)
        const kg = lineQty2(template, l)
        const problem = lineProblem(template, l)
        const suggest = suggestions.get(l.material_id) ?? null
        /*
         * SL gợi ý = nhu cầu − tồn. Không cộng hao hụt. Điều kiện là "dòng có SL
         * đơn hàng", KHÔNG phải "mẫu là phụ kiện" — cặp ô này có ở phụ kiện,
         * nhôm và bao bì (xem `PO_FIELDS`).
         */
        const shortSuggest =
          l.qty_demand !== ''
            ? suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0)
            : null
        const useSuggest = shortSuggest ?? suggest

        return (
          <div
            key={l.material_id}
            data-line
            className="overflow-hidden rounded-lg border border-zinc-200 bg-white transition-[border-color,box-shadow] hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            {/* ── Tầng trên: nhận diện + SL đặt · Đơn giá · Thành tiền ── */}
            <div className="flex items-start gap-3 px-3 py-2.5">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {/* Tên dài thì XUỐNG DÒNG chứ không cắt cụt — người mua phải đọc
                    đủ "Vít 4x15 đuôi cá tai tròn 8mm" mới biết đúng hàng. */}
                <div
                  className="text-[13.5px] leading-snug font-semibold break-words text-zinc-900 dark:text-zinc-100"
                  title={l.name}
                >
                  {l.name}
                </div>
                {/* Mã nổi thành chip mono: tên trong danh mục trùng nhau nhiều,
                    mã mới là thứ chốt đúng món và đọc cho NCC qua điện thoại. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {l.code}
                  </span>
                  <span>{l.unit}</span>
                  <span aria-hidden>·</span>
                  {l.on_hand > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                      <Check className="size-3" aria-hidden /> tồn {num(l.on_hand)}
                    </span>
                  ) : (
                    <span>tồn 0</span>
                  )}
                </div>
              </div>

              <div className="w-[92px] shrink-0">
                <label className={cellLabel} htmlFor={`qty-${l.material_id}`}>
                  SL đặt
                </label>
                <input
                  id={`qty-${l.material_id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  data-cell="qty"
                  onWheel={blurOnWheel}
                  /* Dòng vừa thêm: nhảy vào đây ngay, khỏi với chuột lên bảng. */
                  ref={(el) => {
                    if (el && focusIndex === i) {
                      el.focus()
                      el.select()
                      onFocused?.()
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    focusInRow(e.currentTarget, 'price')
                  }}
                  value={l.qty}
                  onChange={(e) =>
                    onPatch(i, {
                      qty: (e.target.value === '' ? '' : Number(e.target.value)) as Num,
                    })
                  }
                  className={`${cell} h-[34px]! text-right font-medium`}
                  aria-label={`SL đặt ${l.name}`}
                />
                {/* Gợi ý SL: phần còn thiếu của dòng, hoặc đề xuất từ BOM lệnh. */}
                {l.qty === '' && useSuggest != null && useSuggest > 0 && (
                  <button
                    type="button"
                    onClick={() => onPatch(i, { qty: useSuggest })}
                    className="mt-0.5 block w-full text-right text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                    title={
                      shortSuggest != null
                        ? 'SL đơn hàng − tồn kho — bấm để dùng'
                        : 'Đề xuất từ nhu cầu BOM — bấm để dùng'
                    }
                  >
                    dùng {num(useSuggest)} ↩
                  </button>
                )}
              </div>

              <div className="w-[108px] shrink-0">
                <label className={cellLabel} htmlFor={`price-${l.material_id}`}>
                  {priceLabel}
                </label>
                <input
                  id={`price-${l.material_id}`}
                  type="number"
                  min="0"
                  step="1"
                  data-cell="price"
                  onWheel={blurOnWheel}
                  /* Xong đơn giá là xong dòng — Enter trả con trỏ về ô tìm để
                     gõ dòng kế, cả đơn nhập được không rời bàn phím. */
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    onDoneRow?.()
                  }}
                  value={l.price}
                  onChange={(e) =>
                    onPatch(i, {
                      price: (e.target.value === '' ? '' : Number(e.target.value)) as Num,
                    })
                  }
                  className={`${cell} h-[34px]! text-right`}
                  aria-label={`Đơn giá ${l.name}`}
                />
              </div>

              <div className="w-[116px] shrink-0 text-right">
                <span className={cellLabel}>Thành tiền</span>
                {amount > 0 ? (
                  <div className="pt-1 text-[15px] font-semibold tabular-nums">
                    {num(Math.round(amount))}
                  </div>
                ) : (
                  <div className="pt-1 text-[15px] text-zinc-300 dark:text-zinc-600">
                    —
                  </div>
                )}
                {/* Thiếu số nói TO ngay tại chỗ tiền — không phải chữ 10px chìm. */}
                {problem && (
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                    <TriangleAlert className="size-3" aria-hidden /> {problem}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onRemove(i)}
                className="mt-4 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                aria-label={`Xoá dòng ${l.name}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            {/* ── Tầng dưới: thông số theo mẫu + ghi chú + pill tổng kg ── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-100 bg-zinc-50/70 py-2 pr-3 pl-12 text-[12px] dark:border-zinc-800 dark:bg-zinc-900/40">
              {inputCols.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"
                >
                  <span className="whitespace-nowrap">{c.label}</span>
                  <span className={c.width}>
                    <LineCell f={c} line={l} index={i} kgTotal={kg} onPatch={onPatch} />
                  </span>
                </label>
              ))}

              <button
                type="button"
                onClick={() => toggleNote(l, i)}
                className={
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors ' +
                  (noteOpen(l)
                    ? 'text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40'
                    : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800')
                }
                aria-expanded={noteOpen(l)}
                aria-label={`Ghi chú dòng ${l.name}`}
              >
                <StickyNote className="size-3" aria-hidden />
                {noteOpen(l) ? 'Bỏ ghi chú' : 'Ghi chú'}
              </button>

              {calcCol && (
                <span
                  className="ml-auto inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 tabular-nums dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
                  title="Hệ thống tự tính từ thông số dòng"
                >
                  <Weight className="size-3" aria-hidden />
                  {calcCol.label.toLowerCase()} {kg == null ? '—' : num(kg)}
                </span>
              )}

              {noteOpen(l) && (
                <div className="w-full">
                  <NoteCell
                    value={l.note}
                    label={`Ghi chú ${l.name}`}
                    placeholder={
                      template === 'aluminium' || template === 'metal_kg'
                        ? 'vị trí: chân trước…'
                        : '50 bàn santorin (4c/sp)…'
                    }
                    onChange={(v) => onPatch(i, { note: v })}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Dòng cộng cuối danh sách — con số đối chiếu nhanh với thanh tổng. */}
      <div className="flex items-baseline justify-end gap-2 px-1 pt-0.5 text-[12px] text-zinc-500">
        Cộng tiền hàng ({lines.length} dòng)
        <b className="text-[13.5px] font-bold text-zinc-800 tabular-nums dark:text-zinc-100">
          {num(Math.round(lines.reduce((s, x) => s + lineAmount(template, x), 0)))}
        </b>
        <span className="text-[11px]">{currency}</span>
      </div>
    </div>
  )
}

/** Ô số dùng chung cho phần điều khoản của form. */
export type { Num }
