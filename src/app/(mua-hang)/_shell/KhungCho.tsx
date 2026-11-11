import { Loading, ScreenFrame } from '@/components/kit'

/**
 * KHUNG CHỜ CỦA KHU MUA HÀNG — dùng chung cho mọi `loading.tsx` trong khu.
 *
 * Bắt chước ĐÚNG hình dạng màn danh sách — đầu trang một hàng, thanh lọc, rồi
 * lưới — để nội dung thật về không làm bố cục nhảy.
 *
 * VÌ SAO NHIỀU `loading.tsx` CHỨ KHÔNG MỘT (11/11/2026, chủ dự án: "chuyển trang
 * hầu hết không có loading, người dùng không biết đã nhấn chưa và nhấn nhiều
 * lần"). Từ 14/09 khu chỉ có một `loading.tsx` ở gốc `(mua-hang)`. Next bọc
 * khung chờ của một thư mục quanh THƯ MỤC CON của nó, và chỉ hiện lại khi tên
 * thư mục con đó đổi (`layout-router.js`: khoá theo `createRouterCacheKey(…,
 * true)`, bỏ phần `?…`). Con của `(mua-hang)` luôn là `mua-hang`, nên khung chờ
 * gốc chỉ chạy lúc ĐI TỪ KHU KHÁC VÀO; đi `/mua-hang/don` → `/mua-hang/yeu-cau`
 * hay danh sách → chi tiết thì màn cũ đứng im tới khi máy chủ dựng xong.
 *
 * Nay mỗi thư mục có trang con mang một `loading.tsx` trỏ về đây — test
 * `src/app/khung-cho.test.ts` canh (cho MỌI khu, không riêng Mua hàng): thêm
 * trang con mà quên thì đỏ. Đổi bộ lọc (`?…`)
 * KHÔNG làm khung chờ hiện lại (khoá bỏ phần `?…`), nên gõ ô tìm không nháy cả
 * màn — chỗ đó do lớp chờ `components/workspace/LopTaiTrang` lo.
 */
export function KhungCho() {
  return (
    <ScreenFrame>
      <div className="animate-pulse border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2.5">
        <span className="block h-3 w-[190px] rounded bg-[var(--surface-raised)]" />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
        {/*
          KEY THEO VỊ TRÍ, không theo bề rộng: hai ô lọc giữa cùng rộng 110px
          nên `key={w}` sinh ra hai key `110` trùng nhau — React cảnh báo và
          có quyền nhập/bỏ bớt ô. Danh sách này cố định, không sắp xếp lại và
          không thêm bớt, nên chỉ số LÀ danh tính đúng của từng ô.
        */}
        {[300, 110, 110, 90].map((w, i) => (
          <span
            key={i}
            style={{ width: w }}
            className="h-[26px] animate-pulse rounded-[13px] bg-[var(--surface-raised)]"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden bg-[var(--surface-card)]">
        <Loading rows={12} />
      </div>
    </ScreenFrame>
  )
}
