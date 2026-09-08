'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Num,
  Row,
  ScreenFrame,
  Table,
  THead,
  WorkLanes,
  showMoney,
  type Tone,
} from '@/components/kit'
import { SUPPLY_TODO, groupTodos, type SupplyTodoKind } from '@/lib/supply-watch'
import type { WatchPo } from '../_data/watch'

/**
 * CHỜ TÔI XỬ LÝ — bản kit v4.
 *
 * Vì sao chọn màn này làm màn đầu tiên áp v4 (08/09/2026): nó ĐÚNG là hàng
 * đợi việc — thứ mà `WorkLanes` sinh ra để làm — nên áp vào là kiểm được
 * giả định cốt lõi của kit mà không đụng màn nghiệp vụ nặng.
 *
 * ĐO ĐƯỢC TRÊN BẢN CŨ (65 đơn, màn 1500×1000):
 *   · mỗi đơn chiếm HAI dòng, ~69px → chỉ thấy 10/65 đơn, phải cuộn 6,5 màn;
 *   · các nhóm việc xếp DỌC thành từng thẻ, nên muốn biết nhóm "Quá hẹn" có
 *     bao nhiêu đơn phải cuộn xuống tìm — đúng lúc cần nhất thì phải đi tìm;
 *   · "Của tôi / Cả phòng" và các nhóm việc là hai tầng lọc rời nhau, người
 *     dùng phải ghép trong đầu.
 *
 * BẢN NÀY: nhóm việc thành LANE có số đếm ngay đầu màn (thấy hết mức khẩn mà
 * không cuộn), mỗi đơn một dòng bảng ~34px, chọn phạm vi bằng chip cùng hàng
 * lọc. Câu "việc phải làm" của nhóm nằm ở dải ngay dưới lane, không lặp lại
 * ở từng dòng.
 *
 * GIỮ NGUYÊN lõi nghiệp vụ: `groupTodos` và `SUPPLY_TODO` là nguồn duy nhất
 * — bản cũ và bản mới phải phân loại y hệt nhau, khác nhau chỉ ở cách bày.
 */

/** Tone của lõi cũ có 'primary'/'muted'; kit v4 chỉ nhận 4 tone vòng đời. */
const TONE: Record<(typeof SUPPLY_TODO)[SupplyTodoKind]['tone'], Tone> = {
  stop: 'stop',
  warn: 'warn',
  primary: 'neutral',
  muted: 'neutral',
}

