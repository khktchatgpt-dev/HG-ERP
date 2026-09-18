'use client'

import { useMemo, useState } from 'react'
import {
  MEETING_LEVEL,
  MEETING_LEVELS,
  MEETING_STOP_DAYS,
  type MeetingOwner,
  type MeetingRiskLevel,
} from '@/lib/supply-meeting'
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
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'

export type YeuCauRow = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  ship_date: string | null
  materials_due_at: string | null
  products: number
  posTotal: number
  posUnsent: number
  posOpen: number
  posLate: number
  level: MeetingRiskLevel
  reason: string
  owner: MeetingOwner
  action: string
}

/** `MEETING_LEVEL.tone` có 'muted'/'primary'; `Tag` của kit chỉ nhận 4 tone. */
const TONE: Record<string, 'stop' | 'warn' | 'done' | 'neutral'> = {
  stop: 'stop',
  warn: 'warn',
  done: 'done',
  primary: 'neutral',
  muted: 'neutral',
}

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

function conLai(iso: string | null, today: string): number | null {
  if (!iso) return null
  const d = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((d(iso) - d(today)) / 86_400_000)
}

export function YeuCauScreen({
  rows,
  today,
  canEdit,
}: {
  rows: YeuCauRow[]
  today: string
  canEdit: boolean
}) {
  const [q, setQ] = useState('')
  const [muc, setMuc] = useState<MeetingRiskLevel | 'toi' | 'all'>('all')

  const dem = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, toi: 0 }
    for (const r of rows) {
      c[r.level] = (c[r.level] ?? 0) + 1
      if (r.owner === 'Cung ứng') c.toi++
    }
    return c
  }, [rows])

  const kept = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (
      rows
        .filter((r) => {
          if (muc === 'toi' && r.owner !== 'Cung ứng') return false
          if (muc !== 'toi' && muc !== 'all' && r.level !== muc) return false
          if (!needle) return true
          return [r.code, r.customer_name, ...r.order_codes]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle))
        })
        /*
        KHẨN XẾP TRƯỚC, cùng mức thì MỐC GẦN trước — đúng thứ tự ba trang Họp
        và file Excel họp. Xếp theo mã lệnh thì màn này thành danh bạ: người mua
        phải đọc hết 14 dòng mới biết nên động vào cái nào.
      */
        .sort((a, b) => {
          const d = MEETING_LEVEL[a.level].order - MEETING_LEVEL[b.level].order
          if (d !== 0) return d
          const da = a.materials_due_at ?? a.ship_date ?? '9999'
          const db = b.materials_due_at ?? b.ship_date ?? '9999'
          return da < db ? -1 : da > db ? 1 : 0
        })
    )
  }, [rows, q, muc])

  const nhanMuc =
    muc === 'all'
      ? 'tất cả'
      : muc === 'toi'
        ? 'chờ Cung ứng'
        : MEETING_LEVEL[muc].label.toLowerCase()

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Vật tư theo lệnh"
        facts={[
          { label: 'Lệnh đang chạy', value: String(rows.length) },
          {
            label: 'Chờ Cung ứng',
            value: String(dem.toi ?? 0),
            tone: (dem.toi ?? 0) > 0 ? 'warn' : 'neutral',
          },
          {
            label: 'Nguy cơ dừng SX',
            value: String(dem.stop ?? 0),
            tone: (dem.stop ?? 0) > 0 ? 'stop' : 'neutral',
          },
        ]}
        actions={
          <>
            {/*
              HAI BÁO CÁO ĐÃ CÓ SẴN, khu mới chỉ thiếu nút. `hop-report` (Tổng
              hợp · Tình trạng lệnh · Việc cần quyết định) là file phòng cầm đi
              họp sản xuất — trước 15/09/2026 nó chỉ gọi được từ khu cũ, nên ai
              chuyển sang khu mới là mất luôn thứ họ dùng hằng tuần.
            */}
            <Btn icon="excel" href="/api/dept/supply/hop-report">
              Excel họp
            </Btn>
            {canEdit && (
              <Btn primary icon="them" href="/mua-hang/don/moi">
                + Soạn đơn mua
              </Btn>
            )}
          </>
        }
      />

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm mã lệnh, khách hoặc mã đơn hàng…"
          width={300}
        />
        <Chip
          on={muc === 'toi'}
          count={dem.toi ?? 0}
          onClick={() => setMuc(muc === 'toi' ? 'all' : 'toi')}
        >
          Chờ tôi xử lý
        </Chip>
        {MEETING_LEVELS.map((k) => (
          <Chip
            key={k}
            on={muc === k}
            count={dem[k] ?? 0}
            onClick={() => setMuc(muc === k ? 'all' : k)}
          >
            {MEETING_LEVEL[k].label}
          </Chip>
        ))}
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline={`Không có lệnh nào ở khung nhìn “${nhanMuc}”`}
          reason={
            rows.length === 0
              ? 'Chưa có lệnh sản xuất nào đang chạy. Kế hoạch SX phát lệnh thì nó hiện ở đây.'
              : `Trong ${rows.length} lệnh đang chạy, không lệnh nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
          }
          next={
            <Btn
              primary
              onClick={() => {
                setQ('')
                setMuc('all')
              }}
            >
              Xem cả {rows.length} lệnh
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Lệnh</th>
            <th>Khách · sản phẩm</th>
            <th>Mốc vật tư</th>
            <th>Vướng gì</th>
            <th>Ai cầm bóng</th>
            <th style={{ textAlign: 'right' }}>Đơn mua</th>
          </THead>
          <tbody>
            {kept.map((r) => {
              const moc = r.materials_due_at ?? r.ship_date
              const con = conLai(moc, today)
              return (
                <Row key={r.id}>
                  <Cell pin>
                    <span className="flex items-center gap-2">
                      {/*
                        Ở LẠI TRONG KHU MỚI. Trước 15/09/2026 link này trỏ
                        `/planning/lsx/[id]` — người mua đang đi một mạch trong
                        khu Mua hàng thì bị đá về vỏ cũ, mất cả thanh điều hướng
                        lẫn mạch việc. Chủ dự án báo đúng chỗ này.
                      */}
                      <Code
                        as="a"
                        href={`/mua-hang/yeu-cau/${r.id}`}
                        title={`Mở lệnh ${r.code}`}
                      >
                        {r.code}
                      </Code>
                      <Tag tone={TONE[MEETING_LEVEL[r.level].tone]}>
                        {MEETING_LEVEL[r.level].label}
                      </Tag>
                    </span>
                  </Cell>
                  <Cell grow>
                    <span className="flex items-baseline gap-2">
                      <span className="truncate" title={r.customer_name}>
                        {r.customer_name}
                      </span>
                      <span className="shrink-0 text-[10.5px] text-[var(--ink-3)]">
                        {r.products} SP
                      </span>
                    </span>
                  </Cell>
                  <Cell muted>
                    {moc ? (
                      <span className="flex items-baseline gap-2">
                        <span className="num">{ngay(moc)}</span>
                        {/*
                          Chỉ tô đỏ khi mốc đã qua hoặc còn rất gần MÀ lệnh chưa
                          đủ vật tư. Lệnh đã đủ thì mốc gần là chuyện bình
                          thường — tô đỏ hết thì màu hết nghĩa.
                        */}
                        {con != null &&
                          con <= MEETING_STOP_DAYS &&
                          r.level !== 'ready' && (
                            <span className="text-[var(--stop)]">
                              {con < 0 ? `quá ${-con} ngày` : `còn ${con} ngày`}
                            </span>
                          )}
                        {!r.materials_due_at && (
                          <span className="text-[var(--ink-3)]">theo ngày xuất</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--warn)]">chưa có mốc</span>
                    )}
                  </Cell>
                  <Cell grow muted>
                    <span
                      className="truncate"
                      title={r.action ? `${r.reason} → ${r.action}` : r.reason}
                    >
                      {r.reason}
                    </span>
                  </Cell>
                  <Cell muted>{r.owner}</Cell>
                  <Cell num>
                    <span className="flex items-baseline justify-end gap-2">
                      <Num value={String(r.posTotal || '')} strong />
                      {r.posUnsent > 0 && (
                        <span className="text-[10.5px] text-[var(--warn)]">
                          {r.posUnsent} chưa gửi
                        </span>
                      )}
                      {r.posLate > 0 && (
                        <span className="text-[10.5px] text-[var(--stop)]">
                          {r.posLate} trễ
                        </span>
                      )}
                    </span>
                  </Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot
            label={<td colSpan={4}>Cộng {kept.length} lệnh đang hiện</td>}
            cells={
              <td className="num">{kept.reduce((s, r) => s + r.posTotal, 0) || ''}</td>
            }
            caveat="Mức rủi ro tính bằng ĐÚNG hàm của bảng họp và file Excel họp — ba chỗ không thể nói khác nhau."
          />
        </Table>
      )}

      <StatusBar
        left={[`Khung nhìn: ${nhanMuc}`, 'Khẩn xếp trước, cùng mức thì mốc gần trước']}
        right={`${kept.length} / ${rows.length} lệnh`}
      />
    </ScreenFrame>
  )
}
