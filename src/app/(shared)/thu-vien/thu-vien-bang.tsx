'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Menu } from '@/components/kit'
import {
  AnhNho,
  fmtGia,
  fmtKg,
  fmtKt,
  KHUNG_LABEL,
  OHoSo,
  TagDinhMuc,
  type LibraryRow,
  type ThuVienFilters,
} from './thu-vien.shared'
import type { ThuVienCtx } from './useThuVien'

/**
 * Cột nào hiện ở bề rộng nào — đo bằng ResizeObserver rồi BỎ HẲN cột khỏi
 * DOM (không ẩn bằng CSS: `table-layout: fixed` của Chrome chia bề rộng sai
 * khi ô tiêu đề display:none, đo 08/10/2026). Không bao giờ cuộn ngang.
 */
export type CotHien = {
  loai: boolean
  kt: boolean
  nwgw: boolean
  lenh: boolean
  gia: boolean
}
function cotTheoRong(w: number, canPrice: boolean): CotHien {
  const lg = w >= 1180
  const md = w >= 880
  return { loai: lg, kt: md, nwgw: lg, lenh: lg, gia: canPrice && md }
}

/**
 * BẢNG PHẲNG — đúng artboard "Màn 1 · Danh sách": mỗi SP một dòng; SP bộ có
 * các hàng món thụt lề ngay dưới. 12 cột, Giá KH chỉ khi được thấy giá.
 */
