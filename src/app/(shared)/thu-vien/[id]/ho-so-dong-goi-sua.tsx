'use client'

import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import type { HoSoView } from './ho-so.shared'
import type { HoSoCtx } from './useHoSo'

type Kien = {
  package_label: string
  qty: string
  l: string
  w: string
  h: string
  nw: string
  gw: string
}
type Form = {
  label: string
  cartons_per_set: string
  loading_40hc: string
  packages: Kien[]
}

type Option = HoSoView['packingOptions'][number]

const kienTrong = (): Kien => ({
  package_label: '',
  qty: '1',
  l: '',
  w: '',
  h: '',
  nw: '',
  gw: '',
})
const cm = (mm: number | null) => (mm == null ? '' : String(mm / 10).replace('.', ','))
const num = (s: string) =>
  s.trim() ? Number(s.trim().replace(/\./g, '').replace(',', '.')) : null

function fromOption(o: Option | null): Form {
  if (!o)
    return {
      label: '',
      cartons_per_set: '1',
      loading_40hc: '',
      packages: [{ ...kienTrong(), package_label: 'Thùng 1' }],
    }
  return {
    label: o.label ?? '',
    cartons_per_set: o.cartons_per_set != null ? String(o.cartons_per_set) : '',
    loading_40hc: o.loading_40hc != null ? String(o.loading_40hc) : '',
    packages: o.packages.map((p) => ({
      package_label: p.package_label,
      qty: String(p.qty),
      l: cm(p.carton_l_mm),
      w: cm(p.carton_w_mm),
      h: cm(p.carton_h_mm),
      nw: p.net_weight_kg != null ? String(p.net_weight_kg).replace('.', ',') : '',
      gw: p.gross_weight_kg != null ? String(p.gross_weight_kg).replace('.', ',') : '',
    })),
  }
}

/**
 * FORM PHƯƠNG ÁN ĐÓNG GÓI — nằm ngay dưới bảng (không mở hộp thoại): nhãn,
 * cái/thùng, 40HC, và lưới KIỆN (tên, SL, D×R×C cm, NW, GW). Kích thước gõ CM
 * như tờ đóng gói, gửi lên MM như DB.
 */
