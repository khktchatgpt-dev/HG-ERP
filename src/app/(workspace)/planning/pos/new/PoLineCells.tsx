'use client'

import { DiePicker } from '@/components/supply/DiePicker'
import type { PoField } from '@/lib/po-fields'
import { recalcCartonArea, type Line } from './po-line'

/**
 * Ô nhập của DÒNG ĐƠN, dựng theo khai báo trong `@/lib/po-fields`.
 *
 * Trước đây mỗi cột là một nhánh `c.key === '…'` trong JSX của bảng — 15 nhánh,
 * và thêm mẫu đơn là thêm nhánh. Nay bảng chỉ map khai báo → 8 kiểu ô ở đây.
 *
 * Quy ước hiển thị giữ nguyên: ô NỀN XÁM là số hệ thống tự tính (tổng kg, thành
 * tiền), không gõ được; ô nền trắng là chỗ nhân viên nhập.
 */

export const cell =
  'h-[30px] w-full rounded-md border border-zinc-300 px-2 text-[13px] focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
export const calc =
  'flex h-[30px] items-center justify-end rounded-md bg-zinc-100 px-2 text-[13px] font-medium tabular-nums dark:bg-zinc-800'

/**
 * LĂN CHUỘT KHÔNG ĐƯỢC ĐỔI SỐ.
 *
 * `<input type="number">` đang focus mà lăn chuột là trình duyệt tăng/giảm giá
 * trị — im lặng, không undo được. Trên bảng đơn thì cú lăn để đọc dòng dưới có
 * thể vừa sửa đơn giá dòng trên, và sai số tiền chỉ lộ ra lúc đối chiếu hoá đơn.
 * Bỏ focus khi lăn: cuộn trang vẫn chạy, số đứng yên.
 */
export const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) =>
  e.currentTarget.blur()

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Ô CHỮ TỰ NỞ THEO NỘI DUNG.
 *
 * `<input>` một dòng thì nội dung dài hơn ô bị cuộn ngầm bên trong: nhìn vào chỉ
 * thấy "Sắt xi trắ…" và không có cách nào biết đuôi còn gì mà không bấm vào rồi
 * lia con trỏ. Trên đơn đặt hàng thì đuôi ấy là thứ phân biệt hàng — "Inox 304
 * bề mặt phẳng" khác "Inox 304 bề mặt xước".
 *
 * Dùng `<textarea>` một dòng, tự cao thêm theo nội dung, nên gõ tới đâu đọc được
 * tới đó. Enter bị chặn vì đây vẫn là một ô giá trị đơn — xuống dòng thật chỉ
 * làm hỏng dữ liệu in ra phiếu.
 */
function grow(el: HTMLTextAreaElement, max?: number) {
  el.style.height = 'auto'
  // `scrollHeight` KHÔNG tính viền, còn `height` với `border-box` thì có. Thiếu
  // phần bù này thì ô luôn hụt đúng 2px và dòng chữ cuối vẫn bị cuộn ngầm —
  // sát tới mức nhìn tưởng đủ, nhưng chữ vẫn cụt.
  const border = el.offsetHeight - el.clientHeight
  const need = el.scrollHeight + border
  el.style.height = `${max ? Math.min(need, max) : need}px`
}

export function AutoGrowCell({
  value,
  onChange,
  label,
  placeholder,
  className = '',
  maxLength = 200,
  growMax,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  className?: string
  maxLength?: number
  /**
   * Trần chiều cao (px). BỎ TRỐNG = nở hết, không cuộn ngầm.
   *
   * Cột của mẫu đơn chỉ rộng ~100px nên một quy cách 56 ký tự đã cần 5-6 dòng;
   * đặt trần 96px là vẫn giấu mất đuôi, đúng cái lỗi đang đi sửa. Các cột này
   * chặn 200 ký tự nên nở hết cũng không thành hàng khổng lồ.
   */
  growMax?: number
}) {
  return (
    <textarea
      value={value}
      rows={1}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault()
      }}
      onInput={(e) => grow(e.currentTarget, growMax)}
      ref={(el) => {
        // Mở lại đơn cũ: nội dung có sẵn phải nở NGAY, không đợi người dùng gõ.
        if (el) grow(el, growMax)
      }}
      className={`${cell} min-h-[30px] resize-none py-1.5 leading-tight break-words ${className}`}
      aria-label={label}
      title={value}
    />
  )
}

/** Đọc/ghi trường của `Line` theo tên khai báo — ép kiểu gói gọn trong file này. */
const get = (l: Line, field?: string) =>
  field ? (l as unknown as Record<string, unknown>)[field] : ''
