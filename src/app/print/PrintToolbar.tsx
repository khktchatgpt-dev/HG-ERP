'use client'

import { useEffect, useSyncExternalStore } from 'react'

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
const MM_PX = 96 / 25.4

/*
 * VỪA MỘT TỜ (16/10/2026): đơn dài tràn sang trang 2 vì thân phiếu cao hơn vùng in.
 * Đo chiều cao THẬT của thân phiếu ở đúng bề ngang trang in (trừ lề), rồi tính hệ
 * số thu nhỏ để chiều cao vừa vùng in. Đo lúc màn hình đang hiện nhưng ép bề ngang
 * về bề ngang trang in trong lúc đo, nên không phụ thuộc cửa sổ trình duyệt.
 */
function fitScale(body: HTMLElement, kho: Kho, padMm: number): number {
  const [pageW, pageH] = kho === 'portrait' ? [210, 297] : [297, 210]
  const availW = (pageW - 2 * padMm) * MM_PX
  const availH = (pageH - 2 * padMm) * MM_PX
  body.style.width = `${availW}px`
  const h = body.getBoundingClientRect().height
  body.style.width = ''
  if (h <= 0) return 1
  // Chừa 2% để làm tròn của máy in không đẩy dòng cuối sang tờ sau.
  return Math.min(1, (availH * 0.98) / h)
}

export function PrintToolbar({
  exportHref,
  defaultKho = 'landscape',
  pdfName,
  fitOnePage = false,
}: {
  exportHref?: string
  /** Khổ mặc định của loại phiếu (khi người dùng chưa chọn lần nào). */
  defaultKho?: Kho
  /** Có = nút "Lưu PDF", tên file gợi ý này (không kèm đuôi). */
  pdfName?: string
  /** Có = thu nhỏ thân phiếu cho vừa một tờ khi in (xem `fitScale`). */
  fitOnePage?: boolean
}) {
  /*
   * LƯU PDF (06/10/2026) — đi qua hộp in của trình duyệt (đích "Lưu dưới dạng
   * PDF"), không dựng PDF ở server: tờ PDF giống hệt tờ in, không phải chạy
   * Chrome ngầm trên Vercel. Chrome lấy `document.title` làm tên file gợi ý nên
   * đổi tạm tiêu đề trong lúc hộp in mở rồi trả lại.
   */
  const luuPdf = () => {
    const old = document.title
    if (pdfName) document.title = pdfName
    window.addEventListener('afterprint', () => (document.title = old), { once: true })
    window.print()
  }
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
  const padMm = kho === 'portrait' ? 12 : 10
  const pad = `${padMm}mm`
  // Bề ngang thân phiếu khi in = vùng in sau lề (khớp `fitScale`).
  const bodyW = `${(kho === 'portrait' ? 210 : 297) - 2 * padMm}mm`

  // Tính lại hệ số mỗi khi đổi khổ, và ngay trước khi in (nội dung có thể đã đổi).
  useEffect(() => {
    if (!fitOnePage) return
    const run = () => {
      const body = document.querySelector<HTMLElement>('[data-print-body]')
      if (!body) return
      document.documentElement.style.setProperty(
        '--print-fit',
        fitScale(body, kho, padMm).toFixed(4),
      )
    }
    run()
    window.addEventListener('beforeprint', run)
    return () => window.removeEventListener('beforeprint', run)
  }, [fitOnePage, kho, padMm])

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
          ${
            fitOnePage
              ? `[data-print-body] { width: ${bodyW}; margin: 0 auto; zoom: var(--print-fit, 1); }`
              : ''
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
        {pdfName && (
          <button
            type="button"
            onClick={luuPdf}
            title='Mở hộp in — chọn Đích "Lưu dưới dạng PDF"'
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            ⬇ Lưu PDF
          </button>
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
