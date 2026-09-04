'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Pencil, Trash2, TriangleAlert, Weight } from 'lucide-react'
import { poTemplateMeta, suggestOrderQty, type PoTemplate } from '@/lib/po-template'
import { PO_FIELDS } from '@/lib/po-fields'
import { GridCellInput, GridCellNumber } from '@/components/erp/GridCell'
import { Button } from '@/components/shadcn/button'
import { cn } from '@/lib/utils'
import { fmtMoney, packCount, roundMoney, roundUpToPack } from '@/lib/po-line'
import { AutoGrowCell, LineCell, NoteCell, blurOnWheel, calc, cell } from './PoLineCells'
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
 * BẢNG DÒNG HÀNG của form soạn đơn — bảng tính, một hàng/dòng như sổ Excel.
 *
 * Logic nhập giữ NGUYÊN bản đang chạy: cùng `LineCell` (barem kg/m, ô lọt lòng,
 * cách mở thùng…), cùng gợi ý SL/giá, cùng cảnh báo trần tồn, cùng `lineAmount`.
 * Chỉ đổi cách bày.
 *
 * ─── BA LỖI CỦA BẢN DỰNG ĐẦU, ĐÃ SỬA ───
 *
 * 1. LỆCH 19px. Bản đầu có cột `#` riêng khai `w-10` (40px) và cột Tên ghim ở
 *    `left-10`. Nhưng `width` trên `<th>` của bảng auto-layout chỉ là ĐỀ NGHỊ —
 *    trình duyệt cấp cho nó 21px, trong khi cột Tên vẫn đứng ở đúng 40px. Kết
 *    quả: một khe 19px cho nội dung chạy qua giữa hai cột ghim.
 *
 *    Sửa TẬN GỐC chứ không chỉnh số: BỎ HẲN cột `#`, số thứ tự vào ô Tên. Còn
 *    đúng MỘT cột ghim trái ở `left-0` thì không còn phép cộng nào để sai.
 *    Cột chevron rỗng cũng bỏ luôn — nút mở ô mẫu đã nằm trong ô Tên.
 *
 * 2. CHE QUÁ NHIỀU. Hai cột ghim từng ăn 380/643px khung cuộn (59%). Nay: tiêu
 *    đề cho XUỐNG DÒNG (bỏ `whitespace-nowrap` — "Lọt lòng D×R×C (MM)" một mình
 *    chiếm 137px), cột tiền 136→112px, nút xoá dời sang ô Tên. Và cột ghim mang
 *    BÓNG ĐỔ thật, để chỗ bị che đọc ra là "còn nội dung phía dưới" chứ không
 *    phải "bảng vỡ".
 *
 * 3. Ô TRÔNG NHƯ RỖNG. Hàng cao 64px (ô Tên hai dòng) mà mọi ô canh `align-top`
 *    nên ô nhập dạt lên đỉnh, giữa ô là một khoảng trắng. Ô nhập nay canh giữa;
 *    chỉ ô Tên giữ `align-top`.
 */

/* Ranh giới ô do KẺ CỘT của bảng đảm nhiệm; ô nhập bên trong phẳng, không viền. */

/**
 * TIÊU ĐỀ CỘT IN ĐẬM, mực chính (yêu cầu user 29/08).
 *
 * Trước để `text-muted-foreground` + `font-semibold` cỡ 10px: nhạt hơn cả chữ
 * phụ chú dưới tên vật tư, nên hàng tiêu đề không đọc ra là hàng tiêu đề — mắt
 * phải dò xuống ô dữ liệu mới biết cột nào là cột nào. Đây là bộ TÊN TRƯỜNG của
 * đơn, người soạn đối chiếu với mẫu giấy liên tục, nên phải bắt mắt trước.
 */
const thBase =
  'text-foreground border-border bg-card sticky top-0 border-b border-r px-1.5 pt-2 pb-1.5 text-left align-bottom text-[10.5px] leading-[13px] font-bold tracking-wide uppercase last:border-r-0'
