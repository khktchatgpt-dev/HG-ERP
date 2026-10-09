'use client'

import {
  Btn,
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
  WhyBox,
} from '@/components/kit'
import type { GtdRow } from '@/lib/gia-tri-don'
import type { LaiLoRow } from '@/lib/lai-lo'
import { STATUS_LABEL as ORDER_STATUS_LABEL } from '@/lib/order-progress'
import { poStatusLabel } from '@/lib/po-status'
import {
  amountsGon,
  ccy,
  DIFF_WARN_TEXT,
  dmy,
  missingText,
  pct,
  tyGon,
  vnd,
} from '../gia-tri-don.shared'
import { PhanTich } from '../phan-tich'

/**
 * TRANG CHI TIẾT MỘT LỆNH — thay ngăn soi phủ phải 700px (09/10/2026).
 *
 * Hai bảng liệt kê ĐÚNG những chứng từ đã cộng thành con số trên dòng danh
 * sách: từng đơn bán và từng đơn mua, mỗi bảng có chân tổng khớp ô trên dòng —
 * con số là một lời hứa, trang này là nơi kiểm lời hứa đó.
 *
 * Bố cục: chứng từ là nhân vật chính (cột trái, rộng); phân tích lãi / lỗ nằm
 * cột phải ngăn bằng một vạch dọc kiểu FactBox. Màn hẹp dưới 1280px thì cột
 * phải xuống dưới.
 */
