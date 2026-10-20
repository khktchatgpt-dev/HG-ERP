'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Empty,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  Pick,
  Tag,
  Td,
  Th,
  WorkTile,
  WorkTiles,
} from '@/components/kit'
import type { TeamJobCard } from '@/modules/dept/production/jobs.service'

/**
 * M5 — VIỆC CỦA TỔ (Khuôn A). Bề mặt XƯỞNG.
 *
 * Trả lời: "tổ tôi đang nợ việc gì?".
 *
 * **CHỈ ĐỌC** — chủ dự án chốt 18/09/2026: *"tổ trưởng chỉ xem để biết tình
 * hình"*. Bản cũ có nút "Xong" (xác nhận xong công đoạn), ô ghi chú và đường
 * ép-qua kèm lý do; tất cả đã bỏ khỏi màn này.
 *
 * VÌ SAO BỎ HẲN CHỨ KHÔNG CHỈ ẨN: một nút chỉ hiện với vài người trên màn mà
 * cả tổ cùng nhìn là mời người ta nhờ nhau bấm hộ. Sổ sản lượng là căn cứ tính
 * lương; đường ghi chỉ nên có MỘT, và nó nằm ở màn Ghi sản lượng của thống kê.
 *
 * MÀN NÀY THƯỜNG MỞ TRÊN MÀN NHỎ ở xưởng, nên: không bộ lọc dài, không cột
 * thừa, ô việc bấm một chạm là lọc xong.
 */

export type TeamCard = TeamJobCard & { image_url: string | null }

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (d: string | null) =>
  d ? d.slice(0, 10).split('-').reverse().join('/') : '—'

const STATUS: Record<string, { label: string; tone: 'neutral' | 'warn' | 'done' }> = {
  todo: { label: 'Chưa làm', tone: 'neutral' },
  doing: { label: 'Đang làm', tone: 'warn' },
  done: { label: 'Đã xong', tone: 'done' },
}

/** Khung nhìn — cùng một hàm vừa đếm vừa lọc (lời hứa của con số). */
const VIEWS: {
  id: string
  label: string
  hint: string
  test: (c: TeamCard) => boolean
}[] = [
  {
    id: 'open',
    label: 'Việc còn phải làm',
    hint: 'Chưa làm hoặc đang làm dở',
    test: (c) => c.status !== 'done',
  },
  {
    id: 'late',
    label: 'Thuộc lệnh trễ hạn',
    hint: 'Lệnh đã quá ngày xuất mà việc chưa xong',
    test: (c) => c.status !== 'done' && c.late === 'overdue',
  },
  {
    id: 'doing',
    label: 'Đang làm dở',
    hint: 'Đã có số ghi nhưng chưa đủ',
    test: (c) => c.status === 'doing',
  },
  {
    id: 'done',
    label: 'Đã xong',
    hint: 'Đủ số, không còn nợ',
    test: (c) => c.status === 'done',
  },
]