const tdBase = 'border-border border-b border-r px-1 py-1.5 align-middle last:border-r-0'

/**
 * TẦNG NỔI CỦA Ô GHIM Ở THÂN BẢNG (05/09/2026).
 *
 * `position: sticky` KHÔNG tự đặt phần tử lên trên: nó chỉ ghim vị trí. Bốn ô
 * ghim của thân bảng trước đây để `z-index: auto`, nên khi cuộn ngang thì ô của
 * cột kế trượt xuống dưới chúng mà vẫn VẼ ĐÈ LÊN — đo được: cuộn 140px thì ô
 * nhập "Mã khuôn" chồng lên cột Tên đúng 136px, trông như một ô mờ lạc vào giữa
 * tên vật tư.
 *
 * Ẩn kỹ vì nền `bg-card` của ô ghim là trắng đặc, nên phần CHỮ tĩnh vẫn bị che
 * đúng như mong đợi; chỉ mấy ô NHẬP của cột kế mới nổi lên trên — tức lỗi chỉ
 * lộ ở đúng những cột có input, và chỉ khi cuộn.
 *
 * Đặt 2: trên các ô thường (auto = 0) nhưng dưới đầu bảng (5), để hàng tiêu đề
 * ghim vẫn che được ô ghim khi cuộn dọc.
 */
const STICKY_Z = 2

/**
 * Bóng đổ của cột ghim — nói rằng nội dung đang TRƯỢT XUỐNG DƯỚI, không phải mất.
 * Chỉ bật khi phía đó THẬT SỰ còn nội dung bị che; bảng không tràn ngang (chế độ
 * gọn) mà vẫn đổ bóng thì giữa bảng có một vệt tối vô cớ.
 */
const SHADOW_L = '6px 0 8px -6px rgba(16,24,40,0.28), 1px 0 0 var(--border)'
const SHADOW_R = '-6px 0 8px -6px rgba(16,24,40,0.28), -1px 0 0 var(--border)'
const EDGE_L = '1px 0 0 var(--border)'
const EDGE_R = '-1px 0 0 var(--border)'
/** Bề rộng cột Tên — khoá cứng để cột ghim không co giãn theo tên hàng. */
const NAME_W = 250

/**
 * BỀ RỘNG CÁC CỘT CỐ ĐỊNH — khai một chỗ cho cả header, dòng ma và chân bảng,
 * để ba tầng không bao giờ lệch nhau. Kèm `minWidth` (xem chú thích ở header).
 * Số khớp với bề rộng ô nhập bên trong + 12px đệm hai bên.
 */
