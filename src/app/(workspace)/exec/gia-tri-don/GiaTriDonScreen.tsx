'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Chip,
  Empty,
  FilterBar,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  Metric,
  MetricStrip,
  ScreenFrame,
  ScreenHeader,
  Tag,
  Td,
  Th,
} from '@/components/kit'
import { mergeGtdQuy, type GtdQuy, type GtdRow } from '@/lib/gia-tri-don'
import type { LaiLoRow } from '@/lib/lai-lo'
import type { GiaTriDonScreen as Board } from '@/modules/core/exec/gia-tri-don.service'
import { SoiLenh } from './soi-lenh'
import { amountsGon, ccy, ccyGon, missingText, tyGon, vnd } from './gia-tri-don.shared'

/**
 * GIÁ TRỊ ĐƠN THEO LỆNH — Ban Giám đốc (bản vẽ duyệt 02/10/2026).
 *
 * Khuôn C "Danh sách": một dòng một lệnh, hai khối cột — ĐƠN BÁN của lệnh và
 * ĐƠN MUA cho lệnh — bấm dòng mở ngăn soi liệt kê từng chứng từ. Mọi số do
 * `giaTriDonBoard` cộng; màn chỉ bày.
 *
 * BỐ CỤC THEO BẢN VẼ HTML user duyệt 03/10/2026 ("tôi muốn như thiết kế"): tiêu
 * đề hai tầng "Đơn bán của lệnh | Đơn mua cho lệnh" với vạch ngăn hai khối, bảng
 * cỡ "đọc" (13px mono), dải tóm tắt số lớn, tên khách không cắt.
 *
 * KHÔNG SUY LUẬN: đơn bán ghi giá 0 thì bày "—" kèm nhãn "0/N dòng có giá",
 * không thay bằng FOB kế hoạch — để Giám đốc thấy việc còn thiếu nằm ở Bán
 * hàng. Chênh lệch bán − mua CHƯA tính (bước sau), ô trên dải nói thẳng.
 */

type Filter = 'all' | 'co_gia' | 'chua_gia'

