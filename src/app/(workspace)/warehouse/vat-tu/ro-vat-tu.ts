/**
 * BA RỔ của màn Danh mục vật tư bản Kho — module KHÔNG `'use client'`.
 *
 * BẪY (đã dính ở màn Tồn kho 16/09): hằng export từ file `'use client'` thì
 * server component đọc ra client-reference, `.includes` ném lỗi, trang 500.
 */

// Rổ "Chờ Kho rà" đã BỎ 14/10/2026 (chủ dự án: "không cần thiết") — Kho sửa
// thẳng mã ở hộp Sửa, không còn hàng đợi xác nhận mã Cung ứng khai.
export const RO_VT = ['no_shelf', 'no_min', 'all'] as const
export type RoVatTu = (typeof RO_VT)[number]

export const RO_VT_NHAN: Record<RoVatTu, string> = {
  no_min: 'Chưa khai ngưỡng',
  no_shelf: 'Chưa có kệ',
  all: 'Tất cả',
}

/** Câu giải thích rổ — hiện thành dải trên bảng, nói VIỆC chứ không tả bộ lọc. */
export const RO_VT_VIEC: Partial<Record<RoVatTu, string>> = {
  no_min:
    'Chưa khai ngưỡng thì cảnh báo “sắp hết” không bao giờ kêu cho mã đó. Khai ngưỡng cho mã hay dùng trước, không cần khai hết.',
  no_shelf: 'Chưa có kệ gợi ý thì lúc cất hàng phải chọn tay. Khai theo biển hiệu thật.',
}
