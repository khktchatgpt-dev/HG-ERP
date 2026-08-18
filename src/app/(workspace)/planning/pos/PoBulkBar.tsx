'use client'

import { Spinner } from '@/components/erp/Spinner'
import type { Po } from './po-types'

/**
 * THANH HÀNH ĐỘNG HÀNG LOẠT — hiện khi có đơn được tích.
 *
 * Giám đốc duyệt tám đơn trước đây là tám lần mở menu ⋯, và người mua gửi năm
 * bản nháp lên duyệt cũng vậy. Cả hai đều là việc theo LÔ: quyết một lần cho cả
 * nhóm, không phải quyết tám lần giống hệt nhau.
 *
 * Nút chỉ hiện khi TOÀN BỘ phần đang tích hợp lệ cho thao tác đó, và nhãn nói
 * rõ số lượng —"Duyệt 3 đơn " chứ không phải "Duyệt ". Một nút mờ kèm dòng giải
 * thích vì sao mờ vẫn bắt người ta đọc; thà không hiện.
 *
 * Thanh dính ĐÁY màn hình: lựa chọn có thể rải khắp trang sau khi cuộn, mà nút
 * xác nhận thì phải luôn trong tầm tay.
 */
export function PoBulkBar({
  selected,
  onClear,
  onSubmitAll,
  onApproveAll,
  onOrderAll,
  canApprove,
  busy,
}: {
  selected: Po[]
  onClear: () => void
  /** Gửi GĐ duyệt — chỉ khi mọi đơn đang tích đều là nháp CỦA MÌNH. */
  onSubmitAll: (() => void) | null
  /** Duyệt — chỉ Giám đốc, và mọi đơn đang tích đều đang chờ duyệt. */
  onApproveAll: (() => void) | null
  /** Gửi NCC — mọi đơn đang tích đều đã duyệt. */
  onOrderAll: (() => void) | null
  canApprove: boolean
  busy: boolean
}) {
  if (selected.length === 0) return null
  const n = selected.length
  const btn = 'rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50'

  return (
    <div className="border-input bg-card sticky bottom-3 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2.5 shadow-lg">
      <span className="text-[13px] font-medium">
        Đã chọn <b className="tabular-nums">{n}</b> đơn
      </span>
      {busy && <Spinner size={14} />}
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />

      {onSubmitAll && (
        <button
          type="button"
          disabled={busy}
          onClick={onSubmitAll}
          className={`${btn} bg-primary hover:opacity-90`}
        >
          Gửi GĐ duyệt {n} đơn
        </button>
      )}
      {canApprove && onApproveAll && (
        <button
          type="button"
          disabled={busy}
          onClick={onApproveAll}
          className={`${btn} bg-[var(--done)] hover:opacity-90`}
        >
          Duyệt {n} đơn
        </button>
      )}
      {onOrderAll && (
        <button
          type="button"
          disabled={busy}
          onClick={onOrderAll}
          className={`${btn} bg-primary hover:opacity-90`}
        >
          Gửi NCC {n} đơn
        </button>
      )}
      {!onSubmitAll && !onOrderAll && !(canApprove && onApproveAll) && (
        <span className="text-muted-foreground text-xs">
          Các đơn đang chọn không cùng một bước — bỏ bớt để làm hàng loạt.
        </span>
      )}

      <button
        type="button"
        onClick={onClear}
        className="text-muted-foreground border-input hover:bg-muted ml-1 rounded-md border px-2.5 py-1.5 text-xs"
      >
        Bỏ chọn
      </button>
    </div>
  )
}
