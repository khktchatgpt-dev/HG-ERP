'use client'

import Link from 'next/link'
import { Panel, TH, TD, NUM } from '../../_erp/ui'
import {
  EDGE,
  GhiChuNoiBo,
  GIA_TIP,
  INT,
  INT_HEAD,
  NHOM,
  NhomTh,
  fmtPct,
  useAnGiaNoiBo,
} from '../../_erp/gia-noi-bo'
import { quoteNetPrice } from '@/lib/quote-price'
import { checkPrice, PRICE_NAME, type PlanPrice } from '@/lib/sale-price'
import { fmtMoney, fmtN } from './bao-gia.shared'
import type { BaoGiaCtx } from './useBaoGia'

/**
 * LƯỚI DÒNG của chi tiết báo giá (khuôn D) — artboard bước 2, 13/10/2026.
 *
 *   # · Sản phẩm · SL │ GỬI KHÁCH: Giá trước CK · CK% · Giá chào · Thành tiền
 *                     │ NỘI BỘ:    Giá vốn KH · Giá bán KH · ± Bán KH · Lãi thực
 *
 * Nhóm nội bộ đọc số CHỤP lúc chào khi có (0235), không thì số hiện tại; tiêu đề
 * nhóm nói rõ là loại nào. Số chụp lệch số hiện tại thì ghi "hiện X" ngay trong
 * ô — không giấu trong tooltip.
 */

function planNote(plan: PlanPrice | null, now: PlanPrice | null, snap: boolean) {
  if (!plan) return `SP chưa có ${PRICE_NAME.plan}`
  const one = (p: PlanPrice) =>
    `vốn ${p.cost != null ? fmtMoney(p.cost) : '—'} · bán KH ${fmtMoney(p.price)} ${p.currency}`
  if (!snap) return `Số hiện tại (dòng lập trước khi chụp giá vốn): ${one(plan)}`
  if (now && (now.price !== plan.price || now.cost !== plan.cost))
    return `Lúc chào: ${one(plan)} — hiện: ${one(now)}`
  return `Lúc chào: ${one(plan)}`
}

