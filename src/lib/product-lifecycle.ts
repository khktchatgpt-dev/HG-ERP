/**
 * TRẠNG THÁI HỒ SƠ SẢN PHẨM (0145) — lộ trình mục A của tài liệu:
 *
 *   Nháp → Đang rà soát → Đã duyệt mẫu → Đang sản xuất → Ngừng dùng
 *
 * Đây là trạng thái THẬT, người dùng tự chuyển bằng nút "Cập nhật trạng thái"
 * (0144 từng suy nó ra từ mấy cờ cũ — user bác vì như vậy màn hình vẫn phải bày
 * cả 4 cờ và không ai chuyển thẳng được).
 *
 * ĐI LÙI ĐƯỢC. Đời thật có: khách bắt sửa lại mẫu sau khi đã duyệt, hàng ngừng
 * rồi khách đặt lại. Lùi thì BẮT ghi lý do — xem `requiresReason`.
 */

export const LIFECYCLES = [
  'draft',
  'review',
  'approved',
  'production',
  'discontinued',
] as const

export type Lifecycle = (typeof LIFECYCLES)[number]

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  draft: 'Nháp',
  review: 'Đang rà soát',
  approved: 'Đã duyệt mẫu',
  production: 'Đang sản xuất',
  discontinued: 'Ngừng dùng',
}

/** Câu mô tả nghĩa của từng chặng — hiện ngay trong menu chọn trạng thái. */
export const LIFECYCLE_HINT: Record<Lifecycle, string> = {
  draft: 'Mới lập hồ sơ, đang vẽ / đang gom thông tin',
  review: 'Hồ sơ đã đủ, đang rà soát nội bộ hoặc chờ khách duyệt mẫu',
  approved: 'Khách đã duyệt mẫu — chốt quy cách, chuẩn bị chạy',
  production: 'Đang sản xuất theo hồ sơ này',
  discontinued: 'Ngừng dùng — không nhận đơn / không lên lệnh mới nữa',
}

export const LIFECYCLE_TONE: Record<Lifecycle, string> = {
  draft: 'bg-muted text-muted-foreground',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  approved: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  production: 'bg-emerald-600 text-white',
  discontinued: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

export function isLifecycle(v: unknown): v is Lifecycle {
  return typeof v === 'string' && (LIFECYCLES as readonly string[]).includes(v)
}

export const stageIndex = (s: Lifecycle): number => LIFECYCLES.indexOf(s)

/** Lùi chặng (kể cả gỡ khỏi "ngừng dùng") thì phải nói vì sao. */
export function requiresReason(from: Lifecycle, to: Lifecycle): boolean {
  return stageIndex(to) < stageIndex(from)
}

/**
 * CỜ CŨ ĐỒNG BỘ THEO TRẠNG THÁI (0145).
 *
 * Trước 0145 mỗi cờ là một trạng thái riêng, màn hình nào cũng phải bày ra hết.
 * Nay trạng thái là nguồn duy nhất người dùng chạm vào, còn các cờ cũ được ghi
 * theo — để mọi chỗ đang đọc chúng (bộ lọc thư viện, báo giá, đơn) vẫn đúng mà
 * không phải sửa hàng loạt.
 *
 *   `is_active`          false đúng khi ngừng dùng.
 *   `sample_confirmed`   true từ chặng "đã duyệt mẫu" trở đi — chính là mốc chốt
 *                        mẫu với khách của 0141.
 *
 * KHÔNG đụng `bom_status` (tiến độ VẼ của Kỹ thuật) và `locked_at` (khoá SỬA):
 * hai thứ đó trả lời câu hỏi khác, và khoá vẫn là quyết định riêng — chuyển
 * sang "đang sản xuất" không tự khoá hồ sơ.
 */
export function flagsFor(to: Lifecycle): {
  is_active: boolean
  sample_confirmed: boolean
} {
  return {
    is_active: to !== 'discontinued',
    sample_confirmed: to === 'approved' || to === 'production',
  }
}
