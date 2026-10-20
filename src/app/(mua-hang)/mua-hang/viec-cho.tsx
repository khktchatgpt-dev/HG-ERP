'use client'

import { useRouter } from 'next/navigation'
import { Cell, Code, GroupRow, Num, Row, THead, Table } from '@/components/kit'
import { SUPPLY_TODO, SUPPLY_TODO_KINDS, type SupplyTodoKind } from '@/lib/supply-watch'
import { henGiaoText } from '@/lib/hen-giao-text'
import { tenNccGon } from '@/lib/theo-doi-loc'
import type { Todo } from './BanLamViecScreen'

/** Tiền: đồng thì bỏ chữ "VND" (cột đã ghi ₫), ngoại tệ thì ghi mã. */
const tien = (n: number, cur: string) =>
  n > 0 ? (cur === 'VND' ? n.toLocaleString('vi-VN') : `${n.toLocaleString('vi-VN')} ${cur}`) : '' // prettier-ignore

/**
 * VIỆC CHỜ — NHÓM THEO LOẠI VIỆC (05/10/2026, bản vẽ M1 canvas "Cung ứng ·
 * Hàng về" › Bản 10, chủ dự án duyệt).
 *
 * Bảng cũ để phẳng 18 dòng và lặp cột "Việc phải làm" ("Gọi NCC chốt đơn +
 * ngày giao" ×9). Nay câu việc viết MỘT lần ở đầu nhóm kèm lý do, mỗi nhóm một
 * `<tbody>` (GroupRow = rowgroup). Trong nhóm: hẹn giao sớm nhất / trễ nhất
 * trước. Bấm cả dòng là mở đơn.
 */
export function ViecChoBang({
  todos,
  mine,
  today,
}: {
  /** Việc đã lọc theo làn đang chọn (một loại, hoặc tất cả). */
  todos: Todo[]
  /** Xem bàn của một người — ẩn cột Phụ trách. */
  mine: boolean
  today: string
}) {
  const router = useRouter()
  const nhom = SUPPLY_TODO_KINDS.map((k) => ({
    k,
    rows: todos
      .filter((t) => t.kind === k)
      .sort((a, b) => (a.expected_at ?? '9999').localeCompare(b.expected_at ?? '9999')),
  })).filter((g) => g.rows.length > 0)
  const soCot = mine ? 6 : 7

  return (
    <Table label="Việc chờ, nhóm theo loại việc">
      <THead>
        <th>Đơn</th>
        <th>Nhà cung cấp</th>
        {!mine && <th>Phụ trách</th>}
        <th>Lệnh SX</th>
        <th>Hẹn giao</th>
        <th style={{ textAlign: 'right' }}>Giá trị (₫)</th>
        <th aria-label="Mở đơn" />
      </THead>
      {nhom.map((g) => (
        <tbody key={g.k}>
          <GroupRow
            name={SUPPLY_TODO[g.k as SupplyTodoKind].action}
            meta={`${g.rows.length} đơn · ${SUPPLY_TODO[g.k as SupplyTodoKind].why}`}
            cols={soCot}
          />
          {g.rows.map((t) => {
            const hen = henGiaoText(t.expected_at, today)
            return (
              <Row key={t.id} onClick={() => router.push(`/mua-hang/don/${t.id}`)}>
                <Cell>
                  <Code as="a" href={`/mua-hang/don/${t.id}`}>
                    {t.code}
                  </Code>
                </Cell>
                <Cell grow title={t.supplier}>
                  <span className="truncate">{tenNccGon(t.supplier)}</span>
                </Cell>
                {!mine && <Cell muted>{t.owner.split(' ').slice(-2).join(' ')}</Cell>}
                <Cell muted>
                  <span className="num">{t.lsx ?? 'Ngoài lệnh'}</span>
                </Cell>
                <Cell>
                  <span
                    className={
                      hen.tone === 'stop'
                        ? 'num font-semibold whitespace-nowrap text-[var(--stop)]'
                        : hen.tone === 'warn'
                          ? 'num font-semibold whitespace-nowrap text-[var(--warn)]'
                          : 'num whitespace-nowrap'
                    }
                  >
                    {hen.text}
                  </span>
                </Cell>
                <Cell num>
                  <Num value={tien(t.total, t.currency)} />
                </Cell>
                <Cell muted>
                  <span aria-hidden>›</span>
                </Cell>
              </Row>
            )
          })}
        </tbody>
      ))}
    </Table>
  )
}
