'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  INCOMING_BUCKET,
  INCOMING_BUCKETS,
  type IncomingBucket,
} from '@/lib/supply-watch'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import {
  Btn,
  Cell,
  Chip,
  Code,
  CoverageBar,
  Empty,
  FilterBar,
  GroupRow,
  NoticeBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  showMoney,
} from '@/components/kit'

export type NhanHangRow = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string | null
  status: string
  expected_at: string | null
  currency: string
  total: number
  assignee_name: string | null
  lines_done: number
  lines_total: number
  bucket: IncomingBucket
}

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const soNgay = (iso: string | null, today: string): number | null => {
  if (!iso) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(iso) - t(today)) / 86_400_000)
}

export function NhanHangScreen({
  rows,
  today,
  truncatedAt,
  canEdit,
}: {
  rows: NhanHangRow[]
  today: string
  truncatedAt: number | null
  canEdit: boolean
}) {
  const [q, setQ] = useState('')
  const [moc, setMoc] = useState<IncomingBucket | 'all'>('all')

  const dem = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const r of rows) c[r.bucket] = (c[r.bucket] ?? 0) + 1
    return c
  }, [rows])

  const kept = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (moc !== 'all' && r.bucket !== moc) return false
      if (!needle) return true
      return [r.code, r.supplier_name, r.lsx_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    })
  }, [rows, q, moc])

  /*
    GOM THEO MỐC, không phải theo trạng thái đơn — đó là điều tách màn này khỏi
    danh sách Đơn mua. Người mở màn hỏi "tuần này có gì về", và câu trả lời xếp
    theo thời gian: quá hẹn trước, rồi hôm nay, rồi 7 ngày tới.
  */
  const nhom = useMemo(
    () =>
      INCOMING_BUCKETS.map((b) => ({
        b,
        rows: kept
          .filter((r) => r.bucket === b)
          .sort((x, y) =>
            (x.expected_at ?? '9999') < (y.expected_at ?? '9999') ? -1 : 1,
          ),
      })).filter((g) => g.rows.length > 0),
    [kept],
  )

  const tien = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of kept) m[r.currency] = (m[r.currency] ?? 0) + r.total
    return Object.entries(m)
      .filter(([, v]) => v > 0)
      .map(
        ([c, v]) =>
          `${showMoney(v, { digits: c === 'VND' ? 0 : 2 })} ${c === 'VND' ? '₫' : c}`,
      )
  }, [kept])

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Nhận hàng"
        facts={[
          { label: 'Đơn đang về', value: String(rows.length) },
          {
            label: 'Quá hẹn',
            value: String(dem.overdue ?? 0),
            tone: (dem.overdue ?? 0) > 0 ? 'stop' : 'neutral',
          },
          {
            label: 'Chưa hẹn ngày',
            value: String(dem.no_eta ?? 0),
            tone: (dem.no_eta ?? 0) > 0 ? 'warn' : 'neutral',
          },
        ]}
        /* Nút "Lập phiếu nhập" gỡ 16/09/2026 cùng khu Kho. Màn này vẫn
           dùng được để THEO DÕI hàng về; việc ghi phiếu quay lại khi Kho
           dựng xong. */
      />

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi" action={{ label: 'Thu hẹp bằng ô tìm' }}>
          Sổ chạm trần <b>{truncatedAt} đơn</b> khi nạp — con số trên màn có thể thiếu.
        </NoticeBar>
      )}

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm số PO, nhà cung cấp hoặc lệnh…"
          width={300}
        />
        {INCOMING_BUCKETS.map((b) => (
          <Chip
            key={b}
            on={moc === b}
            count={dem[b] ?? 0}
            icon={INCOMING_BUCKET[b].icon}
            onClick={() => setMoc(moc === b ? 'all' : b)}
          >
            {INCOMING_BUCKET[b].label}
          </Chip>
        ))}
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline={
            rows.length === 0 ? 'Không có đơn nào đang về' : 'Không có đơn nào khớp'
          }
          reason={
            rows.length === 0
              ? 'Chỉ đơn ĐÃ GỬI nhà cung cấp mới nằm ở đây. Đơn còn nháp hoặc mới duyệt mà chưa gửi thì chưa ai chuẩn bị hàng — chúng nằm ở Bàn làm việc để bị thúc.'
              : `Trong ${rows.length} đơn đang về, không đơn nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
          }
          next={
            rows.length === 0 ? (
              <Btn primary icon="don" href="/mua-hang/don">
                Mở danh sách đơn mua
              </Btn>
            ) : (
              <Btn
                primary
                onClick={() => {
                  setQ('')
                  setMoc('all')
                }}
              >
                Xem cả {rows.length} đơn
              </Btn>
            )
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Đơn</th>
            <th>Nhà cung cấp</th>
            <th>Hẹn giao</th>
            <th>Trạng thái</th>
            <th>Về kho</th>
            <th>Phụ trách</th>
            <th style={{ textAlign: 'right' }}>Giá trị</th>
          </THead>
          <tbody>
            {nhom.map((g) => (
              <Fragment key={g.b}>
                <GroupRow
                  name={INCOMING_BUCKET[g.b].label}
                  cols={7}
                  meta={`${g.rows.length} đơn`}
                />
                {g.rows.map((r) => {
                  const con = soNgay(r.expected_at, today)
                  return (
                    <Row key={r.id}>
                      <Cell pin>
                        <span className="flex items-center gap-2">
                          <Code as="a" href={`/mua-hang/don/${r.id}`}>
                            {r.code}
                          </Code>
                          {r.lsx_code && (
                            <span className="num text-[10.5px] text-[var(--ink-3)]">
                              {r.lsx_code}
                            </span>
                          )}
                        </span>
                      </Cell>
                      <Cell grow>
                        <span className="truncate" title={r.supplier_name}>
                          {r.supplier_name}
                        </span>
                      </Cell>
                      <Cell muted>
                        {r.expected_at ? (
                          <span className="flex items-baseline gap-2">
                            <span className="num">{ngay(r.expected_at)}</span>
                            {con != null && con < 0 && (
                              <span className="text-[var(--stop)]">quá {-con} ngày</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[var(--warn)]">chưa hẹn</span>
                        )}
                      </Cell>
                      <Cell muted>
                        {PO_STATUS_LABEL[r.status as PoStatus] ?? r.status}
                      </Cell>
                      <Cell>
                        {/*
                          ĐỘ PHỦ THEO DÒNG, không phải theo tiền: Kho nhận từng
                          mã một, và "8/11 dòng đã về" mới là câu nói được điều
                          gì còn thiếu. Số tiền đã về thì nằm ở chính chứng từ.
                        */}
                        {r.lines_total > 0 ? (
                          <CoverageBar
                            ratio={r.lines_done / r.lines_total}
                            label={`${r.lines_done}/${r.lines_total}`}
                          />
                        ) : (
                          <span className="text-[var(--ink-empty)]">—</span>
                        )}
                      </Cell>
                      <Cell muted>{r.assignee_name ?? '—'}</Cell>
                      <Cell num>
                        <Num
                          value={showMoney(r.total, {
                            digits: r.currency === 'VND' ? 0 : 2,
                          })}
                        />
                      </Cell>
                    </Row>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
          <TFoot
            label={<td colSpan={5}>Cộng {kept.length} đơn đang về</td>}
            cells={null}
            caveat={
              tien.length > 0
                ? `Giá trị ${tien.join(' · ')} — cộng riêng từng loại tiền. Là giá trị ĐƠN, không phải số đã về kho.`
                : 'Chưa đơn nào có giá trị — không phải bằng 0.'
            }
          />
        </Table>
      )}

      <StatusBar
        left={[
          moc === 'all' && !q.trim() ? 'Khung nhìn: tất cả' : 'Khung nhìn: đang lọc',
          'Chỉ đơn đã gửi NCC — đơn chưa gửi nằm ở Bàn làm việc',
        ]}
        right={`${kept.length} / ${rows.length} đơn`}
      />
    </ScreenFrame>
  )
}
