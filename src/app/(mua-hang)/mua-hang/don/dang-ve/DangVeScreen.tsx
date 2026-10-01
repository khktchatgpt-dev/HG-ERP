'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DaGhiSoBar } from '@/components/warehouse/DaGhiSoBar'
import {
  INCOMING_BUCKET,
  INCOMING_BUCKETS,
  type IncomingBucket,
} from '@/lib/supply-watch'
import { CACH_GIAO_LABEL, type CachGiao } from '@/lib/cach-giao'
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
  ScopeSwitch,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showMoney,
} from '@/components/kit'
import type { SupplyScope } from '@/lib/supply-scope'
import { useScopePref } from '@/lib/use-scope-pref'
import { XemDonSwitch } from '../xem-don'
import { HenGiaoNut, XacNhanNut } from './hanh-dong'
import { ChuyenSheet, type CarrierOption, type TripEdit } from './chuyen-sheet'
import { ChuyenDangDi, type TripCard } from './chuyen-dang-di'

export type DangVeRow = {
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
  /** Đơn của người đang xem (lib/supply-scope). */
  mine: boolean
  /** Suy từ câu nơi giao (`lib/cach-giao`); null = đơn chưa ghi nơi giao. */
  cach: CachGiao | null
  /** Tên chành khi `cach === 'chanh'`. */
  chanh: string | null
  /** Người xem được ghi hẹn giao / xác nhận trên đơn này (cùng luật server). */
  editable: boolean
}

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const soNgay = (iso: string | null, today: string): number | null => {
  if (!iso) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(iso) - t(today)) / 86_400_000)
}

