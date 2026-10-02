'use client'

import { Btn, Grid, GridBody, GridHead, GridRow, Sheet, Tag, Td, TextLink, Th, WhyBox } from '@/components/kit' // prettier-ignore
import { VERDICT_LABEL, type LaiLoRow } from '@/lib/lai-lo'
import { ccy, pct, tyGon, VERDICT_TONE, vnd } from './lai-lo.shared'

/**
 * NGĂN SOI MỘT LỆNH — phủ bên phải, bảng phía sau vẫn đọc được.
 *
 * Ba khối, đúng thứ tự Giám đốc hỏi: (1) thiếu gì để kết luận — ai điền, ở đâu;
 * (2) theo sản phẩm — SP nào chưa có số kế hoạch; (3) theo nhà cung cấp — tiền
 * đã cam kết nằm ở ai. Phép tính nguyên văn ở cuối (`WhyBox`).
 *
 * Số kế hoạch từng SP (FOB · giá thành · lợi nhuận) là số riêng của Bán hàng —
 * màn này nằm trong khu Ban Giám đốc, service đã kiểm `technical.plan_cost.view`.
 */
export function SoiLenh({ row: r, onClose }: { row: LaiLoRow; onClose: () => void }) {
  const planned = r.products.filter((p) => p.price != null)
  const unplanned = r.products.filter((p) => p.price == null)
  const sub = [
    r.customer_name,
    `${r.product_count} SP · ${r.qty_total.toLocaleString('vi-VN')} cái`,
    `${r.order_count} đơn bán`,
    `${r.po_count} đơn mua`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Sheet open onClose={onClose} title={r.code} subtitle={sub} stakes="nhe" width={460}>
      <div className="flex flex-col gap-4">
        <section>
          <h3 className="text-k-label mb-1 font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase">
            Kết luận
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={VERDICT_TONE[r.verdict]}>{VERDICT_LABEL[r.verdict]}</Tag>
            {r.ratio_pct != null && (
              <span className="text-k-sm">
                Mua / giá thành KH <b className="num">{pct(r.ratio_pct)}</b>
              </span>
            )}
            {r.margin != null && (
              <span className="text-k-sm">
                Biên dự kiến <b className="num">{vnd(r.margin)}</b>
                {r.plan_profit && r.plan_profit.missing.length === 0 && (
                  <>
                    {' '}
                    · LN KH <span className="num">{vnd(r.plan_profit.vnd)}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </section>

        {r.missing.length > 0 && (
          <section>
            <h3 className="text-k-label mb-1 font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase">
              Thiếu gì để kết luận
            </h3>
            <ul className="flex flex-col gap-1.5">
              {r.missing.map((m) => (
                <li key={m.kind} className="text-k-sm flex gap-2">
                  <span
                    aria-hidden
                    className={`mt-[6px] size-2 shrink-0 rounded-full ${
                      m.kind === 'plan' || m.kind === 'order' || m.kind === 'price' ? 'bg-[var(--warn)]' : 'bg-[var(--ink-3)]' // prettier-ignore
                    }`}
                  />
                  <span>
                    <b>{m.text}</b> — {m.who}: <TextLink href={m.href}>mở màn</TextLink>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-k-label mb-1 font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase">
            Theo sản phẩm · {planned.length} có số, {unplanned.length} chưa
          </h3>
          <Grid minWidth={400}>
            <GridHead>
              <Th>SP</Th>
              <Th num width={64}>
                SL
              </Th>
              <Th num width={84}>
                FOB KH
              </Th>
              <Th num width={84}>
                GT KH
              </Th>
              <Th num width={76}>
                LN KH
              </Th>
            </GridHead>
            <GridBody>
              {r.products.map((p) => (
                <GridRow key={p.product_id ?? `code:${p.code}`}>
                  <Td>
                    <span
                      className={`num ${p.price == null ? 'text-[var(--ink-3)]' : ''}`}
                    >
                      {p.code}
                    </span>
                  </Td>
                  <Td num>{p.qty.toLocaleString('vi-VN')}</Td>
                  <Td num>
                    {p.price == null ? (
                      <span className="text-[var(--ink-empty)]">—</span>
                    ) : (
                      money(p.price, p.currency)
                    )}
                  </Td>
                  <Td num>
                    {p.direct == null ? (
                      <span className="text-[var(--ink-empty)]">—</span>
                    ) : (
                      money(p.direct + (p.overhead ?? 0), p.currency)
                    )}
                  </Td>
                  <Td num>
                    {p.profit == null ? (
                      <span className="text-[var(--ink-empty)]">—</span>
                    ) : (
                      money(p.profit, p.currency)
                    )}
                  </Td>
                </GridRow>
              ))}
            </GridBody>
          </Grid>
          <div className="text-k-label mt-1 text-[var(--ink-3)]">
            Số kế hoạch theo đơn vị, tiền tệ của bản báo giá. GT KH = trực tiếp + chi phí
            chung.
          </div>
        </section>

        <section>
          <h3 className="text-k-label mb-1 font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase">
            Đã cam kết mua · theo nhà cung cấp
          </h3>
          {r.suppliers.length === 0 ? (
            <div className="text-k-sm text-[var(--ink-3)]">
              Chưa có đơn mua nào gắn lệnh này.
            </div>
          ) : (
            <Grid minWidth={400}>
              <GridHead>
                <Th>Nhà cung cấp</Th>
                <Th num width={110}>
                  Cam kết
                </Th>
                <Th num width={110}>
                  Quy VND
                </Th>
                <Th width={72}>Đơn</Th>
              </GridHead>
              <GridBody>
                {r.suppliers.map((s) => (
                  <GridRow key={`${s.supplier_id} ${s.currency}`}>
                    <Td>{s.name}</Td>
                    <Td num>{ccy(s.amount, s.currency)}</Td>
                    <Td num>
                      {s.vnd == null ? <Tag tone="warn">chưa tỷ giá</Tag> : vnd(s.vnd)}
                    </Td>
                    <Td>
                      <span className="num">{s.po_count}</span>
                      {s.has_draft && (
                        <span className="text-k-label ml-1 text-[var(--ink-3)]">
                          nháp
                        </span>
                      )}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
            </Grid>
          )}
          <WhyBox
            lines={[
              `Σ ${r.po_count} đơn mua gắn lệnh, chưa huỷ`,
              ...(r.committed_draft > 0 ? [`trong đó còn ở NHÁP / chờ duyệt: ${vnd(r.committed_draft)} (ý định chi, NCC chưa biết)`] : []), // prettier-ignore
              ...r.committed.missing.map((m) => `${ccy(m.amount, m.currency)} chưa quy — ${r.po_missing_fx} đơn chưa có tỷ giá chốt`), // prettier-ignore
            ]}
            result={`Đã cam kết mua ${vnd(r.committed.vnd)} VND${r.committed.missing.length ? ' (chưa gồm phần chưa quy)' : ''}`} // prettier-ignore
          />
        </section>

        <div className="flex gap-2">
          <Btn icon="tien" href="/finance/theo-lenh">
            Tiền theo lệnh (Kế toán)
          </Btn>
          <Btn icon="don" href={`/mua-hang/don?lsx=${r.lsx_id}&pham_vi=phong`}>
            Sổ đơn mua của lệnh
          </Btn>
        </div>
        <div className="text-k-label text-[var(--ink-3)]">
          Biên dự kiến chưa gồm công khoán, vận chuyển, điện, lương — không phải lãi thật.{' '}
          {r.committed_draft > 0 &&
            `${tyGon(r.committed_draft)} trong cam kết còn ở nháp.`}
        </div>
      </div>
    </Sheet>
  )
}

const money = (n: number, c: string | null) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: c === 'VND' ? 0 : 2 })
