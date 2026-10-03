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
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  Tag,
  Td,
  Th,
  WhyBox,
} from '@/components/kit'
import { mergeQuy, VERDICT_LABEL, type LaiLoRow, type Quy } from '@/lib/lai-lo'
import type { LaiLoScreen as Board } from '@/modules/core/exec/lai-lo.service'
import { SoiLenh } from './soi-lenh'
import { ccy, missingText, pct, tyGon, VERDICT_TONE, vnd } from './lai-lo.shared'

/**
 * LÃI / LỖ THEO LỆNH — Ban Giám đốc (bước 4, artboard duyệt 02/10/2026).
 *
 * Khuôn C "Danh sách": một dòng một lệnh, bấm dòng mở ngăn soi (`Sheet`) phủ
 * bên phải — bảng giữ nguyên bề rộng. Mọi số do `laiLoBoard` tính; màn chỉ bày.
 *
 * Ô THIẾU BÀY "—" KÈM LÝ DO, KHÔNG BÀY 0: "doanh thu 0" đọc ra là "bán không
 * thu được đồng nào". Hôm nay (02/10/2026) chỉ cột "Đã cam kết mua" đầy; ba
 * cột kia chờ Bán hàng dán giá thành, điền giá đơn và Kế toán gán tỷ giá —
 * cột "Thiếu gì" là việc Giám đốc dùng để giục.
 */

type Filter = 'all' | 'risk' | 'thieu'

