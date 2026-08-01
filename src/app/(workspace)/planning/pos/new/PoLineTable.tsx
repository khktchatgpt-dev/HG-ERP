'use client'

import { poTemplateMeta, suggestOrderQty, type PoTemplate } from '@/lib/po-template'
import { DiePicker } from '@/components/supply/DiePicker'
import {
  lineAmount,
  lineProblem,
  lineQty2,
  recalcCartonArea,
  type Line,
  type Num,
} from './po-line'

const num = (n: number) => n.toLocaleString('vi-VN')
const cell =
  'h-[30px] w-full rounded-md border border-zinc-300 px-2 text-[13px] focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
const calc =
  'flex h-[30px] items-center justify-end rounded-md bg-zinc-100 px-2 text-[13px] font-medium tabular-nums dark:bg-zinc-800'

/**
 * Cột riêng của từng mẫu đơn. Bộ cột lấy đúng từ đơn thật của phòng Cung ứng —
 * xem `@/lib/po-template` cho bảng đối chiếu mẫu ↔ NCC.
 *
 * Quy ước hiển thị: ô NỀN XÁM là số hệ thống tự tính (tổng kg, m², thành tiền,
 * SL gợi ý) — không gõ được. Nhân viên chỉ gõ ô nền trắng, và ở mọi mẫu thì hai
 * ô luôn phải gõ là SL đặt và Đơn giá.
 */
type Col = { key: string; label: string; width: string; align?: 'right' }

const COLS: Record<PoTemplate, Col[]> = {
  accessory: [
    { key: 'grade', label: 'Vật liệu', width: 'w-[110px]' },
    { key: 'spec', label: 'Quy cách', width: 'w-[110px]' },
    { key: 'demand', label: 'SL đơn hàng', width: 'w-[92px]', align: 'right' },
    { key: 'onhand', label: 'Tồn kho', width: 'w-[78px]', align: 'right' },
    { key: 'waste', label: 'HH %', width: 'w-[62px]', align: 'right' },
  ],
  aluminium: [
    { key: 'die', label: 'Mã khuôn', width: 'w-[120px]' },
    { key: 'kgm', label: 'kg/m', width: 'w-[80px]', align: 'right' },
    { key: 'barlen', label: 'Dài cây (m)', width: 'w-[92px]', align: 'right' },
    { key: 'surplus', label: 'Cây dư', width: 'w-[70px]', align: 'right' },
    { key: 'kgtotal', label: 'Tổng kg', width: 'w-[92px]', align: 'right' },
  ],
  metal_kg: [
    { key: 'grade', label: 'Vật liệu', width: 'w-[100px]' },
    { key: 'dim', label: 'Kích thước', width: 'w-[130px]' },
    { key: 'finish', label: 'Màu / bề mặt', width: 'w-[100px]' },
    { key: 'kgunit', label: 'kg / đơn vị', width: 'w-[92px]', align: 'right' },
    { key: 'kgtotal', label: 'Tổng kg', width: 'w-[92px]', align: 'right' },
  ],
  carton: [
    { key: 'productcode', label: 'Mã SP', width: 'w-[92px]' },
    { key: 'open', label: 'Cách mở', width: 'w-[74px]' },
    { key: 'pcs', label: 'Pcs/thùng', width: 'w-[78px]', align: 'right' },
    { key: 'inner', label: 'Lọt lòng D×R×C (mm)', width: 'w-[168px]' },
    { key: 'area', label: 'm² / thùng', width: 'w-[88px]', align: 'right' },
    { key: 'basis', label: 'Tính theo', width: 'w-[92px]' },
  ],
  simple: [{ key: 'spec', label: 'Quy cách', width: 'w-[140px]' }],
}