export function SuaPhuongAn({
  d,
  c,
  option,
  onClose,
}: {
  d: HoSoView
  c: HoSoCtx
  /** null = thêm mới. */
  option: Option | null
  onClose: () => void
}) {
  const [f, setF] = useState<Form>(() => fromOption(option))
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const setK = (i: number, k: keyof Kien, v: string) =>
    setF((s) => ({
      ...s,
      packages: s.packages.map((p, j) => (j === i ? { ...p, [k]: v } : p)),
    }))

  const kiemTra = (): string | null => {
    for (const [i, p] of f.packages.entries()) {
      if (!p.package_label.trim()) return `Kiện ${i + 1}: thiếu tên`
      for (const [k, s] of Object.entries({
        SL: p.qty,
        Dài: p.l,
        Rộng: p.w,
        Cao: p.h,
        NW: p.nw,
        GW: p.gw,
      })) {
        const n = num(s)
        if (s.trim() && (n == null || !Number.isFinite(n) || n < 0))
          return `Kiện ${i + 1}: ${k} "${s}" không phải số`
      }
      const nw = num(p.nw)
      const gw = num(p.gw)
      if (nw != null && gw != null && gw < nw)
        return `Kiện ${i + 1}: GW (${p.gw}) nhỏ hơn NW (${p.nw})`
    }
    return null
  }

  async function luu() {
    const l = kiemTra()
    if (l) {
      setLoi(l)
      return
    }
    setLoi(null)
    const body = {
      label: f.label.trim() || null,
      cartons_per_set: num(f.cartons_per_set),
      loading_40hc: num(f.loading_40hc),
      packages: f.packages.map((p) => ({
        package_label: p.package_label.trim(),
        qty: num(p.qty) ?? 1,
        carton_l_mm: num(p.l) != null ? Math.round(num(p.l)! * 10) : null,
        carton_w_mm: num(p.w) != null ? Math.round(num(p.w)! * 10) : null,
        carton_h_mm: num(p.h) != null ? Math.round(num(p.h)! * 10) : null,
        net_weight_kg: num(p.nw),
        gross_weight_kg: num(p.gw),
      })),
    }
    setBusy(true)
    try {
      if (option)
        await api(`/api/dept/technical/products/${d.id}/packing/${option.id}`, {
          method: 'PATCH',
          body,
        })
      else
        await api(`/api/dept/technical/products/${d.id}/packing`, {
          method: 'POST',
          body,
        })
      c.toast.success(
        option ? 'Đã sửa phương án' : 'Đã thêm phương án',
        f.label || `#${option?.option_no ?? d.packingOptions.length + 1}`,
      )
      c.router.refresh()
      onClose()
    } catch (e) {
      setLoi(e instanceof ApiError ? e.message : 'Có lỗi khi lưu')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="form"
      role="form"
      aria-label={
        option ? `Sửa phương án #${option.option_no}` : 'Thêm phương án đóng gói'
      }
    >
      <div className="form-h">
        <b>{option ? `Sửa phương án #${option.option_no}` : 'Thêm phương án đóng gói'}</b>
        <span className="muted">
          Kích thước kiện gõ theo cm; GM, Fedex, CBM app tự tính.
        </span>
      </div>
      <div className="form-row">
        <label>
          <span>Tên phương án</span>
          <input
            className="pick"
            value={f.label}
            onChange={(e) => setF({ ...f, label: e.target.value })}
            placeholder="Nguyên chiếc, 1 thùng"
            style={{ width: 240 }}
          />
        </label>
        <label>
          <span>Thùng / bộ</span>
          <input
            className="pick num"
            value={f.cartons_per_set}
            onChange={(e) => setF({ ...f, cartons_per_set: e.target.value })}
            style={{ width: 72 }}
            inputMode="numeric"
          />
        </label>
        <label>
          <span>Xếp cont 40HC (cái)</span>
          <input
            className="pick num"
            value={f.loading_40hc}
            onChange={(e) => setF({ ...f, loading_40hc: e.target.value })}
            style={{ width: 90 }}
            inputMode="numeric"
          />
        </label>
      </div>
      <table aria-label="Kiện của phương án" style={{ minWidth: 760 }}>
        <thead>
          <tr>
            <th>Kiện</th>
            <th className="num">SL</th>
            <th className="num">Dài (cm)</th>
            <th className="num">Rộng (cm)</th>
            <th className="num">Cao (cm)</th>
            <th className="num">NW (kg)</th>
            <th className="num">GW (kg)</th>
            <th style={{ width: 60 }} />
          </tr>
        </thead>
        <tbody>
          {f.packages.map((p, i) => (
            <tr key={i}>
              <td>
                <input
                  className="pick"
                  aria-label={`Tên kiện ${i + 1}`}
                  value={p.package_label}
                  onChange={(e) => setK(i, 'package_label', e.target.value)}
                  style={{ width: 200 }}
                />
              </td>
              {(['qty', 'l', 'w', 'h', 'nw', 'gw'] as const).map((k) => (
                <td key={k} className="num">
                  <input
                    className="pick num"
                    aria-label={`${k} kiện ${i + 1}`}
                    value={p[k]}
                    onChange={(e) => setK(i, k, e.target.value)}
                    style={{ width: 72, textAlign: 'right' }}
                    inputMode="decimal"
                  />
                </td>
              ))}
              <td>
                <button
                  type="button"
                  className="btn"
                  style={{ height: 24, color: 'var(--stop)' }}
                  disabled={f.packages.length <= 1}
                  title={
                    f.packages.length <= 1
                      ? 'Phương án cần ít nhất một kiện'
                      : 'Bỏ kiện này'
                  }
                  onClick={() =>
                    setF({ ...f, packages: f.packages.filter((_, j) => j !== i) })
                  }
                >
                  Bỏ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="form-foot">
        <button
          type="button"
          className="btn"
          onClick={() =>
            setF({
              ...f,
              packages: [
                ...f.packages,
                { ...kienTrong(), package_label: `Thùng ${f.packages.length + 1}` },
              ],
            })
          }
        >
          + Thêm kiện
        </button>
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {loi && (
            <span className="loi" role="alert">
              {loi}
            </span>
          )}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Thôi
          </button>
          <button
            type="button"
            className="btn pri"
            onClick={() => void luu()}
            disabled={busy}
          >
            {busy ? 'Đang lưu…' : option ? 'Lưu phương án' : 'Thêm phương án'}
          </button>
        </span>
      </div>
    </div>
  )
}