const patchOf = (field: string, v: unknown) =>
  ({ [field]: v }) as unknown as Partial<Line>

export function LineCell({
  f,
  line,
  index,
  kgTotal,
  onPatch,
}: {
  f: PoField
  line: Line
  index: number
  /** Tổng kg do `lineQty2` tính — chỉ dùng cho ô kiểu 'calc'. */
  kgTotal: number | null
  onPatch: (i: number, patch: Partial<Line>) => void
}) {
  const l = line
  const label = `${f.label} ${l.name}`

  switch (f.kind) {
    case 'text':
      return (
        <AutoGrowCell
          value={String(get(l, f.field) ?? '')}
          placeholder={f.placeholder}
          onChange={(v) => onPatch(index, patchOf(f.field!, v))}
          label={label}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          min="0"
          max={f.max}
          step={f.step ?? '0.01'}
          onWheel={blurOnWheel}
          value={String(get(l, f.field) ?? '')}
          onChange={(e) =>
            onPatch(
              index,
              patchOf(f.field!, e.target.value === '' ? '' : Number(e.target.value)),
            )
          }
          className={`${cell} text-right`}
          aria-label={label}
        />
      )

    case 'calc':
      return (
        <div className={calc} title="Hệ thống tự tính">
          {kgTotal == null ? (
            <span className="font-normal text-zinc-400">—</span>
          ) : (
            num(kgTotal)
          )}
        </div>
      )

    case 'die':
      return (
        <DiePicker
          value={l.die_code}
          ariaLabel={label}
          onTextChange={(code) => onPatch(index, { die_code: code })}
          onPick={(d) =>
            onPatch(index, {
              die_code: d.code,
              // Chọn khuôn là chốt kg/m — thứ quyết định tổng kg và tiền hàng.
              weight_per_m: d.weight_per_m ?? l.weight_per_m,
              spec: d.profile_spec ?? l.spec,
            })
          }
        />
      )

    case 'openStyle':
      return (
        <select
          value={l.open_style}
          onChange={(e) => {
            // Đổi cách mở là đổi công thức m² (AD khác MR) — tính lại ngay.
            const next = { ...l, open_style: e.target.value }
            onPatch(index, {
              open_style: e.target.value,
              area_m2: recalcCartonArea(next),
            })
          }}
          className={cell}
          aria-label={label}
        >
          <option value="">—</option>
          <option value="AD">AD</option>
          <option value="MR">MR</option>
        </select>
      )

    case 'inner':
      return (
        <div className="flex items-center gap-1">
          {(['inner_l_mm', 'inner_w_mm', 'inner_h_mm'] as const).map((k) => (
            <input
              key={k}
              type="number"
              min="0"
              step="1"
              onWheel={blurOnWheel}
              value={l[k]}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value)
                const next = { ...l, [k]: v } as Line
                onPatch(index, {
                  [k]: v,
                  area_m2: recalcCartonArea(next),
                } as Partial<Line>)
              }}
              className={`${cell} px-1 text-right`}
              aria-label={`${k === 'inner_l_mm' ? 'Dài' : k === 'inner_w_mm' ? 'Rộng' : 'Cao'} lọt lòng ${l.name}`}
            />
          ))}
        </div>
      )

    case 'area':
      return (
        <input
          type="number"
          min="0"
          step="0.0001"
          onWheel={blurOnWheel}
          value={l.area_m2}
          onChange={(e) =>
            onPatch(index, {
              area_m2: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
          className={`${cell} text-right`}
          title="Tự tính từ lọt lòng theo cách mở — sửa được nếu NCC chào khác barem"
          aria-label={label}
        />
      )

    case 'cartonBasis':
      return (
        <select
          value={l.carton_basis}
          onChange={(e) =>
            onPatch(index, { carton_basis: e.target.value as 'ctn' | 'm2' })
          }
          className={cell}
          aria-label={label}
        >
          <option value="ctn">thùng</option>
          <option value="m2">m²</option>
        </select>
      )
  }
}

// ── Ô cố định cuối hàng, mẫu nào cũng có ────────────────────────────────────

/**
 * Ghi chú dòng — cùng ô nở theo nội dung với các cột chữ khác, chỉ cho dài hơn
 * (500 ký tự): ghi chú là chỗ người mua dặn NCC nên hay viết cả câu.
 */
export function NoteCell({
  value,
  placeholder,
  label,
  onChange,
}: {
  value: string
  placeholder: string
  label: string
  onChange: (v: string) => void
}) {
  return (
    <AutoGrowCell
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      maxLength={500}
      growMax={160}
    />
  )
}
