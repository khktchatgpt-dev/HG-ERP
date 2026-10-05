'use client'

import { Btn, Grid, GridBody, GridFoot, GridHead, GridRow, Sheet, Tag, Td, Th, WhyBox } from '@/components/kit' // prettier-ignore
import type { GtdRow } from '@/lib/gia-tri-don'
import type { LaiLoRow } from '@/lib/lai-lo'
import { STATUS_LABEL as ORDER_STATUS_LABEL } from '@/lib/order-progress'
import { poStatusLabel } from '@/lib/po-status'
import { ccy, dmy, missingText, vnd } from './gia-tri-don.shared'
import { PhanTich } from './phan-tich'

/**
 * NGĂN SOI MỘT LỆNH — phủ bên phải, bảng phía sau vẫn đọc được.
 *
 * Hai bảng liệt kê ĐÚNG những chứng từ đã cộng thành con số trên dòng: từng
 * đơn bán (mã · ngày giao · tiền gốc · tỷ giá · VND · dòng có giá) và từng đơn
 * mua (mã · NCC · trạng thái · tiền · VND). Chân mỗi bảng khớp ô trên dòng —
 * con số là một lời hứa, bảng này là nơi kiểm lời hứa đó.
 *
 * Đầu ngăn là PHÂN TÍCH LÃI / LỖ của lệnh (03/10/2026 — trang /exec/lai-lo gỡ,
 * phần phân tích dời vào đây), xem `PhanTich`.
 */
export function SoiLenh({
  row: r,
  phanTich,
  onClose,
}: {
  row: GtdRow
  /** Dòng phân tích lãi / lỗ của lệnh; undefined = người xem không có quyền xem giá thành KH. */
  phanTich: LaiLoRow | null | undefined
  onClose: () => void
}) {
  const sub = [r.customer_name, `${r.order_count} đơn bán`, `${r.po_count} đơn mua`]
    .filter(Boolean)
    .join(' · ')
  const h3 =
    'text-k-label mb-1 font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase'
  const dash = <span className="text-[var(--ink-empty)]">—</span>

  return (
    <Sheet open onClose={onClose} title={r.code} subtitle={sub} stakes="nhe" width={700}>
      <div className="flex flex-col gap-4">
        <PhanTich row={phanTich} />

        <section>
          <h3 className={h3}>
            Đơn bán của lệnh · {r.order_count} đơn · {r.priced_lines}/{r.order_lines} dòng
            có giá
          </h3>
          {r.orders.length === 0 ? (
            <div className="text-k-sm text-[var(--ink-3)]">
              Chưa có đơn bán nào gắn lệnh này — Bán hàng tạo đơn rồi gắn vào lệnh.
            </div>
          ) : (
            <Grid minWidth={460}>
              <GridHead>
                <Th>Đơn</Th>
                <Th width={72}>Giao</Th>
                <Th num width={110}>
                  Tiền gốc
                </Th>
                <Th num width={64}>
                  Tỷ giá
                </Th>
                <Th num width={110}>
                  VND
                </Th>
                <Th num width={64}>
                  Có giá
                </Th>
              </GridHead>
              <GridBody>
                {r.orders.map((o) => (
                  <GridRow key={o.id}>
                    <Td>
                      <span className="num">{o.code}</span>
                      <div className="text-k-label leading-tight text-[var(--ink-3)]">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </div>
                    </Td>
                    <Td>
                      <span className="num">{dmy(o.due_date)}</span>
                    </Td>
                    <Td num>{o.amount === 0 ? dash : ccy(o.amount, o.currency)}</Td>
                    <Td num>
                      {o.currency === 'VND' ? (
                        '—'
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
                <Td colSpan={2}>Cộng</Td>
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
          <h3 className={h3}>Đơn mua cho lệnh · {r.po_count} đơn</h3>
          {r.pos.length === 0 ? (
            <div className="text-k-sm text-[var(--ink-3)]">
              Chưa có đơn mua nào gắn lệnh này.
            </div>
          ) : (
            <Grid minWidth={460}>
              <GridHead>
                <Th>Đơn</Th>
                <Th>Nhà cung cấp</Th>
                <Th num width={110}>
                  Tiền gốc
                </Th>
                <Th num width={110}>
                  VND
                </Th>
              </GridHead>
              <GridBody>
                {r.pos.map((p) => (
                  <GridRow key={p.id}>
                    <Td>
                      <span className="num">{p.code}</span>
                      <div className="text-k-label leading-tight text-[var(--ink-3)]">
                        {poStatusLabel(p.status)}
                        {p.extra_lsx ? ' · gộp lệnh' : ''}
                      </div>
                    </Td>
                    <Td>
                      <span
                        className="block max-w-[150px] truncate"
                        title={p.supplier_name}
                      >
                        {p.supplier_name}
                      </span>
                    </Td>
                    <Td num>{ccy(p.amount, p.currency)}</Td>
                    <Td num>
                      {p.vnd == null ? <Tag tone="warn">chưa tỷ giá</Tag> : vnd(p.vnd)}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
              <GridFoot>
                <Td colSpan={3}>Cộng · {vnd(r.po_draft_vnd)} còn ở nháp</Td>
                <Td num>{vnd(r.po_vnd.vnd)}</Td>
              </GridFoot>
            </Grid>
          )}
          <WhyBox
            lines={[
              `Đơn bán = Σ SL × đơn giá trên ${r.order_count} đơn gắn lệnh, quy VND theo tỷ giá chốt từng đơn`,
              `Đơn mua = Σ ${r.po_count} đơn gắn lệnh chưa huỷ, kể cả ${vnd(r.po_draft_vnd)} còn ở nháp / chờ duyệt`,
              ...r.po_vnd.missing.map((m) => `${ccy(m.amount, m.currency)} đơn mua chưa quy — chưa có tỷ giá chốt`), // prettier-ignore
              ...(r.po_extra_lsx > 0 ? [`${r.po_extra_lsx} đơn mua gộp nhiều lệnh đang tính TRỌN cho lệnh này`] : []), // prettier-ignore
            ]}
            result={`Bán ${vnd(r.order_vnd.vnd)} · Mua ${vnd(r.po_vnd.vnd)} VND — chênh lệch tính ở bước sau`}
          />
        </section>

        <div className="flex flex-wrap gap-2">
          <Btn icon="lenh" href={`/exec/lsx/${r.lsx_id}`}>
            Hồ sơ lệnh
          </Btn>
          <Btn icon="don" href={`/mua-hang/don?lsx=${r.lsx_id}&pham_vi=phong`}>
            Sổ đơn mua của lệnh
          </Btn>
          <Btn icon="tien" href="/finance/theo-lenh">
            Tiền theo lệnh (Kế toán)
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}