export function BangThuVien({
  d,
  rows,
  total,
  page,
  filters,
  canPrice,
}: {
  d: ThuVienCtx
  rows: LibraryRow[]
  total: number
  page: number
  filters: ThuVienFilters
  canPrice: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [cot, setCot] = useState<CotHien>(() => cotTheoRong(1400, canPrice))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setCot(cotTheoRong(e.contentRect.width, canPrice)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [canPrice])
  const soCot = 7 + Object.values(cot).filter(Boolean).length
  const tu = total === 0 ? 0 : (page - 1) * 60 + 1
  const thieuTrenTrang = rows.filter((r) =>
    Object.values(r.check).includes('thieu'),
  ).length

  return (
    <div className="scroll" ref={ref}>
      <table aria-label="Thư viện sản phẩm" className="bang">
        <thead>
          <tr>
            <th style={{ width: 34 }}>
              <span className="sr">Ảnh</span>
            </th>
            <th style={{ width: 104 }}>Mã HG</th>
            <th>Tên sản phẩm</th>
            <th style={{ width: 150 }}>Khách · mã KH</th>
            {cot.loai && <th style={{ width: 64 }}>Loại</th>}
            {cot.kt && (
              <th className="num" style={{ width: 118 }}>
                KTSP (mm)
              </th>
            )}
            {cot.nwgw && (
              <th className="num" style={{ width: 86 }}>
                NW / GW
              </th>
            )}
            <th style={{ width: 190 }}>Hồ sơ</th>
            <th style={{ width: 124 }}>Định mức</th>
            {cot.lenh && (
              <th
                className="num"
                style={{ width: 48 }}
                title="Số lệnh sản xuất chưa xong có SP này"
              >
                Lệnh
              </th>
            )}
            {cot.gia && (
              <th className="num" style={{ width: 86 }}>
                Giá KH
              </th>
            )}
            <th style={{ width: 36 }}>
              <span className="sr">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <DongSp key={r.id} d={d} r={r} cot={cot} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              {total.toLocaleString('vi-VN')} SP · hiện {tu}–{tu + rows.length - 1}
              {filters.tt === 'active' && ' · không gồm SP ngừng dùng'}
            </td>
            <td colSpan={soCot - 4} style={{ fontWeight: 400 }}>
              {thieuTrenTrang}/{rows.length} dòng trên trang còn thiếu hồ sơ.{' '}
              {canPrice && 'Giá KH là giá kế hoạch của Bán hàng, không phải giá thành.'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DongSp({ d, r, cot }: { d: ThuVienCtx; r: LibraryRow; cot: CotHien }) {
  const kt = fmtKt(r.length_mm, r.width_mm, r.height_mm)
  const nw = fmtKg(r.net_weight_kg)
  const gw = fmtKg(r.gw_kg)
  return (
    <>
      <tr>
        <td>
          {r.image_url ? (
            <button
              type="button"
              className="thumbbtn"
              aria-label={`Phóng to ảnh ${r.code}`}
              onClick={() => d.setPreview({ row: r, url: r.image_url! })}
            >
              <AnhNho url={r.image_url} alt="" />
            </button>
          ) : (
            <AnhNho url={null} alt="" />
          )}
        </td>
        <td>
          <Link className="code" href={`/thu-vien/${r.id}`} title={`Mở hồ sơ ${r.code}`}>
            {r.code}
          </Link>
        </td>
        <td title={r.name}>
          {r.name}
          {r.is_set && (
            <span className="tag run" style={{ marginLeft: 6 }}>
              BỘ · {r.children.length} món
            </span>
          )}
          {!r.is_active && (
            <span className="tag" style={{ marginLeft: 6 }}>
              Ngừng dùng
            </span>
          )}
          {r.locked_at && (
            <span className="tag done" style={{ marginLeft: 6 }}>
              Đã khoá
            </span>
          )}
        </td>
        <td title={`${r.customer_name ?? 'Mẫu chung'} · ${r.customer_item_code ?? ''}`}>
          {r.customer_name ?? <span className="muted">Mẫu chung</span>}
          {r.customer_item_code && (
            <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>
              {r.customer_item_code}
            </span>
          )}
        </td>
        {cot.loai && (
          <td
            className="muted"
            title={`${r.product_type ?? ''} · ${KHUNG_LABEL[r.frame_material ?? ''] ?? ''}`}
          >
            {r.product_type ?? '—'} · {r.frame_material ?? '—'}
          </td>
        )}
        {cot.kt && (
          <td className={cn('num', !kt && !r.is_set && 'red')}>
            {kt || (r.is_set ? <span className="muted">theo món</span> : 'thiếu')}
          </td>
        )}
        {cot.nwgw && (
          <td className={cn('num', !nw && !gw && !r.is_set && 'red')}>
            {nw || gw ? (
              `${nw || '—'} / ${gw || '—'}`
            ) : r.is_set ? (
              <span className="muted">—</span>
            ) : (
              'thiếu'
            )}
          </td>
        )}
        <td>
          <OHoSo check={r.check} />
        </td>
        <td>
          <TagDinhMuc status={r.bom_status} parts={r.parts} check={r.check} />
        </td>
        {cot.lenh && (
          <td className="num">{r.lsx_open || <span className="muted">0</span>}</td>
        )}
        {cot.gia && (
          <td className="num">
            {fmtGia(r.plan_price, r.plan_currency) || <span className="muted">—</span>}
          </td>
        )}
        <td>
          <Menu items={d.menu(r)} ariaLabel={`Thao tác với ${r.code}`} />
        </td>
      </tr>
      {r.children.map((c, i) => (
        <tr key={c.id ?? `${r.id}-${i}`} className="child">
          <td>
            <AnhNho url={c.image_url} alt="" />
          </td>
          <td>
            {c.id && c.code ? (
              <Link
                className="code"
                href={`/thu-vien/${c.id}`}
                title={`Mở hồ sơ ${c.code}`}
              >
                {c.code}
              </Link>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>
                chưa có hồ sơ
              </span>
            )}
          </td>
          <td title={c.name}>
            └ {c.name}{' '}
            <span className="muted" style={{ fontSize: 11 }}>
              ×{c.qty}
            </span>
          </td>
          <td className="muted">↑ cùng bộ</td>
          {cot.loai && (
            <td className="muted">
              {c.product_type ?? '—'} · {c.frame_material ?? '—'}
            </td>
          )}
          {cot.kt && (
            <td className="num muted">
              {fmtKt(c.length_mm, c.width_mm, c.height_mm) || '—'}
            </td>
          )}
          {cot.nwgw && (
            <td className="num muted">
              {fmtKg(c.net_weight_kg) ? `${fmtKg(c.net_weight_kg)} / —` : '—'}
            </td>
          )}
          <td>
            {c.check ? <OHoSo check={c.check} /> : <span className="muted">—</span>}
          </td>
          <td>
            {c.check ? (
              <TagDinhMuc
                status={c.parts > 0 ? 'done' : 'none'}
                parts={c.parts}
                check={c.check}
              />
            ) : (
              <span className="muted">—</span>
            )}
          </td>
          {cot.lenh && <td className="num muted">{c.lsx_open || 0}</td>}
          {cot.gia && <td className="num muted">theo bộ</td>}
          <td />
        </tr>
      ))}
    </>
  )
}
