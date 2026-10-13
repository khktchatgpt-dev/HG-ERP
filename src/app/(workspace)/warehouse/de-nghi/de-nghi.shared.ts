import type { DeNghiStatus } from '@/lib/de-nghi'

/**
 * Kiểu page → màn của "Đề nghị mua vật tư" (0236). File KHÔNG `'use client'` để
 * server component dùng được (bẫy client-reference, xem `ton/ro-ton.ts`).
 */

export type GiaGoiY = {
  unit_price: number
  po_code: string
  supplier_name: string
  at: string
}

export type DongForm = {
  /** Khoá React — id dòng đã lưu hoặc khoá tạm. */
  key: string
  material_id: string | null
  code: string | null
  name: string
  unit: string
  /** Tồn dùng được lúc thêm dòng; null = dòng chưa có mã. */
  ton: number | null
  qty: number | null
  unit_price: number | null
  purpose: string
  note: string
  gia_goi_y: GiaGoiY | null
}

export type PhieuForm = {
  id: string | null
  code: string | null
  status: DeNghiStatus
  department: string
  need_by: string
  note: string
  production_order_id: string | null
  nguoi_de_nghi: string
  created_at: string | null
  submitted_at: string | null
  rejected_at: string | null
  rejected_by_name: string | null
  rejected_reason: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  lines: DongForm[]
}

/** Một dòng sổ đề nghị (DN-4). */
export type DeNghiSoRow = {
  id: string
  code: string
  status: DeNghiStatus
  created_at: string
  need_by: string | null
  nguoi: string | null
  so_dong: number
  chua_ma: number
  tong: number
  thieu_gia: number
  bi_tu_choi: boolean
  rejected_reason: string | null
  cancel_reason: string | null
  lsx_code: string | null
}

/** Gợi ý ô "Mục đích / tổ dùng" (Q5) — gõ tự do, đây chỉ là gợi ý. */
export const MUC_DICH_GOI_Y = [
  'Phục vụ sản xuất',
  'Tổ phôi',
  'Tổ hàn',
  'Tổ nguội',
  'Tổ sơn',
  'Đóng gói',
  'Bảo trì máy',
  'Bảo hộ lao động',
  'Văn phòng',
] as const
