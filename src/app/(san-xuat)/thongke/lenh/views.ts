import { STALE_DAYS, isStale } from '@/lib/lsx-holder'
import type { OverviewRow } from '@/modules/dept/production/jobs.service'

/**
 * KHUNG NHÌN của màn Lệnh sản xuất (M2) — mỗi chip là MỘT câu hỏi, và CÙNG
 * một hàm vừa đếm vừa lọc. Đếm một đằng lọc một nẻo là bấm vào ra khác số, và
 * người dùng hết tin cả trang (nguyên tắc 3 của /design-lab).
 *
 * VÌ SAO Ở FILE RIÊNG, không nằm trong `LenhScreen.tsx`:
 *
 * `LenhScreen` là module `'use client'`. Server component import một GIÁ TRỊ
 * từ module client thì KHÔNG nhận được giá trị đó — nó nhận một tham chiếu
 * proxy để trình duyệt nạp sau. Trang gọi `VIEW_IDS.includes(...)` vì thế nổ
 * "includes is not a function", và nổ ở RUNTIME chứ không phải lúc typecheck:
 * TypeScript vẫn thấy kiểu `string[]` nên hoàn toàn im lặng.
 *
 * Luật rút ra: dữ liệu dùng chung giữa server và client phải nằm ở module
 * KHÔNG có `'use client'`.
 *
 * Thứ tự cố ý: việc CẤP nằm trước. "Đã đủ số" đứng cuối vì nó là tin mừng,
 * không phải việc phải làm.
 */
export const VIEWS: { id: string; label: string; test: (r: OverviewRow) => boolean }[] = [
  { id: 'all', label: 'Tất cả', test: () => true },
  { id: 'late', label: 'Trễ hạn xuất', test: (r) => r.lsx.late === 'overdue' },
  {
    id: 'short',
    label: 'Thiếu vật tư',
    test: (r) => (r.materials?.missing_count ?? 0) > 0,
  },
  // "Chưa định hình" = chưa có chi tiết nào nên KHÔNG CÓ GÌ để ghi sổ. Đây là
  // nút thắt đầu chuỗi: 6/14 lệnh đang chạy nằm ở đây (đo 18/09/2026).
  { id: 'noshape', label: 'Chưa định hình', test: (r) => r.component_count === 0 },
  { id: 'noplan', label: 'Chưa lên kế hoạch', test: (r) => r.jobs_total === 0 },
  // Bóng nằm im quá ngưỡng — thứ KHÔNG màn nào của app từng nói ra, trong khi
  // phần lớn lệnh đứng ở "đã duyệt" mà không ai biết đã bao lâu.
  { id: 'stale', label: `Nằm im ≥${STALE_DAYS} ngày`, test: (r) => isStale(r.holder) },
  {
    id: 'done',
    label: 'Đã đủ số',
    test: (r) => r.qty_needed > 0 && r.qty_done >= r.qty_needed,
  },
]

/** Id hợp lệ — trang lọc tham số `?view=` trước khi truyền xuống màn. */
export const VIEW_IDS: string[] = VIEWS.map((v) => v.id)

/** Khung nhìn từ query, rơi về "tất cả" nếu id lạ. Không nổ vì tham số bẩn. */
export function resolveView(raw: string | undefined): string | undefined {
  return raw && VIEW_IDS.includes(raw) ? raw : undefined
}