export function TodoScreenV4({
  pos,
  meId,
  today,
  canEdit,
}: {
  pos: WatchPo[]
  meId: string | null
  today: string
  canEdit: boolean
}) {
  const [scope, setScope] = useState<'mine' | 'all'>(meId ? 'mine' : 'all')
  const [kind, setKind] = useState<SupplyTodoKind | null>(null)

  const rows = useMemo(
    () => (scope === 'mine' && meId ? pos.filter((p) => p.assigned_to === meId) : pos),
    [pos, scope, meId],
  )
  const groups = useMemo(() => groupTodos(rows, today), [rows, today])

  const mineCount = useMemo(
    () =>
      meId
        ? groupTodos(
            pos.filter((p) => p.assigned_to === meId),
            today,
          ).reduce((n, g) => n + g.rows.length, 0)
        : 0,
    [pos, meId, today],
  )
  const allCount = useMemo(
    () => groupTodos(pos, today).reduce((n, g) => n + g.rows.length, 0),
    [pos, today],
  )

  // Lane dựng TỪ groupTodos, không tự lọc lại: hai đường tính thì sớm muộn
  // lệch nhau và hai màn nói hai chuyện về cùng một đơn.
  const lanes = groups.map((g) => ({
    id: g.kind,
    label: SUPPLY_TODO[g.kind].label,
    tone: TONE[SUPPLY_TODO[g.kind].tone],
    rows: g.rows,
  }))
  const active = kind && lanes.some((l) => l.id === kind) ? kind : (lanes[0]?.id ?? null)
  const lane = lanes.find((l) => l.id === active)
  const meta = active ? SUPPLY_TODO[active] : null

  return (
    <ScreenFrame>
      <div className="kit-v4 flex min-h-0 flex-1 flex-col">
        {/* Đầu màn: danh tính + hành động ở góc phải theo chuẩn ERP */}
        <div className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] pt-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold tracking-[.09em] text-[var(--fs-micro)] text-[var(--ink-3)] uppercase">
                Cung ứng
              </div>
              <h1 className="mt-[3px] font-semibold tracking-[-.015em] text-[var(--fs-title)]">
                Chờ tôi xử lý
              </h1>
              <p className="mt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
                Xếp theo mức khẩn — mỗi đơn chỉ nằm ở một nhóm.
              </p>
            </div>
            {canEdit && (
              <Btn primary href="/planning/pos/new" className="shrink-0">
                Tạo phiếu mua
              </Btn>
            )}
          </div>

          {lanes.length > 0 && (
            <WorkLanes
              lanes={lanes}
              activeId={active ?? ''}
              onPick={(id) => setKind(id as SupplyTodoKind)}
            />
          )}
        </div>

        {/* Câu VIỆC PHẢI LÀM của nhóm đang xem — nói một lần ở đây, không lặp
          xuống từng dòng như bản cũ. */}
        {meta && (
          <div className="flex items-center gap-3 border-b border-[var(--warn-line)] bg-[var(--warn-wash)] px-[var(--gutter)] py-[9px] text-[12.5px]">
            <span className="shrink-0 text-[10.5px] font-bold tracking-[.06em] text-[var(--warn)] uppercase">
              {meta.action}
            </span>
            <span className="text-[var(--ink-2)]">{meta.why}</span>
          </div>
        )}

        <FilterBar>
          <Chip on={scope === 'mine'} count={mineCount} onClick={() => setScope('mine')}>
            Của tôi
          </Chip>
          <Chip on={scope === 'all'} count={allCount} onClick={() => setScope('all')}>
            Cả phòng
          </Chip>
          <div className="flex-1" />
          <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
            Đang xem <b className="num text-[var(--act)]">{lane?.rows.length ?? 0}</b> đơn
          </span>
        </FilterBar>

        {!lane || lane.rows.length === 0 ? (
          <Empty
            headline={
              scope === 'mine' && allCount > 0 ? 'Bạn không có việc nào' : 'Sạch việc'
            }
            reason={
              scope === 'mine'
                ? allCount > 0
                  ? // Bản cũ từng hiện "Sạch việc" trong khi cả phòng còn 64 đơn —
                    // trưởng phòng mở ra tưởng hết việc thật.
                    `Không đơn nào của bạn đang chờ, nhưng cả phòng còn ${allCount} việc.`
                  : 'Không đơn nào của bạn đang chờ gửi, chờ hẹn ngày hay quá hạn.'
                : 'Cả phòng không còn đơn nào tồn đọng.'
            }
            next={
              <>
                {scope === 'mine' && allCount > 0 && (
                  <Btn primary onClick={() => setScope('all')}>
                    Xem {allCount} việc của cả phòng
                  </Btn>
                )}
                <Btn href="/planning/pos">Xem toàn bộ phiếu mua</Btn>
              </>
            }
          />
        ) : (
          /*
          KHÔNG có cột "Trạng thái": một lane = đúng MỘT loại việc, nên cột đó
          chép lại tên lane xuống cả 65 dòng. Cột chỉ có một giá trị cho cả
          bảng là một câu về CẢ MÀN, không phải một cột — nói một lần ở lane
          và ở dải việc phải làm là đủ.
        */
          <Table>
            <THead>
              <th style={{ width: 120 }}>Số đơn</th>
              <th>Nhà cung cấp</th>
              <th style={{ width: 150 }}>Lệnh sản xuất</th>
              <th style={{ width: 160 }}>Người theo dõi</th>
              <th style={{ width: 92 }}>Hẹn giao</th>
              <th className="num" style={{ width: 96 }}>
                Về / tổng
              </th>
              <th className="num" style={{ width: 124 }}>
                Tiền hàng
              </th>
            </THead>
            <tbody>
              {lane.rows.map((po) => (
                <Row key={po.id} onClick={() => undefined}>
                  <Cell>
                    <Code as="a" href={`/planning/pos/${po.id}`}>
                      {po.code}
                    </Code>
                  </Cell>
                  <Cell grow>{po.supplier_name}</Cell>
                  <Cell muted>{po.lsx_code ?? '—'}</Cell>
                  <Cell muted>{po.assignee_name ?? '—'}</Cell>
                  <Cell muted>
                    {po.expected_at ? (
                      new Date(po.expected_at).toLocaleDateString('vi-VN')
                    ) : (
                      <span className="text-[var(--warn)]">chưa hẹn</span>
                    )}
                  </Cell>
                  <Cell num>
                    <span className="num text-[var(--fs-num-sm)] text-[var(--ink-2)]">
                      {po.lines_done}/{po.lines_total}
                    </span>
                  </Cell>
                  <Cell num>
                    <Num value={showMoney(po.total)} strong zero="zero" />
                    <span className="ml-1 text-[10px] text-[var(--ink-3)]">
                      {po.currency}
                    </span>
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </ScreenFrame>
  )
}
