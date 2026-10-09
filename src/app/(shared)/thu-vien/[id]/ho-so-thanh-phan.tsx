'use client'

import Link from 'next/link'
import { Boxes } from 'lucide-react'
import { nz, type HoSoView } from './ho-so.shared'

/** THÀNH PHẦN — món trong BỘ (chỉ hiện khi SP là bộ). Chỉ bày; ghép bộ do nạp BOM. */
export function HoSoThanhPhan({ d }: { d: HoSoView }) {
  if (!d.is_set && d.setItems.length === 0) return null
  return (
    <section
      aria-label="Thành phần"
      id="thanh-phan"
      className="panel"
    >
      <h2 className="ph sec-ls">
        <span className="ic-sec">
          <Boxes aria-hidden />
        </span>
        Thành phần của bộ <span className="n">{d.setItems.length} món</span>
      </h2>
      {d.setItems.length === 0 ? (
        <div className="pad">
          SP được đánh dấu là BỘ nhưng chưa khai món nào — đọc từ file BOM để nạp.
        </div>
      ) : (
        <table aria-label="Món trong bộ">
          <thead>
            <tr>
              <th>Món</th>
              <th>Hồ sơ riêng</th>
              <th className="num">SL</th>
              <th className="num">KT D×R×C (mm)</th>
              <th className="num">NW (kg)</th>
            </tr>
          </thead>
          <tbody>
            {d.setItems.map((s) => (
              <tr key={s.id}>
                <td>{s.item_label}</td>
                <td>
                  {s.item_product_id ? (
                    <Link className="code" href={`/thu-vien/${s.item_product_id}`}>
                      mở hồ sơ
                    </Link>
                  ) : (
                    <span className="muted">chưa có hồ sơ riêng</span>
                  )}
                </td>
                <td className="num">{nz(s.qty, 2)}</td>
                <td className="num">
                  {s.length_mm || s.width_mm || s.height_mm
                    ? `${s.length_mm ? nz(s.length_mm, 0) : '—'}×${s.width_mm ? nz(s.width_mm, 0) : '—'}×${s.height_mm ? nz(s.height_mm, 0) : '—'}`
                    : '—'}
                </td>
                <td className="num">
                  {s.net_weight_kg != null ? nz(s.net_weight_kg, 1) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>{d.setItems.length} món</td>
              <td className="num">
                {nz(
                  d.setItems.reduce((a, s) => a + s.qty, 0),
                  2,
                )}
              </td>
              <td />
              <td className="num">
                {nz(
                  d.setItems.reduce((a, s) => a + (s.net_weight_kg ?? 0) * s.qty, 0),
                  1,
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}