/** Ô tiền quy VND: số, hoặc "—"; phần ngoại tệ chưa quy nằm dòng dưới, nhạt. */
function Money({
  q,
  tone,
  note,
}: {
  q: Quy | null
  tone?: 'stop' | 'warn' | 'done'
  note?: string
}) {
  if (q == null) return <span className="text-[var(--ink-empty)]">—</span>
  const shown = q.vnd !== 0 || q.missing.length === 0
  return (
    <>
      <span className={tone ? `font-semibold text-[var(--${tone})]` : undefined}>
        {shown ? vnd(q.vnd) : '—'}
      </span>
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

export function LaiLoScreen({ board }: { board: Board }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [customer, setCustomer] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showWhy, setShowWhy] = useState(false)
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
  const byFilter = (r: LaiLoRow, f: Filter) =>
    f === 'all' || (f === 'risk' ? r.verdict === 'lo' || r.verdict === 'an_lai' : r.verdict === 'thieu') // prettier-ignore
  const byCustomer = (r: LaiLoRow) =>
    customer == null || (r.customer_name ?? 'Khác') === customer
  const rows = board.rows.filter((r) => byFilter(r, filter) && byCustomer(r))
  const count = (f: Filter) => board.rows.filter((r) => byFilter(r, f) && byCustomer(r)).length // prettier-ignore

  const sum = {
    committed: mergeQuy(rows.map((r) => r.committed)),
    revenue: rows.every((r) => r.revenue) ? mergeQuy(rows.map((r) => r.revenue!)) : null,
    plan_cost: rows.every((r) => r.plan_cost) ? mergeQuy(rows.map((r) => r.plan_cost!)) : null, // prettier-ignore
    plan_profit: rows.every((r) => r.plan_profit) ? mergeQuy(rows.map((r) => r.plan_profit!)) : null, // prettier-ignore
  }
  const open = openId ? (board.rows.find((r) => r.lsx_id === openId) ?? null) : null
  const planAll = t.products > 0 && t.plan_products === t.products
  const priceAll = t.order_lines > 0 && t.priced_lines === t.order_lines

  return (
    <>
      <ScreenFrame tableMin={1080}>
        <ScreenHeader
          compact
          eyebrow="Ban Giám đốc"
          title="Lãi / lỗ theo lệnh"
          facts={[
            { label: 'Lệnh', value: String(t.lsx_count) },
            { label: 'Kết luận được', value: `${t.conclusive}/${t.lsx_count}`, tone: t.conclusive === 0 && t.lsx_count > 0 ? 'warn' : undefined }, // prettier-ignore
          ]}
          actions={
            <>
              <Btn
                icon="lenh"
                href={board.all ? '/exec/lai-lo' : '/exec/lai-lo?tat_ca=1'}
              >
                {board.all ? 'Chỉ lệnh đang chạy' : 'Cả lệnh đã đóng'}
              </Btn>
              <Btn icon="tien" href="/finance/theo-lenh">
                Tiền theo lệnh (Kế toán)
              </Btn>
            </>
          }
        />

        <MetricStrip>
          <Metric
            label="Đã cam kết mua"
            value={t.po_count > 0 ? tyGon(t.committed.vnd) : null}
            basis={
              t.po_count > 0
                ? `${t.po_count} đơn mua · ${tyGon(t.committed_draft)} còn ở nháp${
                    t.committed.missing.length ? ` · ${missingText(t.committed)} (${t.po_missing_fx} đơn chưa tỷ giá)` : '' // prettier-ignore
                  }`
                : 'chưa có đơn mua gắn lệnh'
            }
          />
          <Metric
            label="Giá thành KH"
            value={planAll && sum.plan_cost ? tyGon(sum.plan_cost.vnd) : null}
            basis={`${t.plan_products}/${t.products} SP có số · đủ ${board.rows.filter((r) => r.plan_cost).length}/${t.lsx_count} lệnh`} // prettier-ignore
            tone={planAll ? undefined : 'warn'}
          />
          <Metric
            label="Doanh thu"
            value={sum.revenue && rows.length === board.rows.length ? tyGon(sum.revenue.vnd) : null} // prettier-ignore
            basis={`${t.priced_lines}/${t.order_lines} dòng đơn có giá · ${t.orders_missing_lsx} lệnh không có đơn bán`} // prettier-ignore
            tone={priceAll ? undefined : 'warn'}
          />
          <Metric
            label="Lệnh kết luận được"
            value={String(t.conclusive)}
            basis={`/ ${t.lsx_count} · cần đủ giá thành KH + doanh thu + tỷ giá`}
            tone={t.conclusive === 0 && t.lsx_count > 0 ? 'stop' : undefined}
          />
          <Metric
            label="Nguy cơ lỗ"
            value={t.conclusive > 0 ? String(t.at_risk) : null}
            basis={t.conclusive > 0 ? `/ ${t.conclusive} lệnh kết luận được` : 'chưa so được lệnh nào'} // prettier-ignore
            tone={t.at_risk > 0 ? 'stop' : undefined}
          />
        </MetricStrip>

        {board.extra_lsx_pos > 0 && (
          <NoticeBar tone="warn" tag="Đơn gộp lệnh">
            <b>{board.extra_lsx_pos} đơn mua</b> gộp nhiều lệnh đang tính TRỌN cho lệnh
            chính — lệnh chính đọc hơi cao, lệnh phụ đọc hơi thấp.
          </NoticeBar>
        )}

        <FilterBar dense>
          <Chip
            on={filter === 'all'}
            count={count('all')}
            onClick={() => setFilter('all')}
          >
            {board.all ? 'Mọi lệnh' : 'Đang chạy'}
          </Chip>
          <Chip
            on={filter === 'risk'}
            count={count('risk')}
            onClick={() => setFilter('risk')}
          >
            Có nguy cơ lỗ
          </Chip>
          <Chip
            on={filter === 'thieu'}
            count={count('thieu')}
            onClick={() => setFilter('thieu')}
          >
            Thiếu số để kết luận
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
            VND quy đổi theo tỷ giá chốt từng chứng từ · bấm dòng để soi
          </span>
        </FilterBar>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              headline={
                board.rows.length === 0
                  ? 'Không có lệnh nào đang chạy'
                  : filter === 'risk'
                    ? t.conclusive === 0
                      ? 'Chưa lệnh nào kết luận được'
                      : 'Không lệnh nào có nguy cơ lỗ'
                    : 'Không lệnh nào ở nhóm này'
              }
              reason={
                board.rows.length === 0
                  ? 'Bảng chỉ bày lệnh đang chạy; bấm "Cả lệnh đã đóng" để xem lệnh cũ.'
                  : filter === 'risk' && t.conclusive === 0
                    ? `Cần đủ ba vế trên cùng một lệnh: giá thành kế hoạch của mọi SP (Bán hàng dán), doanh thu (đơn có giá hoặc FOB kế hoạch) và tỷ giá chốt trên đơn mua ngoại tệ (Kế toán gán). Hôm nay: ${t.plan_products}/${t.products} SP có giá thành, ${t.priced_lines}/${t.order_lines} dòng đơn có giá, ${t.po_missing_fx} đơn mua chưa tỷ giá. Màn không ước lượng thay — thiếu một vế mà vẫn ra số lãi/lỗ là con số không kiểm được.`
                    : 'Bộ lọc đang thu hẹp danh sách.'
              }
              next={
                <Btn
                  icon="boLoc"
                  primary
                  onClick={() => {
                    setFilter(t.conclusive === 0 ? 'thieu' : 'all')
                    setCustomer(null)
                  }}
                >
                  {t.conclusive === 0 && filter === 'risk'
                    ? 'Xem lệnh thiếu số'
                    : 'Xem tất cả'}
                </Btn>
              }
            />
          ) : (
            <Grid minWidth={1080}>
              <GridHead>
                <Th width={136}>Lệnh</Th>
                <Th width={100}>Khách</Th>
                <Th num width={40}>
                  SP
                </Th>
                <Th num width={120}>
                  Doanh thu
                </Th>
                <Th num width={120}>
                  Giá thành KH
                </Th>
                <Th num width={110}>
                  Lợi nhuận KH
                </Th>
                <Th num width={140}>
                  Đã cam kết mua
                </Th>
                <Th num width={84}>
                  Mua / GT KH
                </Th>
                <Th num width={120}>
                  Biên dự kiến
                </Th>
                <Th>Thiếu gì</Th>
              </GridHead>
              <GridBody>
                {rows.map((r) => {
                  const ratioTone = r.ratio_pct == null ? undefined : r.ratio_pct > 100 ? 'stop' : r.ratio_pct > 90 ? 'warn' : undefined // prettier-ignore
                  const marginTone = r.margin == null ? undefined : r.margin < 0 ? 'stop' : r.verdict === 'an_lai' ? 'warn' : 'done' // prettier-ignore
                  return (
                    <GridRow
                      key={r.lsx_id}
                      selected={openId === r.lsx_id}
                      onClick={() => setOpenId(r.lsx_id)}
                    >
                      <Td>
                        <span className="num font-semibold text-[var(--act-text)]">
                          {r.code}
                        </span>
                        {board.all &&
                          r.status !== 'in_progress' &&
                          r.status !== 'approved' && (
                            <span className="text-k-label ml-1 text-[var(--ink-3)]">
                              đã đóng
                            </span>
                          )}
                      </Td>
                      <Td>
                        <span
                          className="block max-w-[96px] truncate"
                          title={r.customer_name ?? undefined}
                        >
                          {r.customer_name ?? '—'}
                        </span>
                      </Td>
                      <Td num>{r.product_count}</Td>
                      <Td num>
                        <Money
                          q={r.revenue}
                          note={r.revenue_source === 'plan' ? 'theo KH' : undefined}
                        />
                      </Td>
                      <Td num>
                        <Money q={r.plan_cost} />
                      </Td>
                      <Td num>
                        <Money q={r.plan_profit} />
                      </Td>
                      <Td num>
                        {r.po_count === 0 ? (
                          <Money q={null} note="chưa có đơn mua" />
                        ) : (
                          <Money
                            q={r.committed}
                            note={
                              r.committed_draft > 0
                                ? `${tyGon(r.committed_draft)} nháp`
                                : undefined
                            }
                          />
                        )}
                      </Td>
                      <Td num tone={ratioTone}>
                        {r.ratio_pct == null ? (
                          <span className="text-[var(--ink-empty)]">—</span>
                        ) : (
                          pct(r.ratio_pct)
                        )}
                      </Td>
                      <Td num tone={marginTone}>
                        {r.margin == null ? (
                          <span className="text-[var(--ink-empty)]">—</span>
                        ) : (
                          <>
                            {vnd(r.margin)}
                            {r.plan_profit && r.plan_profit.missing.length === 0 && (
                              <div className="text-k-label leading-tight whitespace-normal text-[var(--ink-3)]">
                                LN KH {tyGon(r.plan_profit.vnd)}
                              </div>
                            )}
                          </>
                        )}
                      </Td>
                      <Td>
                        <div className="flex min-w-[220px] flex-wrap gap-1 py-0.5 whitespace-normal">
                          {r.verdict !== 'thieu' && (
                            <Tag tone={VERDICT_TONE[r.verdict]}>
                              {VERDICT_LABEL[r.verdict]}
                            </Tag>
                          )}
                          {r.missing.map((m) => (
                            <Tag
                              key={m.kind}
                              tone={
                                m.kind === 'plan' ||
                                m.kind === 'order' ||
                                m.kind === 'price'
                                  ? 'warn'
                                  : 'neutral'
                              }
                            >
                              {m.short}
                            </Tag>
                          ))}
                        </div>
                      </Td>
                    </GridRow>
                  )
                })}
              </GridBody>
              <GridFoot>
                <Td colSpan={3}>Cộng {rows.length} lệnh · VND quy đổi</Td>
                <Td num>
                  <Money q={sum.revenue} />
                </Td>
                <Td num>
                  <Money q={sum.plan_cost} />
                </Td>
                <Td num>
                  <Money q={sum.plan_profit} />
                </Td>
                <Td num>
                  <Money q={sum.committed} />
                </Td>
                <Td num>
                  {sum.plan_cost &&
                  sum.plan_cost.missing.length === 0 &&
                  sum.committed.missing.length === 0 &&
                  sum.plan_cost.vnd > 0
                    ? pct(Math.round((sum.committed.vnd / sum.plan_cost.vnd) * 1000) / 10)
                    : '—'}
                </Td>
                <Td num>
                  {sum.revenue &&
                  sum.revenue.missing.length === 0 &&
                  sum.committed.missing.length === 0
                    ? vnd(sum.revenue.vnd - sum.committed.vnd)
                    : '—'}
                </Td>
                <Td>
                  <span className="text-k-label font-normal text-[var(--ink-3)]">
                    {sum.committed.missing.length > 0
                      ? `tổng KHÔNG gồm ${sum.committed.missing.map((m) => ccy(m.amount, m.currency)).join(' · ')} chưa có tỷ giá`
                      : 'mọi khoản đã quy VND'}
                  </span>
                </Td>
              </GridFoot>
            </Grid>
          )}
        </div>

        {/*
          Phép tính GẬP mặc định: ở 1280×800 đầu trang + dải đo + lọc đã chiếm
          328px, khối WhyBox mở sẵn lấy thêm ~130px và bảng chỉ còn chỗ cho bốn
          dòng. Dòng chú thích một hàng nói điều quan trọng nhất (chưa gồm gì);
          ai cần công thức bấm "Cách tính".
        */}
        <div className="text-k-label flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-1.5 text-[var(--ink-3)]">
          <span>
            Biên dự kiến chưa gồm công khoán, vận chuyển, điện, lương — không phải lãi
            thật. Mọi số VND theo tỷ giá chốt trên từng chứng từ.
          </span>
          <button
            type="button"
            className="text-[var(--act-text)] underline-offset-2 hover:underline"
            aria-expanded={showWhy}
            onClick={() => setShowWhy((v) => !v)}
          >
            {showWhy ? 'Ẩn cách tính' : 'Cách tính'}
          </button>
          {showWhy && (
            <div className="w-full">
              <WhyBox
                lines={[
                  'Doanh thu      = Σ SL dòng đơn bán × đơn giá, quy VND theo tỷ giá chốt đơn bán; đơn chưa có giá → Σ SL lệnh × FOB kế hoạch, ghi "theo KH"',
                  'Giá thành KH   = Σ SL lệnh × (trực tiếp + chi phí chung) kế hoạch của SP — Bán hàng dán từ bản báo giá',
                  'Đã cam kết mua = Σ đơn mua gắn lệnh chưa huỷ, KỂ CẢ nháp; ngoại tệ theo tỷ giá chốt lúc duyệt',
                  'Mua / GT KH    > 100% là đỏ: chưa tính công mà vật tư đã vượt kế hoạch',
                ]}
                result="Biên dự kiến = Doanh thu − Đã cam kết mua; so với Lợi nhuận KH của chính lệnh đó"
              />
            </div>
          )}
        </div>
      </ScreenFrame>

      {open && <SoiLenh row={open} onClose={() => setOpenId(null)} />}
    </>
  )
}
