'use client'

import { useSyncExternalStore } from 'react'

export type Kho = 'portrait' | 'landscape'

/*
 * KHỔ GIẤY NGƯỜI DÙNG CHỌN — nhớ theo LOẠI phiếu (05/10/2026). Trước đây trang
 * in ghim cứng `@page { size: A4 landscape }`: hộp in của Chrome khoá luôn ô
 * "Bố cục", người dùng không in dọc được. Nay chọn ở thanh nút, nhớ lần sau.
 *
 * Đọc localStorage qua `useSyncExternalStore` (bản server = khổ mặc định) để
 * không lệch lúc hydrate; lỗi bộ nhớ (chế độ ẩn danh) thì dùng mặc định.
 */
const EVT = 'hg-print-kho'
const keyOf = () => `hg-print-kho:${location.pathname.split('/').slice(0, 3).join('/')}`
function readKho(): Kho | null {
  try {
    const v = localStorage.getItem(keyOf())
    return v === 'portrait' || v === 'landscape' ? v : null
  } catch {
    return null
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVT, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Thanh nút In / Đóng (+ Xuất Excel nếu phiếu có) + chọn khổ Dọc/Ngang — tự ẩn
 * khi in (print:hidden). Thanh này cũng phát luật `@page` của trang in.
 */
export function PrintToolbar({
  exportHref,
  defaultKho = 'landscape',
}: {
  exportHref?: string
  /** Khổ mặc định của loại phiếu (khi người dùng chưa chọn lần nào). */
  defaultKho?: Kho
}) {
  const kho = useSyncExternalStore(
    subscribe,
    () => readKho() ?? defaultKho,
    () => defaultKho,
  )
  const chon = (k: Kho) => {
    try {
      localStorage.setItem(keyOf(), k)
    } catch {
      /* không nhớ được thì thôi — vẫn đổi cho lần in này qua sự kiện */
    }
    window.dispatchEvent(new Event(EVT))
  }
  const pad = kho === 'portrait' ? '12mm' : '10mm'
  // File Excel mở ra in cùng chiều với bản đang xem (route xuất đọc `kho`).
  const excelHref = exportHref
    ? `${exportHref}${exportHref.includes('?') ? '&' : '?'}kho=${kho === 'portrait' ? 'doc' : 'ngang'}`
    : undefined

  return (
    <>
      {/*
        BỎ ĐẦU/CHÂN TRANG CỦA TRÌNH DUYỆT (05/10/2026). Chrome in tiêu đề trang,
        URL, ngày giờ và số trang VÀO PHẦN LỀ của tờ giấy — đó là "thông tin web
        + ngày" dính lên phiếu gửi NCC. Lề trang = 0 thì không còn chỗ để in
        chúng; lề thật của phiếu chuyển thành padding của khung phiếu, nhân lại
        ở MỌI trang nhờ `box-decoration-break: clone`.
      */}
      <style>{`
        @page { size: A4 ${kho}; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          [data-print-sheet] {
            padding: ${pad} !important;
            max-width: none !important;
            -webkit-box-decoration-break: clone;
            box-decoration-break: clone;
          }
        }
      `}</style>
      <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
        <span className="mr-auto flex items-center gap-2 text-sm text-zinc-600">
          Khổ giấy
          <span className="inline-flex overflow-hidden rounded-md border border-zinc-300">
            {(
              [
                ['portrait', 'Dọc'],
                ['landscape', 'Ngang'],
              ] as [Kho, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kho === k}
                onClick={() => chon(k)}
                className={`px-3 py-1.5 text-sm ${
                  kho === k ? 'bg-sky-600 font-medium text-white' : 'hover:bg-zinc-50'
                }`}
              >
                {label}
              </button>
            ))}
          </span>
        </span>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Đóng
        </button>
        {excelHref && (
          <a
            href={excelHref}
            download
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            ⬇ Xuất Excel
          </a>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          🖨 In
        </button>
      </div>
    </>
  )
}
