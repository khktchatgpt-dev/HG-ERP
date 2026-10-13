'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { DE_NGHI_NHAN, DE_NGHI_TONE } from '@/lib/de-nghi'
import { RO_DUYET_NHAN, type RoDuyet } from '@/lib/de-nghi-duyet'
import { soNgayLui } from '@/lib/ngay-chung-tu-nhap'
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
import type { DuyetRow } from '@/modules/dept/warehouse/de-nghi.service'

const fmt = (n: number) => n.toLocaleString('vi-VN')
const R = { textAlign: 'right', whiteSpace: 'normal' } as const
const RO: (RoDuyet | 'all')[] = ['cho', 'mua', 'xong', 'tra_lai', 'all']

/** Số ngày phiếu đã chờ (theo ngày VN) — chỉ có nghĩa với phiếu đang chờ duyệt. */
const choNgay = (r: DuyetRow, today: string) =>
  r.status === 'pending' && r.submitted_at
    ? soNgayLui(todayVn(new Date(r.submitted_at)), today)
    : null

/** Một câu "cần để ý" của phiếu — theo rổ, để người duyệt khỏi phải mở ra mới biết. */
function luuY(r: DuyetRow): { text: string; tone: 'warn' | 'stop' | 'muted' } | null {
  if (r.ro === 'tra_lai' && r.rejected_reason)
    return { text: `trả lại: “${r.rejected_reason}”`, tone: 'stop' }
  if (r.status === 'pending') {
    const x = [
      r.chua_ma > 0 && `${r.chua_ma} dòng chưa có mã`,
      r.thieu_gia > 0 && `${r.thieu_gia} dòng chưa có giá`,
      r.lsx_code && `lệnh ${r.lsx_code}`,
      r.need_by && `cần trước ${isoToVn(r.need_by)}`,
    ].filter(Boolean)
    return x.length ? { text: x.join(' · '), tone: r.chua_ma || r.thieu_gia ? 'warn' : 'muted' } : null // prettier-ignore
  }
  if (r.status === 'done' && r.closed)
    return { text: 'chốt khi còn dòng thiếu', tone: 'warn' }
  return r.approved_by_name
    ? { text: `${r.approved_by_name} duyệt`, tone: 'muted' }
    : null
}

/** Tiến độ mua của phiếu đã duyệt — đếm từ sổ kho. */
function tienDo(r: DuyetRow): string | null {
  if (!['approved', 'ordering', 'done'].includes(r.status)) return null
  if (r.du_dong === 0 && r.thuc_chi === 0) return 'Kho chưa nhập'
  return `đã nhập ${r.du_dong}/${r.mua_dong} dòng · chi ${fmt(r.thuc_chi)}`
}

const TONE_CLS = {
  warn: 'text-[var(--warn)] font-semibold',
  stop: 'text-[var(--stop)]',
  muted: 'text-[var(--ink-3)]',
} as const

/**
 * DANH SÁCH ĐỀ NGHỊ MUA CHO LÃNH ĐẠO (Đ5 · DN-6). Câu màn trả lời: phiếu nào
 * chờ tôi, phiếu đã duyệt Kho mua chưa, tháng này đã chi bao nhiêu thật.
 *
 * Khung < 900px (điện thoại — lãnh đạo mở từ thông báo): mỗi phiếu một khối
 * chữ, không bảng nhiều cột. Rộng hơn: bảng một dòng một phiếu.
 */
