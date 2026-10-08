/**
 * Hằng dùng ở CẢ server (page) lẫn client (màn) — cố ý KHÔNG `'use client'`.
 *
 * BẪY (08/10/2026): import một hằng từ file `'use client'` vào server component
 * thì Next trả về tham chiếu client, không phải giá trị — `PAGE_SIZE` thành
 * `undefined`, `range(NaN, NaN)` trả 0 dòng trong khi `count` vẫn 144. Kiểu
 * (`import type`) thì vô hại, hằng và hàm thì phải nằm ở file thường như này.
 */
export const PAGE_SIZE = 60

/** Khoá localStorage nhớ kiểu xem (bảng / lưới ảnh) theo máy. */
export const XEM_KEY = 'thu-vien-xem'
