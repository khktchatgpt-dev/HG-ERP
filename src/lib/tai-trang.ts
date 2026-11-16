'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'

/**
 * BÁO "ĐANG TẢI TRANG" CHO LỚP CHỜ (`components/workspace/LopTaiTrang`)
 * KHI CHUYỂN TRANG BẰNG MÃ (11/11/2026, chủ dự án: "bổ sung loading cho phòng
 * cung ứng ở các trang chưa có").
 *
 * Lớp chờ tự nghe cú bấm `<a>`, nhưng `router.push` / `router.replace` trong mã
 * (chip lọc, "Xem theo vật tư", đóng hộp…) không có cú bấm link nào — đổi `?…`
 * thì khung chờ `loading.tsx` cũng không hiện (Next khoá theo tên thư mục, bỏ
 * `?…`), nên màn đứng im tới khi máy chủ dựng lại. `useRouterBao()` dùng THAY
 * `useRouter()`: `push` / `replace` phát tín hiệu trước rồi mới đi; lớp chờ gỡ
 * khi URL đổi (hoặc tự tắt sau 15 s nếu không đổi). `refresh()` KHÔNG báo — URL
 * không đổi nên lớp chờ không biết lúc nào xong.
 */
export const SU_KIEN_TAI_TRANG = 'hg:tai-trang'

/** Phát tín hiệu "sắp đi tới `href`" cho lớp chờ đang gắn trong vỏ. */
export function baoDangTai(href: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<string>(SU_KIEN_TAI_TRANG, { detail: href }))
}

/**
 * `useRouter()` mà `push` / `replace` báo lớp chờ trước khi đi. Chuyển tiếp ĐÚNG
 * các tham số bên gọi đưa vào (16/11/2026): trước đó luôn gửi thêm `undefined` làm
 * tham số thứ hai — Next không phân biệt, nhưng test màn kiểm `push('/…')` thì đỏ.
 */
export function useRouterBao() {
  const r = useRouter()
  return useMemo(
    () => ({
      ...r,
      push: (...a: Parameters<typeof r.push>) => {
        baoDangTai(a[0])
        r.push(...a)
      },
      replace: (...a: Parameters<typeof r.replace>) => {
        baoDangTai(a[0])
        r.replace(...a)
      },
    }),
    [r],
  )
}
