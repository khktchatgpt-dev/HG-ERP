'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'
import { KHUNG_LABEL, LOAI_LABEL } from '../thu-vien.shared'
import { nz, type HoSoView } from './ho-so.shared'
import type { HoSoCtx, OSua } from './useHoSo'

/**
 * KHỐI PHIẾU THÔNG SỐ — đúng artboard: ảnh trái 300px, lưới nhãn–giá trị 4 cột
 * bên phải, BẤM Ô LÀ SỬA tại chỗ (không mở form 40 trường).
 */
export function HoSoPhieu({ d, c }: { d: HoSoView; c: HoSoCtx }) {
  return (
    <div className={cn('two', c.suaDuoc && 'sua')}>
      <div className="photo">
        {d.imageUrls.length ? (
          <button
            type="button"
            className="big"
            aria-label="Ảnh sản phẩm, bấm để xem ảnh kế"
            onClick={() =>
              d.imageUrls.length > 1 && c.setAnh((c.anh + 1) % d.imageUrls.length)
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh qua /api/files/[id]/img */}
            <img src={d.imageUrls[c.anh]} alt="" />
          </button>
        ) : (
          <span className="big img none">chưa có ảnh đại diện</span>
        )}
        {d.imageUrls.length > 1 && (
          <div className="thumbs">
            {d.imageUrls.map((u, i) => (
              <button
                key={u}
                type="button"
                aria-label={`Ảnh ${i + 1}`}
                className={i === c.anh ? 'on' : undefined}
                onClick={() => c.setAnh(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thu nhỏ */}
                <img src={u} alt="" />
              </button>
            ))}
          </div>
        )}
        <div className="muted" style={{ fontSize: 11 }}>
          {d.imageUrls.length} ảnh · thêm/xoá ảnh ở{' '}
          <a href="#tai-lieu">Tài liệu</a>
        </div>
      </div>

      <div className="sheet">
        <div className="lbl">
          Thông số sản phẩm{' '}
          {c.suaDuoc ? (
            <span className="sub">— gõ vào ô, rời ô là lưu, Esc trả lại</span>
          ) : c.khoa ? (
            <span className="sub warn">— hồ sơ đã khoá</span>
          ) : null}
        </div>
        <dl className="kv">
          <O c={c} d={d} label="Tên SP" field="name" v={d.name} />
          <O
            c={c}
            d={d}
            label="Khách hàng"
            field="customer_name"
            v={d.customer_name}
            trong="mẫu chung"
          />
          <O
            c={c}
            d={d}
            label="Mã HG"
            v={d.code + (d.code_legacy ? ` · cũ ${d.code_legacy}` : '')}
            mono
          />
          <O
            c={c}
            d={d}
            label="Mã KH đặt"
            field="customer_item_code"
            v={d.customer_item_code}
            mono
            trong="chưa khai"
            thieu
          />
          <O
            c={c}
            d={d}
            label="Tên nước ngoài"
            field="name_foreign"
            v={d.name_foreign}
            trong="chưa khai"
          />
          <O
            c={c}
            d={d}
            label="Loại · Khung"
            v={`${LOAI_LABEL[d.product_type ?? ''] ?? '—'} (${d.product_type ?? '—'}) · ${KHUNG_LABEL[d.frame_material ?? ''] ?? '—'} (${d.frame_material ?? '—'})`}
          />
          <Kt d={d} c={c} />
          <O
            c={c}
            d={d}
            label="KT mở (nếu gập)"
            v={
              d.length_open_mm || d.width_open_mm || d.height_open_mm
                ? `${d.length_open_mm ? nz(d.length_open_mm, 0) : '—'} × ${d.width_open_mm ? nz(d.width_open_mm, 0) : '—'} × ${d.height_open_mm ? nz(d.height_open_mm, 0) : '—'} mm`
                : null
            }
            trong="— không gập"
            mono
          />
          <O
            c={c}
            d={d}
            label="NW (kg)"
            field="net_weight_kg"
            v={d.net_weight_kg != null ? nz(d.net_weight_kg) : null}
            mono
            trong="chưa khai"
            thieu
          />
          <O
            c={c}
            d={d}
            label="Tải trọng (kg)"
            field="max_load_kg"
            v={d.max_load_kg != null ? nz(d.max_load_kg, 0) : null}
            mono
            trong="chưa khai"
          />
          <O
            c={c}
            d={d}
            label="Vật liệu"
            field="material"
            v={d.material}
            trong="chưa khai"
          />
          <O
            c={c}
            d={d}
            label="Lộ trình công đoạn"
            v={d.stage_route?.length ? d.stage_route.join(' → ') : null}
            trong="chưa khai"
          />
          <O
            c={c}
            d={d}
            label="Ghi chú in LSX"
            v={
              [
                d.tech_spec.paint && `Sơn: ${d.tech_spec.paint}`,
                d.tech_spec.wood && `Gỗ: ${d.tech_spec.wood}`,
                d.tech_spec.glass && `Kính: ${d.tech_spec.glass}`,
                d.tech_spec.cushion && `Nệm: ${d.tech_spec.cushion}`,
              ]
                .filter(Boolean)
                .join(' · ') || null
            }
            trong="chưa khai"
          />
          <O
            c={c}
            d={d}
            label="Mã HS · Xuất xứ"
            field="hs_code"
            v={
              d.hs_code || d.origin_country
                ? `${d.hs_code ?? '—'} · ${d.origin_country ?? '—'}`
                : null
            }
            trong="chưa khai"
            mono
          />
          <O c={c} d={d} label="ĐVT" field="unit" v={d.unit} />
          <O
            c={c}
            d={d}
            label="Người tạo · phụ trách"
            v={`${d.creatorName ?? '—'} · ${d.ownerName ?? '—'}`}
          />
        </dl>
      </div>
    </div>
  )
}

/** Một cặp nhãn–giá trị. Có `field` + quyền sửa thì giá trị là nút mở ô nhập. */
function O({
  d,
  c,
  label,
  field,
  v,
  trong = '—',
  mono,
  thieu,
}: {
  d: HoSoView
  c: HoSoCtx
  label: string
  field?: OSua
  v: string | null
  trong?: string
  mono?: boolean
  /** Trống là THIẾU hồ sơ (chữ màu dừng), không phải "không áp dụng". */
  thieu?: boolean
}) {
  const cls = [mono ? 'num' : '', !v ? (thieu ? 'miss' : 'fill') : '']
    .filter(Boolean)
    .join(' ')
  return (
    <>
      <dt>{label}</dt>
      <dd className="v1">
        {field && c.suaDuoc ? (
          <OInput
            key={fieldRaw(d, field)}
            c={c}
            field={field}
            label={label}
            initial={fieldRaw(d, field)}
            ph={trong}
          />
        ) : (
          <span
            className={cls}
            title={v ?? undefined}
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {v ?? trong}
          </span>
        )}
      </dd>
    </>
  )
}

function fieldRaw(d: HoSoView, field: OSua): string {
  const v = d[field as keyof HoSoView]
  if (v == null) return ''
  return typeof v === 'number' ? String(v).replace('.', ',') : String(v)
}

/** Ô nhập của chế độ sửa: luôn hiện; Enter / rời ô lưu nếu có đổi; Esc trả về số cũ. */
function OInput({
  c,
  field,
  label,
  initial,
  ph,
  w,
}: {
  c: HoSoCtx
  field: OSua
  label: string
  initial: string
  ph?: string
  w?: number
}) {
  const [val, setVal] = useState(initial)
  const commit = () => {
    if (val !== initial) void c.luu(field, val)
  }
  return (
    <input
      className="cell"
      value={val}
      placeholder={ph}
      aria-label={label}
      style={w ? { width: w } : undefined}
      disabled={c.busy === field}
      onChange={(e) => setVal(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') setVal(initial)
      }}
      onBlur={commit}
    />
  )
}

/** KTSP = ba ô số trong một hàng — sửa từng chiều, Enter lưu. */
function Kt({ d, c }: { d: HoSoView; c: HoSoCtx }) {
  const du = !!(d.length_mm && d.width_mm && d.height_mm)
  const dims: { f: OSua; v: number | null; l: string }[] = [
    { f: 'length_mm', v: d.length_mm, l: 'dài' },
    { f: 'width_mm', v: d.width_mm, l: 'rộng' },
    { f: 'height_mm', v: d.height_mm, l: 'cao' },
  ]
  return (
    <>
      <dt>KTSP D×R×C</dt>
      <dd className="v1 num">
        <span className="dims">
          {dims.map((x, i) => (
            <span
              key={x.f}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              {i > 0 && <span className="muted">×</span>}
              {c.suaDuoc ? (
                <OInput
                  key={x.v ?? ''}
                  c={c}
                  field={x.f}
                  label={`KTSP ${x.l} (mm)`}
                  initial={x.v != null ? String(x.v) : ''}
                  ph={x.l}
                  w={64}
                />
              ) : (
                <span className={x.v == null ? 'miss' : undefined}>
                  {x.v != null ? nz(x.v, 0) : x.l}
                </span>
              )}
            </span>
          ))}
          <span className={du ? 'muted' : 'miss'} style={{ fontSize: 11, marginLeft: 4 }}>
            {du ? 'mm' : 'mm · thiếu'}
          </span>
        </span>
      </dd>
    </>
  )
}
