'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Panel, TH, TD, NUM } from '../../_erp/ui'
import { shipWeekLabel } from '@/lib/ship-week'
import { fmtD, fmtMoney, fmtN, type DongView } from './don-hang.shared'
import type { DonHangCtx } from './useDonHang'

/**
 * LƯỚI DÒNG SẢN PHẨM — nhân vật chính của màn chứng từ (tiêu chí ERP #1):
 * STT · Ảnh · Mã SP (mã khách dòng dưới) · Tên · ĐVT · SL · Đã xuất · Còn ·
 * Tuần giao · Đơn giá · Thành tiền · Ghi chú (12 cột). Bề rộng khai cố định
 * (`table-fixed`) để vừa 1280 không tràn; ảnh bấm mở xem lớn. Chân bảng: Cộng +
 * tổng, nói rõ tổng chưa gồm gì.
 */
export function KhoiDong({ d }: { d: DonHangCtx }) {
  const { lines, order, tong } = d
  const noPrice = lines.length - tong.priced
  const [xem, setXem] = useState<DongView | null>(null)
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
          <colgroup>
            <col className="w-9" />
            <col className="w-12" />
            <col className="w-[118px]" />
            <col />
            <col className="w-11" />
            <col className="w-[64px]" />
            <col className="w-[68px]" />
            <col className="w-[60px]" />
            <col className="w-[92px]" />
            <col className="w-[84px]" />
            <col className="w-[100px]" />
            <col className="w-[104px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={`${TH} text-center`}>Ảnh</th>
              <th className={TH}>Mã SP · mã khách</th>
              <th className={TH}>Tên sản phẩm</th>
              <th className={TH}>ĐVT</th>
              <th className={`${TH} text-right`}>SL</th>
              <th className={`${TH} text-right`}>Đã xuất</th>
              <th className={`${TH} text-right`}>Còn</th>
              <th className={TH}>Tuần giao</th>
              <th className={`${TH} text-right`}>Đơn giá</th>
              <th className={`${TH} text-right`}>Thành tiền</th>
              <th className={TH}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const left = Math.max(l.qty - l.shipped, 0)
              return (
                <tr key={l.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
                  <td className={`${TD} px-1 text-center`}>
                    <AnhSp
                      src={l.image_url}
                      alt={l.product_name}
                      onOpen={() => setXem(l)}
                    />
                  </td>
                  <td className={`${TD} min-w-0`}>
                    <Link
                      href={`/products/${l.product_id}`}
                      className="block truncate font-mono text-xs text-[var(--primary)] hover:underline"
                    >
                      {l.product_code}
                    </Link>
                    <span className="text-muted-foreground block truncate font-mono text-[11px] leading-4">
                      {l.customer_item_code ?? '—'}
                      {l.bom_status !== 'done' && (
                        <span
                          className="ml-1 text-[var(--warn)]"
                          title="Hồ sơ SP chưa có định mức"
                        >
                          · chưa BOM
                        </span>
                      )}
                    </span>
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
                  <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                    {l.ship_date ? (
                      <>
                        <span className="block leading-4">
                          {shipWeekLabel(l.ship_date)}
                        </span>
                        <span className="text-muted-foreground block text-[11px] leading-4">
                          {fmtD(l.ship_date)}
                        </span>
                      </>
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
              <td className={`${TD} ${NUM} border-b-0 whitespace-nowrap`}>
                {fmtMoney(tong.value)}{' '}
                <span className="text-muted-foreground">{order.currency}</span>
              </td>
              <td className={`${TD} border-b-0`} />
            </tr>
          </tfoot>
        </table>
      </div>
      {xem && <AnhLon line={xem} onClose={() => setXem(null)} />}
    </Panel>
  )
}

/** Ảnh nhỏ 36px — bấm mở ảnh lớn; không ảnh → ô trống cùng cỡ để hàng thẳng. */
function AnhSp({
  src,
  alt,
  onOpen,
}: {
  src: string | null
  alt: string
  onOpen: () => void
}) {
  if (!src)
    return (
      <span
        className="border-border bg-muted inline-block h-9 w-9 rounded-sm border align-middle"
        title="Chưa có ảnh — thêm ở hồ sơ SP"
      />
    )
  return (
    <button type="button" onClick={onOpen} className="align-middle" title="Xem ảnh lớn">
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh ký sẵn, không qua next/image */}
      <img
        src={src}
        alt={alt}
        width={36}
        height={36}
        className="border-border bg-card h-9 w-9 rounded-sm border object-contain hover:border-[var(--primary)]"
      />
    </button>
  )
}

/** Ảnh lớn phủ màn — Esc hoặc bấm nền để đóng. */
function AnhLon({ line, onClose }: { line: DongView; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])
  if (!line.image_url) return null
  return (
    <div
      role="dialog"
      aria-label={`Ảnh ${line.product_code}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="bg-card flex max-h-full max-w-4xl flex-col rounded-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-border flex items-center gap-3 border-b px-3 py-2 text-[13px]">
          <span className="font-mono font-semibold">{line.product_code}</span>
          <span className="text-muted-foreground truncate">{line.product_name}</span>
          <span className="flex-1" />
          <Link
            href={`/products/${line.product_id}`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Hồ sơ SP
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground px-1"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh ký sẵn, không qua next/image */}
        <img
          src={line.image_url}
          alt={line.product_name}
          className="max-h-[80vh] object-contain p-2"
        />
      </div>
    </div>
  )
}
