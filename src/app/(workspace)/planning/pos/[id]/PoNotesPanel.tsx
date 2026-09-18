'use client'

import { DocNotesPanel } from '@/components/doc/DocNotesPanel'

/**
 * KHỐI TRAO ĐỔI của ĐƠN ĐẶT VẬT TƯ — lớp mỏng trên `DocNotesPanel` dùng chung.
 *
 * Giữ lại tên và chữ ký cũ để hai màn đang gọi nó (`PoDetailScreen` và
 * `DonChungTuScreen`) không phải sửa; phần khác nhau duy nhất giữa các loại
 * chứng từ là CÂU NÓI khi chưa ai ghi gì, nên nó nằm ở đây.
 */
export function PoNotesPanel({
  poId,
  marks,
  meId,
  meName,
  followerNames,
}: {
  poId: string
  /** Mốc máy ghi của đơn — trộn chung dòng với ghi chú của người. */
  marks: { key: string; at: string | null; label: string; actor?: string | null }[]
  meId: string
  meName: string
  followerNames: string[]
}) {
  return (
    <DocNotesPanel
      docType="po"
      docId={poId}
      marks={marks}
      meId={meId}
      meName={meName}
      followerNames={followerNames}
      emptyHint={
        <>
          Chưa ai ghi gì về đơn này. Ghi lại những gì đang xảy ra ngoài hệ thống — NCC hẹn
          lại ngày nào, ai đã gọi cho ai — để ba tháng nữa còn tra được.
        </>
      }
    />
  )
}
