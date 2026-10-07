import type { ReactNode } from 'react'
import type { ProductPick } from '@/components/sales/ProductPicker'
import {
  Card as UiCard,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'

/**
 * Thành phần trình bày nhỏ của OrderForm (thẻ, nhãn trường, nhãn dòng, tab) —
 * tách ra 07/10/2026 để OrderForm không vượt trần dòng riêng (size-baseline).
 * Không state, không gọi API.
 */

export function Card({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <UiCard>
      <CardHeader>
        {/* Tiêu đề thẻ là CHỮ THẬT (14px, đậm, màu chữ chính) chứ không phải caps
            11px xám: cả trang trước đây mọi tiêu đề cùng một sắc xám nhạt nên
            không thẻ nào nổi lên được. */}
        <CardTitle className="t-title">{title}</CardTitle>
        {right && (
          <div className="col-start-2 row-span-2 row-start-1 self-center">{right}</div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </UiCard>
  )
}

/**
 * Nhãn trường của form. `strong` = trường Sales phải để mắt (hạn giao, số
 * lượng…) — nhãn đậm lên để mắt bắt được trước, thay vì mọi nhãn một sắc như cũ.
 */
export function L({
  label,
  span2,
  strong,
  children,
}: {
  label: string
  span2?: boolean
  strong?: boolean
  children: ReactNode
}) {
  return (
    <label
      className={`grid gap-1.5 ${span2 ? 'sm:col-span-2 lg:col-span-4 xl:col-span-1' : ''}`}
    >
      {/* Bậc `t-label` của thang chữ v3 — 11px hoa, giãn chữ 0.04em. Trước là
          14px thường nên nhãn và giá trị cùng một cỡ, mắt không tách được đâu
          là câu hỏi đâu là câu trả lời. */}
      <span className={`t-label ${strong ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
      {children}
    </label>
  )
}

export function LineField({
  label,
  strong,
  children,
}: {
  label: string
  strong?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      {/* Ở khổ rộng nhãn nằm ở hàng tiêu đề cột, in lại trên từng dòng là thừa —
          nhưng vẫn giữ trong DOM cho trình đọc màn hình (`sr-only`). */}
      <span
        className={`t-label xl:sr-only ${strong ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

export function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
        on
          ? 'bg-card text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

/* ── Kiểu dòng, quy cách SP mới, lớp ô nhập, lưới dòng — dời từ OrderForm 07/10/2026 ── */

/**
 * Năm ô quy cách LSX in ra bảng. Khoá khớp `ProductTechSpec` (technical.repo).
 */
export type SpecKey = 'machine' | 'cushion' | 'paint' | 'glass' | 'wood'
/** [khoá, nhãn, ví dụ] — ví dụ lấy từ dữ liệu thật để sale biết gõ kiểu gì. */
export const SPEC_FIELDS: [SpecKey, string, string][] = [
  ['machine', 'Máy', 'Dây dù màu kem'],
  ['cushion', 'Nệm', 'Nệm dày 5cm · vải Stormstone'],
  ['paint', 'Sơn', 'Màu Graphit H-SM-9608'],
  ['glass', 'Kính', 'Kính cường lực 8mm'],
  ['wood', 'Gỗ', 'Acacia FSC 100%'],
]
export const emptySpec = (): Record<SpecKey, string> => ({
  machine: '',
  cushion: '',
  paint: '',
  glass: '',
  wood: '',
})

/** SP mới sale tự điền — chỉ tạo vào thư viện Kỹ thuật KHI submit đơn (không mồ côi). */
export type LineDraft = {
  code: string
  name: string
  unit: string
  itemCode: string
  notes: string
  image: File | null
  /*
   * Barcode + quy cách: LSX cần mà trước đây tạo nhanh không hỏi, nên SP mới vừa
   * vào lệnh là đã báo 'hồ sơ SP đang thiếu' — mà từ 07/08/2026 lệnh KHÔNG cho
   * sửa thông tin SP nữa, phải quay về hồ sơ SP mới điền được. Hỏi ngay tại đây.
   */
  barcode: string
  spec: Record<SpecKey, string>
}
export type LineRow = {
  key: number
  /** id dòng đang có (sửa đơn) — server khớp theo id (D2: một SP nhiều dòng). */
  id?: string
  productId: string // '' nếu là SP mới (draft)
  draft: LineDraft | null
  qty: number | ''
  unitPrice: number | ''
  /** Ngày giao dòng = hạn cuối của tuần giao (yyyy-mm-dd) — nhãn w37.26 tự suy. */
  shipDate: string
  note: string
}

/** "68×62×99 cm" từ quy cách đóng gói — thiếu chiều nào thì thôi không in. */
export function dimsOf(p: ProductPick): string | null {
  const k = p.packing ?? {}
  return k.l_cm && k.w_cm && k.h_cm ? `${k.l_cm}×${k.w_cm}×${k.h_cm} cm` : null
}

export const BOM_LABEL = {
  none: 'Chưa có BOM',
  drawing: 'Đang vẽ',
  done: 'Đã vẽ',
} as const
export const BOM_TONE = { none: 'gray', drawing: 'amber', done: 'green' } as const

/**
 * Nhãn + ô nhập của mini-form 'SP mới'. Nhãn là THẬT chứ không mượn placeholder:
 * placeholder biến mất ngay khi gõ, form 12 ô mà không nhãn thì nhìn lại không
 * biết ô nào là gì.
 */
export function NpField({
  label,
  required,
  className = '',
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="t-label text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  )
}

/*
 * Lớp ô nhập DÙNG CHUNG cho mọi input/select/textarea của form. Đổi ở ĐÂY là
 * đổi cả trang. Vì sao không thay hết bằng <Input>/<Select> của shadcn: form có
 * <select> kèm <optgroup> (nhóm SP theo khách) mà Radix Select không dựng được,
 * nên giữ thẻ gốc và khoác đúng lớp da của Input — bám sát
 * `components/shadcn/input.tsx` để hai bên nhìn như một, và mọi màu ở đây đều là
 * token v3 (border-input / ring / bg-card), không có màu Tailwind cứng.
 */
export const cls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 bg-card w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Lưới một DÒNG SẢN PHẨM. Dưới xl là thẻ 2 cột (điện thoại/laptop hẹp), từ xl
 * thành HÀNG
 * BẢNG: sản phẩm co giãn, các ô số cố định bề ngang để cột số thẳng hàng suốt
 * bảng — đơn 26 dòng mà mỗi dòng tự căn một kiểu thì không đối chiếu được.
 *
 * Vì sao xl chứ không phải lg: khung nội dung của shell là max-w-1600 nhưng ở
 * màn 1100px thẻ chỉ còn ~750px — 4 cột số cố định ăn 470px, ô chọn SP còn
 * đúng 100px, không đọc nổi tên hàng. Đo trên máy trước khi chốt mốc.
 */
export const LINE_GRID =
  'grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,2fr)_6rem_7rem_7rem_8.5rem_minmax(5rem,1fr)] xl:gap-2'
