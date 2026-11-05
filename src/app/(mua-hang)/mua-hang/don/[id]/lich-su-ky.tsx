'use client'

import { Grid, GridBody, GridHead, GridRow, Td, Th } from '@/components/kit'
import { ngayGioVn } from '@/lib/date-vn'
import { vetKyDong } from '@/lib/po-review'
import type { Props } from './don-chung-tu.shared'

type Vet = NonNullable<Props['signEvents']>[number]

const TONE: Record<string, string> = {
  done: 'text-[var(--done)]',
  warn: 'text-[var(--warn)]',
  stop: 'text-[var(--stop)]',
}

/** "05/11 09:15" giờ VN — cùng chuỗi ở server và trình duyệt (không lệch múi giờ). */
const luc = (iso: string) => {
  const a = ngayGioVn(iso)
  return `${a.slice(0, 5)} ${a.slice(11)}`
}

/**
 * LỊCH SỬ KÝ của đơn (0293 · B4, bản vẽ RcqWLU7F1z33btAR97gZBo khung 5·D): mỗi
 * mốc trong sổ vết ký — gửi duyệt, trưởng phòng đã xem / trả lại, Giám đốc duyệt
 * (kể cả "duyệt khi trưởng phòng chưa xem"), rút về, mở lại… Nhãn dùng chung với
 * màn ký đơn của Giám đốc (`vetKyDong`) — hai nơi gọi một việc bằng một tên.
 */
export function LichSuKy({ events }: { events: Vet[] }) {
  if (events.length === 0) {
    return (
      <p className="text-k-sm text-[var(--ink-3)]">
        Đơn chưa từng gửi duyệt — chưa có mốc ký nào. Gửi duyệt thì mốc đầu tiên ghi ở
        đây.
      </p>
    )
  }
  return (
    <Grid minWidth={640}>
      <GridHead>
        <Th width={110}>Lúc</Th>
        <Th width={170}>Ai</Th>
        <Th width={290}>Việc</Th>
        <Th>Ghi chú</Th>
      </GridHead>
      <GridBody>
        {events.map((e, i) => {
          const v = vetKyDong(e)
          return (
            <GridRow key={`${e.created_at}-${i}`}>
              <Td>
                <span className="num">{luc(e.created_at)}</span>
              </Td>
              <Td>{e.actor_name ?? '—'}</Td>
              <Td>
                <span className={v.tone ? `font-semibold ${TONE[v.tone]}` : undefined}>
                  {v.label}
                </span>
              </Td>
              <Td>
                <span className="text-k-sm whitespace-pre-wrap text-[var(--ink-2)]">
                  {v.detail ?? ''}
                </span>
              </Td>
            </GridRow>
          )
        })}
      </GridBody>
    </Grid>
  )
}
