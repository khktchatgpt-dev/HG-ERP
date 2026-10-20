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
  nguon?: 'po' | 'kho'
}

/** Gợi ý của một mã (Đ6) — đúng hình `ThongTinMa` của service. */
export type GoiYMa = {
  ton: number
  theo_doi: boolean
  gia: GiaGoiY | null
  trung: { code: string; status: DeNghiStatus; qty: number }[]
  dang_ve: { po_code: string; qty_open: number }[]
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
  /** Số lãnh đạo duyệt (Đ2), null = duyệt đúng số đề nghị / chưa duyệt. */
  approved_qty?: number | null
  unit_price: number | null
  /** % VAT của dòng, 0 = không VAT (Đ7 · 0239). */
  vat_rate: number
  purpose: string
  note: string
  gia_goi_y: GiaGoiY | null
  /** Mã đã từng có giao dịch sổ kho chưa (Đ6) — false: tồn 0 là "chưa theo dõi". */
  theo_doi?: boolean | null
  /** Đề nghị khác đang mở cùng mã / đơn mua Cung ứng còn về (Đ6). */
  trung?: GoiYMa['trung']
  dang_ve?: GoiYMa['dang_ve']
  /** Số phải nhập = số duyệt (0238 · DN-5). */
  can?: number
  /** Đã nhập, đọc từ sổ kho. */
  da_nhap?: number
  /** Phiếu nhập kho đã nhập cho dòng (chưa đảo). */
  phieu_nhap?: { doc_id: string; code: string; doc_date: string; qty: number }[]
}

export type PhieuForm = {
  id: string | null
  code: string | null
  status: DeNghiStatus
  department: string
  need_by: string
  note: string
  production_order_id: string | null
  /** Phí vận chuyển dự kiến cả phiếu (Đ7). */
  shipping_fee: number
  /** Lời lãnh đạo dặn Kho khi duyệt (Đ7). */
  approve_note?: string | null
  nguoi_de_nghi: string
  created_at: string | null
  submitted_at: string | null
  approved_at?: string | null
  approved_by_name?: string | null
  rejected_at: string | null
  rejected_by_name: string | null
  rejected_reason: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  /** Chốt xong khi còn thiếu (0238 · Q14). */
  closed_at?: string | null
  closed_reason?: string | null
  closed_by_name?: string | null
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

/** Một phiếu cũ để "Lập lại từ phiếu cũ" (Đ8) — chỉ số đếm, không gửi dòng. */
export type PhieuCu = {
  id: string
  code: string
  status: DeNghiStatus
  /** Ngày gửi duyệt (ISO). */
  ngay: string
  so_dong: number
  /** Tổng dự kiến gồm VAT + vận chuyển (theo số duyệt nếu đã duyệt). */
  tong: number
  /** Ba tên vật tư đầu — để nhận ra phiếu mà không phải mở. */
  ten: string
}
