'use client'

import { PackageSearch, Pencil, Trash2, TriangleAlert, Weight } from 'lucide-react'
import { poTemplateMeta, suggestOrderQty, type PoTemplate } from '@/lib/po-template'
import { PO_FIELDS } from '@/lib/po-fields'
import { AutoGrowCell, LineCell, NoteCell, blurOnWheel, calc, cell } from './PoLineCells'
import { fmtMoney, packCount, roundMoney, roundUpToPack } from '@/lib/po-line'
import {
  cartonPriceSuggest,
  lineAmount,
  lineProblem,
  lineQty2,
  type Line,
  type Num,
} from './po-line'

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Ô kế tiếp trong CÙNG MỘT DÒNG, tìm theo `data-cell` bên trong hàng `data-line`.
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

/*
 * LƯỚI KIỂU BẢNG TÍNH: ranh giới giữa các ô do KẺ CỘT (border-r) của bảng đảm
 * nhiệm — ô nhập bên trong phẳng, không viền, không bo tròn (phản hồi
 * 08/08/2026: "mỗi thông tin một ô tròn nhìn khá xấu").
 */
const th =
  'text-muted-foreground border-b border-r border-zinc-100 px-1.5 pb-1.5 text-left align-bottom text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase last:border-r-0 dark:border-zinc-800'
const td =
  'border-b border-r border-zinc-100 px-1 py-1.5 align-top last:border-r-0 dark:border-zinc-800'

/**
 * DANH SÁCH DÒNG HÀNG của đơn đặt — BẢNG PHẲNG MỘT HÀNG/DÒNG, y như sổ Excel
 * của phòng Cung ứng (yêu cầu 08/08/2026: "tất cả cùng hàng như Excel").
 *
 *   · Header là bộ cột của MẪU đang chọn, hiện NGAY CẢ KHI CHƯA CÓ DÒNG — bấm
 *     qua các thẻ loại hàng là thấy mẫu này hỏi những ô nào, kèm một dòng ma
 *     mờ minh hoạ chỗ dữ liệu sẽ vào.
 *   · Cột đi đúng thứ tự đơn giấy: # · Tên · [cột riêng của mẫu] · SL đặt ·
 *     Đơn giá · [tổng kg nếu có] · Thành tiền · Ghi chú.
 *   · Bảng rộng hơn màn hình thì cuộn ngang trong khung riêng — thanh thêm dòng
 *     nằm NGOÀI khung nên không trôi theo (xem PoCreateForm).
 *
 * Dòng thiếu số báo bằng badge cam ngay dưới Thành tiền và viền cam đúng ô cần
 * điền (LineCell lo phần ô).
 */
