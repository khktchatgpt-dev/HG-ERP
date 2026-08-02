'use client'

import { poTemplateMeta, suggestOrderQty, type PoTemplate } from '@/lib/po-template'
import { PO_FIELDS } from '@/lib/po-fields'
import { LineCell, NoteCell, ProductCodeCell, calc, cell } from './PoLineCells'
import { lineAmount, lineProblem, lineQty2, type Line, type Num } from './po-line'

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * BẢNG DÒNG HÀNG của đơn đặt.
 *
 * Khung hàng cố định hai đầu — `# · Mã SP · Vật tư · … · SL đặt · Đơn giá ·
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
  products = [],
  currency,
  onPatch,
  onRemove,
  addRow,
}: {
  template: PoTemplate
  lines: Line[]
  /** SL đề xuất từ nhu cầu BOM theo material_id — chỉ hiện, không tự điền. */
  suggestions: Map<string, number>
  /** Mã SP của LSX đang chọn — rỗng = đơn ngoài LSX, ô Mã SP quay về gõ tay. */
  products?: { code: string; name: string }[]
  currency: string
  onPatch: (i: number, patch: Partial<Line>) => void
  onRemove: (i: number) => void
  /** Ô chọn vật tư luôn nằm cuối bảng — dòng nhập nhanh. */
  addRow: React.ReactNode
}) {
  const meta = poTemplateMeta(template)
  const cols = PO_FIELDS[template]
  const priceLabel = meta.priceUnit ? `Đơn giá / ${meta.priceUnit}` : 'Đơn giá'
  /**
   * Số cột một hàng: `# · Mã SP · Vật tư` + cột riêng của mẫu +
   * `SL đặt · Đơn giá · Thành tiền · Ghi chú` + nút xoá.
   */
  const totalColSpan = 8 + cols.length

  return (
    <div className="overflow-x-auto">
      {/*
        `min-w` GIỮ bề rộng cột: bảng `w-full` với 12 cột sẽ bóp cột hẹp nhất cho
        vừa màn hình — ô Ghi chú tụt còn ~30px và chữ rơi từng ký tự một dòng.
        Có min-w thì khung `overflow-x-auto` bên ngoài cuộn ngang, cột giữ nguyên.
      */}
      <table className="w-full min-w-[1240px] text-[13px] tabular-nums">
        <thead className="bg-zinc-50 dark:bg-zinc-900/50">
          <tr className="text-left text-[10px] text-zinc-500 uppercase">
            {/* Ba cột đầu GHIM lại — bảng rộng hơn màn hình, cuộn sang phải mà mất
                mã SP + tên vật tư thì không biết đang gõ số cho dòng nào. */}
            <th className="sticky left-0 z-[2] w-7 bg-zinc-50 py-2 pl-3 text-center dark:bg-zinc-900">
              #
            </th>
            <th className="sticky left-7 z-[2] w-[92px] bg-zinc-50 py-2 pr-2 dark:bg-zinc-900">
              Mã SP
            </th>
            <th className="sticky left-[120px] z-[2] min-w-[190px] bg-zinc-50 py-2 pr-2 dark:bg-zinc-900">
              Vật tư
            </th>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`${c.width} py-2 pr-2 ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.label}
              </th>
            ))}
            <th className="w-[88px] py-2 pr-2 text-right">SL đặt</th>
            <th className="w-[112px] py-2 pr-2 text-right">{priceLabel}</th>
            <th className="w-[108px] py-2 pr-2 text-right">Thành tiền</th>
            <th className="w-[210px] py-2 pr-2">Ghi chú</th>
            <th className="w-7 py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td
                colSpan={totalColSpan}
                className="py-6 text-center text-xs text-zinc-400"
              >
                Chưa có dòng nào — gõ tên vật tư ở ô dưới cùng để thêm.
              </td>
            </tr>
          )}
          {lines.map((l, i) => {
            const amount = lineAmount(template, l)
            const kg = lineQty2(template, l)
            const problem = lineProblem(template, l)
            const suggest = suggestions.get(l.material_id) ?? null
            // Mẫu phụ kiện: SL gợi ý = (nhu cầu − tồn) × (1 + hao hụt%), làm tròn lên.
            const wasteSuggest =
              template === 'accessory' && l.qty_demand !== ''
                ? suggestOrderQty(
                    Number(l.qty_demand),
                    Number(l.qty_on_hand) || 0,
                    Number(l.waste_pct) || 0,
                  )
                : null

            return (
              <tr
                key={l.material_id}
                className="border-t border-zinc-100 align-top dark:border-zinc-900"
              >
                <td className="sticky left-0 z-[1] bg-white py-2 pl-3 text-center text-xs text-zinc-400 dark:bg-zinc-950">
                  <div className="flex h-[30px] items-center justify-center">{i + 1}</div>
                </td>
                <td className="sticky left-7 z-[1] bg-white py-2 pr-2 dark:bg-zinc-950">
                  <ProductCodeCell
                    value={l.product_code}
                    products={products}
                    onChange={(v) => onPatch(i, { product_code: v })}
                    label={`Mã SP ${l.name}`}
                  />
                </td>
                <td className="sticky left-[120px] z-[1] bg-white py-2 pr-2 dark:bg-zinc-950">
                  {/* Tên dài thì XUỐNG DÒNG chứ không cắt cụt — người mua phải đọc
                      được đủ "Vít 4x15 đuôi cá tai tròn 8mm" mới biết đúng hàng. */}
                  <div className="text-xs font-semibold break-words" title={l.name}>
                    {l.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                    {l.code} · {l.unit} · tồn {num(l.on_hand)}
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
                    value={l.qty}
                    onChange={(e) =>
                      onPatch(i, {
                        qty: (e.target.value === '' ? '' : Number(e.target.value)) as Num,
                      })
                    }
                    className={`${cell} text-right font-medium`}
                    aria-label={`SL đặt ${l.name}`}
                  />
                  {/* Gợi ý SL: từ hao hụt (mẫu phụ kiện) hoặc từ nhu cầu BOM. */}
                  {l.qty === '' &&
                    (wasteSuggest ?? suggest) != null &&
                    (wasteSuggest ?? suggest)! > 0 && (
                      <button
                        type="button"
                        onClick={() => onPatch(i, { qty: (wasteSuggest ?? suggest)! })}
                        className="mt-0.5 block w-full text-right text-[10px] text-sky-600 hover:underline dark:text-sky-400"
                        title={
                          wasteSuggest != null
                            ? 'Từ (SL đơn hàng − tồn) × hao hụt — bấm để dùng'
                            : 'Đề xuất từ nhu cầu BOM — bấm để dùng'
                        }
                      >
                        dùng {num((wasteSuggest ?? suggest)!)} ↩
                      </button>
                    )}
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
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
                <td className="py-2 pr-1 text-center">
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

          {/* Dòng nhập nhanh — luôn ở cuối bảng, focus sẵn để gõ liên tục. */}
          <tr className="border-t border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20">
            <td className="py-2.5 pl-3 text-center text-xs text-zinc-400">＋</td>
            {/* Ô tìm trải từ cột Mã SP tới hết phần cột riêng của mẫu. */}
            <td colSpan={cols.length + 2} className="py-2.5 pr-2">
              {addRow}
            </td>
            <td colSpan={5} className="py-2.5 pr-3 text-right text-[11px] text-zinc-400">
              chọn vật tư → nhập SL → nhập đơn giá
            </td>
          </tr>
        </tbody>
        {lines.length > 0 && (
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              {/* Nhãn trải tới hết cột Đơn giá, rồi tới ô tổng nằm đúng dưới
                  cột Thành tiền; hai cột cuối (Ghi chú, nút xoá) để đơn vị tiền. */}
              <td
                colSpan={totalColSpan - 3}
                className="py-2 pr-2 text-right text-[10px] font-semibold text-zinc-500 uppercase"
              >
                Cộng tiền hàng ({lines.length} dòng)
              </td>
              <td className="py-2 pr-2 text-right font-bold whitespace-nowrap">
                {num(Math.round(lines.reduce((s, l) => s + lineAmount(template, l), 0)))}
              </td>
              <td colSpan={2} className="py-2 pl-2 text-xs text-zinc-400">
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