export function ViecCuaToScreen({
  teamId,
  teamName,
  cards,
  teams,
  canPick,
}: {
  teamId: string | null
  teamName: string | null
  cards: TeamCard[]
  teams: { id: string; name: string }[]
  /** Quản đốc/GĐ soi tổ khác; tổ viên thì không có ô chọn. */
  canPick: boolean
}) {
  const router = useRouter()
  const [view, setView] = useState('open')

  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.id, cards.filter(v.test).length])),
    [cards],
  )

  const shown = useMemo(() => {
    const test = VIEWS.find((v) => v.id === view)?.test ?? (() => true)
    // Trễ hạn lên trước, rồi hạn xuất gần nhất — việc gấp nằm trên đầu.
    return cards
      .filter(test)
      .sort(
        (a, b) =>
          (a.late === 'overdue' ? 0 : 1) - (b.late === 'overdue' ? 0 : 1) ||
          (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
      )
  }, [cards, view])

  return (
    <div className="kit flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-k-title font-semibold text-[var(--ink)]">
          Việc của {teamName ?? 'tổ'}
        </h1>
        {canPick && teams.length > 0 && (
          <Pick
            label="Xem tổ"
            value={teamId ?? ''}
            onChange={(v) => router.push(`/to?team=${v}`)}
            width={190}
            options={[
              { value: '', label: '— chọn tổ —' },
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        )}
        <span className="text-k-sm ml-auto text-[var(--ink-3)]">
          Màn chỉ để XEM — số liệu do thống kê ghi ở sổ sản lượng.
        </span>
      </div>

      <WorkTiles>
        {VIEWS.map((v) => (
          <WorkTile
            key={v.id}
            label={v.label}
            count={counts[v.id] ?? 0}
            hint={v.hint}
            onClick={() => setView(v.id)}
            on={view === v.id}
            tone={
              // Số 0 KHÔNG tô màu: "trễ hạn 0" là tin mừng, tô đỏ làm người ta
              // hoảng vô cớ.
              (counts[v.id] ?? 0) === 0
                ? 'neutral'
                : v.id === 'late'
                  ? 'stop'
                  : v.id === 'done'
                    ? 'done'
                    : 'warn'
            }
            strong={v.id === 'open'}
          />
        ))}
      </WorkTiles>

      {!teamId ? (
        // Tài khoản không gắn phòng ban (quản đốc, GĐ, admin) — KHÔNG trả về
        // sớm ở đầu hàm: làm thế thì ô chọn tổ ở trên cũng biến mất và họ hết
        // đường soi tổ nào cả.
        <Empty
          headline="Chưa chọn tổ nào"
          reason={
            canPick
              ? 'Tài khoản của bạn không thuộc tổ nào, nên hệ thống không tự đoán được xem tổ nào.'
              : 'Tài khoản chưa gắn phòng ban, nên hệ thống không biết lấy việc của tổ nào ra.'
          }
          next={
            <span className="text-[var(--ink-3)]">
              {canPick
                ? 'Chọn tổ ở ô “Xem tổ” phía trên.'
                : 'Nhờ quản trị gán phòng ban cho tài khoản.'}
            </span>
          }
        />
      ) : shown.length === 0 ? (
        <Empty
          headline="Không có việc nào ở khung nhìn này"
          reason="Con số trên ô đang là 0 nên bảng trống là đúng, không phải hỏng."
          next={<Btn onClick={() => setView('open')}>Xem việc còn phải làm</Btn>}
        />
      ) : (
        <Grid minWidth={860}>
          <GridHead>
            <Th width={130}>Lệnh</Th>
            <Th width={200}>Sản phẩm</Th>
            <Th>Công đoạn</Th>
            <Th num>Cần</Th>
            <Th num>Đạt</Th>
            <Th num>Còn</Th>
            <Th>Hạn xuất</Th>
            <Th>Tình trạng</Th>
          </GridHead>
          <GridBody>
            {shown.map((c) => {
              const remain = Math.max(0, c.progress.needed - c.progress.done)
              return (
                <GridRow key={c.id}>
                  <Td>
                    <b className="num">{c.lsx_code}</b>
                    <span className="text-k-sm mt-0.5 block text-[var(--ink-3)]">
                      {c.customer_name}
                    </span>
                  </Td>
                  <Td>
                    <span className="num">{c.product_code}</span>
                    <span className="text-k-sm mt-0.5 block text-[var(--ink-3)]">
                      {c.product_name}
                    </span>
                  </Td>
                  <Td>{c.stage_label}</Td>
                  <Td num>
                    {/* Chưa định hình chi tiết thì KHÔNG có mẫu số để so — nói
                        thẳng là chưa biết, đừng in số 0 như thể đã đo. */}
                    {c.progress.has_components ? fmt(c.progress.needed) : 'chưa rõ'}
                  </Td>
                  <Td num>{fmt(c.progress.done)}</Td>
                  <Td num tone={remain > 0 ? 'warn' : 'done'}>
                    {c.progress.has_components ? (remain > 0 ? fmt(remain) : 'đủ') : ''}
                  </Td>
                  <Td num tone={c.late === 'overdue' ? 'stop' : undefined}>
                    {fmtDate(c.ship_date)}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      <Tag tone={STATUS[c.status]?.tone ?? 'neutral'}>
                        {STATUS[c.status]?.label ?? c.status}
                      </Tag>
                      {c.late === 'overdue' && <Tag tone="stop">lệnh trễ</Tag>}
                    </span>
                  </Td>
                </GridRow>
              )
            })}
          </GridBody>
        </Grid>
      )}
    </div>
  )
}
