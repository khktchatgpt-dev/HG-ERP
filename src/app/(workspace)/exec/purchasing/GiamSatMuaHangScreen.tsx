'use client'

import {
  Btn,
  Cell,
  TextLink,
  FastTab,
  Ico,
  NoticeBar,
  Num,
  ToneText,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  Table,
  TFoot,
  THead,
  WorkTile,
  WorkTiles,
} from '@/components/kit'
import { money } from '../approval-helpers'
import type { MoneyByCurrency, PurchasingWatch } from '@/lib/purchasing-watch'

/**
 * GIÁM SÁT MUA HÀNG — Ban Giám đốc (27/09/2026, artboard 6, thay trang "Mua hàng
 * & NCC" cũ: bộ giao diện v3, bấm dòng không mở được gì, không có góc nhìn theo
 * người mua).
 *
 * Khuôn A "Vào việc" (/design-lab/mau-vao-viec): ô việc → danh sách đã lọc; bảng
 * theo NGƯỜI MUA (ai đang cầm gì) → sổ đơn của người đó; cột phải: tiền ĐÃ CAM
 * KẾT theo nhà cung cấp. Mọi con số đếm bằng hàm của trang đích — xem
 * `lib/purchasing-watch`. Màn CHỈ XEM; làm việc thì bấm sang màn tác nghiệp.
 */

const moneyLines = (m: MoneyByCurrency) =>
  m.length === 0 ? <span className="text-[var(--ink-empty)]">—</span> : m.map((x) => <div key={x.currency}>{money(x.value, x.currency)}</div>) // prettier-ignore
const moneyText = (m: MoneyByCurrency) => m.map((x) => money(x.value, x.currency)).join(' · ') || '—' // prettier-ignore

/** Số trong bảng: 0 nhạt (không phải tin xấu), có việc thì nhấn theo mức. */
function N({ v, tone }: { v: number; tone?: 'warn' | 'stop' }) {
  if (v === 0) return <Num value="" zero="zero" />
  return tone ? <ToneText tone={tone}>{v}</ToneText> : <>{v}</>
}

