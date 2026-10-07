'use client'

import Link from 'next/link'
import { Panel, TH, TD, NUM, Nhan } from '../../_erp/ui'
import { shipWeekLabel } from '@/lib/ship-week'
import { fmtD, fmtMoney, fmtN } from './don-hang.shared'
import type { DonHangCtx } from './useDonHang'

/**
 * LƯỚI DÒNG SẢN PHẨM — nhân vật chính của màn chứng từ (tiêu chí ERP #1):
 * STT · Mã SP · Mã khách · Tên · ĐVT · SL · Đã xuất · Còn · Tuần giao · Đơn giá ·
 * Thành tiền · Ghi chú (12 cột, ≤ trần 11 + STT). Chân bảng: Cộng + tổng, nói
 * rõ tổng chưa gồm gì.
 */
export function KhoiDong({ d }: { d: DonHangCtx }) {
  const { lines, order, tong } = d
  const noPrice = lines.length - tong.priced
  return (
    <Panel
      title="Dòng sản phẩm"
      count={lines.length}
      label="Dòng sản phẩm"
      note={
        order.qty_tolerance_pct
          ? `Dung sai ±${order.qty_tolerance_pct}% — mỗi dòng xuất được tới SL × ${(1 + order.qty_tolerance_pct / 100).toFixed(2)}`
          : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-10 text-right`}>#</th>
              <th className={`${TH} w-[120px]`}>Mã SP</th>
              <th className={`${TH} w-[100px]`}>Mã khách</th>
              <th className={TH}>Tên sản phẩm</th>
              <th className={`${TH} w-12`}>ĐVT</th>
              <th className={`${TH} w-[68px] text-right`}>SL</th>
              <th className={`${TH} w-[72px] text-right`}>Đã xuất</th>
              <th className={`${TH} w-[68px] text-right`}>Còn</th>
              <th className={`${TH} w-[96px]`}>Tuần giao</th>
              <th className={`${TH} w-[88px] text-right`}>Đơn giá</th>
              <th className={`${TH} w-[104px] text-right`}>Thành tiền</th>
              <th className={`${TH} w-[120px]`}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const left = Math.max(l.qty - l.shipped, 0)
              return (
                <tr key={l.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
                  <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                    <Link
                      href={`/products/${l.product_id}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {l.product_code}
                    </Link>
                    {l.bom_status !== 'done' && (
                      <span className="ml-1" title="Hồ sơ SP chưa có định mức">
                        <Nhan tone="warn">BOM</Nhan>
                      </span>
                    )}
                  </td>
                  <td className={`${TD} font-mono text-xs`}>
                    {l.customer_item_code ?? '—'}
                  </td>
                  <td className={`${TD} truncate`} title={l.product_name}>
                    {l.product_name}
                  </td>
                  <td className={`${TD} text-muted-foreground`}>{l.product_unit}</td>
                  <td className={`${TD} ${NUM}`}>{fmtN(l.qty)}</td>
                  <td
                    className={`${TD} ${NUM} ${l.shipped > 0 ? '' : 'text-muted-foreground'}`}
                  >
                    {l.shipped > 0 ? fmtN(l.shipped) : '—'}
                  </td>
                  <td
                    className={`${TD} ${NUM} ${left === 0 ? 'text-[var(--done)]' : ''}`}
                  >
                    {left === 0 ? 'đủ' : fmtN(left)}
                  </td>
                  <td className={`${TD} font-mono text-xs`}>
                    {l.ship_date ? (
                      <span title={fmtD(l.ship_date)}>
                        {shipWeekLabel(l.ship_date)}{' '}
                        <span className="text-muted-foreground">
                          · {fmtD(l.ship_date)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[var(--warn)]">chưa có</span>
                    )}
                  </td>
                  <td
                    className={`${TD} ${NUM} ${l.unit_price > 0 ? '' : 'text-[var(--warn)]'}`}
                  >
                    {l.unit_price > 0 ? fmtMoney(l.unit_price) : 'giá 0'}
                  </td>
                  <td className={`${TD} ${NUM}`}>
                    {l.unit_price > 0 ? fmtMoney(l.qty * l.unit_price) : '—'}
                  </td>
                  <td className={`${TD} truncate text-xs`} title={l.note ?? undefined}>
                    {l.note ?? ''}
                  </td>
                </tr>
              )
            })}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className={`${TD} text-muted-foreground py-6 text-center`}
                >
                  Đơn chưa có dòng sản phẩm — bấm Sửa để thêm.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 font-medium">
              <td className={`${TD} border-b-0`} colSpan={5}>
                Cộng {lines.length} dòng
                {noPrice > 0 && (
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    · thành tiền chưa gồm {noPrice} dòng giá 0
                  </span>
                )}
              </td>
              <td className={`${TD} ${NUM} border-b-0`}>{fmtN(tong.qty)}</td>
              <td className={`${TD} ${NUM} border-b-0`}>{fmtN(tong.shipped)}</td>
              <td className={`${TD} ${NUM} border-b-0`}>{fmtN(tong.left)}</td>
              <td className={`${TD} border-b-0`} />
              <td className={`${TD} border-b-0`} />
              <td className={`${TD} ${NUM} border-b-0`}>
                {fmtMoney(tong.value)}{' '}
                <span className="text-muted-foreground">{order.currency}</span>
              </td>
              <td className={`${TD} border-b-0`} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}