/** Ô tiền quy VND: số, hoặc "—" khi 0; phần ngoại tệ chưa quy nằm dòng dưới, nhạt. */
function Money({ q, note }: { q: GtdQuy; note?: string }) {
  return (
    <>
      {q.vnd === 0 ? <span className="text-[var(--ink-empty)]">—</span> : vnd(q.vnd)}
      {(note || q.missing.length > 0) && (
        <div className="text-k-label leading-tight whitespace-normal text-[var(--ink-3)]">
          {[note, q.missing.length > 0 ? `+${missingText(q)}` : '']
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
    </>
  )
}

export function GiaTriDonScreen({
  board,
  phanTich,
}: {
  board: Board
  /** Phân tích lãi / lỗ theo lệnh (lsx_id → dòng). null = người xem không có quyền xem giá thành kế hoạch. */
  phanTich: Record<string, LaiLoRow> | null
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [customer, setCustomer] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const t = board.totals

  const customers = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of board.rows) {
      const k = r.customer_name ?? 'Khác'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m].sort((a, b) => b[1] - a[1])
  }, [board.rows])

  // CÙNG hàm cho chip và bảng — số trên chip là lời hứa về số dòng bên dưới.
  const byFilter = (r: GtdRow, f: Filter) =>
    f === 'all' || (f === 'co_gia' ? r.priced_lines > 0 : r.priced_lines === 0)
  const byCustomer = (r: GtdRow) => customer == null || (r.customer_name ?? 'Khác') === customer // prettier-ignore
  const rows = board.rows.filter((r) => byFilter(r, filter) && byCustomer(r))
  const count = (f: Filter) => board.rows.filter((r) => byFilter(r, f) && byCustomer(r)).length // prettier-ignore

  const sum = {
    order_vnd: mergeGtdQuy(rows.map((r) => r.order_vnd)),
    po_vnd: mergeGtdQuy(rows.map((r) => r.po_vnd)),
    po_draft: rows.reduce((s, r) => s + r.po_draft_vnd, 0),
    orders: rows.reduce((s, r) => s + r.order_count, 0),
    pos: rows.reduce((s, r) => s + r.po_count, 0),
    lines: rows.reduce((s, r) => s + r.order_lines, 0),
    priced: rows.reduce((s, r) => s + r.priced_lines, 0),
    with_price: rows.filter((r) => r.priced_lines > 0).length,
    with_pos: rows.filter((r) => r.po_count > 0).length,
  }
  const open = openId ? (board.rows.find((r) => r.lsx_id === openId) ?? null) : null
  const unpriced = t.order_lines - t.priced_lines

  return (
    <>
      <ScreenFrame tableMin={1120}>
        <ScreenHeader
          compact
          eyebrow="Ban Giám đốc"
          title="Giá trị đơn theo lệnh"
          facts={[
            { label: 'Lệnh', value: String(t.lsx_count) },
            { label: 'Đơn bán có giá', value: `${t.lsx_with_price}/${t.lsx_count} lệnh`, tone: t.lsx_with_price < t.lsx_count ? 'warn' : undefined }, // prettier-ignore
          ]}
          actions={
            <>
              <Btn
                icon="lenh"
                href={board.all ? '/exec/gia-tri-don' : '/exec/gia-tri-don?tat_ca=1'}
              >
                {board.all ? 'Chỉ lệnh đang chạy' : 'Cả lệnh đã đóng'}
              </Btn>
              <Btn icon="tien" href="/finance/theo-lenh">
                Tiền theo lệnh (Kế toán)
              </Btn>
            </>
          }
        />

        <MetricStrip size="lg">
          <Metric
            label="Đơn bán gắn lệnh"
            value={t.order_count > 0 ? `${t.order_count} đơn · ${amountsGon(t.order_amounts) || '0'}` : null} // prettier-ignore
            basis={
              t.order_count > 0
                ? `= ${tyGon(t.order_vnd.vnd)} theo tỷ giá chốt từng đơn${t.order_vnd.missing.length ? ` · ${missingText(t.order_vnd)}` : ''} · chỉ ${t.lsx_with_price}/${t.lsx_count} lệnh có đơn ghi giá` // prettier-ignore
                : 'chưa có đơn bán nào gắn lệnh'
            }
            tone={t.lsx_with_price < t.lsx_count ? 'warn' : undefined}
          />
          <Metric
            label="Dòng đơn bán có giá"
            value={t.order_lines > 0 ? `${t.priced_lines} / ${t.order_lines}` : null}
            basis={
              unpriced > 0
                ? `${unpriced} dòng đơn giá 0 — Bán hàng chưa nhập giá vào đơn`
                : t.order_lines > 0
                  ? 'mọi dòng đã có giá'
                  : 'chưa có dòng đơn nào'
            }
            tone={unpriced > 0 ? 'warn' : undefined}
          />
          <Metric
            label="Đơn mua gắn lệnh"
            value={t.po_count > 0 ? `${t.po_count} đơn · ${tyGon(t.po_vnd.vnd)}` : null}
            basis={
              t.po_count > 0
                ? [
                    `${tyGon(t.po_draft_vnd)} còn ở nháp / chờ duyệt`,
                    t.po_vnd.missing.length ? missingText(t.po_vnd) : '',
                    t.po_extra_lsx > 0 ? `${t.po_extra_lsx} đơn gộp nhiều lệnh` : '',
                    t.lsx_without_pos > 0
                      ? `${t.lsx_without_pos} lệnh chưa có đơn mua`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'chưa có đơn mua gắn lệnh'
            }
          />
          <Metric
            label="Chênh lệch bán − mua"
            value={null}
            basis="chưa tính — bước sau, khi đơn bán có giá đủ"
          />
        </MetricStrip>

        <FilterBar dense>
          <Chip
            on={filter === 'all'}
            count={count('all')}
            onClick={() => setFilter('all')}
          >
            {board.all ? 'Mọi lệnh' : 'Đang chạy'}
          </Chip>
          <Chip
            on={filter === 'co_gia'}
            count={count('co_gia')}
            onClick={() => setFilter('co_gia')}
          >
            Đơn bán có giá
          </Chip>
          <Chip
            on={filter === 'chua_gia'}
            count={count('chua_gia')}
            onClick={() => setFilter('chua_gia')}
          >
            Đơn bán chưa có giá
          </Chip>
          <span className="mx-1 h-4 w-px bg-[var(--line)]" />
          {customers.map(([c, n]) => (
            <Chip
              key={c}
              on={customer === c}
              count={n}
              onClick={() => setCustomer(customer === c ? null : c)}
            >
              {c}
            </Chip>
          ))}
          <span className="text-k-label ml-auto text-[var(--ink-3)]">
            VND quy đổi theo tỷ giá chốt từng chứng từ · bấm dòng để xem từng đơn
          </span>
        </FilterBar>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              headline={
                board.rows.length === 0 ? 'Không có lệnh nào đang chạy' : 'Không lệnh nào ở nhóm này' // prettier-ignore
              }
              reason={
                board.rows.length === 0
                  ? 'Bảng chỉ bày lệnh đang chạy; bấm "Cả lệnh đã đóng" để xem lệnh cũ.'
                  : filter === 'co_gia'
                    ? 'Chưa đơn bán nào trong nhóm này có dòng ghi giá — Bán hàng nhập giá ở màn Đơn hàng.'
                    : 'Bộ lọc đang thu hẹp danh sách.'
              }
              next={
                <Btn
                  icon="boLoc"
                  primary
                  onClick={() => {
                    setFilter('all')
                    setCustomer(null)
                  }}
                >
                  Xem tất cả
                </Btn>
              }
            />
          ) : (
            <Grid minWidth={1120} size="md">
              <GridHead
                groups={
                  <>
                    <Th rows={2} width={150}>
                      Lệnh
                    </Th>
                    <Th rows={2}>Khách</Th>
                    <Th group sep span={4}>
                      Đơn bán của lệnh
                    </Th>
                    <Th group sep span={4}>
                      Đơn mua cho lệnh
                    </Th>
                  </>
                }
              >
                <Th num sep width={56}>
                  Đơn
                </Th>
                <Th num width={140}>
                  Giá trị gốc
                </Th>
                <Th num width={140}>
                  VND quy đổi
                </Th>
                <Th num width={100}>
                  Dòng có giá
                </Th>
                <Th num sep width={56}>
                  Đơn
                </Th>
                <Th num width={140}>
                  VND quy đổi
                </Th>
                <Th num width={120}>
                  Trong đó nháp
                </Th>
                <Th>Ghi chú</Th>
              </GridHead>
              <GridBody>
                {rows.map((r) => {
                  const noPrice = r.order_lines > 0 && r.priced_lines === 0
                  const partPrice = r.priced_lines > 0 && r.priced_lines < r.order_lines
                  const notes: string[] = []
                  if (r.po_extra_lsx > 0) notes.push(`${r.po_extra_lsx} đơn gộp lệnh`)
                  if (r.po_count === 0) notes.push('chưa có đơn mua')
                  if (r.order_count === 0) notes.push('chưa có đơn bán')
                  return (
                    <GridRow
                      key={r.lsx_id}
                      selected={openId === r.lsx_id}
                      onClick={() => setOpenId(r.lsx_id)}
                    >
                      <Td>
                        <span className="num text-[var(--act-text)]">{r.code}</span>
                        {board.all &&
                          r.status !== 'in_progress' &&
                          r.status !== 'approved' && (
                            <span className="text-k-label ml-1 text-[var(--ink-3)]">
                              đã đóng
                            </span>
                          )}
                      </Td>
                      <Td>{r.customer_name ?? '—'}</Td>
                      <Td num sep>
                        {r.order_count || (
                          <span className="text-[var(--ink-empty)]">—</span>
                        )}
                      </Td>
                      <Td num>
                        {r.order_amounts.length === 0 ? (
                          <span className="text-[var(--ink-empty)]">
                            {r.order_count > 0 ? `0 ${r.orders[0].currency}` : '—'}
                          </span>
                        ) : (
                          r.order_amounts.map((a) => <div key={a.currency}>{ccyGon(a.amount, a.currency)}</div>) // prettier-ignore
                        )}
                      </Td>
                      <Td num>
                        <Money q={r.order_vnd} />
                      </Td>
                      <Td num>
                        {r.order_lines === 0 ? (
                          <span className="text-[var(--ink-empty)]">—</span>
                        ) : noPrice || partPrice ? (
                          <Tag tone="warn">
                            {r.priced_lines}/{r.order_lines}
                          </Tag>
                        ) : (
                          `${r.priced_lines}/${r.order_lines}`
                        )}
                      </Td>
                      <Td num sep>
                        {r.po_count || <span className="text-[var(--ink-empty)]">—</span>}
                      </Td>
                      <Td num>
                        <Money q={r.po_vnd} />
                      </Td>
                      <Td num>
                        {r.po_draft_vnd > 0 ? (
                          vnd(r.po_draft_vnd)
                        ) : (
                          <span className="text-[var(--ink-empty)]">—</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-k-sm whitespace-normal text-[var(--ink-3)]">
                          {notes.join(' · ')}
                        </span>
                      </Td>
                    </GridRow>
                  )
                })}
              </GridBody>
              <GridFoot>
                <Td colSpan={2}>Cộng {rows.length} lệnh</Td>
                <Td num sep>
                  {sum.orders}
                </Td>
                <Td num>
                  {amountsGon(
                    rows
                      .flatMap((r) => r.order_amounts)
                      .reduce<{ currency: string; amount: number }[]>((acc, a) => {
                        const hit = acc.find((x) => x.currency === a.currency)
                        if (hit)
                          hit.amount = Math.round((hit.amount + a.amount) * 100) / 100
                        else acc.push({ ...a })
                        return acc
                      }, []),
                  ) || <span className="text-[var(--ink-empty)]">—</span>}
                </Td>
                <Td num>
                  <Money
                    q={sum.order_vnd}
                    note={`${sum.with_price}/${rows.length} lệnh có giá`}
                  />
                </Td>
                <Td num>
                  {sum.priced}/{sum.lines}
                </Td>
                <Td num sep>
                  {sum.pos}
                </Td>
                <Td num>
                  <Money
                    q={sum.po_vnd}
                    note={`${sum.with_pos}/${rows.length} lệnh có đơn mua`}
                  />
                </Td>
                <Td num>
                  {sum.po_draft > 0 ? (
                    vnd(sum.po_draft)
                  ) : (
                    <span className="text-[var(--ink-empty)]">—</span>
                  )}
                </Td>
                <Td>
                  <span className="text-k-label font-normal text-[var(--ink-3)]">
                    {sum.order_vnd.missing.length + sum.po_vnd.missing.length > 0
                      ? `tổng KHÔNG gồm ${[...sum.order_vnd.missing, ...sum.po_vnd.missing].map((m) => ccy(m.amount, m.currency)).join(' · ')} chưa có tỷ giá`
                      : 'mọi khoản đã quy VND'}
                  </span>
                </Td>
              </GridFoot>
            </Grid>
          )}
        </div>

        <div className="text-k-label flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-1.5 text-[var(--ink-3)]">
          <span>
            Sắp xếp: lệnh có đơn bán ghi giá lên đầu, rồi theo tiền mua giảm dần. Bấm một
            dòng để xem từng đơn bán và đơn mua của lệnh. Đơn bán = Σ SL × đơn giá trên
            đơn, đúng số Bán hàng nhập (không thay bằng giá kế hoạch). Đơn mua = Σ đơn gắn
            lệnh chưa huỷ, kể cả nháp
            {t.po_extra_lsx > 0
              ? `; ${t.po_extra_lsx} đơn gộp nhiều lệnh tính TRỌN cho lệnh chính`
              : ''}
            . Mọi số VND theo tỷ giá chốt trên từng chứng từ.
          </span>
        </div>
      </ScreenFrame>

      {open && (
        <SoiLenh
          row={open}
          phanTich={phanTich ? (phanTich[open.lsx_id] ?? null) : undefined}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}
