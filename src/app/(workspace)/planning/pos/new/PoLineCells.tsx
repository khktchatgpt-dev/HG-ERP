'use client'

import { useState } from 'react'
import { DiePicker } from '@/components/supply/DiePicker'
import type { PoField } from '@/lib/po-fields'
import {
  baremFor,
  overridesCatalog,
  parseInnerDims,
  recalcCartonArea,
  type Line,
} from './po-line'

/**
 * Ô nhập của DÒNG ĐƠN, dựng theo khai báo trong `@/lib/po-fields`.
 *
 * Trước đây mỗi cột là một nhánh `c.key === '…'` trong JSX của bảng — 15 nhánh,
 * và thêm mẫu đơn là thêm nhánh. Nay bảng chỉ map khai báo → 8 kiểu ô ở đây.
 *
 * KIỂU Ô: PHẲNG NHƯ BẢNG TÍNH (08/08/2026 — "mỗi thông tin một ô bo tròn nhìn
 * khá xấu"). Ô nhập không viền không nền, ranh giới do KẺ CỘT của bảng đảm
 * nhiệm; bấm vào ô mới nổi nền xanh nhạt + ring. Ô NỀN XÁM vẫn là số hệ thống
 * tự tính (tổng kg), không gõ được.
 */

/*
 * `appearance` reset: GIẤU NÚT TĂNG/GIẢM của input số (08/08/2026). Spinner vừa
 * che mất số dài trong ô hẹp, vừa vô dụng — SL đặt 2.060 không ai bấm mũi tên
 * 2.060 lần, và cuộn-để-đổi-số đã bị chặn từ trước (blurOnWheel).
 */
export const cell =
  'h-[32px] w-full rounded-none border-0 bg-transparent px-2 text-[13px] outline-none ring-inset transition-colors focus:bg-sky-50/70 focus-visible:ring-2 focus-visible:ring-sky-500/60 dark:focus:bg-sky-950/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
export const calc =
  'bg-muted/50 flex h-[32px] items-center justify-end px-2 text-[13px] font-medium tabular-nums'

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
      className={`${cell} min-h-[32px] resize-none py-1.5 leading-tight break-words ${className}`}
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

function SaveToCatalog({
  f,
  line,
  onSave,
}: {
  f: PoField
  line: Line
  onSave: NonNullable<BaremHintProps['onSaveToCatalog']>
}) {
  const value = Number(get(line, f.field))
  const label = f.key === 'kgm' ? 'kg/m' : `kg/${line.unit || 'đơn vị'}`
  return (
    <button
      type="button"
      onClick={() => onSave(line.material_id, f.key === 'kgm' ? 'kgm' : 'kgunit', value)}
      title={`Ghi ${num(value)} ${label} vào danh mục vật tư — lần đặt sau tự điền, khỏi gõ lại`}
      className="text-muted-foreground mt-0.5 block w-full text-right text-[10.5px] whitespace-nowrap hover:text-sky-700 hover:underline dark:hover:text-sky-400"
    >
      lưu vào danh mục ↑
    </button>
  )
}

type BaremHintProps = {
  f: PoField
  line: Line
  index: number
  onPatch: (i: number, patch: Partial<Line>) => void
  /** Ghi số vừa gõ về danh mục vật tư — form lo phần gọi API. */
  onSaveToCatalog?: (materialId: string, field: 'kgm' | 'kgunit', value: number) => void
}

function BaremHint({ f, line, index, onPatch, onSaveToCatalog }: BaremHintProps) {
  const { kg, why } = baremFor(f, line)
  const filled = Number(get(line, f.field))
  const saveBtn =
    onSaveToCatalog && overridesCatalog(f, line) ? (
      <SaveToCatalog f={f} line={line} onSave={onSaveToCatalog} />
    ) : null

  /*
   * Ô ĐÃ CÓ SỐ (điền sẵn từ danh mục) — không mời bấm barem nữa, nhưng LỆCH
   * NHIỀU thì phải nói. Đối chiếu 110 mã có cả hai nguồn: lệch 7-14% là dung
   * sai âm bình thường của thép, còn lệch lớn hơn thường là dài cây khai sai —
   * "Sắt hộp 40x80x1li x4m30" khai 6 m, kg/cây 8,24 mới đúng cây 4,3 m. Người
   * mua thấy hai số cạnh nhau thì gọi NCC hỏi, chứ không ký nhầm.
   */
  if (filled > 0) {
    const lech = kg == null ? 0 : Math.abs(kg - filled) / filled
    return (
      <>
        {lech >= 0.1 && (
          <div
            className="mt-0.5 text-right text-[10.5px] leading-tight text-amber-700 dark:text-amber-500"
            title={`Số đang dùng ${num(filled)}; barem tính từ quy cách ra ${num(kg!)}. Lệch lớn thường do dài cây khai sai — đối chiếu lại trước khi gửi.`}
          >
            barem {num(kg!)} · lệch {Math.round(lech * 100)}%
          </div>
        )}
        {saveBtn}
      </>
    )
  }

  if (kg == null) {
    return (
      <div className="text-muted-foreground/70 mt-0.5 text-right text-[10.5px] leading-tight">
        {why}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onPatch(index, patchOf(f.field!, kg))}
      title={`Tính từ quy cách trong tên vật tư theo barem xưởng — bấm để dùng ${num(kg)}`}
      className="mt-0.5 block w-full text-right text-[11px] font-medium whitespace-nowrap text-sky-700 hover:underline dark:text-sky-400"
    >
      barem {num(kg)} ↩
    </button>
  )
}