export function ChiTietLenhScreen({
  row: r,
  phanTich,
  backHref,
}: {
  row: GtdRow
  /** Dòng phân tích lãi / lỗ của lệnh; undefined = người xem không có quyền xem giá thành KH. */
  phanTich: LaiLoRow | null | undefined
  /** Danh sách người xem vừa rời (giữ `?tat_ca=1`). */
  backHref: string
}) {
  const closed = r.status !== 'in_progress' && r.status !== 'approved'
  const unpriced = r.order_lines - r.priced_lines
  const h2 =
    'text-k-label mb-1.5 font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase'
  const dash = <span className="text-[var(--ink-empty)]">—</span>

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Giá trị đơn theo lệnh"
        title={<span className="num">{r.code}</span>}
        status={closed ? <Tag>đã đóng</Tag> : undefined}
        facts={[
          { label: 'Khách', value: r.customer_name ?? '—' },
          { label: 'Đơn bán', value: String(r.order_count) },
          { label: 'Đơn mua', value: String(r.po_count) },
        ]}
        actions={
          <>
            <Btn icon="quayLai" href={backHref}>
              Danh sách lệnh
            </Btn>
            <Btn icon="lenh" href={`/exec/lsx/${r.lsx_id}`}>
              Hồ sơ lệnh
            </Btn>
            <Btn icon="don" href={`/mua-hang/don?lsx=${r.lsx_id}&pham_vi=phong`}>
              Sổ đơn mua của lệnh
            </Btn>
            <Btn icon="tien" href="/finance/theo-lenh">
              Tiền theo lệnh (Kế toán)
            </Btn>
          </>
        }
      />

      <MetricStrip size="lg">
        <Metric
          label="Đơn bán của lệnh"
          value={r.order_count > 0 ? `${tyGon(r.order_vnd.vnd)}` : null}
          basis={
            r.order_count > 0
              ? [
                  `${r.order_count} đơn · ${amountsGon(r.order_amounts) || '0'}`,
                  r.order_vnd.missing.length ? missingText(r.order_vnd) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'chưa có đơn bán nào gắn lệnh này'
          }
          tone={r.order_count > 0 && r.priced_lines === 0 ? 'warn' : undefined}
        />
        <Metric
          label="Dòng đơn bán có giá"
          value={r.order_lines > 0 ? `${r.priced_lines} / ${r.order_lines}` : null}
          basis={
            unpriced > 0
              ? `${unpriced} dòng đơn giá 0 — Bán hàng chưa nhập giá vào đơn`
              : r.order_lines > 0
                ? 'mọi dòng đã có giá'
                : 'chưa có dòng đơn nào'
          }
          tone={unpriced > 0 ? 'warn' : undefined}
        />
        <Metric
          label="Đơn mua cho lệnh"
          value={r.po_count > 0 ? tyGon(r.po_vnd.vnd) : null}
          basis={
            r.po_count > 0
              ? [
                  `${r.po_count} đơn`,
                  `${tyGon(r.po_draft_vnd)} còn ở nháp / chờ duyệt`,
                  r.po_vnd.missing.length ? missingText(r.po_vnd) : '',
                  r.po_extra_lsx > 0 ? `${r.po_extra_lsx} đơn gộp nhiều lệnh` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'chưa có đơn mua nào gắn lệnh này'
          }
        />
        <Metric
          label="Chênh lệch bán − mua"
          value={r.diff.vnd == null ? null : tyGon(r.diff.vnd)}
          basis={
            r.diff.vnd == null
              ? 'chưa tính được — lệnh chưa có đơn bán ghi giá'
              : [
                  r.diff.buy_pct != null ? `mua = ${pct(r.diff.buy_pct)} giá bán` : '',
                  ...r.diff.warn.map((w) => DIFF_WARN_TEXT[w]),
                  'chưa gồm nhân công, vận chuyển, chi phí chung',
                ]
                  .filter(Boolean)
                  .join(' · ')
          }
          tone={
            r.diff.vnd != null && r.diff.vnd < 0
              ? 'stop'
              : r.diff.warn.length > 0
                ? 'warn'
                : undefined
          }
        />
      </MetricStrip>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="flex min-w-0 flex-col gap-5 px-[var(--gutter)] py-4">
            <section>
              <h2 className={h2}>
                Đơn bán của lệnh · {r.order_count} đơn · {r.priced_lines}/{r.order_lines}{' '}
                dòng có giá
              </h2>
              {r.orders.length === 0 ? (
                <div className="text-k-sm text-[var(--ink-3)]">
                  Chưa có đơn bán nào gắn lệnh này — Bán hàng tạo đơn rồi gắn vào lệnh.
                </div>
              ) : (
                <Grid minWidth={720} size="md">
                  <GridHead>
                    <Th>Đơn</Th>
                    <Th width={150}>Trạng thái</Th>
                    <Th width={90}>Giao</Th>
                    <Th num width={150}>
                      Tiền gốc
                    </Th>
                    <Th num width={90}>
                      Tỷ giá
                    </Th>
                    <Th num width={150}>
                      VND
                    </Th>
                    <Th num width={90}>
                      Dòng có giá
                    </Th>
                  </GridHead>
                  <GridBody>
                    {r.orders.map((o) => (
                      <GridRow key={o.id}>
                        <Td>
                          <span className="num">{o.code}</span>
                        </Td>
                        <Td>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Td>
                        <Td>
                          <span className="num">{dmy(o.due_date)}</span>
                        </Td>
                        <Td num>{o.amount === 0 ? dash : ccy(o.amount, o.currency)}</Td>
                        <Td num>
                          {o.currency === 'VND' ? (
                            dash
                          ) : o.fx_rate == null ? (
                            <Tag tone="warn">chưa</Tag>
                          ) : (
                            o.fx_rate.toLocaleString('vi-VN')
                          )}
                        </Td>
                        <Td num>{o.vnd == null || o.vnd === 0 ? dash : vnd(o.vnd)}</Td>
                        <Td num>
                          {o.priced_lines < o.lines ? (
                            <Tag tone="warn">
                              {o.priced_lines}/{o.lines}
                            </Tag>
                          ) : (
                            `${o.priced_lines}/${o.lines}`
                          )}
                        </Td>
                      </GridRow>
                    ))}
                  </GridBody>
                  <GridFoot>
                    <Td colSpan={3}>Cộng {r.orders.length} đơn</Td>
                    <Td num>
                      {r.order_amounts.length
                        ? r.order_amounts.map((a) => (
                            <div key={a.currency}>{ccy(a.amount, a.currency)}</div>
                          ))
                        : dash}
                    </Td>
                    <Td />
                    <Td num>{r.order_vnd.vnd === 0 ? dash : vnd(r.order_vnd.vnd)}</Td>
                    <Td num>
                      {r.priced_lines}/{r.order_lines}
                    </Td>
                  </GridFoot>
                </Grid>
              )}
              {r.order_vnd.missing.length > 0 && (
                <div className="text-k-label mt-1 text-[var(--ink-3)]">
                  Chưa quy: {missingText(r.order_vnd)} — Kế toán gán tỷ giá ở màn Tỷ giá.
                </div>
              )}
            </section>

            <section>
              <h2 className={h2}>
                Đơn mua cho lệnh · {r.po_count} đơn
                {r.po_draft_vnd > 0 ? ` · ${vnd(r.po_draft_vnd)} còn ở nháp` : ''}
              </h2>
              {r.pos.length === 0 ? (
                <div className="text-k-sm text-[var(--ink-3)]">
                  Chưa có đơn mua nào gắn lệnh này.
                </div>
              ) : (
                <Grid minWidth={720} size="md">
                  <GridHead>
                    <Th width={140}>Đơn</Th>
                    <Th>Nhà cung cấp</Th>
                    <Th width={150}>Trạng thái</Th>
                    <Th num width={150}>
                      Tiền gốc
                    </Th>
                    <Th num width={90}>
                      Tỷ giá
                    </Th>
                    <Th num width={150}>
                      VND
                    </Th>
                  </GridHead>
                  <GridBody>
                    {r.pos.map((p) => (
                      <GridRow key={p.id}>
                        <Td>
                          <span className="num">{p.code}</span>
                        </Td>
                        <Td>{p.supplier_name}</Td>
                        <Td>
                          {poStatusLabel(p.status)}
                          {p.extra_lsx && (
                            <span className="text-k-label ml-1 text-[var(--ink-3)]">
                              · gộp lệnh
                            </span>
                          )}
                        </Td>
                        <Td num>{ccy(p.amount, p.currency)}</Td>
                        <Td num>
                          {p.currency === 'VND'
                            ? dash
                            : p.fx_rate == null
                              ? dash
                              : p.fx_rate.toLocaleString('vi-VN')}
                        </Td>
                        <Td num>
                          {p.vnd == null ? (
                            <Tag tone="warn">chưa tỷ giá</Tag>
                          ) : (
                            vnd(p.vnd)
                          )}
                        </Td>
                      </GridRow>
                    ))}
                  </GridBody>
                  <GridFoot>
                    <Td colSpan={5}>
                      Cộng {r.pos.length} đơn · {vnd(r.po_draft_vnd)} còn ở nháp / chờ
                      duyệt
                    </Td>
                    <Td num>{vnd(r.po_vnd.vnd)}</Td>
                  </GridFoot>
                </Grid>
              )}
            </section>

            <WhyBox
              lines={[
                `Đơn bán = Σ SL × đơn giá trên ${r.order_count} đơn gắn lệnh, quy VND theo tỷ giá chốt từng đơn`,
                `Đơn mua = Σ ${r.po_count} đơn gắn lệnh chưa huỷ, kể cả ${vnd(r.po_draft_vnd)} còn ở nháp / chờ duyệt`,
                ...r.po_vnd.missing.map((m) => `${ccy(m.amount, m.currency)} đơn mua chưa quy — chưa có tỷ giá chốt`), // prettier-ignore
                ...(r.po_extra_lsx > 0 ? [`${r.po_extra_lsx} đơn mua gộp nhiều lệnh đang tính TRỌN cho lệnh này`] : []), // prettier-ignore
              ]}
              result={
                r.diff.vnd == null
                  ? `Bán ${vnd(r.order_vnd.vnd)} · Mua ${vnd(r.po_vnd.vnd)} VND — chưa có giá bán nên chưa trừ`
                  : `Bán ${vnd(r.order_vnd.vnd)} − Mua ${vnd(r.po_vnd.vnd)} = ${vnd(r.diff.vnd)} VND`
              }
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-5 border-t border-[var(--line)] px-[var(--gutter)] py-4 xl:border-t-0 xl:border-l">
            <PhanTich row={phanTich} />
          </aside>
        </div>
      </div>
    </ScreenFrame>
  )
}
