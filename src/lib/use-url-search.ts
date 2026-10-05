'use client'

import { useEffect, useState } from 'react'

/**
 * Ô TÌM GÕ Ở CLIENT, TRUY VẤN Ở SERVER QUA URL — không nuốt chữ đang gõ.
 *
 * LỖI CŨ (đo 06/10/2026 trên Vật tư, Tồn kho): ô đẩy `?q=` sau 350 ms dừng tay,
 * rồi khi trang tải xong thì CHÉP LẠI ô bằng `q` của URL. Trang 13k mã tải mất
 * cả giây; người dùng gõ "ong", ngừng một nhịp, gõ tiếp " thep" trong lúc trang
 * đang tải → trang về mang `q=ong` → ô bị đè còn "ong", " thep" biến mất. Với bộ
 * gõ Telex còn tệ hơn: đè giữa lúc đang ghép dấu.
 *
 * Cách sửa: nhớ các giá trị CHÍNH MÌNH vừa đẩy lên URL. URL về đúng một giá trị
 * mình đẩy → đó là tiếng vọng của chính ô này, KHÔNG chép đè. URL đổi sang giá
 * trị lạ (Back của trình duyệt, link ai gửi, nút xoá lọc) → chép vào ô như cũ.
 */
export function useUrlSearch(
  /** `q` đang nằm trên URL (props từ page). */
  urlQ: string,
  /** Đẩy từ khoá mới lên URL — màn tự lo tham số khác (trang về 1…). */
  push: (q: string) => void,
  delay = 350,
) {
  const [nhap, setNhap] = useState(urlQ)
  const [qTruoc, setQTruoc] = useState(urlQ)
  const [daDay, setDaDay] = useState<string[]>([])
  /*
    Chỉnh NGAY TRONG RENDER theo mẫu React "adjust state when a prop changes"
    — không dùng effect: setState trong effect đẻ một vòng render thừa và luật
    `react-hooks/set-state-in-effect` chặn.
  */
  if (urlQ !== qTruoc) {
    setQTruoc(urlQ)
    const r = nhanUrl(daDay, urlQ)
    setDaDay(r.daDay)
    if (!r.giuO) setNhap(urlQ)
  }
  useEffect(() => {
    if (nhap === urlQ) return
    const t = setTimeout(() => {
      setDaDay((d) => [...d, nhap])
      push(nhap)
    }, delay)
    return () => clearTimeout(t)
    // Chỉ chạy lại khi CHỮ trong ô đổi — `push` đổi mỗi render, `urlQ` đổi khi
    // trang về; cả hai không phải lý do để đẩy thêm lần nữa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nhap])
  return [nhap, setNhap] as const
}

/**
 * Hàm thuần của hook trên — URL vừa về `urlQ`, ô có giữ chữ đang gõ không?
 *
 * `daDay` là các giá trị đã đẩy, theo thứ tự. Gặp `urlQ` trong đó → là tiếng
 * vọng; bỏ nó cùng mọi giá trị cũ hơn (Next có thể gộp nhiều lần đẩy, về thẳng
 * giá trị cuối). Không gặp → điều hướng từ ngoài, ô phải theo URL.
 */
export function nhanUrl(
  daDay: readonly string[],
  urlQ: string,
): { giuO: boolean; daDay: string[] } {
  const i = daDay.lastIndexOf(urlQ)
  return i >= 0 ? { giuO: true, daDay: daDay.slice(i + 1) } : { giuO: false, daDay: [] }
}
