'use client'

import { useState } from 'react'
import { PenLine, Plus, SlidersHorizontal } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { uploadFileTracked } from '@/lib/upload'
import { KHUNG_LABEL, LOAI_LABEL } from '../thu-vien.shared'
import { nz, type HoSoView } from './ho-so.shared'
import type { HoSoCtx, OSua } from './useHoSo'

/**
 * KHỐI ẢNH + THÔNG SỐ KỸ THUẬT — bản thẻ 09/10/2026 (bản vẽ
 * https://claude.ai/artifact/2aJmfRiWs29AnByCZDsux6): thẻ ảnh trái (ảnh lớn,
 * thumbnail, nút + thêm ảnh tại chỗ) và thẻ thông số phải là LƯỚI KẺ Ô 4 cột
 * (nhãn nền xám, giá trị chữ thường, ô thiếu chữ đỏ nghiêng), nút "Sửa thông
 * số" ngay trên khối. Chế độ sửa: ô nhập có viền, rời ô là lưu.
 */
export function HoSoPhieu({ d, c }: { d: HoSoView; c: HoSoCtx }) {
  const [busyAnh, setBusyAnh] = useState(false)
  const themDuoc = c.canEdit && !c.khoa

  async function themAnh(f: File | null | undefined) {
    if (!f) return
    setBusyAnh(true)
    try {
      const fileId = await uploadFileTracked(
        f,
        { kind: 'product', id: d.id },
        'attachments',
        'image',
      )
      if (!d.imageUrl) {
        await api(`/api/dept/sales/products/${d.id}/image`, {
          method: 'POST',
          body: { file_id: fileId },
        })
      }
      c.toast.success(
        'Đã thêm ảnh',
        d.imageUrl ? 'Ảnh nằm ở Tài liệu, bấm để xem' : 'Đặt làm ảnh đại diện',
      )
      c.router.refresh()
    } catch (e) {
      c.toast.error(
        'Thêm ảnh thất bại',
        e instanceof ApiError || e instanceof Error ? e.message : 'Có lỗi',
      )
    } finally {
      setBusyAnh(false)
    }
  }

  const loaiKhung = `${LOAI_LABEL[d.product_type ?? ''] ?? '—'} (${d.product_type ?? '—'}) · ${KHUNG_LABEL[d.frame_material ?? ''] ?? '—'} (${d.frame_material ?? '—'})`
  const ktMo =
    d.length_open_mm || d.width_open_mm || d.height_open_mm
      ? `${d.length_open_mm ? nz(d.length_open_mm, 0) : '—'} × ${d.width_open_mm ? nz(d.width_open_mm, 0) : '—'} × ${d.height_open_mm ? nz(d.height_open_mm, 0) : '—'} mm`
      : null
  const ghiChuLsx =
    [
      d.tech_spec.paint && `Sơn: ${d.tech_spec.paint}`,
      d.tech_spec.wood && `Gỗ: ${d.tech_spec.wood}`,
      d.tech_spec.glass && `Kính: ${d.tech_spec.glass}`,
      d.tech_spec.cushion && `Nệm: ${d.tech_spec.cushion}`,
    ]
      .filter(Boolean)
      .join(' · ') || null

  return (
    <div className="two">
      <section className="card photo" aria-label="Ảnh sản phẩm">
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
          <span className="big none">chưa có ảnh đại diện</span>
        )}
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
          {themDuoc && (
            <label className={cn('add', busyAnh && 'busy')} title="Thêm ảnh (PNG/JPG)">
              <Plus size={18} aria-hidden />
              <span className="sr">Thêm ảnh</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr"
                disabled={busyAnh}
                onChange={(e) => {
                  void themAnh(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          )}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>
          {d.imageUrls.length} ảnh · ảnh đầu là ảnh đại diện
          {busyAnh ? ' · đang tải…' : ''}
        </div>
      </section>

      <section className="card" aria-label="Thông số kỹ thuật">
        <div className="card-h sec-ts">
          <h2>
            <span className="ic-sec">
              <SlidersHorizontal aria-hidden />
            </span>
            Thông số kỹ thuật
          </h2>
          <span className="sub">khối in lên LSX và báo giá</span>
          <span className="r">
            {c.suaDuoc ? (
              <span className="sub">gõ vào ô, rời ô là lưu · Esc trả lại</span>
            ) : themDuoc ? (
              <button
                type="button"
                className="btn out xs"
                onClick={() => c.setCheDoSua(true)}
              >
                <PenLine size={13} aria-hidden />
                Sửa thông số
              </button>
            ) : c.khoa ? (
              <span className="sub">hồ sơ đã khoá</span>
            ) : null}
          </span>
        </div>
        <div className="pad">
          <table className="xl">
            <tbody>
              <tr>
                <td className="l">Tên SP</td>
                <td className="v" colSpan={3}>
                  <V c={c} d={d} label="Tên SP" field="name" v={d.name} />
                </td>
              </tr>
              <tr>
                <td className="l">Tên theo khách</td>
                <td className="v" colSpan={3}>
                  <V
                    c={c}
                    d={d}
                    label="Tên theo khách"
                    field="name_foreign"
                    v={d.name_foreign}
                    trong="chưa khai"
                  />
                </td>
              </tr>
              <tr>
                <td className="l">Khách · mã KH</td>
                <td className="v">
                  <V
                    c={c}
                    d={d}
                    label="Khách hàng"
                    field="customer_name"
                    v={d.customer_name}
                    trong="mẫu chung"
                    w={110}
                  />
                  <span className="dot">·</span>
                  <V
                    c={c}
                    d={d}
                    label="Mã KH đặt"
                    field="customer_item_code"
                    v={d.customer_item_code}
                    trong="chưa khai"
                    thieu
                    w={110}
                  />
                </td>
                <td className="l">Loại · khung</td>
                <td className="v">{loaiKhung}</td>
              </tr>
              <tr>
                <td className="l">KTSP D×R×C</td>
                <td className="v kt">
                  <Kt d={d} c={c} />
                </td>
                <td className="l">KT mở (gập)</td>
                <td className="v kt">
                  {ktMo ?? <span className="muted">— không gập</span>}
                </td>
              </tr>
              <tr>
                <td className="l">NW · tải trọng</td>
                <td className="v kt">
                  <V
                    c={c}
                    d={d}
                    label="NW (kg)"
                    field="net_weight_kg"
                    v={d.net_weight_kg != null ? `${nz(d.net_weight_kg)} kg` : null}
                    trong="chưa khai"
                    thieu
                    w={80}
                  />
                  <span className="dot">·</span>
                  <V
                    c={c}
                    d={d}
                    label="Tải trọng (kg)"
                    field="max_load_kg"
                    v={d.max_load_kg != null ? `${nz(d.max_load_kg, 0)} kg` : null}
                    trong="chưa khai"
                    w={80}
                  />
                </td>
                <td className="l">Vật liệu</td>
                <td className="v">
                  <V
                    c={c}
                    d={d}
                    label="Vật liệu"
                    field="material"
                    v={d.material}
                    trong="chưa khai"
                  />
                </td>
              </tr>
              <tr>
                <td className="l">Ghi chú in LSX</td>
                <td className="v" colSpan={3}>
                  {ghiChuLsx ?? <span className="muted">chưa khai</span>}
                </td>
              </tr>
              <tr>
                <td className="l">Mã HS · xuất xứ</td>
                <td className="v">
                  <V
                    c={c}
                    d={d}
                    label="Mã HS"
                    field="hs_code"
                    v={d.hs_code}
                    trong="chưa khai"
                    w={100}
                  />
                  <span className="dot">·</span>
                  <V
                    c={c}
                    d={d}
                    label="Xuất xứ"
                    field="origin_country"
                    v={d.origin_country}
                    trong="—"
                    w={100}
                  />
                </td>
                <td className="l">ĐVT</td>
                <td className="v">
                  <V c={c} d={d} label="ĐVT" field="unit" v={d.unit} w={60} />
                </td>
              </tr>
              <tr>
                <td className="l">Mã HG · mã cũ</td>
                <td className="v">
                  {d.code}
                  {d.code_legacy ? (
                    <span className="muted"> · cũ {d.code_legacy}</span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="l">Người tạo · phụ trách</td>
                <td className="v">
                  {d.creatorName ?? '—'} · {d.ownerName ?? '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/** Một GIÁ TRỊ trong ô: chữ khi xem; ô nhập có viền khi sửa (rời ô là lưu). */
function V({
  d,
  c,
  label,
  field,
  v,
  trong = '—',
  thieu,
  w,
}: {
  d: HoSoView
  c: HoSoCtx
  label: string
  field: OSua
  v: string | null
  trong?: string
  /** Trống là THIẾU hồ sơ (chữ đỏ), không phải "không áp dụng". */
  thieu?: boolean
  w?: number
}) {
  if (c.suaDuoc)
    return (
      <OInput
        key={fieldRaw(d, field)}
        c={c}
        field={field}
        label={label}
        initial={fieldRaw(d, field)}
        ph={trong}
        w={w}
      />
    )
  if (!v) return <span className={thieu ? 'miss' : 'muted'}>{trong}</span>
  return <span title={v}>{v}</span>
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

/** KTSP = ba ô số trong một ô bảng — sửa từng chiều. */
function Kt({ d, c }: { d: HoSoView; c: HoSoCtx }) {
  const du = !!(d.length_mm && d.width_mm && d.height_mm)
  const dims: { f: OSua; v: number | null; l: string }[] = [
    { f: 'length_mm', v: d.length_mm, l: 'dài' },
    { f: 'width_mm', v: d.width_mm, l: 'rộng' },
    { f: 'height_mm', v: d.height_mm, l: 'cao' },
  ]
  return (
    <span className="dims">
      {dims.map((x, i) => (
        <span key={x.f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span className="muted">×</span>}
          {c.suaDuoc ? (
            <OInput
              key={x.v ?? ''}
              c={c}
              field={x.f}
              label={`KTSP ${x.l} (mm)`}
              initial={x.v != null ? String(x.v) : ''}
              ph={x.l}
              w={60}
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
  )
}
