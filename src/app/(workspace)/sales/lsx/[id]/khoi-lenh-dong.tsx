'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import { Panel, TH, TD, NUM, Nhan } from '../../_erp/ui'
import { fmtN } from './lenh.shared'
import type { LenhCtx } from './useLenh'

/**
 * LƯỚI DÒNG LỆNH theo NHÓM (PO / bộ sưu tập — cấu trúc in, D1): STT · Mã SP ·
 * Mã khách · Tên · ĐVT · SL · CBM · Đợt xuất (theo lô) · Quy cách · Bản — 10
 * cột. Dòng đổi ở bản phát lại hiện nhãn "bản N". Chân: Cộng n dòng + Σ SL.
 */
export function KhoiLenhDong({ d }: { d: LenhCtx }) {
  const l = d.lsx
  return (
    <Panel
      title="Dòng lệnh"
      count={`${d.tong.lines} dòng · ${d.groups.length} nhóm`}
      label="Dòng lệnh"
      note={
        d.tong.bomMissing > 0 ? (
          <span className="text-[var(--warn)]">
            {d.tong.bomMissing} dòng có SP chưa có định mức
          </span>
        ) : undefined
      }
      actions={
        d.can.lines ? (
          <Link
            href={`/sales/lsx/${l.id}/dong`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Soạn dòng lệnh
          </Link>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-10 text-right`}>#</th>
              <th className={`${TH} w-[150px]`}>Mã SP</th>
              <th className={`${TH} w-[150px]`}>Mã khách</th>
              <th className={TH}>Tên</th>
              <th className={`${TH} w-14`}>ĐVT</th>
              <th className={`${TH} w-20 text-right`}>SL</th>
              <th className={`${TH} w-20 text-right`}>CBM</th>
              <th className={`${TH} w-[220px]`}>Đợt xuất</th>
              <th className={`${TH} w-[200px]`}>Quy cách</th>
              <th className={`${TH} w-16`}>Bản</th>
            </tr>
          </thead>
          <tbody>
            {d.groups.map((g) => (
              <Fragment key={g.id}>
                <tr className="bg-muted/50">
                  <td className={`${TD} h-8 text-[13px] font-semibold`} colSpan={10}>
                    {g.title || g.po_no || '(nhóm không tên)'}
                    {g.po_no && g.title && (
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        PO {g.po_no}
                      </span>
                    )}
                    {g.buyer_name && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        · {g.buyer_name}
                      </span>
                    )}
                    {g.sales_order_code && (
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        · đơn {g.sales_order_code}
                      </span>
                    )}
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      {g.lines.length} dòng ·{' '}
                      {fmtN(g.lines.reduce((s, x) => s + x.qty, 0))} SP
                    </span>
                  </td>
                </tr>
                {g.lines.map((x, i) => (
                  <tr key={x.id} className="hover:bg-muted/40">
                    <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
                    <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                      {x.product_id ? (
                        <Link
                          href={`/products/${x.product_id}`}
                          className="text-[var(--primary)] hover:underline"
                        >
                          {x.product_code}
                        </Link>
                      ) : (
                        <span className="text-[var(--warn)]">
                          {x.product_code || 'chưa có mã'}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} font-mono text-xs`}>
                      {x.customer_item_code ?? '—'}
                    </td>
                    <td className={`${TD} truncate`} title={x.name_vi ?? ''}>
                      {x.name_vi ?? '—'}
                    </td>
                    <td className={`${TD} text-muted-foreground`}>{x.unit}</td>
                    <td className={`${TD} ${NUM}`}>{fmtN(x.qty)}</td>
                    <td className={`${TD} ${NUM} text-muted-foreground`}>
                      {x.cbm ? x.cbm.toLocaleString('vi-VN') : '—'}
                    </td>
                    <td
                      className={`${TD} truncate font-mono text-xs`}
                      title={x.ship_text}
                    >
                      {x.ship_text || (
                        <span className="text-[var(--warn)]">chưa có đợt</span>
                      )}
                    </td>
                    <td className={`${TD} truncate text-xs`} title={x.spec_summary}>
                      {x.spec_summary || '—'}
                    </td>
                    <td className={TD}>
                      {x.changed_in_rev &&
                      x.changed_in_rev === l.revision &&
                      l.revision > 1 ? (
                        <Nhan tone="warn">bản {x.changed_in_rev}</Nhan>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {d.tong.lines === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className={`${TD} text-muted-foreground py-6 text-center`}
                >
                  Lệnh chưa có dòng — bấm “Soạn dòng lệnh” để nạp từ đơn và soạn quy cách.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 font-medium">
              <td className={`${TD} border-b-0`} colSpan={5}>
                Cộng {fmtN(d.tong.lines)} dòng
              </td>
              <td className={`${TD} ${NUM} border-b-0`}>{fmtN(d.tong.qty)}</td>
              <td className={`${TD} ${NUM} text-muted-foreground border-b-0`}>
                {fmtN(
                  Math.round(
                    d.groups
                      .flatMap((g) => g.lines)
                      .reduce((s, x) => s + (x.cbm ?? 0), 0) * 100,
                  ) / 100,
                )}
              </td>
              <td className={`${TD} border-b-0`} colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}