export function LineCell({
  f,
  line,
  index,
  kgTotal,
  onPatch,
  onSaveToCatalog,
}: {
  f: PoField
  line: Line
  index: number
  /** Tổng kg do `lineQty2` tính — chỉ dùng cho ô kiểu 'calc'. */
  kgTotal: number | null
  onPatch: (i: number, patch: Partial<Line>) => void
  onSaveToCatalog?: BaremHintProps['onSaveToCatalog']
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
        <>
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
          {(f.key === 'kgm' || f.key === 'kgunit') && (
            <BaremHint
              f={f}
              line={l}
              index={index}
              onPatch={onPatch}
              onSaveToCatalog={onSaveToCatalog}
            />
          )}
        </>
      )

    case 'calc':
      return (
        <div className={calc} title="Hệ thống tự tính">
          {kgTotal == null ? (
            <span className="text-muted-foreground font-normal">—</span>
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
      return <InnerDimsCell line={l} index={index} onPatch={onPatch} />

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

/**
 * LỌT LÒNG D×R×C trong MỘT Ô — gõ "900x605x115" như vẫn gõ trong sổ Excel,
 * thay vì ba ô số rời (phản hồi 08/08/2026: "gộp lại luôn được không").
 *
 * Chuỗi đang gõ giữ ở state riêng vì "900x6" chưa đọc được — đọc được tới đâu
 * ghi vào dòng tới đó (kèm tính lại m² theo cách mở), chưa đọc được thì ba số
 * trong dòng về trống để `deriveLine` không tính m² trên số cũ.
 */
function InnerDimsCell({
  line,
  index,
  onPatch,
}: {
  line: Line
  index: number
  onPatch: (i: number, patch: Partial<Line>) => void
}) {
  const l = line
  // Mở đơn cũ: ba số đã lưu ghép lại thành chuỗi ban đầu.
  const [raw, setRaw] = useState(() =>
    l.inner_l_mm !== '' && l.inner_w_mm !== '' && l.inner_h_mm !== ''
      ? `${l.inner_l_mm}×${l.inner_w_mm}×${l.inner_h_mm}`
      : '',
  )
  return (
    <input
      value={raw}
      onChange={(e) => {
        const v = e.target.value
        setRaw(v)
        const dims = parseInnerDims(v)
        if (dims) {
          const next = {
            ...l,
            inner_l_mm: dims[0],
            inner_w_mm: dims[1],
            inner_h_mm: dims[2],
          } as Line
          onPatch(index, {
            inner_l_mm: dims[0],
            inner_w_mm: dims[1],
            inner_h_mm: dims[2],
            area_m2: recalcCartonArea(next),
          })
        } else {
          onPatch(index, {
            inner_l_mm: '',
            inner_w_mm: '',
            inner_h_mm: '',
            ...(v.trim() === '' ? { area_m2: '' as const } : null),
          })
        }
      }}
      placeholder="900×605×115"
      maxLength={30}
      className={`${cell} tabular-nums`}
      title="Dài × Rộng × Cao lọt lòng (mm) — gõ 900x605x115"
      aria-label={`Lọt lòng D×R×C ${l.name}`}
    />
  )
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
      /* KHÔNG đặt trần chiều cao (bỏ 08/08/2026): trần 160px vẫn giấu đuôi ghi
         chú dài — "nội dung bị che khi nhập nhiều" đúng cái AutoGrowCell sinh ra
         để sửa. Chặn 500 ký tự nên nở hết cũng không thành hàng khổng lồ. */
    />
  )
}
