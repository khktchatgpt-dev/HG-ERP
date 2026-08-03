'use client'

import { poTemplateMeta, suggestOrderQty, type PoTemplate } from '@/lib/po-template'
import { PO_FIELDS } from '@/lib/po-fields'
import { LineCell, NoteCell, blurOnWheel, calc, cell } from './PoLineCells'
import { lineAmount, lineProblem, lineQty2, type Line, type Num } from './po-line'

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Ô GHIM hai mép, kèm BÓNG ĐỔ ở cạnh trong.
 *
 * Không có bóng thì cột ghim và cột đang trượt dưới nó dính liền một khối —
 * nhìn ra y hệt "chữ bị cắt mất" chứ không phải "còn nội dung ở bên kia". Bóng
 * là thứ duy nhất nói cho người dùng biết bảng còn cuộn được.
 */
const stickyLeft =
  'sticky left-0 z-[1] w-[196px] min-w-[196px] bg-white shadow-[6px_0_6px_-6px_rgba(0,0,0,0.18)] dark:bg-zinc-950'
const stickyRight =
  'sticky right-0 z-[1] bg-white shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.18)] dark:bg-zinc-950'

/**
 * Ô kế tiếp trong CÙNG MỘT HÀNG, tìm theo `data-cell`.
 *
 * Dùng DOM thay vì một mảng ref: bảng dựng động theo mẫu đơn nên số ô mỗi hàng
 * đổi theo mẫu, còn chuỗi nhập thì luôn cố định `SL đặt → Đơn giá → ô tìm`.
 */
function focusInRow(from: HTMLElement, cellName: string): boolean {
  const next = from
    .closest('tr')
    ?.querySelector<HTMLInputElement>(`[data-cell="${cellName}"]`)
  if (!next) return false
  next.focus()
  next.select?.()
  return true
}