export function GiamSatMuaHangScreen({
  w,
  names,
  oldestPendingDays,
  truncatedAt,
}: {
  w: PurchasingWatch
  /** id người mua → [tên gọi, họ tên đầy đủ]. */
  names: Record<string, [string, string]>
  oldestPendingDays: number
  truncatedAt: number | null
}) {
  const T = w.tiles
  const sum = (k: 'pending' | 'unsent' | 'sent' | 'unconfirmed' | 'no_eta' | 'overdue') =>
    w.buyers.reduce((s, b) => s + b[k], 0)
  const hop = (nhom: string) => `/mua-hang/hop-thu?nhom=${nhom}&pham_vi=phong`
  const TOP = 12

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Ban Giám đốc · Theo dõi"
        title="Mua hàng"
        facts={[
          { label: 'Đơn đang mở', value: String(w.open) },
          { label: 'Đã cam kết', value: moneyText(w.committed) },
          ...(T.pending > 0
            ? [
                {
                  label: 'Chờ ký lâu nhất',
                  value: `${oldestPendingDays} ngày`,
                  tone: oldestPendingDays >= 7 ? ('stop' as const) : ('warn' as const),
                },
              ]
            : []),
        ]}
        actions={
          <>
            <Btn icon="don" href="/mua-hang/don?pham_vi=phong">
              Sổ đơn mua
            </Btn>
            <Btn icon="duyet" primary href="/exec/approvals?loai=po">
              Hộp ký ({T.pending})
            </Btn>
          </>
        }
      />
      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi">
          Sổ chạm trần <b>{truncatedAt} đơn</b> — số trên màn có thể thiếu.
        </NoticeBar>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_372px]">
        <div className="flex min-w-0 flex-col gap-3 px-[var(--gutter)] py-2.5">
          <WorkTiles>
            <WorkTile
              strong
              label="Chờ ký"
              count={T.pending}
              hint={
                T.pending > 0
                  ? `Lâu nhất ${oldestPendingDays} ngày`
                  : 'Không đơn nào chờ ký'
              }
              tone="warn"
              href="/exec/approvals?loai=po"
            />
            <WorkTile
              label="Duyệt rồi, chờ NCC xác nhận"
              count={T.unsent}
              hint="Người mua gọi NCC chốt"
              tone="warn"
              href={hop('unsent')}
            />{' '}
            {/* prettier-ignore */}
            <WorkTile label="NCC chưa xác nhận" count={T.unconfirmed} hint="Gửi quá 2 ngày" tone="warn" href={hop('unconfirmed')} />{' '}
            {/* prettier-ignore */}
            <WorkTile label="Đã gửi, chưa hẹn giao" count={T.no_eta} hint="Không đo được trễ" tone="warn" href={hop('no_eta')} />{' '}
            {/* prettier-ignore */}
            <WorkTile label="Quá hẹn giao" count={T.overdue} hint="Giục nhà cung cấp" tone="stop" href={hop('overdue')} />{' '}
            {/* prettier-ignore */}
            {/* Đơn còn mở mà lệnh đã hoàn thành — chưa ai cập nhật (28/09/2026). */}
            <WorkTile
              label="Lệnh đã xong, đơn còn mở"
              count={w.lsx_done}
              hint="Cập nhật đã về đủ / huỷ"
              tone="warn"
              href="/mua-hang/don?lenh_xong=1&trang_thai=open&pham_vi=phong"
            />
          </WorkTiles>

          <FastTab
            title="Theo người mua"
            id="nguoi-mua"
            defaultOpen
            flush
            summary={[
              ['Người mua', String(w.buyers.length)],
              ['Đơn mở', String(w.open)],
            ]}
          >
            <Table>
              <THead>
                <th>Người mua</th>
                <th style={{ textAlign: 'right' }}>Chờ ký</th>
                <th style={{ textAlign: 'right' }}>Duyệt, chờ NCC</th>
                <th style={{ textAlign: 'right' }}>Đang về</th>
                <th style={{ textAlign: 'right' }}>NCC chưa xác nhận</th>
                <th style={{ textAlign: 'right' }}>Chưa hẹn giao</th>
                <th style={{ textAlign: 'right' }}>Quá hẹn</th>
                <th style={{ textAlign: 'right' }}>Đã cam kết</th>
              </THead>
              <tbody>
                {w.buyers.map((b) => {
                  const [nick, full] = b.id
                    ? (names[b.id] ?? ['—', ''])
                    : ['Chưa giao ai', '']
                  return (
                    <Row key={b.id ?? '@none'}>
                      <Cell title={full ? `Mở sổ đơn của ${full}` : undefined}>
                        <span className="flex items-center gap-1.5">
                          <Ico name="toi" size={14} />
                          {b.id ? (
                            <TextLink
                              href={`/mua-hang/don?nguoi=${b.id}&pham_vi=phong&trang_thai=open`}
                              strong
                            >
                              {nick}
                            </TextLink>
                          ) : (
                            nick
                          )}
                        </span>
                      </Cell>
                      <Cell num>
                        <N v={b.pending} tone="warn" />
                      </Cell>
                      <Cell num>
                        <N v={b.unsent} tone="warn" />
                      </Cell>
                      <Cell num>
                        <N v={b.sent} />
                      </Cell>
                      <Cell num>
                        <N v={b.unconfirmed} tone="warn" />
                      </Cell>
                      <Cell num>
                        <N v={b.no_eta} tone="warn" />
                      </Cell>
                      <Cell num>
                        <N v={b.overdue} tone="stop" />
                      </Cell>
                      <Cell num>
                        <span className="font-semibold">{moneyLines(b.committed)}</span>
                      </Cell>
                    </Row>
                  )
                })}
              </tbody>
              <TFoot
                label={<td>Cả phòng</td>}
                cells={
                  <>
                    <td className="num">{sum('pending')}</td>
                    <td className="num">{sum('unsent')}</td>
                    <td className="num">{sum('sent')}</td>
                    <td className="num">{sum('unconfirmed')}</td>
                    <td className="num">{sum('no_eta')}</td>
                    <td className="num">{sum('overdue')}</td>
                    <td className="num">{moneyLines(w.committed)}</td>
                  </>
                }
              />
            </Table>
          </FastTab>
        </div>

        {/* Cột phải: bảng hẹp — bỏ sàn 680px mặc định của Table, không thì cuộn ngang. */}
        <div className="min-w-0 border-l border-[var(--line)] bg-[var(--surface-card)]">
          <FastTab
            title="Đã cam kết theo nhà cung cấp"
            id="ncc"
            defaultOpen
            flush
            summary={[['NCC', String(w.suppliers.length)]]}
          >
            <Table minWidth={0}>
              <THead>
                <th>Nhà cung cấp</th>
                <th style={{ textAlign: 'right', width: 48 }}>Đơn</th>
                <th style={{ textAlign: 'right', width: 150 }}>Giá trị</th>
              </THead>
              <tbody>
                {w.suppliers.slice(0, TOP).map((s) => (
                  <Row key={s.id}>
                    <Cell grow title={s.name}>
                      <TextLink href={`/mua-hang/ncc/${s.id}`} title={s.name}>
                        {s.short}
                      </TextLink>
                    </Cell>
                    <Cell num>{s.count}</Cell>
                    <Cell num>{moneyLines(s.committed)}</Cell>
                  </Row>
                ))}
              </tbody>
              <TFoot
                label={
                  <td>
                    {w.suppliers.length > TOP
                      ? `Top ${TOP} / ${w.suppliers.length} NCC`
                      : `Cộng ${w.suppliers.length} NCC`}
                  </td>
                }
                cells={
                  <td className="num" colSpan={2}>
                    {moneyLines(w.committed)}
                  </td>
                }
              />
            </Table>
          </FastTab>
        </div>
      </div>

      <StatusBar
        left={[
          'Chỉ đơn ĐÃ GỬI NCC mới tính là cam kết',
          'Không gồm nháp / đã về đủ / đã huỷ',
        ]}
        right={`${w.open} đơn đang mở`}
      />
    </ScreenFrame>
  )
}
