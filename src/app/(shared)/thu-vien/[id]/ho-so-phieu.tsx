'use client'

import { useState } from 'react'
import { ImageUp, PenLine, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { uploadFileTracked } from '@/lib/upload'
import { KHUNG_LABEL, LOAI_LABEL } from '../thu-vien.shared'
import { nz, type HoSoView } from './ho-so.shared'
import type { HoSoCtx, OChon, OSua } from './useHoSo'

/**
 * KHỐI ẢNH + THÔNG SỐ KỸ THUẬT — bản thẻ 09/10/2026 (bản vẽ
 * https://claude.ai/artifact/2aJmfRiWs29AnByCZDsux6): thẻ ảnh trái (ảnh lớn,
 * thumbnail, nút + thêm ảnh tại chỗ) và thẻ thông số phải là LƯỚI KẺ Ô 4 cột
 * (nhãn nền xám, giá trị chữ thường, ô thiếu chữ đỏ nghiêng), nút "Sửa thông
 * số" ngay trên khối. Chế độ sửa: ô nhập có viền, rời ô là lưu.
 */
export function HoSoPhieu({ d, c }: { d: HoSoView; c: HoSoCtx }) {
  const [busyAnh, setBusyAnh] = useState(false)
  const confirm = useConfirm()
  const themDuoc = c.canEdit && !c.khoa
  /** Ảnh đang xem (id) — đặt đại diện / xoá (B5, chuyển từ trang cũ 20/11/2026). */
  const anhId = d.imageIds[c.anh] ?? null
  const laDaiDien = !!anhId && anhId === d.image_file_id

  async function datDaiDien() {
    if (!anhId || laDaiDien) return
    setBusyAnh(true)
    try {
      await api(`/api/dept/technical/products/${d.id}`, {
        method: 'PATCH',
        body: { image_file_id: anhId },
      })
      c.toast.success('Đã đặt làm ảnh đại diện')
      c.setAnh(0)
      c.router.refresh()
    } catch (e) {
      c.toast.error('Chưa đổi được', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusyAnh(false)
    }
  }

  async function xoaAnh() {
    if (!anhId) return
    const ok = await confirm({
      title: 'Xoá ảnh này?',
      description: laDaiDien
        ? d.imageIds.length > 1
          ? 'Đây là ảnh đại diện — ảnh kế tiếp sẽ thành ảnh đại diện. Ảnh bị xoá hẳn, không khôi phục được.'
          : 'Đây là ảnh duy nhất — SP sẽ không còn ảnh đại diện. Ảnh bị xoá hẳn, không khôi phục được.'
        : 'Ảnh bị xoá hẳn, không khôi phục được.',
      tone: 'danger',
      confirmLabel: 'Xoá ảnh',
    })
    if (!ok) return
    setBusyAnh(true)
    try {
      // Đổi đại diện TRƯỚC rồi mới xoá file — không để SP trỏ vào file đã mất.
      if (laDaiDien) {
        const ke = d.imageIds.find((x) => x !== anhId) ?? null
        await api(`/api/dept/technical/products/${d.id}`, {
          method: 'PATCH',
          body: { image_file_id: ke },
        })
      }
      await api(`/api/files/${anhId}`, { method: 'DELETE' })
      c.toast.success('Đã xoá ảnh')
      c.setAnh(0)
      c.router.refresh()
    } catch (e) {
      c.toast.error('Chưa xoá được', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusyAnh(false)
    }
  }

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
    TS_LSX.map(([k, t]) => d.tech_spec[k] && `${t}: ${d.tech_spec[k]}`)
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
          {busyAnh ? ' · đang xử lý…' : ''}
        </div>
        {/* Chỉ ở chế độ sửa: nút xoá không nằm sẵn khi chỉ đang xem. */}
        {c.suaDuoc && anhId && (
          <div className="anh-tt">
            {laDaiDien ? (
              <span className="muted">Đang xem ảnh đại diện</span>
            ) : (
              <button
                type="button"
                className="btn sm"
                disabled={busyAnh}
                onClick={() => void datDaiDien()}
              >
                <ImageUp size={13} aria-hidden />
                Đặt làm đại diện
              </button>
            )}
            <button
              type="button"
              className="btn sm del"
              disabled={busyAnh}
              onClick={() => void xoaAnh()}
            >
              <Trash2 size={13} aria-hidden />
              Xoá ảnh này
            </button>
          </div>
        )}
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
                <td className="l">Thông số in LSX</td>
                <td className="v" colSpan={3}>
                  {c.suaDuoc ? (
                    <span className="ts-sua">
                      {TS_LSX.map(([k, t, ph]) => (
                        <span key={k}>
                          <span className="muted">{t} </span>
                          <V
                            c={c}
                            d={d}
                            label={ph}
                            field={`ts_${k}` as OSua}
                            v={d.tech_spec[k] || null}
                            trong={t.toLowerCase()}
                            w={120}
                          />
                        </span>
                      ))}
                    </span>
                  ) : (
                    (ghiChuLsx ?? <span className="muted">chưa khai</span>)
                  )}
                </td>
              </tr>
              <tr>
                <td className="l">Barcode · KL cân</td>
                <td className="v kt">
                  <V
                    c={c}
                    d={d}
                    label="Barcode"
                    field="barcode"
                    v={d.barcode}
                    trong="chưa khai"
                    thieu
                    w={130}
                  />
                  <span className="dot">·</span>
                  <V
                    c={c}
                    d={d}
                    label="KL cân thực tế (kg)"
                    field="actual_weight_kg"
                    v={
                      d.actual_weight_kg != null
                        ? `${nz(d.actual_weight_kg, 3)} kg`
                        : null
                    }
                    trong="chưa cân"
                    w={80}
                  />
                </td>
                <td className="l">Lắp ráp · bộ gồm</td>
                <td className="v">
                  <Chon
                    c={c}
                    field="assembly"
                    label="Lắp ráp"
                    value={d.assembly ?? ''}
                    opts={[
                      { v: '', t: '—' },
                      { v: 'assembled', t: 'Nguyên chiếc' },
                      { v: 'kd', t: 'Tháo rời (KD)' },
                    ]}
                  />
                  <span className="dot">·</span>
                  <V
                    c={c}
                    d={d}
                    label="Bộ gồm"
                    field="set_contents"
                    v={d.set_contents}
                    trong={d.is_set ? 'chưa khai' : '—'}
                    w={150}
                  />
                </td>
              </tr>
              <tr>
                <td className="l">Đặc tính</td>
                <td className="v">
                  {c.suaDuoc ? (
                    <>
                      <Co
                        c={c}
                        field="is_upholstered"
                        label="Có nệm / bọc"
                        on={d.is_upholstered}
                      />
                      <span className="dot">·</span>
                      <Co c={c} field="has_glass" label="Có kính" on={d.has_glass} />
                      <span className="dot">·</span>
                      <Co c={c} field="is_set" label="Bộ nhiều món" on={d.is_set} />
                    </>
                  ) : (
                    // Khi xem chỉ kể cái CÓ — ba chữ "không …" là nhiễu.
                    [
                      d.is_upholstered && 'Có nệm / bọc',
                      d.has_glass && 'Có kính',
                      d.is_set && 'Bộ nhiều món',
                    ]
                      .filter(Boolean)
                      .join(' · ') || <span className="muted">—</span>
                  )}
                </td>
                <td className="l">Bản vẽ BOM</td>
                <td className="v">
                  <Chon
                    c={c}
                    field="bom_status"
                    label="Trạng thái bản vẽ BOM"
                    value={d.bom_status}
                    opts={[
                      { v: 'none', t: 'Chưa có BOM' },
                      { v: 'drawing', t: 'Đang vẽ' },
                      { v: 'done', t: 'Đã vẽ' },
                    ]}
                  />
                </td>
              </tr>
              <tr>
                <td className="l">Mô tả tiếng Anh</td>
                <td className="v" colSpan={3}>
                  <V
                    c={c}
                    d={d}
                    label="Mô tả tiếng Anh"
                    field="description_en"
                    v={d.description_en}
                    trong="chưa khai"
                  />
                </td>
              </tr>
              <tr>
                <td className="l">Shipping mark</td>
                <td className="v" colSpan={3}>
                  <V
                    c={c}
                    d={d}
                    label="Shipping mark (ký mã hiệu in trên thùng)"
                    field="shipping_mark"
                    v={d.shipping_mark}
                    trong="chưa khai"
                  />
                </td>
              </tr>
              <tr>
                <td className="l">Ghi chú</td>
                <td className="v" colSpan={3}>
                  <V
                    c={c}
                    d={d}
                    label="Ghi chú"
                    field="notes"
                    v={d.notes}
                    trong="chưa có ghi chú"
                  />
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
                  {d.creatorName ?? '—'} ·{' '}
                  <Chon
                    c={c}
                    field="owner_id"
                    label="Người phụ trách"
                    value={d.owner_id ?? ''}
                    show={d.ownerName}
                    opts={[
                      { v: '', t: '— chưa giao' },
                      // Người phụ trách đã nghỉ vẫn phải hiện được trong ô chọn.
                      ...(d.owner_id && !d.owners.some((o) => o.id === d.owner_id)
                        ? [{ v: d.owner_id, t: d.ownerName ?? 'người đã nghỉ' }]
                        : []),
                      ...d.owners.map((o) => ({ v: o.id, t: o.name })),
                    ]}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/** Tám ô của jsonb `tech_spec` in lên LSX — [khoá, nhãn ngắn, nhãn đủ]. */
const TS_LSX = [
  ['machine', 'Máy', 'Máy'],
  ['paint', 'Sơn', 'Sơn (mã màu)'],
  ['wood', 'Gỗ', 'Gỗ'],
  ['glass', 'Kính', 'Kính'],
  ['cushion', 'Nệm', 'Nệm / mút'],
  ['fabric', 'Vải', 'Vải'],
  ['hardware', 'Ngũ kim', 'Phụ kiện ngũ kim'],
  ['finish', 'Finish', 'Màu hoàn thiện (finish)'],
] as const

/** Ô CHỌN một giá trị (lắp ráp, BOM, người phụ trách): đổi là lưu ngay. */
function Chon({
  c,
  field,
  label,
  value,
  opts,
  show,
}: {
  c: HoSoCtx
  field: OChon
  label: string
  value: string
  opts: { v: string; t: string }[]
  /** Chữ bày khi xem (mặc định = nhãn của lựa chọn đang chọn). */
  show?: string | null
}) {
  if (!c.suaDuoc) {
    const t = show ?? (value ? opts.find((o) => o.v === value)?.t : null)
    return t ? <span>{t}</span> : <span className="muted">—</span>
  }
  return (
    <select
      className="cell"
      aria-label={label}
      value={value}
      disabled={c.busy === field}
      onChange={(e) => void c.luuChon(field, e.target.value)}
    >
      {opts.map((o) => (
        <option key={o.v} value={o.v}>
          {o.t}
        </option>
      ))}
    </select>
  )
}

/** Ô TICK có / không ở chế độ sửa — bấm là lưu. */
function Co({
  c,
  field,
  label,
  on,
}: {
  c: HoSoCtx
  field: OChon
  label: string
  on: boolean
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        type="checkbox"
        aria-label={label}
        checked={on}
        disabled={c.busy === field}
        onChange={(e) => void c.luuChon(field, e.target.checked)}
      />
      {label}
    </label>
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
  if (field.startsWith('ts_'))
    return (d.tech_spec as Record<string, string | undefined>)[field.slice(3)] ?? ''
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