/**
 * BẢNG DÒNG HÀNG của đơn đặt.
 *
 * Khung hàng cố định hai đầu — `# · Vật tư · … · SL đặt · Đơn giá ·
 * Thành tiền · Ghi chú` — đúng thứ tự đơn giấy phòng Cung ứng đang ký. Phần giữa
 * là cột riêng của mẫu, đọc từ khai báo `PO_FIELDS`; file này không biết mẫu nào
 * có cột gì, nên thêm mẫu đơn thứ sáu không phải sửa ở đây.
 *
 * Ô NỀN XÁM là số hệ thống tự tính (tổng kg, thành tiền) — không gõ được. Hai ô
 * luôn phải gõ ở mọi mẫu là SL đặt và Đơn giá.
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
  lines: Line[]
  /** SL đề xuất từ nhu cầu BOM theo material_id — chỉ hiện, không tự điền. */
  suggestions: Map<string, number>
  currency: string
  onPatch: (i: number, patch: Partial<Line>) => void
  onRemove: (i: number) => void
  /**
   * Dòng vừa được thêm — con trỏ nhảy thẳng vào ô SL đặt của nó.
   *
   * Trước đây chọn xong vật tư là con trỏ ở lại ô tìm, trong khi dòng mới chèn
   * PHÍA TRÊN: mỗi dòng phải bỏ bàn phím, rê chuột lên gõ SL rồi đơn giá. Ghi
   * chú trong `MaterialPicker` vẫn hứa "con trỏ tự nhảy sang SL" — nay mới có.
   */
  focusIndex?: number | null
  /** Đã nhảy tới nơi — xoá cờ để lần render sau không cướp con trỏ lần nữa. */
  onFocused?: () => void
  /** Gõ xong đơn giá dòng cuối → trả con trỏ về ô tìm để thêm dòng kế. */
  onDoneRow?: () => void
}) {
  const meta = poTemplateMeta(template)
  const cols = PO_FIELDS[template]
  const priceLabel = meta.priceUnit ? `Đơn giá / ${meta.priceUnit}` : 'Đơn giá'
  /**
   * Số cột một hàng: `Nhận dạng` (gộp # · Vật tư) + cột riêng của mẫu +
   * `SL đặt · Đơn giá · Thành tiền · Ghi chú` + nút xoá.
   */
  const totalColSpan = 6 + cols.length

  return (
    <div className="overflow-x-auto">
      {/*
        `min-w` GIỮ bề rộng cột: bảng `w-full` với 12 cột sẽ bóp cột hẹp nhất cho
        vừa màn hình — ô Ghi chú tụt còn ~30px và chữ rơi từng ký tự một dòng.
        Có min-w thì khung `overflow-x-auto` bên ngoài cuộn ngang, cột giữ nguyên.
      */}
      <table className="w-full min-w-[1120px] text-[13px] tabular-nums">
        <thead className="bg-zinc-50 dark:bg-zinc-900/50">
          <tr className="text-left text-[10px] font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            {/*
              MỘT CỘT GHIM DUY NHẤT, gộp `# · Vật tư`.

              Trước là ba ô sticky rời (`#`, `Mã SP`, `Vật tư`) với `left` gõ
              cứng: `left-7` (28px) và `left-[112px]`. Nhưng bảng dùng
              `table-layout: auto` — khi bị ép về `min-w`, trình duyệt bóp cột
              nhỏ lại: đo thực tế `#` còn 27px và `Mã SP` còn 77px, tổng 104 chứ
              không phải 112. Ô "Vật tư" vẫn ghim ở 112 nên ĐÈ LÊN cột kế 8px —
              đúng chỗ chữ "VẬT LIỆU" mất chữ "V". Gõ cứng số nào cũng sai, vì
              bề rộng đổi theo mẫu đơn và theo bề ngang màn hình.

              Gộp thành một ô `left-0` thì không còn phép cộng nào để sai, và
              `min-w` giữ cho nó không bị bóp.
            */}
            <th
              className={`${stickyLeft} z-[2]! bg-zinc-50! py-2 pr-2 pl-3 dark:bg-zinc-900!`}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center">#</span>
                <span className="min-w-0 flex-1">Vật tư</span>
              </div>
            </th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`${c.width} py-2 pr-2 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.label}
              </th>
            ))}
            <th className="w-[80px] py-2 pr-2 text-right whitespace-nowrap">SL đặt</th>
            <th className="w-[104px] py-2 pr-2 text-right whitespace-nowrap">
              {priceLabel}
            </th>
            <th className="w-[100px] py-2 pr-2 text-right whitespace-nowrap">
              Thành tiền
            </th>
            <th className="w-[150px] py-2 pr-2 whitespace-nowrap">Ghi chú</th>
            {/* NÚT XOÁ GHIM BÊN PHẢI. Mẫu inox/bao bì có tới 5 cột riêng nên
                bảng rộng ~1270px trong khung 1061px của laptop 1366 — đo được
                179px bị đẩy khuất, và thứ rơi ra ngoài đầu tiên đúng là cột
                này. Muốn xoá một dòng phải cuộn ngang, mà cuộn ngang thì mọi
                danh sách đang mở tự đóng (`AnchoredPopover`). */}
            <th
              className={`${stickyRight} z-[2]! w-8 bg-zinc-50! py-2 dark:bg-zinc-900!`}
            />
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td
                colSpan={totalColSpan}
                className="py-6 text-center text-xs text-zinc-500"
              >
                Chưa có dòng nào — gõ tên vật tư ở thanh “Thêm dòng” ngay dưới bảng.
              </td>
            </tr>
          )}
          {lines.map((l, i) => {
            const amount = lineAmount(template, l)
            const kg = lineQty2(template, l)
            const problem = lineProblem(template, l)
            const suggest = suggestions.get(l.material_id) ?? null
            /*
             * SL gợi ý = nhu cầu − tồn. Không cộng hao hụt.
             *
             * Điều kiện là "dòng có SL đơn hàng", KHÔNG phải "mẫu là phụ kiện":
             * cặp ô SL đơn hàng · Tồn kho nay có ở phụ kiện, nhôm và bao bì (xem
             * `PO_FIELDS`). Khoá theo tên mẫu thì thêm mẫu nào cũng phải nhớ sửa
             * thêm ở đây — mà quên thì mất gợi ý mà chẳng có gì báo.
             */
            const shortSuggest =
              l.qty_demand !== ''
                ? suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0)
                : null

            return (
              <tr
                key={l.material_id}
                className="border-t border-zinc-100 align-top dark:border-zinc-900"
              >
                <td className={`${stickyLeft} py-2 pr-2 pl-3`}>
                  <div className="flex items-start gap-2">
                    <span className="w-4 shrink-0 pt-2 text-center text-xs font-medium text-zinc-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* Tên dài thì XUỐNG DÒNG chứ không cắt cụt — người mua phải
                          đọc đủ "Vít 4x15 đuôi cá tai tròn 8mm" mới biết đúng hàng. */}
                      <div
                        className="text-xs leading-snug font-semibold break-words text-zinc-900 dark:text-zinc-100"
                        title={l.name}
                      >
                        {l.name}
                      </div>
                      {/* Mã đậm ngang tên: tên hàng trong danh mục trùng nhau
                          nhiều, mã mới là thứ chốt đúng món và là thứ đọc cho
                          NCC qua điện thoại. ĐVT/tồn nhạt hơn nhưng vẫn đọc
                          được — không còn zinc-400. */}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                          {l.code}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{l.unit}</span>
                        <span aria-hidden>·</span>
                        <span
                          className={
                            l.on_hand > 0 ? 'text-emerald-700 dark:text-emerald-400' : ''
                          }
                        >
                          tồn {num(l.on_hand)}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {cols.map((c) => (
                  <td key={c.key} className="py-2 pr-2">
                    <LineCell f={c} line={l} index={i} kgTotal={kg} onPatch={onPatch} />
                  </td>
                ))}

                <td className="py-2 pr-2">
                  <input
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
                    className={`${cell} text-right font-medium`}
                    aria-label={`SL đặt ${l.name}`}
                  />
                  {/* Gợi ý SL: phần còn thiếu của dòng (mẫu phụ kiện), hoặc đề
                      xuất từ nhu cầu BOM của lệnh. */}
                  {l.qty === '' &&
                    (shortSuggest ?? suggest) != null &&
                    (shortSuggest ?? suggest)! > 0 && (
                      <button
                        type="button"
                        onClick={() => onPatch(i, { qty: (shortSuggest ?? suggest)! })}
                        className="mt-0.5 block w-full text-right text-[10px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                        title={
                          shortSuggest != null
                            ? 'SL đơn hàng − tồn kho — bấm để dùng'
                            : 'Đề xuất từ nhu cầu BOM — bấm để dùng'
                        }
                      >
                        dùng {num((shortSuggest ?? suggest)!)} ↩
                      </button>
                    )}
                </td>
                <td className="py-2 pr-2">
                  <input
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
                        price: (e.target.value === ''
                          ? ''
                          : Number(e.target.value)) as Num,
                      })
                    }
                    className={`${cell} text-right`}
                    aria-label={`Đơn giá ${l.name}`}
                  />
                </td>
                <td className="py-2 pr-2">
                  <div
                    className={`${calc} bg-transparent font-semibold dark:bg-transparent`}
                  >
                    {amount > 0 ? (
                      num(Math.round(amount))
                    ) : (
                      <span className="font-normal text-zinc-300 dark:text-zinc-600">
                        —
                      </span>
                    )}
                  </div>
                  {problem && (
                    <div className="mt-0.5 text-right text-[10px] text-amber-600 dark:text-amber-500">
                      {problem}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-2">
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
                </td>
                <td className={`${stickyRight} py-2 pr-1 text-center`}>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="mt-1 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label={`Xoá dòng ${l.name}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        {lines.length > 0 && (
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              {/* Nhãn trải tới hết cột Đơn giá, rồi tới ô tổng nằm đúng dưới
                  cột Thành tiền; hai cột cuối (Ghi chú, nút xoá) để đơn vị tiền. */}
              <td
                colSpan={totalColSpan - 3}
                className="py-2 pr-2 text-right text-[10px] font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300"
              >
                Cộng tiền hàng ({lines.length} dòng)
              </td>
              <td className="py-2 pr-2 text-right font-bold whitespace-nowrap">
                {num(Math.round(lines.reduce((s, l) => s + lineAmount(template, l), 0)))}
              </td>
              <td colSpan={2} className="py-2 pl-2 text-xs font-medium text-zinc-500">
                {currency}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Ô số dùng chung cho phần điều khoản của form. */
export type { Num }
