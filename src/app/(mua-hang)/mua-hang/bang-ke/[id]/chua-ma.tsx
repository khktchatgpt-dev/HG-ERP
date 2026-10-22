'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { partGroupLabel } from '@/lib/part-groups'
import { NUM, TD, TH } from '../../_erp/ui'
import { so } from './ke-hoach.shared'
import type { KeHoachCtx } from './useKeHoachMua'

const LINK = 'text-[var(--act-text)] underline-offset-2 hover:underline'

/**
 * VẬT TƯ TRONG ĐỊNH MỨC CHƯA CÓ MÃ KHO (22/10/2026). Bảng kê chỉ tính được dòng
 * đã gắn mã; dòng chưa gắn trước đây biến mất im lặng — lệnh GIGA có 21 loại
 * ngũ kim trong BOM mà bảng chỉ hiện 9. Khối này bày chúng ra kèm số cần cả
 * lệnh, để người mua thấy còn thứ phải mua và biết đó có phải vật tư mới không.
 * Gập sẵn; dòng đầu kể vài tên để không phải mở mới biết có gì.
 */
export function KhoiChuaMa({ d }: { d: KeHoachCtx }) {
  const { chua_ma, products } = d.bk
  const { items, frame_lines } = chua_ma
  if (items.length === 0 && frame_lines === 0) return null
  const spId = new Map(products.map((p) => [p.code, p.id]))
  const vaiTen = items
    .slice(0, 4)
    .map((i) => i.name)
    .join(', ')
  return (
    <section
      id="kh-chua-ma"
      className="shrink-0 border-b border-[var(--warn-line)] bg-[var(--warn-wash)]"
    >
      <button
        type="button"
        aria-expanded={d.moChuaMa}
        onClick={() => d.setMoChuaMa(!d.moChuaMa)}
        className="flex w-full items-baseline gap-2 px-4 py-1.5 text-left text-[12.5px]"
      >
        <span aria-hidden>{d.moChuaMa ? '▾' : '▸'}</span>
        <span className="font-semibold text-[var(--warn)]">
          {items.length} vật tư trong định mức chưa có mã kho — số của chúng CHƯA có trong
          bảng kê
        </span>
        {items.length > 0 && (
          <span className="min-w-0 truncate text-[var(--ink-2)]">
            · {vaiTen}
            {items.length > 4 ? '…' : ''}
          </span>
        )}
      </button>
      {d.moChuaMa && (
        <div className="max-h-[280px] overflow-auto bg-[var(--surface-card)] px-4 pb-2">
          <p className="py-1.5 text-[12px] text-[var(--ink-2)]">
            Có thể là vật tư MỚI (kho chưa có mã) hoặc chỉ là Kỹ thuật chưa gắn mã. Tìm
            trong danh mục trước; chưa có thì tạo mã, rồi gắn mã vào hồ sơ SP — khi đó số
            cần tự vào bảng kê.
          </p>
          {items.length > 0 && (
            <table className="w-full table-fixed border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className={`${TH} w-[72px]`}>Loại</th>
                  <th className={`${TH} w-[260px]`}>Tên trong định mức</th>
                  <th className={`${TH} w-[56px]`}>ĐVT</th>
                  <th className={TH}>Định mức theo SP</th>
                  <th className={`${TH} w-[110px] text-right`}>Cần cả lệnh</th>
                  <th className={`${TH} w-[140px]`}>Việc</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.key} className="align-top">
                    <td className={`${TD} text-[var(--ink-2)]`}>
                      {partGroupLabel(it.kind) ?? '—'}
                    </td>
                    <td className={TD}>
                      <b className="font-semibold">{it.name}</b>
                      {it.quy_cach && (
                        <span className="font-mono text-[11.5px]"> {it.quy_cach}</span>
                      )}
                      {it.note && (
                        <span className="text-[var(--ink-3)]"> · {it.note}</span>
                      )}
                      {it.aliases.length > 0 && (
                        <span className="block text-[11px] text-[var(--ink-3)]">
                          còn ghi: {it.aliases.join(', ')}
                        </span>
                      )}
                      {it.bad_code && (
                        <span className="block text-[11px] text-[var(--stop)]">
                          ghi mã {it.bad_code} — danh mục không có mã này
                        </span>
                      )}
                    </td>
                    <td className={TD}>{it.unit ?? '—'}</td>
                    <td className={`${TD} text-[var(--ink-2)]`}>
                      {it.products.map((p, i) => {
                        const pid = spId.get(p.code)
                        return (
                          <Fragment key={p.product_id}>
                            {i > 0 && ' · '}
                            <span className="whitespace-nowrap">
                              {pid ? (
                                <Link
                                  href={`/products/${pid}/dinh-muc`}
                                  className={`font-mono ${LINK}`}
                                >
                                  {p.code}
                                </Link>
                              ) : (
                                <span className="font-mono">{p.code}</span>
                              )}{' '}
                              {p.per == null ? '?' : so(p.per)} × {so(p.qty)}
                            </span>
                          </Fragment>
                        )
                      })}
                    </td>
                    <td className={`${TD} ${NUM} font-semibold`}>
                      {it.qty_total == null ? 'chưa rõ' : so(it.qty_total)}
                    </td>
                    <td className={TD}>
                      <Link
                        href={`/mua-hang/vat-tu?q=${encodeURIComponent(it.name)}`}
                        className={LINK}
                      >
                        Tìm trong danh mục
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {frame_lines > 0 && (
            <p className="pt-1.5 text-[12px] text-[var(--ink-3)]">
              + {frame_lines} dòng khung chưa gắn mã — đặt tên theo vị trí (chân, tay
              vịn…), mua theo quy cách cắt nên không liệt kê ở đây.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
