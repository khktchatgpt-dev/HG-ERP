'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { DE_NGHI_NHAN, DE_NGHI_TONE, dangO } from '@/lib/de-nghi'
import { searchMatcher } from '@/lib/search-text'
import { useBeRong } from '@/lib/use-be-rong'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
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
import type { DeNghiSoRow } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN')
const R = { textAlign: 'right', whiteSpace: 'normal' } as const

const RO = ['viec', 'cho', 'mua', 'xong', 'all'] as const
type Ro = (typeof RO)[number]
const RO_NHAN: Record<Ro, string> = {
  viec: 'Kho cần làm',
  cho: 'Chờ duyệt',
  mua: 'Đã duyệt · đang mua',
  xong: 'Xong · đã huỷ',
  all: 'Tất cả',
}
const thuoc = (r: DeNghiSoRow, ro: Ro) =>
  ro === 'all' ||
  (ro === 'viec' && r.status === 'draft') ||
  (ro === 'cho' && r.status === 'pending') ||
  (ro === 'mua' && (r.status === 'approved' || r.status === 'ordering')) ||
  (ro === 'xong' && (r.status === 'done' || r.status === 'cancelled'))

/**
 * SỔ ĐỀ NGHỊ MUA VẬT TƯ — khuôn C (0236 · Đ1, bản vẽ DN-4). Câu màn trả lời:
 * phiếu nào của Kho đang kẹt ở ai — nháp chưa gửi, bị từ chối chờ sửa, đang chờ
 * lãnh đạo, hay đã sang Cung ứng. Rổ mặc định "Kho cần làm" (nháp + bị từ chối).
 */