export function DangVeScreen({
  rows: allRows,
  today,
  truncatedAt,
  meId,
  defaultScope,
  urlScope,
  initialNhom,
  trips,
  carriers,
  canTrip,
  canReceive,
  vuaGhi,
}: {
  /** Ghi phiếu nhập được (`warehouse.stock.write`) — Cung ứng nhận thay Kho. */
  canReceive: boolean
  /** Phiếu nhập vừa ghi sổ — hiện dải "Đã ghi sổ" có nút In. */
  vuaGhi: { id: string; code: string; detail: string } | null
  /** Chuyến hàng còn theo dõi (0216). */
  trips: TripCard[]
  /** Gợi ý tên chành / nhà xe. */
  carriers: CarrierOption[]
  /** Ghi / sửa / huỷ chuyến được (nhân viên Cung ứng). */
  canTrip: boolean
  rows: DangVeRow[]
  today: string
  truncatedAt: number | null
  meId: string
  defaultScope: SupplyScope
  urlScope: SupplyScope | null
  /** `?nhom=` — một mốc, hoặc 'tuan' = hôm nay + 7 ngày tới (link từ Bàn làm việc). */
  initialNhom: string | null
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [trenXe, setTrenXe] = useState(false)
  const [sheet, setSheet] = useState<{
    edit: TripEdit | null
    init: string[]
    key: number
  } | null>(null)
  // Đơn → chuyến đang chở nó (chuyến gửi gần nhất nếu đơn nằm ở nhiều chuyến).
  const poTrip = useMemo(() => {
    const m = new Map<string, TripCard>()
    for (const t of [...trips].sort((a, b) => (a.sent_on < b.sent_on ? -1 : 1)))
      for (const p of t.pos) m.set(p.id, t)
    return m
  }, [trips])
  const moSheet = (edit: TripEdit | null, init: string[] = []) =>
    setSheet({ edit, init, key: Date.now() })
  const [moc, setMoc] = useState<IncomingBucket | 'all' | 'tuan'>(() =>
    initialNhom === 'tuan'
      ? 'tuan'
      : INCOMING_BUCKETS.includes(initialNhom as IncomingBucket)
        ? (initialNhom as IncomingBucket)
        : 'all',
  )
  // Khoá nhớ phạm vi GIỮ tên cũ 'nhan-hang': người đã chọn "Hàng của tôi" ở màn
  // cũ vào đây vẫn thấy đúng lựa chọn đó.
  const [scope, setScope] = useScopePref('nhan-hang', meId, defaultScope, urlScope)
  const mineCount = allRows.filter((r) => r.mine).length
  const rows = useMemo(
    () => (scope === 'toi' ? allRows.filter((r) => r.mine) : allRows),
    [allRows, scope],
  )

  const dem = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const r of rows) c[r.bucket] = (c[r.bucket] ?? 0) + 1
    return c
  }, [rows])
  const chuaGhiCach = rows.filter((r) => r.cach == null).length

  const kept = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (trenXe && !poTrip.has(r.id)) return false
      if (moc === 'tuan' && r.bucket !== 'today' && r.bucket !== 'week') return false
      if (moc !== 'all' && moc !== 'tuan' && r.bucket !== moc) return false
      if (!needle) return true
      return [r.code, r.supplier_name, r.lsx_code, r.chanh]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    })
  }, [rows, q, moc, trenXe, poTrip])

  // GOM THEO MỐC NGÀY, không theo trạng thái đơn — người mở màn hỏi "có gì về,
  // cái gì trễ": quá hẹn trước, rồi hôm nay, 7 ngày tới, sau đó, chưa hẹn.
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

  const bat = (b: IncomingBucket) => setMoc(moc === b ? 'all' : b)

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Đơn mua"
        chain={<XemDonSwitch at="dang-ve" />}
        facts={[
          {
            label: scope === 'toi' ? 'Đơn của tôi đang về' : 'Đang về',
            value: String(rows.length),
          },
          { label: 'Quá hẹn', value: String(dem.overdue ?? 0), tone: (dem.overdue ?? 0) > 0 ? 'stop' : undefined, on: moc === 'overdue', onClick: () => bat('overdue') }, // prettier-ignore
          { label: 'Hôm nay', value: String(dem.today ?? 0), on: moc === 'today', onClick: () => bat('today') }, // prettier-ignore
          { label: 'Chưa hẹn giao', value: String(dem.no_eta ?? 0), tone: (dem.no_eta ?? 0) > 0 ? 'warn' : undefined, on: moc === 'no_eta', onClick: () => bat('no_eta') }, // prettier-ignore
        ]}
        actions={
          <>
            {canTrip && (
              <Btn primary icon="them" onClick={() => moSheet(null)}>
                Ghi chuyến hàng
              </Btn>
            )}
            <ScopeSwitch
              label="Phạm vi"
              value={scope}
              onChange={setScope}
              options={[
                {
                  value: 'toi',
                  label: 'Hàng của tôi',
                  count: mineCount,
                  hint: 'Hàng của đơn tôi phụ trách',
                },
                {
                  value: 'phong',
                  label: 'Cả phòng',
                  count: allRows.length,
                  hint: 'Mọi đơn đang về',
                },
              ]}
            />
          </>
        }
      />

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi">
          Sổ chạm trần <b>{truncatedAt} đơn</b> khi nạp — con số trên màn có thể thiếu.
        </NoticeBar>
      )}

      {vuaGhi && (
        <DaGhiSoBar
          code={vuaGhi.code}
          docId={vuaGhi.id}
          detail={`${vuaGhi.detail} — tồn đã cộng, đơn đã tính lại phần còn chờ.`}
          soPhieuHref="/warehouse/phieu?ro=receipt"
          onClose={() => router.replace('/mua-hang/don/dang-ve', { scroll: false })}
        />
      )}

      <FilterBar dense label="Tìm và lọc đơn đang về">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Số PO, nhà cung cấp, lệnh, chành…"
          width={260}
        />
        {/* 'Về trong 7 ngày' = hôm nay + 7 ngày tới — đúng tập Bàn làm việc đếm. */}
        <Chip
          on={moc === 'tuan'}
          count={(dem.today ?? 0) + (dem.week ?? 0)}
          icon="lich"
          onClick={() => setMoc(moc === 'tuan' ? 'all' : 'tuan')}
        >
          Về trong 7 ngày
        </Chip>
        <Chip
          on={trenXe}
          count={rows.filter((r) => poTrip.has(r.id)).length}
          icon="nhanHang"
          onClick={() => setTrenXe(!trenXe)}
        >
          Trên xe
        </Chip>
        {INCOMING_BUCKETS.map((b) => (
          <Chip
            key={b}
            on={moc === b}
            count={dem[b] ?? 0}
            icon={INCOMING_BUCKET[b].icon}
            onClick={() => bat(b)}
          >
            {INCOMING_BUCKET[b].label}
          </Chip>
        ))}
      </FilterBar>

      <ChuyenDangDi
        trips={trips}
        today={today}
        canTrip={canTrip}
        onEdit={(t) => moSheet({ ...t, po_ids: t.pos.map((p) => p.id) })}
      />

      {kept.length === 0 ? (
        <Empty
          headline={
            rows.length === 0
              ? scope === 'toi' && allRows.length > 0
                ? 'Đơn của bạn chưa có hàng nào đang về'
                : 'Không có đơn nào đang về'
              : 'Không có đơn nào khớp'
          }
          reason={
            rows.length === 0 && scope === 'toi' && allRows.length > 0
              ? `Cả phòng có ${allRows.length} đơn đang về, nhưng không đơn nào do bạn phụ trách.`
              : rows.length === 0
                ? 'Chỉ đơn ĐÃ GỬI nhà cung cấp mới nằm ở đây. Đơn còn nháp hoặc mới duyệt mà chưa gửi thì chưa ai chuẩn bị hàng — chúng nằm ở Hộp thư việc để bị thúc.'
                : `Trong ${rows.length} đơn đang về, không đơn nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
          }
          next={
            rows.length === 0 && scope === 'toi' && allRows.length > 0 ? (
              <Btn primary icon="boLoc" onClick={() => setScope('phong')}>
                Xem hàng về của cả phòng
              </Btn>
            ) : rows.length === 0 ? (
              <Btn primary icon="don" href="/mua-hang/don">
                Mở tất cả đơn mua
              </Btn>
            ) : (
              <Btn
                icon="boLoc"
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
            <th>Cách giao</th>
            <th>Hẹn giao</th>
            <th>NCC</th>
            <th>Về kho</th>
            <th>Phụ trách</th>
            <th style={{ textAlign: 'right' }}>Giá trị</th>
            {canReceive && <th aria-label="Nhận hàng" />}
          </THead>
          <tbody>
            {nhom.map((g) => (
              <Fragment key={g.b}>
                <GroupRow
                  name={INCOMING_BUCKET[g.b].label}
                  cols={canReceive ? 9 : 8}
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
                            <span className="num text-k-label text-[var(--ink-3)]">
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
                        <span className="flex flex-col">
                          {r.cach ? (
                            <span>
                              {CACH_GIAO_LABEL[r.cach]}
                              {r.chanh ? ` · ${r.chanh}` : ''}
                            </span>
                          ) : (
                            <span
                              className="text-[var(--warn)]"
                              title="Đơn chưa ghi Địa điểm giao hàng"
                            >
                              chưa ghi
                            </span>
                          )}
                          {poTrip.has(r.id) ? (
                            <span className="text-k-sm font-semibold text-[var(--act-text)]">
                              trên xe{' '}
                              <span className="num">{poTrip.get(r.id)!.code}</span>
                            </span>
                          ) : (
                            canTrip && (
                              <button
                                type="button"
                                className="text-k-sm self-start font-semibold text-[var(--act)] hover:underline"
                                onClick={() => moSheet(null, [r.id])}
                              >
                                NCC đã gửi hàng
                              </button>
                            )
                          )}
                        </span>
                      </Cell>
                      <Cell>
                        <span className="flex items-baseline gap-2 whitespace-nowrap">
                          {r.expected_at ? (
                            <>
                              <span
                                className={
                                  con != null && con < 0
                                    ? 'num font-semibold text-[var(--stop)]'
                                    : 'num'
                                }
                              >
                                {ngay(r.expected_at)}
                              </span>
                              {con != null && con < 0 && (
                                <span className="text-k-sm font-semibold text-[var(--stop)]">
                                  trễ {-con} ngày
                                </span>
                              )}
                              {con === 0 && (
                                <span className="text-k-sm text-[var(--ink-3)]">
                                  hôm nay
                                </span>
                              )}
                              {r.editable && (
                                <HenGiaoNut
                                  poId={r.id}
                                  code={r.code}
                                  current={r.expected_at}
                                />
                              )}
                            </>
                          ) : r.editable ? (
                            <HenGiaoNut poId={r.id} code={r.code} current={null} />
                          ) : (
                            <span className="text-[var(--warn)]">chưa hẹn</span>
                          )}
                        </span>
                      </Cell>
                      <Cell>
                        {r.status !== 'ordered' ? (
                          <Tag tone="done">Đã xác nhận</Tag>
                        ) : r.editable ? (
                          <XacNhanNut poId={r.id} code={r.code} />
                        ) : (
                          <span className="text-[var(--ink-3)]">chưa xác nhận</span>
                        )}
                      </Cell>
                      <Cell>
                        {/* Độ phủ THEO DÒNG: Kho nhận từng mã một, "8/11 dòng" mới nói được còn thiếu gì. */}
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
                      {canReceive && (
                        <Cell>
                          {/* Mở CHÍNH form phiếu nhập của Kho ở cửa Cung ứng (F2). */}
                          <Link
                            href={`/mua-hang/don/${r.id}/nhan`}
                            className="text-k-sm font-semibold whitespace-nowrap text-[var(--act)] hover:underline"
                          >
                            {r.lines_done > 0 ? 'Nhận tiếp' : 'Nhận hàng'}
                          </Link>
                        </Cell>
                      )}
                    </Row>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
          <TFoot
            label={<td colSpan={6}>Cộng {kept.length} đơn đang về</td>}
            // Cột Nhận hàng hẹp — câu caveat ăn thêm cột đó thay vì bị bóp lại.
            caveatSpan={canReceive ? 3 : 2}
            cells={null}
            caveat={
              tien.length > 0
                ? `Giá trị ${tien.join(' · ')} — cộng riêng từng loại tiền, chưa VAT. Là giá trị ĐƠN, không phải số đã về kho, không gồm phí xe.`
                : 'Chưa đơn nào có giá trị — không phải bằng 0.'
            }
          />
        </Table>
      )}

      <StatusBar
        left={[
          moc === 'all' && !q.trim() ? 'Khung nhìn: tất cả' : 'Khung nhìn: đang lọc',
          chuaGhiCach > 0
            ? `${chuaGhiCach} đơn chưa ghi cách giao`
            : 'Chỉ đơn đã gửi NCC — đơn chưa gửi nằm ở Hộp thư việc',
        ]}
        right={`${kept.length} / ${rows.length} đơn`}
      />
      {sheet && (
        <ChuyenSheet
          key={sheet.key}
          open
          onClose={() => setSheet(null)}
          today={today}
          edit={sheet.edit}
          initialPoIds={sheet.init}
          carriers={carriers}
          pos={allRows.map((r) => ({
            id: r.id,
            code: r.code,
            supplier_name: r.supplier_name,
            lsx_code: r.lsx_code,
            chanh: r.chanh,
          }))}
        />
      )}
    </ScreenFrame>
  )
}
