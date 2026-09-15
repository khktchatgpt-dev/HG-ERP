/**
 * Hằng dùng chung giữa page (server) và MaterialsManager (client).
 *
 * PHẢI nằm ở module KHÔNG có 'use client'. Để trong MaterialsManager thì Next
 * biến mọi export của file đó thành client-reference, và server component đọc
 * `PAGE_SIZE` ra `undefined` → `range(0, NaN)` → danh sách rỗng trong khi bộ
 * đếm vẫn báo 12.991. Đúng kiểu lỗi im lặng: trang hiện "Danh mục vật tư trống"
 * mà không có lỗi nào.
 */
export const PAGE_SIZE = 50
