'use client'

import { useSyncExternalStore } from 'react'

/**
 * TUỲ CHỌN NHỚ THEO MÁY — rail mở/thu, cột đang hiện, mật độ bảng.
 *
 * Đọc bằng `useSyncExternalStore`, KHÔNG bằng `useEffect` + `setState`:
 *
 *   · đọc localStorage lúc khởi tạo state thì server dựng HTML một kiểu, trình
 *     duyệt dựng kiểu khác và React báo lệch;
 *   · đọc trong effect rồi setState thì đúng nhưng vẽ hai lần và vướng luật
 *     `react-hooks/set-state-in-effect`.
 *
 * `useSyncExternalStore` sinh ra đúng cho việc này: nhận riêng một ảnh chụp cho
 * phía server (`fallback`) nên hydrate khớp, rồi tự đọc lại phía trình duyệt.
 *
 * Giá trị là CHUỖI. Chỗ gọi tự mã hoá (JSON, '0'/'1'…) — hook không đoán kiểu,
 * vì đoán sai là hỏng im lặng ở mọi nơi dùng.
 */

/** Sự kiện tự phát khi đổi — `storage` của trình duyệt chỉ bắn sang TAB KHÁC. */
const EVT = 'hg:local-pref'

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb)
  window.addEventListener(EVT, cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener(EVT, cb)
  }
}

export function useLocalPref(
  key: string,
  fallback: string,
): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? fallback
      } catch {
        // Trình duyệt chặn lưu (cửa sổ ẩn danh) — dùng mặc định, không phải lỗi.
        return fallback
      }
    },
    () => fallback,
  )
  const set = (v: string) => {
    try {
      localStorage.setItem(key, v)
    } catch {
      // Chặn lưu thì bỏ qua — vẫn phát sự kiện để lần vẽ này đổi theo.
    }
    window.dispatchEvent(new Event(EVT))
  }
  return [value, set]
}
