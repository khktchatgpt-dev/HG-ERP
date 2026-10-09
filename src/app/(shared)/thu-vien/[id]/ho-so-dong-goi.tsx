'use client'

import { Fragment, useState } from 'react'
import { Package, PenLine, Plus, Star, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { SuaPhuongAn } from './ho-so-dong-goi-sua'
import { nz, type HoSoView } from './ho-so.shared'
import { OTxt, soVn } from './ho-so-o'
import type { HoSoCtx } from './useHoSo'

/**
 * ĐÓNG GÓI — đúng artboard "Màn 2b": nhiều phương án, mỗi phương án Cái/thùng ·
 * KTBB · NW · GW · GM · Fedex · 40HC · mặc định; thêm / sửa / đặt mặc định / xoá
 * qua API `products/[id]/packing` (08/10/2026).
 *
 * Hai nguồn số đang sống song song (Q3 của bản vẽ, chưa chốt dời):
 *   · bảng `technical_packing_options` (+ kiện) — nguồn CHÍNH, in lên báo giá/lệnh;
 *   · ô tóm tắt jsonb `packing` — 120/144 SP chỉ có ô này, vẫn sửa được tại chỗ.
 * GM = D + 2R + 2C (cm) · Fedex = GM ÷ 2,54 — tính khi hiển thị, không lưu.
 */
export function HoSoDongGoi({ d, c }: { d: HoSoView; c: HoSoCtx }) {
  const confirm = useConfirm()
  /** null = không mở form · 'moi' = thêm · id = sửa phương án đó. */
  const [sua, setSua] = useState<null | 'moi' | string>(null)
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const j = d.packingJson
  const coJson = !!(j.carton_l_cm || j.qty_per_carton || j.loading_40hc || j.gw_kg)
  const rows = d.packingOptions.map((o) => {
    const p = o.packages[0]
    const l = p?.carton_l_mm != null ? p.carton_l_mm / 10 : null
    const w = p?.carton_w_mm != null ? p.carton_w_mm / 10 : null
    const h = p?.carton_h_mm != null ? p.carton_h_mm / 10 : null
    const kt = o.packages
      .map((k) =>
        [k.carton_l_mm, k.carton_w_mm, k.carton_h_mm]
          .map((v) => (v != null ? nz(v / 10, 1) : '—'))
          .join(' × '),
      )
      .join(' + ')
    const gm = l != null && w != null && h != null ? l + 2 * w + 2 * h : null
    return {
      o,
      id: o.id,
      no: o.option_no,
      label:
        o.label ??
        (o.packages.length > 1 ? `${o.packages.length} thùng` : 'Nguyên chiếc, 1 thùng'),
      cai: o.cartons_per_set,
      kt,
      nw: o.packages.reduce((a, k) => a + (k.net_weight_kg ?? 0), 0) || null,
      gw: o.packages.reduce((a, k) => a + (k.gross_weight_kg ?? 0), 0) || null,
      gm,
      hc: o.loading_40hc,
      def: o.is_default,
      kien: o.packages.length,
      note: o.note,
      l,
      w,
      h,
    }
  })
  const gmJ =
    j.carton_l_cm && j.carton_w_cm && j.carton_h_cm
      ? j.carton_l_cm + 2 * j.carton_w_cm + 2 * j.carton_h_cm
      : null

  /**
   * Sửa TẠI CHỖ một ô của phương án (chế độ sửa): nhãn, cái/thùng, xếp cont, ghi
   * chú ghi thẳng; kích thước / NW / GW ghi vào KIỆN ĐẦU (phương án nhiều kiện
   * thì sửa bằng nút ✎). Số nhận kiểu VN.
   */
  async function luuOpt(
    r: (typeof rows)[number],
    patch: Record<string, string | number | null>,
  ): Promise<boolean> {
    setBusyRow(r.id)
    try {
      await api(`/api/dept/technical/products/${d.id}/packing/${r.id}`, {
        method: 'PATCH',
        body: patch,
      })
      c.router.refresh()
      return true
    } catch (e) {
      c.toast.error('Chưa lưu được', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusyRow(null)
    }
  }
  const soHoacBao = (raw: string): number | null | false => {
    const n = soVn(raw)
    if (n === undefined) {
      c.toast.error('Số không hợp lệ', `"${raw}" — gõ số, ví dụ 62 hoặc 10,5`)
      return false
    }
    return n
  }
  /** Kiện đầu, thay một trường (cm → mm với kích thước). */
  const luuKien = (r: (typeof rows)[number], k: string, raw: string, cm = false) => {
    const n = soHoacBao(raw)
    if (n === false) return
    const p = r.o.packages[0]
    const mm = (v: number | null | undefined) => (v == null ? null : cm ? Math.round(v * 10) : v)
    void luuOpt(r, {
      packages: [
        {
          package_label: p?.package_label ?? 'Thùng',
          qty: p?.qty ?? 1,
          carton_l_mm: k === 'l' ? mm(n) : (p?.carton_l_mm ?? null),
          carton_w_mm: k === 'w' ? mm(n) : (p?.carton_w_mm ?? null),
          carton_h_mm: k === 'h' ? mm(n) : (p?.carton_h_mm ?? null),
          net_weight_kg: k === 'nw' ? n : (p?.net_weight_kg ?? null),
          gross_weight_kg: k === 'gw' ? n : (p?.gross_weight_kg ?? null),
        },
      ] as never,
    })
  }

  async function datMacDinh(id: string, no: number) {
    setBusyRow(id)
    try {
      await api(`/api/dept/technical/products/${d.id}/packing/${id}`, {
        method: 'PATCH',
        body: { is_default: true },
      })
      c.toast.success('Đã đặt mặc định', `Phương án #${no} sẽ in lên báo giá và lệnh`)
      c.router.refresh()
    } catch (e) {
      c.toast.error('Chưa đổi được', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusyRow(null)
    }
  }

  async function xoa(id: string, no: number, def: boolean) {
    const ok = await confirm({
      title: `Xoá phương án #${no}?`,
      description: def
        ? 'Đây là phương án mặc định — xoá xong phương án số nhỏ nhất còn lại sẽ lên mặc định. Báo giá đã in không đổi. Không hoàn tác được.'
        : 'Kiện của phương án xoá theo. Không hoàn tác được.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusyRow(id)
    try {
      await api(`/api/dept/technical/products/${d.id}/packing/${id}`, {
        method: 'DELETE',
      })
      c.toast.success('Đã xoá', `Phương án #${no}`)
      if (sua === id) setSua(null)
      c.router.refresh()
    } catch (e) {
      c.toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusyRow(null)
    }
  }

  return (
    <section aria-label="Đóng gói" id="dong-goi" className="panel">
      <h2 className="ph sec-dg">
        <span className="ic-sec">
          <Package aria-hidden />
        </span>
        Đóng gói
        <span className="n">
          {rows.length
            ? `${rows.length} phương án · mặc định #${rows.find((r) => r.def)?.no ?? rows[0].no}`
            : coJson
              ? 'chỉ có ô tóm tắt, chưa có phương án'
              : 'chưa có'}
        </span>
        <span className="r">
          {c.suaDuoc ? (
            <button
              type="button"
              className="btn"
              onClick={() => setSua(sua === 'moi' ? null : 'moi')}
              title="Thêm phương án đóng gói"
            >
              <Plus size={14} aria-hidden />
              <span className="t">Thêm phương án</span>
            </button>
          ) : null}
        </span>
      </h2>
      {sua === 'moi' && (
        <SuaPhuongAn d={d} c={c} option={null} onClose={() => setSua(null)} />
      )}
      <div>
        <table aria-label="Phương án đóng gói">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Phương án</th>
              <th className="num">Cái / thùng</th>
              <th className="num">KTBB (cm)</th>
              <th className="num c-md">NW</th>
              <th className="num c-md">GW</th>
              <th className="num c-lg">GM (cm)</th>
              <th className="num c-lg">Fedex (in)</th>
              <th className="num c-sm">40HC</th>
              <th className="c-sm">Mặc định</th>
              <th>Ghi chú</th>
              <th style={{ width: 84 }}>
                <span className="sr">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={cn(sua === r.id && 'sel')}>
                  <td className="num">{r.no}</td>
                  <td>
                    {c.suaDuoc ? (
                      <OTxt sua value={r.o.label ?? ''} ph="tên phương án" w={150} onSave={(v) => luuOpt(r, { label: v.trim() || null })} />
                    ) : (
                      r.label
                    )}
                    {r.kien > 1 && (
                      <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>
                        {r.kien} kiện
                      </span>
                    )}
                  </td>
                  <td className="num">
                    <OTxt sua={c.suaDuoc} num value={r.cai != null ? String(r.cai) : ''} show={r.cai != null ? nz(r.cai, 0) : ''} w={44} onSave={(v) => { const n = soHoacBao(v); if (n !== false) void luuOpt(r, { cartons_per_set: n }) }} />
                  </td>
                  <td className="num">
                    {c.suaDuoc && r.kien <= 1 ? (
                      <span className="dims" style={{ justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                        <OTxt sua num value={r.l != null ? String(r.l).replace('.', ',') : ''} ph="D" w={44} onSave={(v) => luuKien(r, 'l', v, true)} />
                        <span className="muted">×</span>
                        <OTxt sua num value={r.w != null ? String(r.w).replace('.', ',') : ''} ph="R" w={44} onSave={(v) => luuKien(r, 'w', v, true)} />
                        <span className="muted">×</span>
                        <OTxt sua num value={r.h != null ? String(r.h).replace('.', ',') : ''} ph="C" w={44} onSave={(v) => luuKien(r, 'h', v, true)} />
                      </span>
                    ) : (
                      <span title={r.kien > 1 ? 'Nhiều kiện — sửa bằng nút ✎' : undefined}>{r.kt || '—'}</span>
                    )}
                  </td>
                  <td className="num c-md">
                    {c.suaDuoc && r.kien <= 1 ? (
                      <OTxt sua num value={r.nw != null ? String(r.nw).replace('.', ',') : ''} w={52} onSave={(v) => luuKien(r, 'nw', v)} />
                    ) : r.nw != null ? nz(r.nw, 1) : '—'}
                  </td>
                  <td className="num c-md">
                    {c.suaDuoc && r.kien <= 1 ? (
                      <OTxt sua num value={r.gw != null ? String(r.gw).replace('.', ',') : ''} w={52} onSave={(v) => luuKien(r, 'gw', v)} />
                    ) : r.gw != null ? nz(r.gw, 1) : '—'}
                  </td>
                  <td className="num c-lg">{r.gm != null ? nz(r.gm, 0) : '—'}</td>
                  <td className="num c-lg">{r.gm != null ? nz(r.gm / 2.54, 1) : '—'}</td>
                  <td className="num c-sm">
                    <OTxt sua={c.suaDuoc} num value={r.hc != null ? String(r.hc) : ''} show={r.hc != null ? nz(r.hc, 0) : ''} w={52} onSave={(v) => { const n = soHoacBao(v); if (n !== false) void luuOpt(r, { loading_40hc: n }) }} />
                  </td>
                  <td className="c-sm">
                    {r.def ? (
                      <span className="st run">Đang dùng</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'normal', minWidth: 140 }}>
                    <OTxt sua={c.suaDuoc} value={r.note ?? ''} ph="ghi chú…" onSave={(v) => luuOpt(r, { note: v.trim() || null })} />
                  </td>
                  <td>
                    {c.suaDuoc && (
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn sm"
                          disabled={busyRow === r.id}
                          onClick={() => setSua(sua === r.id ? null : r.id)}
                          title="Sửa phương án"
                          aria-label={`Sửa phương án ${r.no}`}
                        >
                          <PenLine size={13} aria-hidden />
                        </button>
                        {!r.def && (
                          <button
                            type="button"
                            className="btn sm"
                            disabled={busyRow === r.id}
                            onClick={() => void datMacDinh(r.id, r.no)}
                            title="Đặt làm phương án mặc định"
                            aria-label={`Đặt phương án ${r.no} làm mặc định`}
                          >
                            <Star size={13} aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn sm del"
                          disabled={busyRow === r.id}
                          onClick={() => void xoa(r.id, r.no, r.def)}
                          title="Xoá phương án"
                          aria-label={`Xoá phương án ${r.no}`}
                        >
                          <Trash2 size={13} aria-hidden />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
                {sua === r.id && (
                  <tr>
                    <td
                      colSpan={12}
                      style={{ padding: 0, whiteSpace: 'normal', height: 'auto' }}
                    >
                      <SuaPhuongAn
                        d={d}
                        c={c}
                        option={r.o}
                        onClose={() => setSua(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {/* Dòng TÓM TẮT (jsonb) — luôn hiện để còn chỗ gõ cho 120 SP chỉ có ô này. */}
            <tr>
              <td className="num muted">—</td>
              <td
                title={
                  j.pack_unit_label ? `Đơn vị đóng gói: ${j.pack_unit_label}` : undefined
                }
              >
                Ô tóm tắt (nhập tay)
              </td>
              <td className="num">
                <OSo c={c} k="qty_per_carton" v={j.qty_per_carton} digits={0} />
              </td>
              <td className="num">
                <span className="dims" style={{ justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                  <OSo c={c} k="carton_l_cm" v={j.carton_l_cm} digits={1} />
                  <span className="muted">×</span>
                  <OSo c={c} k="carton_w_cm" v={j.carton_w_cm} digits={1} />
                  <span className="muted">×</span>
                  <OSo c={c} k="carton_h_cm" v={j.carton_h_cm} digits={1} />
                </span>
              </td>
              <td className="num">
                <OSo c={c} k="nw_kg" v={j.nw_kg} digits={1} />
              </td>
              <td className="num">
                <OSo c={c} k="gw_kg" v={j.gw_kg} digits={1} />
              </td>
              <td className="num">{gmJ != null ? nz(gmJ, 0) : '—'}</td>
              <td className="num">{gmJ != null ? nz(gmJ / 2.54, 1) : '—'}</td>
              <td className="num">
                <OSo c={c} k="loading_40hc" v={j.loading_40hc} digits={0} />
              </td>
              <td style={{ whiteSpace: 'normal', minWidth: 140 }}>
                <OTxt sua={c.suaDuoc} value={j.note ?? ''} ph="ghi chú…" onSave={(v) => c.luuPacking({ note: v.trim() || null })} />
              </td>
              <td className="muted c-sm" style={{ order: -1 }}>
                {rows.length ? (
                  'dự phòng'
                ) : coJson ? (
                  <span className="st run">Đang dùng</span>
                ) : (
                  '—'
                )}
              </td>
              <td />
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={12} style={{ fontWeight: 400 }}>
                GM = D + 2R + 2C · Fedex = GM ÷ 2,54 — tính khi hiển thị, không lưu. Số
                cont do Kỹ thuật khai, không suy từ kích thước. Dòng “Đang dùng” = phương
                án in lên báo giá và lệnh.
                {c.suaDuoc ? ' Ô tóm tắt: gõ số, rời ô là lưu.' : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

const TEN_PACK: Record<string, string> = {
  qty_per_carton: 'Cái / thùng',
  carton_l_cm: 'Dài thùng (cm)',
  carton_w_cm: 'Rộng thùng (cm)',
  carton_h_cm: 'Cao thùng (cm)',
  nw_kg: 'NW (kg)',
  gw_kg: 'GW (kg)',
  loading_40hc: 'Số cái / cont 40HC',
}

/** Ô số của dòng tóm tắt: ở chế độ sửa luôn là ô nhập; Enter / rời ô là lưu (trộn vào jsonb). */
function OSo({
  c,
  k,
  v,
  digits,
}: {
  c: HoSoCtx
  k: string
  v: number | undefined
  digits: number
}) {
  const initial = v != null ? String(v).replace('.', ',') : ''
  const [val, setVal] = useState(initial)
  if (!c.suaDuoc)
    return <>{v != null ? nz(v, digits) : <span className="muted">—</span>}</>
  const save = async () => {
    const t = val.trim()
    if (t === initial.trim()) return
    const n = t ? Number(t.replace(/\./g, '').replace(',', '.')) : null
    if (t && (!Number.isFinite(n) || (n as number) < 0)) {
      c.toast.error('Số không hợp lệ', `"${val}"`)
      return
    }
    if ((v ?? null) !== n) await c.luuPacking({ [k]: n })
  }
  return (
    <input
      onFocus={(e) => e.currentTarget.select()}
      className="cell num"
      style={{ width: 60, textAlign: 'right' }}
      value={val}
      aria-label={TEN_PACK[k] ?? k}
      disabled={c.busyPack}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          void save()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') setVal(initial)
      }}
      onBlur={() => void save()}
    />
  )
}
