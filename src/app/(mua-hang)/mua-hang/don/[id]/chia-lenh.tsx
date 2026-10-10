'use client'

import { CellHint, Td, Th } from '@/components/kit'
import {
  chiaText,
  lenhNgan,
  loiChia,
  splitOf,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-lsx-chia'
import type { Line } from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import type { DonCtx } from './useDonChungTu'

/**
 * CỘT "CHIA LỆNH" CỦA LƯỚI DÒNG HÀNG — chỉ có khi đơn gộp từ 2 lệnh (10/10/2026).
 *
 * Trả lời "gộp lệnh khi mua thì lệnh nào bao nhiêu" ngay trên lưới, cả lúc xem
 * lẫn lúc soạn. Trước đây số chia nằm khuất trong khay chi tiết dòng và 113/113
 * dòng của 11 đơn gộp chưa chia — dòng chưa chia bị tính trọn cho lệnh chính.
 * Sửa số: bấm ô → mở khay chi tiết của dòng (các ô SL theo từng lệnh).
 */
export function ChiaLenhTh() {
  return <Th>Chia lệnh</Th>
}

export function ChiaLenhTd({ d, l, i }: { d: DonCtx; l: Line; i: number }) {
  const { lsxsOfPo, editing, setPick, setDetailOpen } = d
  const mo = editing
    ? () => {
        setPick(i)
        setDetailOpen(true)
      }
    : undefined
  if (!(Number(l.qty) > 0)) return <Td><span className="text-[var(--ink-3)]">—</span></Td> // prettier-ignore
  const sp = splitOf(l)
  const loi = loiChia(l)
  const chinh = lsxsOfPo[0]
  const full = chiaText(l, lsxsOfPo)
  return (
    <Td tone={loi || sp.length === 0 ? 'warn' : undefined}>
      {sp.length === 0 ? (
        <CellHint
          tone="warn"
          onClick={mo}
          title={`Dòng chưa chia nên đang tính TRỌN cho lệnh chính ${chinh?.code ?? ''} — lệnh phụ thấy như chưa đặt. ${editing ? 'Bấm để chia, hoặc dùng nút "Chia theo nhu cầu".' : 'Sửa đơn để chia.'}`}
        >
          chưa chia · cả dòng → {lenhNgan(chinh?.code ?? '?')}
        </CellHint>
      ) : (
        <span
          className="num block max-w-[220px] truncate"
          style={{ textAlign: 'left' }}
          title={full}
          onClick={mo}
        >
          {full}
        </span>
      )}
      {loi && (
        <CellHint tone="warn" onClick={mo} title={`${loi} — bấm để sửa phần chia`}>
          {loi}
        </CellHint>
      )}
    </Td>
  )
}

/** Ô chân bảng tương ứng — để trống. */
export function ChiaLenhFoot() {
  return <Td />
}
