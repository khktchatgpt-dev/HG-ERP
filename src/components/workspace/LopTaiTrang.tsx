'use client'

import './lop-tai-trang.css'
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { SU_KIEN_TAI_TRANG } from '@/lib/tai-trang'

/** Điều hướng xong nhanh hơn mức này thì KHÔNG mờ màn / hiện vòng quay — tránh nháy. */
export const TRE_HIEN_MS = 150
/** Chốt an toàn: điều hướng hỏng / bị huỷ mà URL không đổi thì lớp chờ tự gỡ. */
export const TOI_DA_MS = 15_000
/** Điều hướng bằng mã: không có phím bổ trợ, không `target`, không `download`. */
const KHONG_PHIM = { button: 0, mod: false, target: '', download: false }

/**
 * Cú bấm vào link này có ĐI TỚI MỘT TRANG KHÁC trong app không — thuần, có test.
 *
 * Bỏ qua: chuột giữa / Ctrl / Shift / Alt / ⌘ (mở tab mới), `target` khác
 * `_self`, `download`, link ngoài miền, chỉ khác `#…`, cùng đúng URL đang đứng,
 * và `/api/…` · `/print/…` — nút "Excel họp", "Xuất LSX"… là TẢI FILE: URL không
 * đổi nên lớp chờ sẽ treo tới chốt an toàn.
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
 * LỚP CHỜ TẢI TRANG — từ lúc BẤM chuyển trang tới lúc URL đổi, phủ cả màn và
 * NUỐT mọi cú bấm tiếp theo (11/11/2026, chủ dự án: "cái tôi cần là hiệu ứng
 * loading chứ không phải thanh tiến trình, vì thanh tiến trình người dùng vẫn
 * nhấn tiếp được"). Bản trước là vạch 2px ở mép trên; đo trên máy thử, bấm mã
 * lệnh xong màn cũ vẫn bấm được suốt 5 giây.
 *
 * Hai pha cho khỏi nháy:
 *  · `cho`  — NGAY khi bấm: lớp trong suốt phủ màn, con trỏ chờ, bấm gì cũng
 *    không ăn. Điều hướng nhanh (< `TRE_HIEN_MS`) thì người dùng không thấy gì.
 *  · `chay` — sau `TRE_HIEN_MS`: màn mờ đi + vòng quay "Đang tải trang…" ở giữa.
 * URL đổi → gỡ ngay; không đổi sau `TOI_DA_MS` → tự gỡ (không giam người dùng).
 *
 * Bù đúng hai chỗ `loading.tsx` không bắt được: đổi `?…` (khung chờ khoá theo thư
 * mục, bỏ `?…`), và bấm khi Next CHƯA kịp tải sẵn khung chờ. Nghe HAI nguồn: cú
 * bấm `<a>` (mọi `Btn href`, `Code as="a"`, `Link`) và tín hiệu `SU_KIEN_TAI_TRANG`
 * mà `useRouterBao()` (`lib/tai-trang`) phát trước mỗi `router.push` / `replace`.
 *
 * GẮN Ở VỎ CHUNG (`WorkspaceShell`) cho phòng Cung ứng, nên chạy cả ở năm trang
 * dùng chung trong menu Cung ứng. Làm bằng DOM trong effect, không bằng state:
 * không vẽ lại cả khu mỗi lần bấm, không setState-trong-effect khi URL đổi.
 */
export function LopTaiTrang() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const lop = useRef<HTMLDivElement>(null)
  const loi = useRef<HTMLSpanElement>(null)
  /** Gọi khi URL đổi — gắn trong effect nghe cú bấm, dùng ở effect theo URL. */
  const xong = useRef<() => void>(() => {})

  useEffect(() => {
    const el = lop.current
    if (!el) return
    let hien: number | undefined
    let toiDa: number | undefined
    const pha = (p: 'tat' | 'cho' | 'chay') => {
      el.dataset.pha = p
      if (loi.current) loi.current.textContent = p === 'chay' ? 'Đang tải trang…' : ''
    }
    const tat = () => {
      window.clearTimeout(hien)
      window.clearTimeout(toiDa)
      pha('tat')
    }
    xong.current = tat

    const batDau = () => {
      tat()
      pha('cho') // chặn bấm NGAY, chưa mờ màn
      hien = window.setTimeout(() => pha('chay'), TRE_HIEN_MS)
      toiDa = window.setTimeout(tat, TOI_DA_MS)
    }
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
      if (di) batDau()
    }
    // `router.push` / `replace` trong mã — qua `useRouterBao()` (lib/tai-trang).
    const onMa = (e: Event) => {
      const href = (e as CustomEvent<string>).detail
      if (diTrangToi(href, KHONG_PHIM, new URL(window.location.href))) batDau()
    }
    // Pha BẮT (capture): `Link` của Next tự `preventDefault` rồi điều hướng bằng
    // router, nên nghe ở pha nổi bọt thì không phân biệt được gì.
    document.addEventListener('click', onClick, true)
    window.addEventListener(SU_KIEN_TAI_TRANG, onMa)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener(SU_KIEN_TAI_TRANG, onMa)
      window.clearTimeout(hien)
      window.clearTimeout(toiDa)
    }
  }, [])

  // URL đổi = điều hướng đã tới nơi.
  useEffect(() => {
    xong.current()
  }, [pathname, search])

  return (
    <>
      <div ref={lop} className="hg-ltt" data-pha="tat" aria-hidden>
        <span className="hg-ltt-o">
          <span className="hg-ltt-q" />
          Đang tải trang…
        </span>
      </div>
      <span ref={loi} className="sr-only" role="status" aria-live="polite" />
    </>
  )
}
