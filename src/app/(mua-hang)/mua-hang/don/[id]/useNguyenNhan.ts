'use client'

import { useState } from 'react'
import { causeBlock, defaultLsxPick, type AdjCause } from '@/lib/po-adjust-cause'

/**
 * State của khối "Nguyên nhân" trong hộp Áp dụng điều chỉnh (0227, 07/10/2026).
 *
 * Tách khỏi `useDonChungTu` (file đã chạm trần dòng). `lsx` = null nghĩa là
 * người mua CHƯA đụng ô lệnh → dùng gợi ý `defaultLsxPick` (đơn gắn đúng một
 * lệnh thì chọn sẵn); đã đụng thì giữ đúng lựa chọn của họ, kể cả rỗng.
 */
export function useNguyenNhan() {
  const [note, setNote] = useState('')
  const [cause, setCause] = useState<AdjCause | null>(null)
  const [lsx, setLsx] = useState<string[] | null>(null)

  /** Lệnh đang chọn, tính trên danh sách lệnh đơn đang gắn. */
  const pickedLsx = (linked: readonly string[]) => lsx ?? defaultLsxPick(linked)

  return {
    note,
    setNote,
    cause,
    setCause,
    pickedLsx,
    setLsx,
    /** Câu chặn của hộp — null là áp dụng được. */
    block: (linked: readonly string[]) =>
      causeBlock({ cause, lsxIds: pickedLsx(linked), note }),
    reset: () => {
      setNote('')
      setCause(null)
      setLsx(null)
    },
  } as const
}

export type NguyenNhanState = ReturnType<typeof useNguyenNhan>
