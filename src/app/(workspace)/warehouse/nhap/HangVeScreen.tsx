'use client'

import { Fragment, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import {
  HANG_VE_LANE,
  HANG_VE_LANES,
  demTheoLan,
  khopTimKiem,
  laneOf,
  whyOf,
  xepTrongLan,
  type HangVeLane,
  type HangVeRow,
} from '@/lib/kho-hang-ve'
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
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
} from '@/components/kit'

const TONE_TEXT = {
  stop: 'text-[var(--stop)]',
  warn: 'text-[var(--warn)]',
  primary: 'text-[var(--act-text)]',
  muted: 'text-[var(--ink-3)]',
} as const

const LANE_PARAM = 'lan'
const laMaLan = (v: string | null): v is HangVeLane =>
  (HANG_VE_LANES as readonly string[]).includes(v ?? '')

/**
 * HÀNG VỀ — hàng đợi của thủ kho (Bước 1 Kho). Bản thiết kế:
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * Bốn làn theo NGÀY, không theo trạng thái đơn. Chip đếm trên TOÀN TẬP bằng
 * `demTheoLan` — cùng hàm với làn hiện, nên số trên chip là lời hứa. Làn đang
 * chọn sống trên URL (`?lan=`): F5 không mất, gửi link ra đúng tập.
 *
 * Nút NHẬN HÀNG ở việc số 2 còn KHOÁ kèm lý do: form phiếu nhập là việc số 3.
 * Khoá và nói thẳng, không dẫn vào một route chưa có.
 */
