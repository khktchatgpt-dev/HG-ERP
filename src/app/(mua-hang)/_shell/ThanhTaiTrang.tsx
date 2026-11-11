'use client'

import './thanh-tai-trang.css'
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/** Điều hướng xong nhanh hơn mức này thì không hiện — tránh thanh nháy một chớp. */
export const TRE_HIEN_MS = 120
/** Chốt an toàn: điều hướng hỏng / bị huỷ mà URL không đổi thì thanh tự tắt. */
export const TOI_DA_MS = 15_000

/**
 * Cú bấm vào link này có ĐI TỚI MỘT TRANG KHÁC trong app không — thuần, có test.
 *
 * Bỏ qua: chuột giữa / Ctrl / Shift / Alt / ⌘ (mở tab mới), `target` khác
 * `_self`, `download`, link ngoài miền, chỉ khác `#…`, cùng đúng URL đang đứng,
 * và `/api/…` · `/print/…` — nút "Excel họp", "Xuất LSX"… là TẢI FILE: URL không
 * đổi nên thanh sẽ treo tới chốt an toàn.
 */
export function diTrangToi(
  href: string | null,
  o: { button: number; mod: boolean; target: string; download: boolean },
  hienTai: URL,
): boolean {
  if (!href || o.button !== 0 || o.mod || o.download) return false
  if (o.target && o.target !== '_self') return false
  let u: URL
  try {
    u = new URL(href, hienTai)
  } catch {
    return false
  }
  if (u.origin !== hienTai.origin) return false
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/print/')) return false
  return !(u.pathname === hienTai.pathname && u.search === hienTai.search)
}

/**
 * THANH TẢI TRANG — vạch 2px màu hành động ở mép trên, chạy từ lúc BẤM link tới
 * lúc URL đổi (11/11/2026, chủ dự án: "chuyển trang hầu hết không có loading,
 * người dùng không biết đã nhấn hay chưa và nhấn nhiều lần").
 *
 * Bù đúng hai chỗ `loading.tsx` không bắt được:
 *  · đổi `?…` (bộ lọc, "Xem theo"): khung chờ khoá theo thư mục, bỏ phần `?…`,
 *    nên máy chủ dựng lại mà màn đứng im;
 *  · bấm khi Next CHƯA kịp tải sẵn khung chờ (mạng chậm, link vừa cuộn tới):
 *    phải chờ một lượt máy chủ trả lời mới thấy khung.
 *
 * Chỉ nghe cú bấm link (`<a>` — mọi `Btn href`, `Code as="a"`, `Link`). Điều hướng
 * bằng `router.push` trong mã KHÔNG đi qua đây — chỗ đó dùng `useTransition`
 * (như `batDau` ở Tồn & cân đối, Vật tư) để nút tự báo đang chạy.
 *
 * Làm bằng DOM trong effect, không bằng state: thanh không làm React vẽ lại cả
 * khu mỗi lần bấm, và tránh setState-trong-effect khi URL đổi.
 */
export function ThanhTaiTrang() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const thanh = useRef<HTMLDivElement>(null)
  const loi = useRef<HTMLSpanElement>(null)
  /** Gọi khi URL đổi — gắn trong effect nghe cú bấm, dùng ở effect theo URL. */
  const xong = useRef<() => void>(() => {})

  useEffect(() => {
    const el = thanh.current
    if (!el) return
    let hen: number | undefined
    const huy = () => {
      window.clearTimeout(hen)
      hen = undefined
    }
    const pha = (p: 'tat' | 'chay' | 'xong') => {
      el.dataset.pha = p
      if (loi.current) loi.current.textContent = p === 'chay' ? 'Đang tải trang…' : ''
    }
    const tat = () => {
      huy()
      if (el.dataset.pha !== 'chay') return pha('tat')
      pha('xong')
      hen = window.setTimeout(() => pha('tat'), 400)
    }
    xong.current = tat

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a) return
      const di = diTrangToi(
        a.getAttribute('href'),
        {
          button: e.button,
          mod: e.ctrlKey || e.metaKey || e.shiftKey || e.altKey,
          target: a.getAttribute('target') ?? '',
          download: a.hasAttribute('download'),
        },
        new URL(window.location.href),
      )
      if (!di) return
      huy()
      hen = window.setTimeout(() => {
        pha('chay')
        hen = window.setTimeout(tat, TOI_DA_MS)
      }, TRE_HIEN_MS)
    }
    // Pha BẮT (capture): `Link` của Next tự `preventDefault` rồi điều hướng bằng
    // router, nên nghe ở pha nổi bọt thì không phân biệt được gì.
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      huy()
    }
  }, [])

  // URL đổi = điều hướng đã tới nơi.
  useEffect(() => {
    xong.current()
  }, [pathname, search])

  return (
    <>
      <div ref={thanh} className="hg-ttt" data-pha="tat" aria-hidden />
      <span ref={loi} className="sr-only" role="status" aria-live="polite" />
    </>
  )
}
