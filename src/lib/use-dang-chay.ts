'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * VIỆC ĐANG CHẠY THEO KHOÁ — chặn bấm đôi + cờ để nút báo "đang chạy"
 * (11/11/2026, chủ dự án: "những gì cần gọi api ở phần cung ứng hầu hết không có
 * loading, người dùng không biết đã nhấn hay chưa và nhấn nhiều lần").
 *
 * `chay(khoa, fn)`: đang có việc cùng `khoa` thì BỎ QUA lần gọi này (trả
 * `undefined`), không thì chạy `fn` và giữ cờ tới khi xong — kể cả khi `fn` ném
 * lỗi (lỗi vẫn ném ra cho chỗ gọi bắt như cũ).
 *
 * Chặn bằng `ref` chứ không bằng state: hai cú bấm sát nhau tới TRƯỚC khi React
 * vẽ lại, nên nếu chỉ đọc state thì cả hai cùng thấy "chưa chạy" và cùng gọi API.
 * State chỉ để vẽ (nút đổi chữ, `disabled`).
 *
 * Khoá theo việc + đối tượng (`gỡ:${id}`) để mỗi dòng có cờ riêng — gỡ file A
 * không khoá nút gỡ file B.
 */
export function useDangChay() {
  const dangRef = useRef(new Set<string>())
  const [dang, setDang] = useState<ReadonlySet<string>>(() => new Set())

  const chay = useCallback(async <T>(khoa: string, fn: () => Promise<T>) => {
    if (dangRef.current.has(khoa)) return undefined
    dangRef.current.add(khoa)
    setDang(new Set(dangRef.current))
    try {
      return await fn()
    } finally {
      dangRef.current.delete(khoa)
      setDang(new Set(dangRef.current))
    }
  }, [])

  return {
    chay,
    /** Việc `khoa` đang chạy? */
    dangChay: (khoa: string) => dang.has(khoa),
    /** Có việc nào đang chạy không (khoá cả khu khi cần). */
    coViec: dang.size > 0,
  } as const
}