export function HangVeScreen({
  rows,
  today,
  canEdit,
  truncated,
}: {
  rows: HangVeRow[]
  today: string
  canEdit: boolean
  truncated: { dot: number; don: number } | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const lanUrl = params.get(LANE_PARAM)
  const lan: HangVeLane | 'all' = laMaLan(lanUrl) ? lanUrl : 'all'
  const [q, setQ] = useState('')

  const chonLan = (next: HangVeLane | 'all') => {
    const p = new URLSearchParams(params.toString())
    if (next === 'all') p.delete(LANE_PARAM)
    else p.set(LANE_PARAM, next)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const dem = useMemo(() => demTheoLan(rows, today), [rows, today])

  const kept = useMemo(
    () =>
      rows.filter(
        (r) => (lan === 'all' || laneOf(r.date, today) === lan) && khopTimKiem(r, q),
      ),
    [rows, lan, q, today],
  )

  const nhom = useMemo(
    () =>
      HANG_VE_LANES.map((id) => ({
        id,
        rows: kept.filter((r) => laneOf(r.date, today) === id).sort(xepTrongLan),
      })).filter((g) => g.rows.length > 0),
    [kept, today],
  )

  const dangLoc = lan !== 'all' || q.trim() !== ''

  return (
    /*
      Lớp token `.kit` BẮT BUỘC ở gốc màn trong vỏ workspace (SupplyShell của
      Mua hàng gắn sẵn, WorkspaceShell thì không). Thiếu nó thì mọi biến
      --fs-* / --gutter / --ink-* rỗng: chữ 16px, không lề, màu mặc định —
      đúng cái chủ dự án thấy 16/09/2026 ("không giống thiết kế").
    */
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Hàng về"
          facts={[
            { label: 'Đang về', value: String(dem.all) },
            {
              label: 'Quá hẹn',
              value: String(dem.late),
              tone: dem.late > 0 ? 'stop' : 'neutral',
            },
            {
              label: 'Chưa hẹn ngày',
              value: String(dem.no_eta),
              tone: dem.no_eta > 0 ? 'warn' : 'neutral',
            },
          ]}
          actions={<Btn href="/planning/docs">Xem sổ phiếu ›</Btn>}
        />

        {truncated && (
          <NoticeBar tone="warn" tag="Cắt đuôi" action={{ label: 'Thu hẹp bằng ô tìm' }}>
            Danh sách chạm trần khi nạp ({truncated.dot} đợt giao / {truncated.don} đơn) —
            con số trên màn có thể thiếu. Thu hẹp bằng ô tìm.
          </NoticeBar>
        )}

        <FilterBar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm mã đơn, nhà cung cấp hoặc lệnh…"
            width={300}
          />
          {HANG_VE_LANES.map((id) => (
            <Chip
              key={id}
              on={lan === id}
              count={dem[id]}
              onClick={() => chonLan(lan === id ? 'all' : id)}
            >
              {HANG_VE_LANE[id].label}
            </Chip>
          ))}
          <Chip on={lan === 'all'} count={dem.all} onClick={() => chonLan('all')}>
            Tất cả
          </Chip>
        </FilterBar>

        {kept.length === 0 ? (
          <Empty
            headline={
              rows.length === 0 ? 'Không có đơn nào đang về' : 'Không có dòng nào khớp'
            }
            reason={
              rows.length === 0
                ? 'Chỉ đơn ĐÃ GỬI nhà cung cấp mới nằm ở đây. Khi Cung ứng gửi đơn và NCC hẹn lịch, đợt giao hiện ở đây; NCC không hẹn ngày thì đơn nằm ở làn "Chưa hẹn ngày".'
                : `Trong ${rows.length} dòng đang về, không dòng nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
            }
            next={
              rows.length === 0 ? (
                <Btn primary href="/mua-hang/don">
                  Mở danh sách đơn mua
                </Btn>
              ) : (
                <Btn
                  primary
                  onClick={() => {
                    setQ('')
                    chonLan('all')
                  }}
                >
                  Xem cả {rows.length} dòng
                </Btn>
              )
            }
          />
        ) : (
          <Table>
            <THead pinFirst>
              <th>Hẹn giao</th>
              <th>Đơn · Lệnh SX</th>
              <th>Nhà cung cấp</th>
              <th style={{ textAlign: 'right' }}>Khối lượng</th>
              <th style={{ textAlign: 'right' }}>Về kho</th>
              <th>Vì sao đáng chú ý</th>
              <th />
            </THead>
            <tbody>
              {nhom.map((g) => (
                <Fragment key={g.id}>
                  <GroupRow
                    name={HANG_VE_LANE[g.id].label}
                    cols={7}
                    meta={`${g.rows.length} ${g.id === 'no_eta' ? 'đơn · NCC giao khi có xe' : 'lần xe tới'}`}
                  />
                  {g.rows.map((r) => {
                    const why = whyOf(r, today)
                    const laneTone = HANG_VE_LANE[g.id].tone
                    return (
                      <Row key={r.key}>
                        <Cell pin>
                          {r.date ? (
                            <span
                              className={`num ${laneTone === 'stop' || laneTone === 'warn' ? TONE_TEXT[laneTone] : ''}`}
                            >
                              {isoToVn(r.date).slice(0, 5)}
                            </span>
                          ) : (
                            <span className="text-[var(--ink-empty)]">—</span>
                          )}
                        </Cell>
                        <Cell>
                          <span className="flex items-center gap-2">
                            <Code as="a" href={`/mua-hang/don/${r.po_id}`}>
                              {r.po_code}
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
                        <Cell num muted>
                          {r.line_count != null ? (
                            <>
                              {r.line_count} dòng ·{' '}
                              {(r.total_qty ?? 0).toLocaleString('vi-VN')}
                            </>
                          ) : (
                            <>{r.lines_total} dòng · cả đơn</>
                          )}
                        </Cell>
                        <Cell>
                          {r.lines_total > 0 ? (
                            <CoverageBar
                              ratio={r.lines_done / r.lines_total}
                              label={`${r.lines_done}/${r.lines_total}`}
                            />
                          ) : (
                            <span className="text-[var(--ink-empty)]">—</span>
                          )}
                        </Cell>
                        <Cell>
                          <span className={`text-[11.5px] ${TONE_TEXT[why.tone]}`}>
                            {why.text}
                          </span>
                        </Cell>
                        <Cell>
                          <span className="flex items-center justify-end gap-3">
                            <a
                              href={`/mua-hang/don/${r.po_id}`}
                              className="text-[12px] text-[var(--act-text)]"
                            >
                              Đơn ›
                            </a>
                            {canEdit && (
                              <Btn
                                primary={g.id === 'late' || g.id === 'today'}
                                href={`/warehouse/nhap/${r.po_id}${r.shipment_id ? `?dot=${r.shipment_id}` : ''}`}
                                className="h-6 px-[9px] text-[12px]"
                              >
                                Nhận hàng
                              </Btn>
                            )}
                          </span>
                        </Cell>
                      </Row>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
            <TFoot
              label={<td colSpan={5}>Cộng {kept.length} dòng đang về</td>}
              cells={null}
              caveat="Một đơn nhiều đợt giao là nhiều dòng. Đơn nháp và đơn đã duyệt nhưng chưa gửi NCC không nằm ở đây."
            />
          </Table>
        )}

        <StatusBar
          left={[
            dangLoc ? 'Khung nhìn: đang lọc' : 'Khung nhìn: tất cả',
            'Nguồn: đợt giao đã hẹn + đơn đã gửi NCC — cùng hàm với màn Nhận hàng của Mua hàng',
          ]}
          right={`${kept.length} / ${rows.length} dòng`}
        />
      </ScreenFrame>
    </div>
  )
}