export function PoLineTable({
  template,
  lines,
  suggestions,
  capLeft,
  currency,
  onPatch,
  onRemove,
  onSaveToCatalog,
  onEditMaterial,
  focusIndex = null,
  onFocused,
  onDoneRow,
}: {
  template: PoTemplate
  /** SL đề xuất từ nhu cầu BOM theo material_id — chỉ hiện, không tự điền. */
  suggestions: Map<string, number>
  /** Còn ĐẶT THÊM được trước khi vượt trần tồn (P3.1) — cảnh báo vàng, không chặn. */
  capLeft?: Map<string, number>
  lines: Line[]
  currency: string
  onPatch: (i: number, patch: Partial<Line>) => void
  onRemove: (i: number) => void
  /** Ghi kg/m · kg/đơn-vị vừa gõ về danh mục vật tư (0128). */
  onSaveToCatalog?: (
    materialId: string,
    field: 'kgm' | 'kgunit' | 'spec',
    value: number | string,
  ) => void
  /** Mở modal SỬA VẬT TƯ tại chỗ — giai đoạn hoàn thiện data, thiếu gì sửa ngay. */
  onEditMaterial?: (materialId: string) => void
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
  // Ô tổng tự tính (tổng kg) render thành cột nền xám; ô editHidden (Tồn kho)
  // chỉ dành cho phiếu in — tồn đã hiện ở chip dưới tên vật tư, giá trị vẫn
  // được chụp ngầm lúc chọn vật tư.
  const calcCol = cols.find((c) => c.kind === 'calc')
  const inputCols = cols.filter((c) => c.kind !== 'calc' && !c.editHidden)
  const empty = lines.length === 0

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* GIẤU THANH CUỘN (08/08/2026) — vẫn cuộn ngang được bằng lăn/vuốt, và
          Tab/Enter nhảy ô thì trình duyệt tự trượt ô vào tầm nhìn; chỉ là không
          bày thanh xám to giữa form. */}
      <div className="[scrollbar-width:none] overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={`${th} w-8`}>#</th>
              <th className={`${th} min-w-[200px]`}>Tên SP / vật tư</th>
              {inputCols.map((c) => (
                <th key={c.key} className={th}>
                  {c.label}
                </th>
              ))}
              {/* ĐVT là CỘT riêng như sổ Excel (08/08/2026) — trước chỉ là chữ
                  nhỏ dưới tên, người soạn phản hồi "mẫu không có phần ĐVT".
                  Đứng NGAY TRƯỚC cột SL đặt, đúng vị trí trên phiếu in gửi NCC
                  (`PO_PRINT_ORDER` — 10/08/2026); trước đó form để sau cột SL
                  nên nhìn form một kiểu, nhận giấy một kiểu khác. */}
              <th className={`${th} text-center`}>ĐVT</th>
              <th className={`${th} text-right`}>SL đặt</th>
              <th className={`${th} text-right`}>{priceLabel}</th>
              {calcCol && <th className={`${th} text-right`}>{calcCol.label}</th>}
              <th className={`${th} text-right`}>Thành tiền</th>
              <th className={`${th} min-w-[150px]`}>Ghi chú</th>
              <th className={th} aria-label="Xoá dòng" />
            </tr>
          </thead>
          <tbody>
            {empty ? (
              /*
               * DÒNG MA khi bảng trống — đúng khuôn cột thật, mờ và không bấm
               * được: người soạn thấy trước mẫu này sẽ nhập gì mà không phải
               * thêm một dòng thử.
               */
              <tr aria-hidden className="pointer-events-none select-none">
                <td className={`${td} text-muted-foreground/50 text-[12px]`}>1</td>
                <td className={td}>
                  <div className="text-muted-foreground/60 text-[13px] italic">
                    — tên vật tư sẽ hiện ở đây —
                  </div>
                  <div className="text-muted-foreground/50 mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px]">
                    <span className="bg-muted rounded border px-1.5 font-mono">
                      mã VT
                    </span>
                    <span>tồn kho</span>
                  </div>
                </td>
                {inputCols.map((c) => (
                  <td key={c.key} className={td}>
                    <div className={c.width}>
                      <div className={`${cell} text-muted-foreground/40 truncate`}>
                        {c.placeholder ?? '—'}
                      </div>
                    </div>
                  </td>
                ))}
                <td className={`${td} text-muted-foreground/40 pt-3 text-center`}>ĐVT</td>
                <td className={td}>
                  <div className="w-[92px]">
                    <div className={`${cell} text-muted-foreground/40 text-right`}>—</div>
                  </div>
                </td>
                <td className={td}>
                  <div className="w-[108px]">
                    <div className={`${cell} text-muted-foreground/40 text-right`}>—</div>
                  </div>
                </td>
                {calcCol && (
                  <td className={td}>
                    <div className={`${calc} text-muted-foreground/40 w-[88px]`}>—</div>
                  </td>
                )}
                <td className={`${td} text-muted-foreground/40 text-right`}>—</td>
                <td className={td}>
                  <div className={`${cell} text-muted-foreground/40 w-[150px]`}>…</div>
                </td>
                <td className={td} />
              </tr>
            ) : (
              lines.map((l, i) => {
                const amount = lineAmount(template, l)
                const kg = lineQty2(template, l)
                const problem = lineProblem(template, l)
                const suggest = suggestions.get(l.material_id) ?? null
                /*
                 * SL gợi ý = nhu cầu − tồn. Không cộng hao hụt. Điều kiện là
                 * "dòng có SL đơn hàng", KHÔNG phải "mẫu là phụ kiện" — cặp ô
                 * này có ở phụ kiện, nhôm và bao bì (xem `PO_FIELDS`).
                 */
                const shortSuggest =
                  l.qty_demand !== ''
                    ? suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0)
                    : null
                const rawSuggest = shortSuggest ?? suggest
                /*
                 * Vật tư có ĐÓNG GÓI MUA (1 bì = 500 con — 0124): gợi ý làm
                 * tròn LÊN nguyên bao, đúng phép nhân viên vẫn tự bấm máy
                 * (cần 13.596 con → 28 bì = 14.000 con). Không đóng gói thì
                 * giữ nguyên số thiếu như cũ.
                 */
                const useSuggest =
                  rawSuggest != null && rawSuggest > 0
                    ? roundUpToPack(rawSuggest, l.pack_size)
                    : rawSuggest
                const qtyPacks =
                  l.qty !== '' ? packCount(Number(l.qty), l.pack_size) : null

                return (
                  <tr key={l.material_id} data-line className="group">
                    <td className={`${td} text-muted-foreground pt-3 text-[12px]`}>
                      {i + 1}
                    </td>
                    <td className={td}>
                      {l.is_free ? (
                        /* DÒNG TỰ DO (0134): tên hàng GÕ NGAY TẠI ĐÂY — đơn
                           gỗ/gia công đặt theo SP, không có mã danh mục. */
                        <>
                          <AutoGrowCell
                            value={l.name}
                            placeholder="Tên SP / món gia công…"
                            onChange={(v) => onPatch(i, { name: v })}
                            label={`Tên hàng dòng ${i + 1}`}
                            className="font-semibold"
                            /* Dòng tự do vừa thêm: con trỏ vào Ô TÊN (ô bắt
                               buộc đang trống), không phải SL đặt. */
                            autoFocus={focusIndex === i}
                            onAutoFocused={onFocused}
                          />
                          <div className="text-muted-foreground mt-1 text-[11px]">
                            dòng tự gõ — không trừ kho
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Tên dài thì XUỐNG DÒNG chứ không cắt cụt — người mua
                              phải đọc đủ "Vít 4x15 đuôi cá tai tròn 8mm" mới biết
                              đúng hàng. */}
                          <div
                            className="text-foreground text-[13px] leading-snug font-semibold break-words"
                            title={l.name}
                          >
                            {l.name}
                          </div>
                          {/* Mã nổi thành chip mono: tên trong danh mục trùng nhau
                              nhiều, mã mới là thứ chốt đúng món khi đọc cho NCC. */}
                          {/* ĐVT đã có cột riêng cạnh SL đặt — chip chỉ còn mã + tồn. */}
                          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
                            <span className="bg-muted text-foreground/80 rounded border px-1.5 font-mono font-medium">
                              {l.code}
                            </span>
                            {/* SỬA VẬT TƯ tại chỗ (giai đoạn hoàn thiện data):
                                thiếu quy cách/barem/ĐVT thì bổ sung ngay,
                                không phải mở màn danh mục ở tab khác. */}
                            {onEditMaterial && (
                              <button
                                type="button"
                                onClick={() => onEditMaterial(l.material_id)}
                                className="text-muted-foreground/70 rounded p-0.5 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-400"
                                title="Sửa vật tư trong danh mục — quy cách, barem, đóng gói…"
                                aria-label={`Sửa vật tư ${l.name}`}
                              >
                                <Pencil className="size-3" aria-hidden />
                              </button>
                            )}
                            {/* null = chưa có sổ kho — "kho ?" thay vì tồn 0 giả. */}
                            {l.on_hand == null ? (
                              <span className="text-muted-foreground/70">kho ?</span>
                            ) : (
                              <span
                                className={
                                  l.on_hand > 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : undefined
                                }
                              >
                                tồn {num(l.on_hand)}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                    {inputCols.map((c) => (
                      <td key={c.key} className={td}>
                        <div className={c.width}>
                          <LineCell
                            f={c}
                            line={l}
                            index={i}
                            kgTotal={kg}
                            onPatch={onPatch}
                            onSaveToCatalog={onSaveToCatalog}
                          />
                        </div>
                      </td>
                    ))}
                    {/* ĐVT theo danh mục — chỉ đọc, đứng NGAY TRƯỚC SL đặt như
                        phiếu in gửi NCC. Dòng tự do thì ĐVT gõ được (cái/bộ…). */}
                    <td
                      className={`${td} pt-1.5 text-center text-[12.5px] whitespace-nowrap`}
                    >
                      {l.is_free ? (
                        <input
                          value={l.unit}
                          maxLength={30}
                          onChange={(e) => onPatch(i, { unit: e.target.value })}
                          className={`${cell} w-[52px] px-1 text-center`}
                          aria-label={`ĐVT dòng ${i + 1}`}
                        />
                      ) : (
                        <span className="inline-block pt-1.5">{l.unit}</span>
                      )}
                    </td>
                    <td className={td}>
                      {/* Bề rộng đặt ở DIV bọc, không đặt trên input: `cell` đã
                          có w-full, hai utility width trên cùng phần tử thì cái
                          nào thắng là do thứ tự trong stylesheet — ăn may. */}
                      <div className="w-[92px]">
                        <input
                          id={`qty-${l.material_id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          data-cell="qty"
                          onWheel={blurOnWheel}
                          /* Dòng vừa thêm: nhảy vào đây ngay, khỏi với chuột.
                             Dòng TỰ DO thì nhường con trỏ cho Ô TÊN ở đầu hàng. */
                          ref={(el) => {
                            if (el && focusIndex === i && !l.is_free) {
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
                              qty: (e.target.value === ''
                                ? ''
                                : Number(e.target.value)) as Num,
                            })
                          }
                          className={`${cell} text-right font-medium`}
                          aria-label={`SL đặt ${l.name}`}
                        />
                      </div>
                      {/* Gợi ý SL: phần còn thiếu của dòng, hoặc từ BOM lệnh. */}
                      {l.qty === '' && useSuggest != null && useSuggest > 0 && (
                        <button
                          type="button"
                          onClick={() => onPatch(i, { qty: useSuggest })}
                          className="mt-0.5 block w-full text-right text-[11px] font-medium whitespace-nowrap text-sky-700 hover:underline dark:text-sky-400"
                          title={
                            (shortSuggest != null
                              ? 'SL đơn hàng − tồn kho'
                              : 'Đề xuất từ nhu cầu BOM') +
                            (useSuggest !== rawSuggest
                              ? ` (${num(rawSuggest ?? 0)} làm tròn lên nguyên ${l.pack_unit || 'bao'})`
                              : '') +
                            ' — bấm để dùng'
                          }
                        >
                          dùng {num(useSuggest)} ↩
                        </button>
                      )}
                      {/* Trần tồn (P3.1): SL đặt vượt phần "còn đặt thêm được"
                          (max_stock − tồn − đã đặt) → cảnh báo vàng, không chặn. */}
                      {(() => {
                        const cap = capLeft?.get(l.material_id)
                        return cap != null && l.qty !== '' && Number(l.qty) > cap ? (
                          <div
                            className="mt-0.5 text-right text-[11px] whitespace-nowrap text-amber-600 dark:text-amber-500"
                            title="Trần tồn (max_stock) của vật tư trừ tồn hiện có và lượng đã đặt chưa về. Vượt trần là chủ đích (LSX lớn) thì cứ đặt — chỉ nhắc, không chặn."
                          >
                            ⚠ vượt trần tồn — thêm được {num(cap)}
                          </div>
                        ) : null
                      })()}
                      {/* Quy đổi đóng gói (0124): "≈ 27,2 bì" — nhìn là biết
                          gọi NCC bao nhiêu bao, khỏi bấm máy chia. */}
                      {qtyPacks != null && (
                        <div
                          className="text-muted-foreground mt-0.5 text-right text-[11px] whitespace-nowrap"
                          title={`Đóng gói mua: 1 ${l.pack_unit} = ${num(l.pack_size ?? 0)} ${l.unit}`}
                        >
                          {Number.isInteger(qtyPacks) ? '=' : '≈'} {num(qtyPacks)}{' '}
                          {l.pack_unit}
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      <div className="w-[108px]">
                        <input
                          id={`price-${l.material_id}`}
                          type="number"
                          min="0"
                          step="1"
                          data-cell="price"
                          onWheel={blurOnWheel}
                          /* Xong đơn giá là xong dòng — Enter trả con trỏ về ô
                             tìm, cả đơn nhập được không rời bàn phím. */
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
                      </div>
                      {/* Bao bì (0134): giá/thùng = m² × giá/m² + bản in — có đủ
                          hai ô là mời bấm dùng, đúng công thức trên đơn thật. */}
                      {(() => {
                        const goiY = cartonPriceSuggest(template, l)
                        if (goiY == null || l.price === goiY) return null
                        return (
                          <button
                            type="button"
                            onClick={() => onPatch(i, { price: goiY })}
                            className="mt-0.5 block w-full text-right text-[11px] font-medium whitespace-nowrap text-sky-700 hover:underline dark:text-sky-400"
                            title="m²/thùng × đơn giá/m² + bản in — bấm để dùng"
                          >
                            = {num(goiY)} ↩
                          </button>
                        )
                      })()}
                    </td>
                    {calcCol && (
                      <td className={td}>
                        <div
                          className={`${calc} w-[88px]`}
                          title="Hệ thống tự tính từ thông số dòng"
                        >
                          {kg == null ? (
                            <span className="text-muted-foreground font-normal">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Weight
                                className="text-muted-foreground size-3"
                                aria-hidden
                              />
                              {num(kg)}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className={`${td} text-right`}>
                      {amount > 0 ? (
                        <div className="pt-1.5 text-[13.5px] font-semibold whitespace-nowrap tabular-nums">
                          {fmtMoney(roundMoney(amount, currency), currency)}
                        </div>
                      ) : (
                        <div className="text-muted-foreground/40 pt-1.5 text-[13.5px]">
                          —
                        </div>
                      )}
                      {/* Thiếu số nói TO ngay tại chỗ tiền. */}
                      {problem && (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                          <TriangleAlert className="size-3" aria-hidden /> {problem}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      {/* Ghi chú là CỘT thường trực như Excel — không thu gọn. */}
                      <div className="w-[150px]">
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
                    </td>
                    <td className={`${td} pt-2.5`}>
                      <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="text-muted-foreground rounded-md p-1 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        aria-label={`Xoá dòng ${l.name}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {empty ? (
        <p className="text-muted-foreground flex items-center justify-center gap-1.5 pt-1 pb-2 text-center text-xs">
          <PackageSearch className="size-4 shrink-0" aria-hidden />
          Mẫu <b>{meta.label}</b> nhập các cột như trên — bấm <b>Chọn vật tư</b> ở thanh
          ngay dưới để bắt đầu.
        </p>
      ) : (
        /* Dòng cộng cuối danh sách — đối chiếu nhanh với thanh tổng. */
        <div className="text-muted-foreground flex items-baseline justify-end gap-2 px-1 pt-0.5 text-[12px]">
          Cộng tiền hàng ({lines.length} dòng)
          <b className="text-foreground text-[13.5px] font-bold tabular-nums">
            {fmtMoney(
              roundMoney(
                lines.reduce((s, x) => s + lineAmount(template, x), 0),
                currency,
              ),
              currency,
            )}
          </b>
          <span className="text-[11px]">{currency}</span>
        </div>
      )}
    </div>
  )
}

/** Ô số dùng chung cho phần điều khoản của form. */
export type { Num }
