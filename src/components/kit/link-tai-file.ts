/**
 * LINK TẢI FILE (`/api/…`) PHẢI LÀ `<a>` THƯỜNG, không `next/link` (11/11/2026,
 * chủ dự án: "những gì cần gọi api ở phần cung ứng hầu hết không có loading,
 * người dùng nhấn nhiều lần").
 *
 * `next/link` coi mọi href nội bộ là một TRANG: router `fetch` URL đó kiểu RSC,
 * máy chủ dựng xong cả file Excel / zip, router thấy content-type không phải RSC
 * rồi mới bảo trình duyệt tải lại (`doMpaNavigation` trong
 * `next/dist/client/components/router-reducer/fetch-server-response.js`). Mỗi cú
 * bấm "Excel họp", "Xuất LSX", "Tải file của lệnh (.zip)" vì thế dựng file HAI
 * lần, và suốt lần đầu không có gì báo — đúng lúc người dùng bấm thêm. `<a>`
 * thường thì trình duyệt tải thẳng, một lần. `Btn` và `Code as="a"` dùng hàm này.
 */
export const laTaiFile = (href: string) => href.startsWith('/api/')
