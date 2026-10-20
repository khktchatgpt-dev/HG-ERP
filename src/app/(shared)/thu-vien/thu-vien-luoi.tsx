'use client'

import Link from 'next/link'
import { Menu } from '@/components/kit'
import { fmtKg, fmtKt, OHoSo, type LibraryRow } from './thu-vien.shared'
import type { ThuVienCtx } from './useThuVien'

/** LƯỚI ẢNH — đúng artboard "Màn 1b": cùng bộ lọc, cùng checklist với bảng. */
export function LuoiThuVien({ d, rows }: { d: ThuVienCtx; rows: LibraryRow[] }) {
  return (
    <div className="scroll">
      <div className="gridv">
        {rows.map((r) => {
          const kt = fmtKt(r.length_mm, r.width_mm, r.height_mm)
          const nw = fmtKg(r.net_weight_kg)
          return (
            <div key={r.id} className="card">
              {r.image_url ? (
                <button
                  type="button"
                  className="img"
                  aria-label={`Phóng to ảnh ${r.code}`}
                  onClick={() => d.setPreview({ row: r, url: r.image_url! })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh qua /api/files/[id]/img */}
                  <img src={r.image_url} alt="" loading="lazy" />
                </button>
              ) : (
                <span className="img none">chưa có ảnh</span>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{ minWidth: 0, display: 'flex', gap: 6, alignItems: 'center' }}
                >
                  <Link
                    className="code"
                    href={`/thu-vien/${r.id}`}
                    title={`Mở hồ sơ ${r.code}`}
                    style={{ fontSize: 12 }}
                  >
                    {r.code}
                  </Link>
                  <span
                    className="muted"
                    style={{
                      fontSize: 11,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.customer_name ?? 'Mẫu chung'}
                  </span>
                </span>
                <Menu items={d.menu(r)} ariaLabel={`Thao tác với ${r.code}`} />
              </div>
              <div
                className="nm"
                title={r.name}
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.name}
                </span>
                {r.is_set && <span className="tag run">BỘ</span>}
                {!r.is_active && <span className="tag">Ngừng</span>}
              </div>
              <div
                className="num"
                style={{
                  fontSize: 12,
                  color: kt || r.is_set ? 'var(--ink3)' : 'var(--stop)',
                }}
              >
                {r.is_set
                  ? `BỘ · ${r.children.length} món`
                  : kt
                    ? `${kt}${nw ? ` · ${nw} kg` : ''}`
                    : `thiếu KTSP${nw ? '' : ' · thiếu NW'}`}
              </div>
              <OHoSo check={r.check} wide />
            </div>
          )
        })}
      </div>
    </div>
  )
}