export function DuyetDeNghiSoScreen({
  rows,
  thang,
  today,
}: {
  rows: DuyetRow[]
  thang: { ma: string; so_phieu: number; du_kien: number; thuc_chi: number }
  today: string
}) {
  const router = useRouter()
  const thuoc = (r: DuyetRow, ro: RoDuyet | 'all') => ro === 'all' || r.ro === ro
  const coCho = rows.some((r) => r.ro === 'cho')
  const [ro, setRo] = useState<RoDuyet | 'all'>(
    coCho ? 'cho' : rows.some((r) => r.ro === 'mua') ? 'mua' : 'all',
  )
  const [q, setQ] = useState('')
  const khung = useRef<HTMLDivElement>(null)
  const hep = useBeRong(khung) < 900

  const khop = searchMatcher(q)
  const theoTim = rows.filter((r) => khop([r.code, r.nguoi ?? '', r.lsx_code ?? '']))
  const hien = theoTim.filter((r) => thuoc(r, ro))
  const dem = Object.fromEntries(RO.map((x) => [x, theoTim.filter((r) => thuoc(r, x)).length])) as Record<RoDuyet | 'all', number> // prettier-ignore
  const tong = hien.reduce((s, r) => s + r.du_kien, 0)
  const chi = hien.reduce((s, r) => s + r.thuc_chi, 0)
  const thangNhan = `T${Number(thang.ma.slice(5))}`
  const mo = (r: DuyetRow) => router.push(`/duyet/de-nghi/${r.id}`)

  return (
    <div
      className="theme-v3 kit text-foreground -m-4 flex min-h-0 flex-col sm:-m-6"
      style={{ '--col-grow': '180px' } as CSSProperties}
    >
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Duyệt"
          title="Đề nghị mua vật tư"
          facts={[
            { label: 'chờ tôi', value: String(dem.cho), tone: dem.cho > 0 ? 'warn' : undefined, on: ro === 'cho', onClick: () => setRo('cho') }, // prettier-ignore
            { label: `duyệt ${thangNhan}`, value: `${thang.so_phieu} phiếu · ${fmt(thang.du_kien)}` }, // prettier-ignore
            { label: `Kho đã chi ${thangNhan}`, value: fmt(thang.thuc_chi) },
          ]}
        />
        <FilterBar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm số phiếu, người, lệnh…"
            width={hep ? 170 : 260}
          />
          {RO.map((x) => (
            <Chip key={x} on={ro === x} count={dem[x]} onClick={() => setRo(x)}>
              {RO_DUYET_NHAN[x]}
            </Chip>
          ))}
        </FilterBar>
        <div ref={khung} className="h-0 w-full" aria-hidden />
        {hien.length === 0 ? (
          <Empty
            headline={
              rows.length === 0
                ? 'Chưa có phiếu đề nghị mua nào được gửi duyệt'
                : `Không có phiếu nào trong rổ "${RO_DUYET_NHAN[ro]}"`
            }
            reason={
              rows.length === 0
                ? 'Kho lập "Giấy đề nghị mua vật tư" trên hệ thống rồi bấm Gửi lãnh đạo duyệt; phiếu hiện ở đây và trong Hộp ký, kèm thông báo trên chuông.'
                : q.trim()
                  ? `Không phiếu nào khớp "${q.trim()}".`
                  : ro === 'cho'
                    ? 'Không còn phiếu nào chờ bạn duyệt.'
                    : 'Rổ này đang trống.'
            }
            next={
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
            }
          />
        ) : hep ? (
          <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
            {hien.map((r) => {
              const ly = luuY(r)
              const td = tienDo(r)
              const n = choNgay(r, today)
              return (
                <Link
                  key={r.id}
                  href={`/duyet/de-nghi/${r.id}`}
                  className="flex flex-col gap-0.5 border-b border-[var(--hair)] px-[var(--gutter)] py-2.5 hover:bg-[var(--act-wash)]"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <Code>{r.code}</Code>
                    {n != null ? (
                      <Tag tone="warn">{n === 0 ? 'hôm nay' : `chờ ${n} ngày`}</Tag>
                    ) : (
                      <Tag tone={DE_NGHI_TONE[r.status]}>{DE_NGHI_NHAN[r.status]}</Tag>
                    )}
                  </span>
                  <span>
                    {r.department} · {r.nguoi ?? '—'} · {r.so_dong} dòng
                  </span>
                  {ly && (
                    <span className={`text-k-sm ${TONE_CLS[ly.tone]}`}>{ly.text}</span>
                  )}
                  {td && <span className="text-k-sm text-[var(--ink-2)]">{td}</span>}
                  <span className="text-k-sm flex justify-between text-[var(--ink-3)]">
                    <span>Tổng dự kiến (gồm VAT + vận chuyển)</span>
                    <b className="num text-[var(--ink)]">{fmt(r.du_kien)}</b>
                  </span>
                </Link>
              )
            })}
            <div className="text-k-sm flex justify-between px-[var(--gutter)] py-2 text-[var(--ink-3)]">
              <span>{hien.length} phiếu · tổng dự kiến gồm VAT + vận chuyển</span>
              <b className="num text-[var(--ink)]">{fmt(tong)}</b>
            </div>
          </div>
        ) : (
          <Table minWidth={900} label="Đề nghị mua vật tư cho lãnh đạo">
            <THead>
              <th style={{ width: 140 }}>Mã phiếu</th>
              <th style={{ width: 84 }}>Gửi</th>
              <th>Người đề nghị · lưu ý</th>
              <th style={{ ...R, width: 56 }}>Dòng</th>
              <th style={{ ...R, width: 112 }}>Tổng dự kiến</th>
              <th style={{ width: 100 }}>Trạng thái</th>
              <th style={{ width: 210 }}>Tiến độ mua</th>
              <th style={{ ...R, width: 76 }}>Chờ</th>
            </THead>
            <tbody>
              {hien.map((r) => {
                const ly = luuY(r)
                const td = tienDo(r)
                const n = choNgay(r, today)
                return (
                  <Row key={r.id} onClick={() => mo(r)}>
                    <Cell>
                      <Code as="a" href={`/duyet/de-nghi/${r.id}`}>
                        {r.code}
                      </Code>
                    </Cell>
                    <Cell>
                      <span className="num">
                        {r.submitted_at
                          ? isoToVn(todayVn(new Date(r.submitted_at)))
                          : '—'}
                      </span>
                    </Cell>
                    <Cell grow title={ly?.text}>
                      <span className="block truncate">
                        {r.nguoi ?? '—'}
                        <span className="text-[var(--ink-3)]"> · {r.department}</span>
                      </span>
                      {ly && (
                        <span className={`text-k-sm block truncate ${TONE_CLS[ly.tone]}`}>
                          {ly.text}
                        </span>
                      )}
                    </Cell>
                    <Cell num>{r.so_dong}</Cell>
                    <Cell num>{fmt(r.du_kien)}</Cell>
                    <Cell>
                      <Tag tone={r.ro === 'tra_lai' ? 'stop' : DE_NGHI_TONE[r.status]}>
                        {r.ro === 'tra_lai' ? 'Trả lại' : DE_NGHI_NHAN[r.status]}
                      </Tag>
                    </Cell>
                    <Cell muted title={r.phieu_nhap.join(', ') || undefined}>
                      <span className="block truncate">{td ?? '—'}</span>
                      {r.phieu_nhap.length > 0 && (
                        <span className="text-k-sm block truncate">
                          {r.phieu_nhap.join(', ')}
                        </span>
                      )}
                    </Cell>
                    <Cell num>
                      {n == null ? (
                        <span className="text-[var(--ink-empty)]">—</span>
                      ) : (
                        <span
                          className={n >= 2 ? 'font-semibold text-[var(--warn)]' : ''}
                        >
                          {n === 0 ? 'hôm nay' : `${n} ngày`}
                        </span>
                      )}
                    </Cell>
                  </Row>
                )
              })}
            </tbody>
            <TFoot
              label={
                <td colSpan={4}>
                  {hien.length} phiếu · Kho đã chi <span className="num">{fmt(chi)}</span>
                </td>
              }
              cells={
                <>
                  <td className="num">{fmt(tong)}</td>
                  <td />
                </>
              }
              caveat="Tổng dự kiến = SL × giá Kho ghi + VAT từng dòng + vận chuyển; phiếu đã duyệt tính theo số duyệt. Chi = tiền trên phiếu nhập kho."
            />
          </Table>
        )}
        <StatusBar
          left={['Bấm một phiếu để mở màn duyệt — duyệt được cả trên điện thoại']}
          right={`${hien.length} / ${rows.length} phiếu`}
        />
      </ScreenFrame>
    </div>
  )
}
