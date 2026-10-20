'use client'

import {
  Grid,
  GridBody,
  GridHead,
  GridRow,
  Tag,
  Td,
  TextLink,
  Th,
} from '@/components/kit'
import { VERDICT_LABEL, type LaiLoRow } from '@/lib/lai-lo'
import { pct, VERDICT_TONE, vnd } from './gia-tri-don.shared'

/**
 * PHÂN TÍCH LÃI / LỖ CỦA MỘT LỆNH — cột phải trang chi tiết lệnh `[id]`
 * (03/10/2026; từ 09/10/2026 trang thay cho ngăn soi).
 *
 * Chủ dự án: "bỏ trang lãi lỗ đi, xem chi tiết sẽ phân tích bên trong". Ba khối
 * chuyển nguyên từ ngăn soi của trang `/exec/lai-lo` đã gỡ, đúng thứ tự Giám đốc
 * hỏi: (1) kết luận, (2) thiếu gì để kết luận — ai điền, ở đâu, (3) theo sản
 * phẩm — SP nào chưa có số kế hoạch. Khối "theo nhà cung cấp" của trang cũ KHÔNG
 * chuyển: bảng đơn mua ngay bên dưới đã liệt kê đúng những đơn đó.
 *
 * `row = undefined` = người xem không có quyền xem giá thành kế hoạch (số riêng
 * của Bán hàng) — nói thẳng vì sao trống thay vì im lặng giấu khối.
 */
export function PhanTich({ row: r }: { row: LaiLoRow | null | undefined }) {
  const h3 =
    'text-k-label mb-1 font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase'

  if (r === undefined)
    return (
      <section>
        <h3 className={h3}>Phân tích lãi / lỗ</h3>
        <div className="text-k-sm text-[var(--ink-3)]">
          Cần quyền xem giá thành kế hoạch (Bán hàng · Kỹ thuật · Ban Giám đốc) — giá
          thành là số riêng của Bán hàng.
        </div>
      </section>
    )
  if (r === null)
    return (
      <section>
        <h3 className={h3}>Phân tích lãi / lỗ</h3>
        <div className="text-k-sm text-[var(--ink-3)]">
          Lệnh này không có trong bảng phân tích — tải lại trang; còn trống thì báo quản
          trị.
        </div>
      </section>
    )

  const planned = r.products.filter((p) => p.price != null).length
  const dash = <span className="text-[var(--ink-empty)]">—</span>

  return (
    <>
      <section>
        <h3 className={h3}>Phân tích lãi / lỗ</h3>
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
        <div className="text-k-label mt-1 text-[var(--ink-3)]">
          Biên dự kiến chưa gồm công khoán, vận chuyển, điện, lương — không phải lãi thật.
        </div>
      </section>

      {r.missing.length > 0 && (
        <section>
          <h3 className={h3}>Thiếu gì để kết luận</h3>
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
        <h3 className={h3}>
          Theo sản phẩm · {planned} có số kế hoạch, {r.products.length - planned} chưa
        </h3>
        <Grid minWidth={460}>
          <GridHead>
            <Th>SP</Th>
            <Th num width={64}>
              SL
            </Th>
            <Th num width={90}>
              FOB KH
            </Th>
            <Th num width={90}>
              GT KH
            </Th>
            <Th num width={84}>
              LN KH
            </Th>
          </GridHead>
          <GridBody>
            {r.products.map((p) => (
              <GridRow key={p.product_id ?? `code:${p.code}`}>
                <Td>
                  <span className={`num ${p.price == null ? 'text-[var(--ink-3)]' : ''}`}>
                    {p.code}
                  </span>
                </Td>
                <Td num>{p.qty.toLocaleString('vi-VN')}</Td>
                <Td num>{p.price == null ? dash : money(p.price, p.currency)}</Td>
                <Td num>
                  {p.direct == null
                    ? dash
                    : money(p.direct + (p.overhead ?? 0), p.currency)}
                </Td>
                <Td num>{p.profit == null ? dash : money(p.profit, p.currency)}</Td>
              </GridRow>
            ))}
          </GridBody>
        </Grid>
        <div className="text-k-label mt-1 text-[var(--ink-3)]">
          Số kế hoạch theo đơn vị, tiền tệ của bản báo giá. GT KH = trực tiếp + chi phí
          chung.
        </div>
      </section>
    </>
  )
}

const money = (n: number, c: string | null) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: c === 'VND' ? 0 : 2 })
