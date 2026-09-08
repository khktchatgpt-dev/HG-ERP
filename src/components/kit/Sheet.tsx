'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Btn } from './Primitives'

/**
 * ══════════════════════════════════════════════════════════════════════════
 * TẦNG TRONG v4 — hộp thoại, xác nhận, thông báo
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Dựng vì bảng đã theo v4 nhưng bấm vào là rơi về hộp thoại v3.
 *
 * BỐN LỖI CỦA HỘP THOẠI v3, đo trên đơn PO-2026-0068 (09/09/2026):
 *
 * 1. NGHÈO NỘI DUNG. Hộp thoại chiếm 512px giữa màn để nói đúng MỘT dòng
 *    "PO-2026-0068" — không NCC, không giá trị, không số dòng. Nó vừa CHE
 *    MẤT hàng ở bảng rồi không chép lại thứ nó che.
 *
 * 2. KHÔNG NÊU HẬU QUẢ. Đường một-đơn có sẵn câu "Gửi rồi thì hết sửa thoải
 *    mái", đường HÀNG LOẠT thì bỏ trống — trong khi hàng loạt mới là chỗ sai
 *    nhiều đơn cùng lúc.
 *
 * 3. NÚT MẤT THỨ BẬC. "Huỷ" và "Gửi duyệt" cùng cỡ, cùng độ nặng.
 *
 * 4. VIỆC NGUY HIỂM VÀ VIỆC THƯỜNG GIỐNG HỆT NHAU. Duyệt đơn 16.830 USD và
 *    xoá một dòng nháp dùng chung một khung.
 */

/** Bậc hệ quả — quyết định màu, nút, và có buộc dừng lại hay không. */
export type Stakes =
  /** Làm lại được: lưu nháp, đổi bộ lọc. */
  | 'nhe'
  /** Có người khác thấy / trạng thái đổi: gửi duyệt, gửi NCC. */
  | 'vua'
  /** Mất dữ liệu hoặc ràng buộc tiền: xoá, huỷ đơn đã gửi. */
  | 'nang'

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  stakes = 'vua',
  children,
  footer,
  width = 480,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  stakes?: Stakes
  children?: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Đưa tiêu điểm vào hộp để người dùng bàn phím không lạc ra sau lớp phủ.
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="kit-v4 fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-auto p-6 pt-[8vh]"
      onMouseDown={(e) => {
        // Chỉ đóng khi bấm ĐÚNG lớp phủ. Việc nặng thì không cho đóng kiểu
        // này: người dùng kéo chọn chữ trong hộp rồi nhả tay ra ngoài là mất
        // sạch — không thể để một cú trượt tay huỷ mất việc đang khai.
        if (e.target === e.currentTarget && stakes !== 'nang') onClose()
      }}
    >
      {/* Nền mờ phải ĐỦ TỐI để hộp tách hẳn khỏi trang. Đo 09/09/2026: .34
          trên nền sáng gần như không thấy, hộp trông như một thẻ rơi giữa
          bảng — mắt không biết phần nào đang chờ mình trả lời. */}
      <div className="fixed inset-0 bg-[rgba(17,24,38,.55)]" aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        /*
          `focus:outline-none` chứ không chỉ `outline-none`: hộp có tabIndex=-1
          nên khi nhận tiêu điểm, luật focus toàn cục vẽ vòng 2px quanh NÓ và
          trông y như một ô nhập đang được chọn (đo 09/09/2026). Vòng focus
          phải dành cho thứ người dùng đi tới bằng Tab, không phải cho cả hộp.
        */
        className="relative max-w-full rounded-[var(--radius-lg)] bg-[var(--surface-card)] outline-none focus:outline-none"
        style={{ width, boxShadow: 'var(--shadow-modal)' }}
      >
        {/* Vạch trên nói bậc hệ quả TRƯỚC KHI đọc chữ — mắt bắt màu nhanh
            hơn đọc. Việc nhẹ không có vạch: không phải lúc nào cũng cần báo động. */}
        {stakes !== 'nhe' && (
          <div
            className={cn(
              'h-[3px] rounded-t-[var(--radius-lg)]',
              stakes === 'nang' ? 'bg-[var(--stop)]' : 'bg-[var(--act)]',
            )}
          />
        )}
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] leading-snug font-semibold tracking-[-.01em]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[var(--fs-sm)] leading-relaxed text-[var(--ink-2)]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>
        {children && <div className="px-5 pb-4">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--hair)] bg-[var(--surface)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * BẢNG KÊ THỨ SẮP BỊ ĐỘNG VÀO — phần v3 thiếu hẳn.
 *
 * Hộp thoại che mất hàng ở bảng thì phải CHÉP LẠI thứ nó che. Người duyệt
 * cần thấy NCC và số tiền ngay trong hộp, không phải nhớ từ giây trước.
 */
export function Affected({
  items,
  max = 6,
}: {
  items: { code: string; label?: string; amount?: string; note?: string }[]
  max?: number
}) {
  const hien = items.slice(0, max)
  const con = items.length - hien.length

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
      {hien.map((it, i) => (
        <div
          key={it.code}
          className={cn(
            'px-3 py-[7px] text-[12.5px]',
            i > 0 && 'border-t border-[var(--hair)]',
          )}
        >
          {/* HAI HÀNG, không phải một.

              Nhồi mã + tên NCC + ghi chú + tiền vào một hàng 480px thì tên
              NCC — thứ dài nhất và cũng là thứ người duyệt cần đọc — bị cắt
              còn "CÔNG …" (đo 09/09/2026). Tên nhà cung cấp là căn cứ để
              quyết định, không phải chú thích. */}
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-mono)] text-[11.5px] font-semibold text-[var(--act)]">
              {it.code}
            </span>
            {it.note && (
              <span className="text-[11px] text-[var(--ink-3)]">{it.note}</span>
            )}
            <span className="flex-1" />
            {it.amount && <span className="num shrink-0 font-semibold">{it.amount}</span>}
          </div>
          {it.label && (
            <div className="mt-[1px] leading-snug text-[var(--ink-2)]">{it.label}</div>
          )}
        </div>
      ))}
      {con > 0 && (
        <div className="border-t border-[var(--hair)] bg-[var(--surface)] px-3 py-[6px] text-[11.5px] text-[var(--ink-3)]">
          … và {con} mục nữa
        </div>
      )}
    </div>
  )
}

/**
 * HẬU QUẢ — nói thẳng cái gì đổi sau khi bấm.
 *
 * Đặt SÁT nút bấm chứ không nhét lên đầu: người dùng đọc từ trên xuống rồi
 * bấm, câu cảnh báo phải nằm ở chỗ mắt dừng lại cuối cùng.
 */
export function Consequence({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-[var(--warn)] bg-[var(--warn-wash)] py-2 pr-3 pl-3 text-[12px] leading-relaxed text-[var(--ink-2)]">
      {children}
    </p>
  )
}

/** Cặp nút chuẩn cho hộp thoại: huỷ nhạt, làm đậm, thứ bậc rõ. */
export function SheetActions({
  onCancel,
  onConfirm,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  stakes = 'vua',
  busy = false,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  stakes?: Stakes
  busy?: boolean
}) {
  return (
    <>
      <Btn onClick={onCancel}>{cancelLabel}</Btn>
      <Btn primary danger={stakes === 'nang'} onClick={onConfirm} disabled={busy}>
        {busy ? 'Đang chạy…' : confirmLabel}
      </Btn>
    </>
  )
}