export function PoLineTable({
  template,
  lines,
  suggestions,
  currency,
  onPatch,
  onRemove,
  addRow,
}: {
  template: PoTemplate
  lines: Line[]
  /** SL đề xuất từ nhu cầu BOM theo material_id — chỉ hiện, không tự điền. */
  suggestions: Map<string, number>
  currency: string
  onPatch: (i: number, patch: Partial<Line>) => void
  onRemove: (i: number) => void
  /** Ô chọn vật tư luôn nằm cuối bảng — dòng nhập nhanh. */
  addRow: React.ReactNode
}) {
  const meta = poTemplateMeta(template)
  const cols = COLS[template]
  const priceLabel = meta.priceUnit ? `Đơn giá / ${meta.priceUnit}` : 'Đơn giá'
  const totalColSpan = 4 + cols.length

  const setNum =
    (i: number, key: keyof Line) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onPatch(i, {
        [key]: e.target.value === '' ? '' : Number(e.target.value),
      } as Partial<Line>)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] tabular-nums">
        <thead className="bg-zinc-50 dark:bg-zinc-900/50">
          <tr className="text-left text-[10px] text-zinc-500 uppercase">
            <th className="w-7 py-2 pl-3 text-center">#</th>
            <th className="min-w-[190px] py-2 pr-2">Vật tư</th>
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
            <th className="w-7 py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td
                colSpan={totalColSpan + 1}
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
                <td className="py-2 pl-3 text-center text-xs text-zinc-400">
                  <div className="flex h-[30px] items-center justify-center">{i + 1}</div>
                </td>
                <td className="py-2 pr-2">
                  <div className="text-xs font-semibold" title={l.name}>
                    {l.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                    {l.code} · {l.unit} · tồn {num(l.on_hand)}
                  </div>
                  <input
                    value={l.note}
                    maxLength={500}
                    placeholder={
                      template === 'aluminium' || template === 'metal_kg'
                        ? 'vị trí: chân trước…'
                        : 'ghi chú: 50 bàn santorin (4c/sp)…'
                    }
                    onChange={(e) => onPatch(i, { note: e.target.value })}
                    className="mt-1 h-[24px] w-full rounded border border-transparent bg-transparent px-1 text-[11px] text-zinc-500 hover:border-zinc-200 focus:border-sky-500 focus:outline-none dark:hover:border-zinc-700"
                    aria-label={`Ghi chú ${l.name}`}
                  />
                </td>

                {cols.map((c) => (
                  <td key={c.key} className="py-2 pr-2">
                    {c.key === 'grade' && (
                      <input
                        value={l.material_grade}
                        maxLength={100}
                        placeholder="Sắt xi trắng…"
                        onChange={(e) => onPatch(i, { material_grade: e.target.value })}
                        className={cell}
                        aria-label={`Vật liệu ${l.name}`}
                      />
                    )}
                    {c.key === 'spec' && (
                      <input
                        value={l.spec}
                        maxLength={100}
                        placeholder="25×50×1li…"
                        onChange={(e) => onPatch(i, { spec: e.target.value })}
                        className={cell}
                        aria-label={`Quy cách ${l.name}`}
                      />
                    )}
                    {c.key === 'productcode' && (
                      <input
                        value={l.product_code}
                        maxLength={50}
                        placeholder="22027-209"
                        onChange={(e) => onPatch(i, { product_code: e.target.value })}
                        className={`${cell} font-mono text-[12px]`}
                        aria-label={`Mã SP ${l.name}`}
                      />
                    )}
                    {c.key === 'demand' && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.qty_demand}
                        onChange={setNum(i, 'qty_demand')}
                        className={`${cell} text-right`}
                        aria-label={`SL đơn hàng ${l.name}`}
                      />
                    )}
                    {c.key === 'onhand' && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.qty_on_hand}
                        onChange={setNum(i, 'qty_on_hand')}
                        className={`${cell} text-right`}
                        aria-label={`Tồn kho ${l.name}`}
                      />
                    )}
                    {c.key === 'waste' && (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={l.waste_pct}
                        onChange={setNum(i, 'waste_pct')}
                        className={`${cell} text-right`}
                        aria-label={`Hao hụt % ${l.name}`}
                      />
                    )}
                    {c.key === 'die' && (
                      <DiePicker
                        value={l.die_code}
                        ariaLabel={`Mã khuôn ${l.name}`}
                        onTextChange={(code) => onPatch(i, { die_code: code })}
                        onPick={(d) =>
                          onPatch(i, {
                            die_code: d.code,
                            // Chọn khuôn là chốt kg/m — thứ quyết định tổng kg.
                            weight_per_m: d.weight_per_m ?? l.weight_per_m,
                            spec: d.profile_spec ?? l.spec,
                          })
                        }
                      />
                    )}
                    {c.key === 'kgm' && (
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={l.weight_per_m}
                        onChange={setNum(i, 'weight_per_m')}
                        className={`${cell} text-right`}
                        aria-label={`kg/m ${l.name}`}
                      />
                    )}
                    {c.key === 'barlen' && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.bar_length_m}
                        onChange={setNum(i, 'bar_length_m')}
                        className={`${cell} text-right`}
                        aria-label={`Dài cây ${l.name}`}
                      />
                    )}
                    {c.key === 'surplus' && (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.bar_surplus}
                        onChange={setNum(i, 'bar_surplus')}
                        className={`${cell} text-right`}
                        aria-label={`Số cây dư ${l.name}`}
                      />
                    )}
                    {c.key === 'dim' && (
                      <input
                        value={l.dimension_text}
                        maxLength={200}
                        placeholder="Inox phi 15.9x1.5li"
                        onChange={(e) => onPatch(i, { dimension_text: e.target.value })}
                        className={cell}
                        aria-label={`Kích thước ${l.name}`}
                      />
                    )}
                    {c.key === 'finish' && (
                      <input
                        value={l.finish}
                        maxLength={100}
                        placeholder="inox bóng"
                        onChange={(e) => onPatch(i, { finish: e.target.value })}
                        className={cell}
                        aria-label={`Màu bề mặt ${l.name}`}
                      />
                    )}
                    {c.key === 'kgunit' && (
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={l.weight_per_unit}
                        onChange={setNum(i, 'weight_per_unit')}
                        className={`${cell} text-right`}
                        aria-label={`kg mỗi ${l.unit} ${l.name}`}
                      />
                    )}
                    {c.key === 'kgtotal' && (
                      <div className={calc} title="Hệ thống tự tính">
                        {kg == null ? (
                          <span className="font-normal text-zinc-400">—</span>
                        ) : (
                          num(kg)
                        )}
                      </div>
                    )}
                    {c.key === 'open' && (
                      <select
                        value={l.open_style}
                        onChange={(e) => {
                          const next = { ...l, open_style: e.target.value }
                          onPatch(i, {
                            open_style: e.target.value,
                            area_m2: recalcCartonArea(next),
                          })
                        }}
                        className={cell}
                        aria-label={`Cách mở ${l.name}`}
                      >
                        <option value="">—</option>
                        <option value="AD">AD</option>
                        <option value="MR">MR</option>
                      </select>
                    )}
                    {c.key === 'pcs' && (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.pcs_per_ctn}
                        onChange={setNum(i, 'pcs_per_ctn')}
                        className={`${cell} text-right`}
                        aria-label={`Pcs mỗi thùng ${l.name}`}
                      />
                    )}
                    {c.key === 'inner' && (
                      <div className="flex items-center gap-1">
                        {(['inner_l_mm', 'inner_w_mm', 'inner_h_mm'] as const).map(
                          (k) => (
                            <input
                              key={k}
                              type="number"
                              min="0"
                              step="1"
                              value={l[k]}
                              onChange={(e) => {
                                const v =
                                  e.target.value === '' ? '' : Number(e.target.value)
                                const next = { ...l, [k]: v } as Line
                                onPatch(i, {
                                  [k]: v,
                                  area_m2: recalcCartonArea(next),
                                } as Partial<Line>)
                              }}
                              className={`${cell} px-1 text-right`}
                              aria-label={`${k === 'inner_l_mm' ? 'Dài' : k === 'inner_w_mm' ? 'Rộng' : 'Cao'} lọt lòng ${l.name}`}
                            />
                          ),
                        )}
                      </div>
                    )}
                    {c.key === 'area' && (
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={l.area_m2}
                        onChange={setNum(i, 'area_m2')}
                        className={`${cell} text-right`}
                        title="Tự tính từ lọt lòng theo cách mở — sửa được nếu NCC chào khác barem"
                        aria-label={`m² mỗi thùng ${l.name}`}
                      />
                    )}
                    {c.key === 'basis' && (
                      <select
                        value={l.carton_basis}
                        onChange={(e) =>
                          onPatch(i, { carton_basis: e.target.value as 'ctn' | 'm2' })
                        }
                        className={cell}
                        aria-label={`Tính tiền theo ${l.name}`}
                      >
                        <option value="ctn">thùng</option>
                        <option value="m2">m²</option>
                      </select>
                    )}
                  </td>
                ))}

                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.qty}
                    onChange={setNum(i, 'qty')}
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
                    onChange={setNum(i, 'price')}
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
            <td colSpan={cols.length + 1} className="py-2.5 pr-2">
              {addRow}
            </td>
            <td colSpan={3} className="py-2.5 pr-3 text-right text-[11px] text-zinc-400">
              chọn vật tư → nhập SL → nhập đơn giá
            </td>
          </tr>
        </tbody>
        {lines.length > 0 && (
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <td
                colSpan={totalColSpan - 1}
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