export function KhoiBaoGiaDong({ d }: { d: BaoGiaCtx }) {
  const an = useAnGiaNoiBo()
  const cost = d.canSeeCost && !an.hidden
  const cols = 7 + (cost ? 4 : 0)
  const snap = d.lines.some((l) => l.plan_is_snapshot)
  return (
    <Panel
      title="Dòng sản phẩm"
      count={d.lines.length}
      label="Dòng sản phẩm"
      note={
        cost && d.tong.below > 0 ? (
          <span className="text-[var(--stop)]">
            {d.tong.below} dòng chào DƯỚI {PRICE_NAME.cost} — bán lỗ
          </span>
        ) : cost && d.tong.belowPlan > 0 ? (
          <span className="text-[var(--warn)]">
            {d.tong.belowPlan} dòng chào thấp hơn {PRICE_NAME.plan}
          </span>
        ) : d.tong.zero > 0 ? (
          <span className="text-[var(--warn)]">{d.tong.zero} dòng chưa có đơn giá</span>
        ) : undefined
      }
      actions={
        <span className="flex items-center gap-3">
          <GhiChuNoiBo
            canSee={d.canSeeCost}
            hidden={an.hidden}
            cols={4}
            onShow={an.toggle}
          />
          {d.can.edit && (
            <Link
              href={`/sales/quotes/${d.quote.id}/edit`}
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Sửa dòng
            </Link>
          )}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col />
            <col className="w-[72px]" />
            <col className="w-[104px]" />
            <col className="w-[56px]" />
            <col className="w-[92px]" />
            <col className="w-[104px]" />
            {cost && (
              <>
                <col className="w-[96px]" />
                <col className="w-[96px]" />
                <col className="w-[84px]" />
                <col className="w-[80px]" />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              <NhomTh kind="trong" colSpan={3} />
              <NhomTh kind="khach" colSpan={4}>
                {NHOM.quote}
              </NhomTh>
              {cost && (
                <NhomTh kind="noi-bo" colSpan={4}>
                  {snap ? 'Nội bộ · số chụp lúc chào' : `${NHOM.int} · số hiện tại`}
                </NhomTh>
              )}
            </tr>
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Sản phẩm · mã khách</th>
              <th className={`${TH} text-right`}>SL/MOQ</th>
              <th className={`${TH} text-right`}>Giá trước CK</th>
              <th className={`${TH} text-right`}>CK%</th>
              <th className={`${TH} text-right`}>{PRICE_NAME.quote}</th>
              <th className={`${TH} text-right`}>Thành tiền</th>
              {cost && (
                <>
                  <th
                    className={`${TH} ${INT_HEAD} ${EDGE} text-right`}
                    title={GIA_TIP.cost}
                  >
                    {PRICE_NAME.cost}
                  </th>
                  <th className={`${TH} ${INT_HEAD} text-right`} title={GIA_TIP.plan}>
                    {PRICE_NAME.plan}
                  </th>
                  <th className={`${TH} ${INT_HEAD} text-right`} title={GIA_TIP.vs}>
                    ± Bán KH
                  </th>
                  <th className={`${TH} ${INT_HEAD} text-right`} title={GIA_TIP.lai}>
                    Lãi thực
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => {
              const net = quoteNetPrice(l.unit_price, l.discount_pct)
              const chk = checkPrice(net, d.quote.currency, l.plan)
              const mm = chk.currency_mismatch
              const moved =
                l.plan_is_snapshot &&
                l.plan_now != null &&
                l.plan != null &&
                l.plan_now.cost !== l.plan.cost
              const flag = !cost
                ? ''
                : chk.below_cost
                  ? 'shadow-[inset_3px_0_0_var(--stop)]'
                  : chk.below_plan
                    ? 'shadow-[inset_3px_0_0_var(--warn)]'
                    : ''
              return (
                <tr key={l.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground ${flag}`}>
                    {i + 1}
                  </td>
                  <td className={`${TD} min-w-0`}>
                    <span className="block truncate" title={l.product_name}>
                      {l.product_name}
                    </span>
                    <span className="text-muted-foreground block truncate text-[11px] leading-4">
                      <Link
                        href={`/products/${l.product_id}`}
                        className="font-mono text-[var(--primary)] hover:underline"
                      >
                        {l.product_code}
                      </Link>
                      {l.customer_item_code && (
                        <span className="font-mono"> · {l.customer_item_code}</span>
                      )}
                      {l.product_unit && <span> · {l.product_unit}</span>}
                      {l.packing_text && <span> · {l.packing_text}</span>}
                      {l.note && <span title={l.note}> · ghi chú: {l.note}</span>}
                    </span>
                  </td>
                  <td className={`${TD} ${NUM} ${l.qty ? '' : 'text-muted-foreground'}`}>
                    {l.qty ? fmtN(l.qty) : '—'}
                  </td>
                  <td
                    className={`${TD} ${NUM} ${l.unit_price > 0 ? '' : 'text-[var(--warn)]'}`}
                  >
                    {l.unit_price > 0 ? fmtMoney(l.unit_price) : 'giá 0'}
                  </td>
                  <td className={`${TD} ${NUM} text-muted-foreground`}>
                    {l.discount_pct ? l.discount_pct : '—'}
                  </td>
                  <td
                    className={`${TD} ${NUM} font-semibold ${cost && chk.below_cost ? 'text-[var(--stop)]' : ''}`}
                  >
                    {net > 0 ? fmtMoney(net) : '—'}
                  </td>
                  <td className={`${TD} ${NUM} ${l.qty ? '' : 'text-muted-foreground'}`}>
                    {net > 0 && l.qty ? fmtMoney(net * l.qty) : '—'}
                  </td>
                  {cost && (
                    <>
                      <td
                        className={`${TD} ${NUM} ${INT} ${EDGE} text-muted-foreground`}
                        title={planNote(l.plan, l.plan_now, l.plan_is_snapshot)}
                      >
                        {l.plan?.cost != null
                          ? `${fmtMoney(l.plan.cost)}${mm ? ` ${l.plan.currency}` : ''}`
                          : l.plan
                            ? 'chưa bóc'
                            : '—'}
                        {moved && (
                          <span className="block text-[11px] leading-3">
                            hiện{' '}
                            {l.plan_now!.cost != null
                              ? fmtMoney(l.plan_now!.cost)
                              : 'chưa bóc'}
                          </span>
                        )}
                      </td>
                      <td className={`${TD} ${NUM} ${INT} text-muted-foreground`}>
                        {l.plan
                          ? `${fmtMoney(l.plan.price)}${mm ? ` ${l.plan.currency}` : ''}`
                          : '—'}
                      </td>
                      <td
                        className={`${TD} ${NUM} ${INT} ${chk.vs_plan_pct != null && chk.vs_plan_pct < 0 ? 'text-[var(--warn)]' : 'text-muted-foreground'}`}
                      >
                        {fmtPct(chk.vs_plan_pct, true)}
                      </td>
                      <td
                        className={`${TD} ${NUM} ${INT} ${chk.lai_pct == null ? 'text-muted-foreground' : chk.lai_pct < 0 ? 'text-[var(--stop)]' : ''}`}
                      >
                        {fmtPct(chk.lai_pct)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
            {d.lines.length === 0 && (
              <tr>
                <td
                  colSpan={cols}
                  className={`${TD} text-muted-foreground py-6 text-center`}
                >
                  Báo giá chưa có dòng — bấm Sửa để thêm sản phẩm.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 font-medium">
              <td className={`${TD} border-b-0`} colSpan={2}>
                Cộng {d.lines.length} dòng
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  · trị giá tham chiếu = Σ giá chào × SL, KHÔNG gồm dòng thiếu SL
                  {d.tong.noQty ? ` (${d.tong.noQty} dòng)` : ''}
                </span>
              </td>
              <td className={`${TD} ${NUM} border-b-0`}>
                {fmtN(d.lines.reduce((s, l) => s + (l.qty ?? 0), 0))}
              </td>
              <td className={`${TD} border-b-0`} colSpan={3} />
              <td className={`${TD} ${NUM} border-b-0`}>
                {d.tong.ref > 0 ? fmtMoney(d.tong.ref) : '—'}
              </td>
              {cost && (
                <>
                  <td
                    className={`${TD} ${INT_HEAD} ${EDGE} text-muted-foreground border-b-0 font-normal`}
                    colSpan={3}
                    title="Σ (giá chào − giá vốn KH) × SL — chỉ dòng có SL và có giá vốn cùng tiền tệ"
                  >
                    Σ lãi{' '}
                    <span
                      className={`font-mono ${d.tong.gain != null && d.tong.gain < 0 ? 'text-[var(--stop)]' : 'text-foreground'}`}
                    >
                      {d.tong.gain == null ? '—' : fmtMoney(d.tong.gain)}
                    </span>{' '}
                    {d.quote.currency}
                  </td>
                  <td
                    className={`${TD} ${NUM} ${INT_HEAD} border-b-0 ${d.tong.avgLai != null && d.tong.avgLai < 0 ? 'text-[var(--stop)]' : ''}`}
                    title="Lãi thực bình quân, gia quyền theo trị giá (dòng thiếu SL tính 1)"
                  >
                    {fmtPct(d.tong.avgLai)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}
