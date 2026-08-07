'use client'

import {
  DraftingCompass,
  FileSpreadsheet,
  Image as ImageIcon,
  ImageOff,
  ListChecks,
  Package,
  type LucideIcon,
} from 'lucide-react'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import type { BomStatus, ProductRow } from './types'

// ── Dải hồ sơ ────────────────────────────────────────────────────────────

export type DocState = 'ok' | 'partial' | 'missing'

/**
 * Có = màu ĐẶC, thiếu = ô rỗng có viền.
 *
 * Bản trước dùng nền nhạt (emerald-100/zinc-100) cho cả hai: trên thẻ trắng thì
 * ô "thiếu" gần như biến mất, năm icon xám đọc ra như lỗi render chứ không ra
 * thông tin. Tương phản phải nằm ở CHÍNH cặp có/thiếu thì liếc một cái mới đếm
 * được còn thiếu mấy mục.
 */
const DOC_TONE: Record<DocState, string> = {
  ok: 'bg-emerald-600 text-white',
  partial: 'bg-amber-500 text-white',
  missing:
    'bg-zinc-50 text-zinc-400 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-600 dark:ring-zinc-700',
}

const DM_TITLE: Record<BomStatus, string> = {
  none: 'Định mức: chưa có',
  drawing: 'Định mức: đang vẽ',
  done: 'Định mức: đã vẽ xong',
}

/**
 * Năm mảnh hồ sơ quyết định một SP có chào, có làm và có xuất được hay không:
 * ảnh, bản vẽ (file), file BOM đính kèm, định mức (`bom_status`), đóng gói
 * (số xếp cont).
 *
 * Gộp thành MỘT dải icon thay vì rải "Thiếu BV" / "BOM ✓" / badge BOM ở ba chỗ:
 * người tra SP cần biết "còn thiếu gì" chứ không phải mấy mẩu chữ rời nhau.
 * Dùng icon chứ không dùng chữ viết tắt vì 5 ô chữ thì hết chỗ trên thẻ, và
 * mỗi ô đều có `title` nói đủ câu khi rê chuột.
 *
 * `has_bom` (file BOM) tách riêng khỏi `bom_status` (định mức đã vẽ chưa) —
 * hai chuyện khác nhau: vẽ xong định mức trong app mà chưa đính file BOM là
 * chuyện có thật, và ngược lại.
 */
export function docStates(p: ProductRow): {
  key: string
  icon: LucideIcon
  state: DocState
  title: string
}[] {
  const k = p.packing ?? {}
  const hasDim = k.l_cm != null && k.w_cm != null && k.h_cm != null
  const load = p.loading_40hc

  const packParts: string[] = []
  if (hasDim) packParts.push(`${k.l_cm}×${k.w_cm}×${k.h_cm} cm`)
  if (load != null) packParts.push(`${load} SP / cont 40HC`)

  return [
    {
      key: 'anh',
      icon: p.image_file_id ? ImageIcon : ImageOff,
      state: p.image_file_id ? 'ok' : 'missing',
      title: p.image_file_id ? 'Ảnh: đã có' : 'Ảnh: chưa có',
    },
    {
      key: 'ban-ve',
      icon: DraftingCompass,
      state: p.has_drawing ? 'ok' : 'missing',
      title: p.has_drawing ? 'Bản vẽ: đã có file' : 'Bản vẽ: chưa có file',
    },
    {
      // File BOM của xưởng là bảng Excel (xem scripts/products-bom-files.mjs),
      // nên icon bảng tính nói đúng hơn cái ghim giấy chung chung.
      key: 'file-bom',
      icon: FileSpreadsheet,
      state: p.has_bom ? 'ok' : 'missing',
      title: p.has_bom ? 'File BOM: đã đính kèm' : 'File BOM: chưa đính kèm',
    },
    {
      key: 'dinh-muc',
      icon: ListChecks,
      state:
        p.bom_status === 'done'
          ? 'ok'
          : p.bom_status === 'drawing'
            ? 'partial'
            : 'missing',
      title: DM_TITLE[p.bom_status],
    },
    {
      // Số xếp cont mới là thứ Kế hoạch cần; có kích thước mà thiếu số cont chỉ
      // tính là làm dở, nên để 'partial'.
      key: 'dong-goi',
      icon: Package,
      state: load != null ? 'ok' : hasDim ? 'partial' : 'missing',
      title: packParts.length
        ? `Đóng gói: ${packParts.join(' · ')}`
        : 'Đóng gói: chưa có số liệu',
    },
  ]
}

/** Số mục hồ sơ đã đủ — dùng để sắp bảng, lôi SP thiếu nhiều lên đầu. */
export function docOkCount(p: ProductRow): number {
  return docStates(p).filter((d) => d.state === 'ok').length
}

export function DocMeter({ p, className = '' }: { p: ProductRow; className?: string }) {
  const items = docStates(p)
  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      aria-label={`Hồ sơ — ${items.map((d) => d.title).join('; ')}`}
    >
      {items.map((d) => (
        <span
          key={d.key}
          title={d.title}
          aria-hidden
          className={`grid size-6 place-items-center rounded-md ${DOC_TONE[d.state]}`}
        >
          <d.icon className="size-3.5" />
        </span>
      ))}
    </div>
  )
}

// ── Nhãn phân loại & kích thước ──────────────────────────────────────────

// Map<string, string> tường minh: hai hằng khai `as const` nên `.get()` mặc
// định chỉ nhận đúng union mã, trong khi cột DB là string tự do.
const TYPE_LABEL = new Map<string, string>(PRODUCT_TYPES.map((t) => [t.code, t.label]))
const MATERIAL_LABEL = new Map<string, string>(
  FRAME_MATERIALS.map((m) => [m.code, m.label]),
)

/**
 * Nhãn phân loại cho thẻ: "Ghế · Nhôm".
 *
 * Đọc `product_type` + `frame_material` chứ KHÔNG đọc cột `category`: category
 * gần như rỗng (9/537) và 9 giá trị đó lại là tên khách gõ nhầm chỗ (BUNNING,
 * MERXX, ROSCO…), tức nó lặp lại `customer_name` chứ không phân loại gì.
 * Hai cột kia phủ 529/537 SP và khớp 100% với mã SP.
 */
export function classLabel(p: ProductRow): string | null {
  const type = p.product_type ? (TYPE_LABEL.get(p.product_type) ?? p.product_type) : null
  const mat = p.frame_material
    ? (MATERIAL_LABEL.get(p.frame_material) ?? p.frame_material)
    : null
  // 'XX' = chưa xác định: nói ra thì tốn chỗ mà không thêm thông tin gì.
  const parts = [type, p.frame_material === 'XX' ? null : mat].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** Kích thước SP cho góc thẻ; không có thì lấy tạm số xếp cont. */
export function sizeLabel(p: ProductRow): string | null {
  const k = p.packing ?? {}
  if (k.l_cm != null && k.w_cm != null && k.h_cm != null) {
    return `${k.l_cm}×${k.w_cm}×${k.h_cm}`
  }
  return p.loading_40hc != null ? `40HC ${p.loading_40hc}` : null
}
