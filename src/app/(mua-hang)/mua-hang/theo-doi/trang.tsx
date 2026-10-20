'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'
import { Btn } from '@/components/kit'

/**
 * SỐ DÒNG VỪA VÙNG BẢNG (02/10/2026, chủ dự án: "gọn để vừa 1 màn hình không
 * scroll … có phân trang khi quá nhiều đơn").
 *
 * Đo THẬT trên màn đang mở, không đặt cứng 20 dòng/trang: 1536×730 (laptop
 * 125%) và 1920×1080 vừa số dòng rất khác nhau. Vùng = khung bọc bảng (flex-1);
 * trừ tiêu đề cột, chân bảng và thanh cuộn ngang (nếu bảng hẹp phải cuộn
 * ngang); chia cho chiều cao dòng cao nhất đang vẽ. Đổi cỡ cửa sổ thì tính lại.
 */
export function useSucChua(
  ref: RefObject<HTMLDivElement | null>,
  macDinh = 18,
): { cap: number; rong: number } {
  const [cap, setCap] = useState(macDinh)
  // Bề ngang vùng bảng — màn quyết ẩn cột phụ khi hẹp (tránh cuộn ngang).
  const [rong, setRong] = useState(1280)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tinh = () => {
      setRong((w) => (Math.abs(w - el.clientWidth) < 2 ? w : el.clientWidth))
      const thead = el.querySelector('thead')
      if (!thead) return // đang ở trạng thái rỗng — giữ số cũ
      const tfoot = el.querySelector('tfoot')
      const cuon = el.querySelector<HTMLElement>('.k-tscroll')
      const ngang = cuon ? cuon.offsetHeight - cuon.clientHeight : 0
      const cao = [...el.querySelectorAll('tbody tr')].map((r) => r.getBoundingClientRect().height) // prettier-ignore
      const dong = Math.max(24, ...cao)
      const n = Math.floor(
        (el.clientHeight - thead.getBoundingClientRect().height - (tfoot?.getBoundingClientRect().height ?? 0) - ngang - 1) / dong, // prettier-ignore
      )
      if (n > 1) setCap((c) => (c === n ? c : n))
    }
    tinh()
    const ro = new ResizeObserver(tinh)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return { cap, rong }
}

/** Thanh trang nằm ở thanh trạng thái đáy — không ăn thêm một hàng nào của bảng. */
export function PhanTrang({
  trang,
  soTrang,
  onTrang,
  tu,
  den,
  tong,
  donVi,
}: {
  /** Trang đang xem, đếm từ 0. */
  trang: number
  soTrang: number
  onTrang: (i: number) => void
  tu: number
  den: number
  tong: number
  /** "đơn" / "phiếu". */
  donVi: string
}) {
  if (soTrang <= 1) return <span>{`${tong} ${donVi}`}</span>
  return (
    <span className="inline-flex items-center gap-2">
      <span>{`${tu}–${den} / ${tong} ${donVi}`}</span>
      <Btn icon="truoc"
        disabled={trang <= 0}
        onClick={() => onTrang(trang - 1)}
        className="text-k-sm h-[22px] px-2"
      >
        Trước
      </Btn>
      <span aria-live="polite">{`Trang ${trang + 1}/${soTrang}`}</span>
      <Btn icon="sau"
        disabled={trang >= soTrang - 1}
        onClick={() => onTrang(trang + 1)}
        className="text-k-sm h-[22px] px-2"
      >
        Sau
      </Btn>
    </span>
  )
}
