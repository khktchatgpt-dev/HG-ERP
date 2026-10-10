'use client'

import { CellHint, Td, Th } from '@/components/kit'
import {
  loiChia,
  nhanLenh,
  splitOf,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-lsx-chia'
import type { Line } from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import type { DonCtx } from './useDonChungTu'

/**
 * CỘT "LỆNH" CỦA LƯỚI DÒNG HÀNG — chỉ có khi đơn gộp từ 2 lệnh; CHỈ ĐỂ NHÌN
 * (bản vẽ Chia lệnh A, Q1 10/10/2026). Sửa ở MỘT chỗ là mục "Chia lệnh" ngay dưới
 * lưới — bấm ô này là nhảy tới đúng dòng ở đó. Hẹp (~96px) để trả chỗ cho tên
 * vật tư: bản trước ghi "08 MX 200 · 09 MX 88" ăn 157px, tên vật tư còn 191px.
 */
export function ChiaLenhTh() {
  return <Th width={96}>Lệnh</Th>
}

export function ChiaLenhTd({ d, l, i }: { d: DonCtx; l: Line; i: number }) {
  const { lsxsOfPo, setPick } = d
  const toi = () => {
    setPick(i)
    document.getElementById('chia-lenh')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) // prettier-ignore
  }
  if (!(Number(l.qty) > 0)) return <Td><span className="text-[var(--ink-3)]">—</span></Td> // prettier-ignore
  const sp = splitOf(l)
  const loi = loiChia(l)
  const nhan = nhanLenh(lsxsOfPo)
  if (sp.length === 0) {
    return (
      <Td tone="warn">
        <CellHint
          tone="warn"
          onClick={toi}
          title={`Dòng chưa chia — đang tính trọn cho lệnh chính ${lsxsOfPo[0]?.code ?? ''}. Bấm để chia ở mục Chia lệnh.`}
        >
          chưa chia ↓
        </CellHint>
      </Td>
    )
  }
  const tong = sp.reduce((s, x) => s + x.qty, 0)
  const lech = Math.round((Number(l.qty) - tong) * 1e4) / 1e4
  return (
    <Td tone={loi ? (lech < 0 ? 'stop' : 'warn') : undefined}>
      <button
        type="button"
        onClick={toi}
        title={`${lsxsOfPo
          .flatMap((x) => {
            const q = sp.find((s) => s.production_order_id === x.id)?.qty
            return q ? [`${x.code}: ${q.toLocaleString('vi-VN')}`] : []
          })
          .join('\n')}\nBấm để xem / sửa ở mục Chia lệnh.`}
        className="num grid cursor-pointer gap-px text-left text-[12px] leading-tight"
      >
        {lsxsOfPo.flatMap((x) => {
          const q = sp.find((s) => s.production_order_id === x.id)?.qty
          return q
            ? [
                <span key={x.id} className="whitespace-nowrap">
                  <span className="mr-1 text-[var(--ink-3)]">{nhan.get(x.id)}</span>
                  {q.toLocaleString('vi-VN')}
                </span>,
              ]
            : []
        })}
      </button>
      {loi && (
        <CellHint tone="warn" onClick={toi} title={loi}>
          {lech < 0
            ? `thừa ${(-lech).toLocaleString('vi-VN')}`
            : `thiếu ${lech.toLocaleString('vi-VN')}`}
        </CellHint>
      )}
    </Td>
  )
}

/** Ô chân bảng tương ứng — để trống. */
export function ChiaLenhFoot() {
  return <Td />
}
