'use client'

import { Td, Th } from '@/components/kit'
import type { Line } from '../_lib/po-line'
import { OChuNo } from './o-chu-no'
import type { DonCtx } from './useDonChungTu'

/**
 * CỘT "GHI CHÚ" TRÊN LƯỚI DÒNG HÀNG — mọi mẫu đơn, lúc tạo, sửa và xem (30/09/2026).
 *
 * Phiếu in gửi NCC của cả 12 mẫu có cột Ghi chú (`PO_PRINT_ORDER` … '@note'),
 * nhưng trên màn ô ghi chú dòng chỉ nằm trong khung "Chi tiết dòng" gập dưới
 * lưới — sửa từng dòng một, người soạn không thấy dòng nào đang có ghi chú.
 * Nay đứng thẳng trên lưới ngay sau Thành tiền, đúng thứ tự phiếu in.
 *
 * Ghi chú dòng IN LÊN PHIẾU (vd "Ghế 2-3 · Tay vịn"); ghi chú nội bộ ghi ở
 * mục Trao đổi. Trần 500 ký tự do schema (`poLineInputSchema.note`).
 */
export const NOTE_COL_WIDTH = 160

/**
 * Bề rộng tối thiểu của lưới dòng hàng: 640 cho các cột cố định + cột Ghi chú +
 * 100 mỗi ô thông số thường của mẫu (ô gọn như Đm/sp không tính — nó lấy chỗ của
 * cột tên vật tư co giãn, đo 26/09/2026).
 */
export const gridMinWidth = (normalFields: number) =>
  640 + NOTE_COL_WIDTH + normalFields * 100

export function GhiChuTh() {
  return <Th width={NOTE_COL_WIDTH}>Ghi chú</Th>
}

export function GhiChuTd({ d, l, i }: { d: DonCtx; l: Line; i: number }) {
  const { editing, patch } = d
  return (
    <Td>
      {editing ? (
        <OChuNo
          label={`Ghi chú dòng ${i + 1}`}
          value={l.note}
          placeholder="In lên phiếu NCC…"
          maxLength={500}
          onCommit={(v) => patch(i, { note: v.slice(0, 500) })}
        />
      ) : (
        <span className="block max-w-[220px] truncate" title={l.note || undefined}>
          {l.note}
        </span>
      )}
    </Td>
  )
}