export function DeNghiSoScreen({
  rows,
  canManage,
}: {
  rows: DeNghiSoRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const coViec = rows.some((r) => thuoc(r, 'viec'))
  const [ro, setRo] = useState<Ro>(coViec ? 'viec' : rows.some((r) => thuoc(r, 'cho')) ? 'cho' : 'all') // prettier-ignore
  const [q, setQ] = useState('')
  const khung = useRef<HTMLDivElement>(null)
  const hep = useBeRong(khung) < 900

  const khop = searchMatcher(q)
  const theoTim = rows.filter((r) => khop([r.code, r.nguoi ?? '', r.lsx_code ?? '']))
  const hien = theoTim.filter((r) => thuoc(r, ro))
  const dem = Object.fromEntries(RO.map((x) => [x, theoTim.filter((r) => thuoc(r, x)).length])) as Record<Ro, number> // prettier-ignore
  const tong = hien.reduce((s, r) => s + r.tong, 0)

  return (
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      style={{ '--col-grow': '160px' } as CSSProperties}
    >
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Đề nghị mua"
          facts={[
            { label: 'Chờ duyệt', value: String(dem.cho), tone: dem.cho > 0 ? 'warn' : undefined, on: ro === 'cho', onClick: () => setRo('cho') }, // prettier-ignore
            { label: 'Bị từ chối', value: String(rows.filter((r) => r.bi_tu_choi).length), tone: rows.some((r) => r.bi_tu_choi) ? 'stop' : undefined }, // prettier-ignore
          ]}
          actions={
            canManage ? (
              <Btn icon="them" primary href="/warehouse/de-nghi/moi">
                Lập đề nghị
              </Btn>
            ) : undefined
          }
        />
        <FilterBar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm số phiếu, người, lệnh…"
            width={hep ? 180 : 260}
          />
          {RO.map((x) => (
            <Chip key={x} on={ro === x} count={dem[x]} onClick={() => setRo(x)}>
              {RO_NHAN[x]}
            </Chip>
          ))}
        </FilterBar>
        <div ref={khung} className="h-0 w-full" aria-hidden />
        {hien.length === 0 ? (
          <Empty
            headline={
              rows.length === 0
                ? 'Chưa có phiếu đề nghị mua nào'
                : `Không có phiếu nào trong rổ "${RO_NHAN[ro]}"`
            }
            reason={
              rows.length === 0
                ? 'Kho lập "Giấy đề nghị mua vật tư" ở đây thay cho tờ giấy chụp gửi Zalo: lãnh đạo duyệt trên hệ thống, Cung ứng lập đơn mua từ phiếu.'
                : q.trim()
                  ? `Không phiếu nào khớp "${q.trim()}".`
                  : 'Rổ này đang trống.'
            }
            next={
              rows.length === 0 && canManage ? (
                <Btn icon="them" primary href="/warehouse/de-nghi/moi">
                  Lập đề nghị đầu tiên
                </Btn>
              ) : (
                <Btn
                  icon="boLoc"
                  primary
                  onClick={() => {
                    setQ('')
                    setRo('all')
                  }}
                >
                  Xem tất cả phiếu
                </Btn>
              )
            }
          />
        ) : (
          <Table minWidth={hep ? 620 : 900} label="Sổ đề nghị mua vật tư">
            <THead>
              <th style={{ width: 140 }}>Phiếu</th>
              <th style={{ width: 92 }}>Ngày</th>
              {!hep && <th style={{ width: 150 }}>Người đề nghị</th>}
              <th style={{ ...R, width: 64 }}>Số dòng</th>
              <th style={{ ...R, width: 120 }}>Dự kiến</th>
              <th style={{ width: 100 }}>Trạng thái</th>
              <th>Đang ở</th>
            </THead>
            <tbody>
              {hien.map((r) => (
                <Row key={r.id} onClick={() => router.push(`/warehouse/de-nghi/${r.id}`)}>
                  <Cell>
                    <Code as="a" href={`/warehouse/de-nghi/${r.id}`}>
                      {r.code}
                    </Code>
                  </Cell>
                  <Cell>
                    <span className="num">
                      {isoToVn(todayVn(new Date(r.created_at)))}
                    </span>
                  </Cell>
                  {!hep && (
                    <Cell muted>
                      <span className="block truncate">{r.nguoi ?? '—'}</span>
                    </Cell>
                  )}
                  <Cell num>
                    {r.so_dong}
                    {r.chua_ma > 0 && (
                      <span
                        className="block text-[11px] text-[var(--warn)]"
                        title="Dòng chưa có mã — Cung ứng gắn mã khi lập đơn"
                      >
                        {r.chua_ma} chưa mã
                      </span>
                    )}
                  </Cell>
                  <Cell num>
                    {fmt(r.tong)}
                    {r.thieu_gia > 0 && (
                      <span className="block text-[11px] text-[var(--ink-3)]">
                        {r.thieu_gia} dòng chưa giá
                      </span>
                    )}
                  </Cell>
                  <Cell>
                    <Tag tone={r.bi_tu_choi ? 'stop' : DE_NGHI_TONE[r.status]}>
                      {r.bi_tu_choi ? 'Bị từ chối' : DE_NGHI_NHAN[r.status]}
                    </Tag>
                  </Cell>
                  <Cell grow title={r.rejected_reason ?? r.cancel_reason ?? undefined}>
                    <span className="block truncate">
                      {dangO(r.status, r.bi_tu_choi)}
                      {r.bi_tu_choi && r.rejected_reason && (
                        <span className="text-[var(--stop)]">
                          {' '}
                          · “{r.rejected_reason}”
                        </span>
                      )}
                      {r.status === 'cancelled' && r.cancel_reason && (
                        <span className="text-[var(--ink-3)]">
                          {' '}
                          · huỷ: {r.cancel_reason}
                        </span>
                      )}
                      {r.need_by && r.status !== 'done' && r.status !== 'cancelled' && (
                        <span className="text-[var(--ink-3)]">
                          {' '}
                          · cần trước {isoToVn(r.need_by)}
                        </span>
                      )}
                    </span>
                  </Cell>
                </Row>
              ))}
            </tbody>
            <TFoot
              label={<td colSpan={hep ? 3 : 4}>{hien.length} phiếu</td>}
              cells={<td className="num">{fmt(tong)}</td>}
              caveat="Dự kiến = SL × đơn giá Kho ghi (chưa VAT, chưa vận chuyển); dòng chưa có giá không cộng."
            />
          </Table>
        )}
        <StatusBar
          left={[
            'Lãnh đạo duyệt · Cung ứng lập đơn mua từ phiếu đã duyệt — bước sau đang làm',
          ]}
          right={`${hien.length} / ${rows.length} phiếu`}
        />
      </ScreenFrame>
    </div>
  )
}