const w = (n: number) => ({ width: n, minWidth: n })
const COL = {
  unit: w(52),
  qty: w(104),
  price: w(116),
  calc: w(100),
  /**
   * Ghi chú là cột CHỮ TỰ DO — cho chính nó nuốt phần dư của bảng `w-full`.
   * Dùng một cột đệm rỗng cũng chia đều được, nhưng để lại một dải trống không
   * nhãn giữa Ghi chú và Thành tiền, nhìn như bảng thiếu cột.
   */
  note: { minWidth: 156, width: '100%' },
  money: w(112),
} as const

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
  suggestions: Map<string, number>
  capLeft?: Map<string, number>
  lines: Line[]
  currency: string
  onPatch: (i: number, patch: Partial<Line>) => void
  onRemove: (i: number) => void
  onSaveToCatalog?: (
    materialId: string,
    field: 'kgm' | 'kgunit' | 'spec',
    value: number | string,
  ) => void
  onEditMaterial?: (materialId: string) => void
  focusIndex?: number | null
  onFocused?: () => void
  onDoneRow?: () => void
}) {
  const meta = poTemplateMeta(template)
  const cols = PO_FIELDS[template]
  const priceLabel = meta.priceUnit ? `Đơn giá / ${meta.priceUnit}` : 'Đơn giá'
  const calcCol = cols.find((c) => c.kind === 'calc')
  const inputCols = cols.filter((c) => c.kind !== 'calc' && !c.editHidden)
  const shownCols = inputCols
  const empty = lines.length === 0

  const totalAmount = lines.reduce((s, x) => s + lineAmount(template, x), 0)
  const totalQty = lines.reduce((s, x) => s + (x.qty === '' ? 0 : Number(x.qty)), 0)
  const missing = lines.filter((l) => lineProblem(template, l)).length

  /** Còn nội dung bị che bên trái / bên phải hay không — quyết định đổ bóng. */
  const [shade, setShade] = useState({ l: false, r: false })
  const syncShade = (el: HTMLDivElement | null) => {
    if (!el) return
    const l = el.scrollLeft > 0
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    if (l !== shade.l || r !== shade.r) setShade({ l, r })
  }
  const shL = shade.l ? SHADOW_L : EDGE_L
  const shR = shade.r ? SHADOW_R : EDGE_R

  /**
   * CHIỀU CAO KHUNG CUỘN — ĐO THẬT, không phải `calc(100vh-322px)`.
   *
   * Con số ma đó đúng đúng MỘT lần: ở đúng bề rộng mà thanh chip vừa một hàng.
   * Màn hẹp thì chip xuống hai hàng (thẻ dính đầu cao thêm ~50px) và bảng thò
   * xuống dưới thanh tổng; màn cao 1440px thì bảng hụt cả trăm pixel đất trống.
   *
   * Đo từ vị trí thật của khung: cao còn lại = viewport − mép trên khung −
   * thanh thêm dòng (nằm ngoài khung) − thanh tổng − thở 16px. Đo lại khi đổi
   * cỡ cửa sổ; KHÔNG đo theo cuộn — mép trên chỉ nhỏ đi khi cuộn nên số ở đỉnh
   * trang đã là số chặt nhất.
   */
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [maxH, setMaxH] = useState<number | null>(null)
  const measure = () => {
    const el = boxRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top
    const section = el.parentElement
    const addBar = section?.lastElementChild
    const addH = addBar && addBar !== el ? addBar.getBoundingClientRect().height : 0
    const footH = document.querySelector('footer')?.getBoundingClientRect().height ?? 56
    const next = Math.max(200, Math.round(window.innerHeight - top - addH - footH - 16))
    setMaxH((v) => (v === next ? v : next))
  }
  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    if (boxRef.current?.parentElement?.parentElement) {
      ro.observe(boxRef.current.parentElement.parentElement)
    }
    return () => {
      window.removeEventListener('resize', measure)
      ro.disconnect()
    }
  }, [])

  const setBox = (el: HTMLDivElement | null) => {
    boxRef.current = el
    syncShade(el)
  }

  /** Ô kế tiếp trong CÙNG dòng — chuỗi nhập luôn là SL đặt → Đơn giá. */
  const focusInRow = (from: HTMLElement, cellName: string): boolean => {
    const next = from
      .closest<HTMLElement>('[data-line]')
      ?.querySelector<HTMLInputElement>(`[data-cell="${cellName}"]`)
    if (!next) return false
    next.focus()
    next.select?.()
    return true
  }

  return (
    /*
     * FOCUS COBALT, không phải sky. `cell`/`LineCell` dùng chung với màn cũ nên
     * còn mang `focus:bg-sky-50` từ thời theme-v2 — sửa file đó là đổi luôn màn
     * đang chạy. Đè bằng biến thể hậu duệ (`.khung input:focus`): độ đặc hiệu
     * cao hơn utility trên chính ô nên thắng chắc chắn, không phụ thuộc thứ tự
     * class trong stylesheet.
     */
    <div
      ref={setBox}
      onScroll={(e) => syncShade(e.currentTarget)}
      style={maxH ? { maxHeight: maxH } : undefined}
      /*
       * `[&_[data-cell]]` — SL ĐẶT và ĐƠN GIÁ luôn ĐỎ + đậm (user chốt 29/08).
       *
       * Đây là hai con số người soạn phải nhìn ra ngay giữa một bảng toàn chữ
       * đen: mọi thứ khác trên dòng đều là thông tin tra cứu (tên, mã, tồn,
       * quy cách), riêng hai ô này là thứ họ NHẬP và là thứ nhân ra tiền. Bản
       * trước chỉ đỏ lúc ô có con trỏ — tức đúng lúc đang nhìn nó thì mới nổi,
       * còn khi rà soát cả đơn thì lại chìm.
       *
       * Dùng token `--stop` chứ không gõ một mã đỏ mới, để cả app vẫn một hệ
       * màu. LƯU Ý: `--stop` đang mang nghĩa "dừng/sai" ở chỗ khác (badge thiếu
       * số, đợt giao vượt SL) — ở đây nó là màu NHẤN MẠNH. Nếu về sau thấy
       * người dùng đọc nhầm "số đỏ = số sai" thì đổi hai ô này sang cobalt đậm.
       */
      /* Sàn 200px giữ bảng khỏi "nhảy" khi thêm dòng đầu tiên — nhưng lúc đơn
         còn TRỐNG thì nó là 145px trắng trơn dưới một dòng ma. Đơn rỗng hạ sàn
         xuống vừa đủ dòng ma; từ dòng thật đầu tiên trở đi mới cần sàn cao. */
      className={cn(
        'overflow-auto [&_[data-cell]]:font-semibold [&_[data-cell]]:text-[var(--stop)] [&_input:focus]:bg-[var(--accent)] [&_input:focus-visible]:ring-[var(--ring)]/45 [&_textarea:focus]:bg-[var(--accent)] [&_textarea:focus-visible]:ring-[var(--ring)]/45',
        empty ? 'min-h-0' : 'min-h-[200px]',
      )}
    >
      {/*
        `text-[13px]` trên chính THẺ BẢNG: ô nào không tự khai cỡ chữ thì thừa
        kế 16px của body — dòng ma hiện chữ "ĐVT" to gấp rưỡi mọi thứ quanh nó.

        BỀ RỘNG KHAI Ở HEADER, khớp với ô nhập bên dưới. Không khai thì bảng
        `w-full` chia phần thừa theo nội dung: cột SL đặt phình gấp đôi ô nhập
        92px trong khi ĐVT co lại — nhìn là thấy so le.
      */}
      {/* eslint-disable-next-line hg/no-raw-control -- LƯỚI NHẬP kiểu bảng tính:
          cột ghim, mỗi ô là một input, bề rộng khai tay ở header. DataTable là
          bảng DANH SÁCH (sắp xếp/phân trang) — không mô tả được hình này. */}
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th
              className={`${thBase} sticky left-0`}
              style={{ zIndex: 5, width: NAME_W, minWidth: NAME_W, boxShadow: shL }}
            >
              Tên SP / vật tư
            </th>
            {shownCols.map((c) => (
              <th key={c.key} className={thBase} style={{ zIndex: 3 }}>
                {c.label}
              </th>
            ))}
            {/*
              `minWidth` chứ không chỉ `width`.

              Chỉ khai `width` thì đó là ĐỀ NGHỊ: hễ bảng `w-full` không đủ chỗ,
              thuật toán auto-layout bóp mọi cột về min-content — mà min-content
              của một ô chứa `<input>` gần như bằng 0, nên ĐVT/SL đặt/Đơn giá
              cùng tụt xuống 36px trong khi cột đệm vẫn giữ 135px. `minWidth`
              mới tham gia vào min-content của cột: bảng thà TRÀN NGANG (đã có
              khung cuộn) chứ không bóp méo cột.
            */}
            <th className={`${thBase} text-center`} style={{ ...COL.unit, zIndex: 3 }}>
              ĐVT
            </th>
            <th className={`${thBase} text-right`} style={{ ...COL.qty, zIndex: 3 }}>
              <InputDot />
              SL đặt
            </th>
            <th className={`${thBase} text-right`} style={{ ...COL.price, zIndex: 3 }}>
              <InputDot />
              {priceLabel}
            </th>
            {calcCol && (
              <th className={`${thBase} text-right`} style={{ ...COL.calc, zIndex: 3 }}>
                {calcCol.label}
              </th>
            )}
            <th className={thBase} style={{ ...COL.note, zIndex: 3 }}>
              Ghi chú
            </th>
            <th
              className={`${thBase} sticky right-0 text-right`}
              style={{ ...COL.money, zIndex: 5, boxShadow: shR }}
            >
              Thành tiền
            </th>
          </tr>
        </thead>

        <tbody>
          {empty ? (
            /* DÒNG MA — đúng khuôn cột thật, cho thấy mẫu này sẽ hỏi những ô nào. */
            <tr aria-hidden className="pointer-events-none select-none">
              <td
                className={`${tdBase} bg-card sticky left-0 align-top`}
                style={{ zIndex: STICKY_Z, boxShadow: shL }}
              >
                <div className="text-muted-foreground/60 text-[13px] italic">
                  — tên vật tư sẽ hiện ở đây —
                </div>
                <div className="text-muted-foreground/50 mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="bg-muted rounded border px-1.5 font-mono">mã VT</span>
                  <span>tồn kho</span>
                </div>
              </td>
              {shownCols.map((c) => (
                <td key={c.key} className={tdBase}>
                  <div className={c.width}>
                    <div className={`${cell} text-muted-foreground/40 truncate`}>
                      {c.placeholder ?? '—'}
                    </div>
                  </div>
                </td>
              ))}
              <td className={`${tdBase} text-muted-foreground/40 text-center`}>ĐVT</td>
              <td className={tdBase}>
                <div className={`${cell} text-muted-foreground/40 w-[92px] text-right`}>
                  —
                </div>
              </td>
              <td className={tdBase}>
                <div className={`${cell} text-muted-foreground/40 w-[104px] text-right`}>
                  —
                </div>
              </td>
              {calcCol && (
                <td className={tdBase}>
                  <div className={`${calc} text-muted-foreground/40 w-[88px]`}>—</div>
                </td>
              )}
              <td className={tdBase}>
                <div className={`${cell} text-muted-foreground/40 min-w-[140px]`}>…</div>
              </td>
              <td
                className={`${tdBase} bg-muted text-muted-foreground/40 sticky right-0 text-right`}
                style={{ zIndex: STICKY_Z, boxShadow: shR }}
              >
                —
              </td>
            </tr>
          ) : (
            lines.map((l, i) => {
              const amount = lineAmount(template, l)
              const kg = lineQty2(template, l)
              const problem = lineProblem(template, l)
              const suggest = suggestions.get(l.material_id) ?? null
              const shortSuggest =
                l.qty_demand !== ''
                  ? suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0)
                  : null
              const rawSuggest = shortSuggest ?? suggest
              const useSuggest =
                rawSuggest != null && rawSuggest > 0
                  ? roundUpToPack(rawSuggest, l.pack_size)
                  : rawSuggest
              const qtyPacks = l.qty !== '' ? packCount(Number(l.qty), l.pack_size) : null
              const cap = capLeft?.get(l.material_id)
              const goiY = cartonPriceSuggest(template, l)

              return (
                <tr key={l.material_id} data-line className="group hover:bg-accent">
                  {/*
                    Ô DANH TÍNH — cột ghim DUY NHẤT bên trái: số thứ tự, tên, mã,
                    tồn, nút mở ô mẫu, nút xoá. Gộp về một ô nên không còn phép
                    cộng offset nào để lệch.

                    VẠCH CAM: dòng còn thiếu số, đọc được bằng đuôi mắt khi cuộn.
                  */}
                  <td
                    className={`${tdBase} bg-card group-hover:bg-accent sticky left-0 align-top`}
                    style={{
                      maxWidth: NAME_W,
                      zIndex: STICKY_Z,
                      boxShadow: problem ? `inset 3px 0 0 var(--warn), ${shL}` : shL,
                    }}
                  >
                    {/*
                      CỘT SỐ THỨ TỰ KIÊM NÚT XOÁ (05/09/2026).

                      Nút xoá trước đây nằm góc trên PHẢI của ô tên, hiện khi rê
                      chuột — nên với tên dài hai dòng nó đè thẳng lên chữ (thấy
                      rõ ở ảnh người dùng gửi: thùng rác nằm trên "(TD-B40)").
                      Đưa vào ô STT thì nó có chỗ cố định của riêng mình, không
                      bao giờ tranh chỗ với chữ nữa: rê chuột thì con số hoá
                      thành nút xoá, đúng mẫu quen của Sheets/Airtable.
                    */}
                    <div className="flex items-start gap-1.5">
                      <span className="relative w-4 shrink-0 self-stretch">
                        <span className="text-muted-foreground t-data absolute inset-x-0 top-0.5 text-right text-[11px] transition-opacity group-hover:opacity-0">
                          {i + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemove(i)}
                          className="text-muted-foreground absolute inset-x-0 top-0 size-auto rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--stop)] focus-visible:opacity-100"
                          aria-label={`Xoá dòng ${l.name}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </span>
                      <div className="min-w-0 flex-1">
                        {l.is_free ? (
                          <>
                            <AutoGrowCell
                              value={l.name}
                              placeholder="Tên SP / món gia công…"
                              onChange={(v) => onPatch(i, { name: v })}
                              label={`Tên hàng dòng ${i + 1}`}
                              className="font-semibold"
                              autoFocus={focusIndex === i}
                              onAutoFocused={onFocused}
                            />
                            <div className="text-muted-foreground mt-1 text-[11px]">
                              dòng tự gõ — không trừ kho
                            </div>
                          </>
                        ) : (
                          <>
                            {/*
                              MÃ VÀ TÊN CÙNG MỘT DÒNG, CHIỀU CAO HÀNG ĐỀU
                              (05/09/2026).

                              Bản cũ để tên xuống dòng tự do rồi mới tới hàng
                              mã/tồn, nên tên một dòng và tên hai dòng cho ra hai
                              chiều cao hàng khác nhau — bảng nhập liệu sống bằng
                              việc QUÉT NGANG, hàng so le là mắt mất mốc.

                              Nay mã đứng trước (rộng cố định, mono — đây là thứ
                              đối chiếu với phiếu giấy), tên chiếm phần còn lại
                              và cắt tối đa 2 dòng. `min-h` giữ hàng cao bằng
                              nhau dù tên dài hay ngắn.
                            */}
                            <div className="flex min-h-[34px] items-start gap-1.5">
                              <span className="bg-muted text-foreground/80 mt-px shrink-0 rounded border px-1.5 font-mono text-[11px] font-medium">
                                {l.code}
                              </span>
                              <span
                                className="text-foreground line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug font-semibold"
                                title={l.name}
                              >
                                {l.name}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                              {/*
                                TỒN KHO ĐỌC ĐƯỢC BẰNG ĐUÔI MẮT — nó là con số
                                quyết định "có cần mua không, mua bao nhiêu", mà
                                trước đây là chữ xám 11px lọt thỏm cuối một hàng
                                chật. Không tách thành cột riêng (user chốt
                                05/09): chỉ cần nổi lên tại chỗ.

                                Ba trạng thái KHÁC NGHĨA nhau, nên khác hình:
                                  · còn tồn  → nền xanh, số đậm (cân nhắc mua ít)
                                  · tồn 0    → chữ thường, xám (mua đủ)
                                  · chưa có sổ kho → hổ phách, vì đây là THIẾU
                                    DỮ LIỆU chứ không phải "hết hàng" — hai thứ
                                    này lẫn nhau là đặt mua nhầm.
                              */}
                              {l.on_hand == null ? (
                                <span
                                  className="rounded px-1.5 py-px font-medium text-[var(--warn)]"
                                  style={{
                                    background:
                                      'color-mix(in srgb, var(--warn) 12%, transparent)',
                                  }}
                                  title="Vật tư chưa có sổ kho — chưa từng nhập/xuất/kiểm kê. Khác với tồn bằng 0."
                                >
                                  chưa có sổ kho
                                </span>
                              ) : l.on_hand > 0 ? (
                                <span
                                  className="rounded px-1.5 py-px font-medium text-[var(--done)]"
                                  style={{
                                    background:
                                      'color-mix(in srgb, var(--done) 14%, transparent)',
                                  }}
                                  title="Tồn kho hiện có — trừ vào lượng cần mua"
                                >
                                  tồn <b className="t-data">{num(l.on_hand)}</b>
                                </span>
                              ) : (
                                <span className="text-muted-foreground px-1.5 py-px">
                                  tồn 0
                                </span>
                              )}
                              {/* Sửa vật tư trong DANH MỤC là việc rời khỏi luồng
                                  soạn đơn — chỉ hiện khi rê chuột để không mời
                                  bấm nhầm lúc đang nhắm chip mã. */}
                              {onEditMaterial && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onEditMaterial(l.material_id)}
                                  className="text-muted-foreground/70 size-auto rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--primary)] focus-visible:opacity-100"
                                  title="Sửa vật tư trong danh mục — quy cách, barem, đóng gói…"
                                  aria-label={`Sửa vật tư ${l.name}`}
                                >
                                  <Pencil className="size-3" aria-hidden />
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {shownCols.map((c) => (
                    <td key={c.key} className={tdBase}>
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

                  <td className={`${tdBase} text-center text-[12px] whitespace-nowrap`}>
                    {l.is_free ? (
                      <GridCellInput
                        value={l.unit}
                        maxLength={30}
                        onChange={(e) => onPatch(i, { unit: e.target.value })}
                        className={`${cell} w-[44px] px-1 text-center`}
                        aria-label={`ĐVT dòng ${i + 1}`}
                      />
                    ) : (
                      <span className="text-muted-foreground">{l.unit}</span>
                    )}
                  </td>

                  {/* ── ô GÕ THẬT #1 ── */}
                  <td className={tdBase}>
                    <div className="w-[92px]">
                      <GridCellNumber
                        id={`qty-${l.material_id}`}
                        data-cell="qty"
                        onWheel={blurOnWheel}
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
                        onValueChange={(v) => onPatch(i, { qty: v as Num })}
                        className={`${cell} text-right text-[13px] font-medium`}
                        aria-label={`SL đặt ${l.name}`}
                      />
                    </div>
                    {l.qty === '' && useSuggest != null && useSuggest > 0 && (
                      <Button
                        variant="link"
                        type="button"
                        onClick={() => onPatch(i, { qty: useSuggest })}
                        className="mt-0.5 block h-auto w-full justify-end p-0 text-right text-[11px] font-medium whitespace-nowrap"
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
                      </Button>
                    )}
                    {cap != null && l.qty !== '' && Number(l.qty) > cap && (
                      <div
                        className="mt-0.5 text-right text-[11px] whitespace-nowrap text-[var(--warn)]"
                        title="Trần tồn (max_stock) trừ tồn hiện có và lượng đã đặt chưa về. Vượt trần là chủ đích thì cứ đặt — chỉ nhắc, không chặn."
                      >
                        ⚠ vượt trần — thêm được {num(cap)}
                      </div>
                    )}
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

                  {/* ── ô GÕ THẬT #2 ── */}
                  <td className={tdBase}>
                    <div className="w-[104px]">
                      <GridCellNumber
                        id={`price-${l.material_id}`}
                        data-cell="price"
                        onWheel={blurOnWheel}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          onDoneRow?.()
                        }}
                        value={l.price}
                        onValueChange={(v) => onPatch(i, { price: v as Num })}
                        className={`${cell} text-right text-[13px]`}
                        aria-label={`Đơn giá ${l.name}`}
                      />
                    </div>
                    {goiY != null && l.price !== goiY && (
                      <Button
                        variant="link"
                        type="button"
                        onClick={() => onPatch(i, { price: goiY })}
                        className="mt-0.5 block h-auto w-full justify-end p-0 text-right text-[11px] font-medium whitespace-nowrap"
                        title="m²/thùng × đơn giá/m² + bản in — bấm để dùng"
                      >
                        = {num(goiY)} ↩
                      </Button>
                    )}
                  </td>

                  {calcCol && (
                    <td className={tdBase}>
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

                  <td className={tdBase}>
                    <div className="min-w-[140px]">
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

                  {/* ── bậc nổi bật #2: THÀNH TIỀN, ghim phải ── */}
                  <td
                    className={`${tdBase} bg-muted group-hover:bg-accent sticky right-0 text-right`}
                    style={{ zIndex: STICKY_Z, boxShadow: shR }}
                  >
                    {amount > 0 ? (
                      <span className="t-data text-[13.5px] font-semibold whitespace-nowrap">
                        {fmtMoney(roundMoney(amount, currency), currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-[13.5px]">—</span>
                    )}
                    {problem && (
                      <span className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] font-medium whitespace-nowrap text-[var(--warn)]">
                        <TriangleAlert className="size-3 shrink-0" aria-hidden />{' '}
                        {problem}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>

        {/* CHÂN BẢNG DÍNH ĐÁY khung cuộn — cộng dồn ngay trong bảng. */}
        {!empty && (
          <tfoot>
            <tr>
              <td
                className="border-border bg-muted sticky bottom-0 left-0 border-t px-1.5 py-1.5"
                style={{ zIndex: 5, boxShadow: shL }}
              >
                <span className="text-muted-foreground text-[12px]">
                  {lines.length} dòng
                  {missing > 0 && (
                    <b className="ml-1.5 text-[var(--warn)]">· {missing} thiếu số</b>
                  )}
                </span>
              </td>
              {shownCols.map((c) => (
                <Tf key={c.key} />
              ))}
              <Tf />
              <Tf right>
                <span className="t-data text-[12.5px] font-semibold">
                  {num(totalQty)}
                </span>
              </Tf>
              <Tf />
              {calcCol && <Tf />}
              <Tf />
              <td
                className="border-border bg-muted sticky right-0 bottom-0 border-t px-1.5 py-1.5 text-right"
                style={{ zIndex: 5, boxShadow: shR }}
              >
                <span className="t-data text-[13.5px] font-bold whitespace-nowrap">
                  {fmtMoney(roundMoney(totalAmount, currency), currency)}
                </span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Chấm cobalt trên tiêu đề cột GÕ ĐƯỢC — tách khỏi cột chỉ đọc/tự tính. */
function InputDot() {
  return (
    <span
      className="mr-1 inline-block size-1.5 rounded-full bg-[var(--primary)] align-middle"
      aria-hidden
    />
  )
}

function Tf({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <td
      className={`border-border bg-muted sticky bottom-0 border-t px-1.5 py-1.5 ${right ? 'text-right' : ''}`}
      style={{ zIndex: 2 }}
    >
      {children}
    </td>
  )
}
