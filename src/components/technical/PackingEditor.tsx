'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { cn } from '@/lib/utils'
import type { Packing } from '@/components/technical/product-sections'

/**
 * FORM NHẬP QUY CÁCH ĐÓNG GÓI — viết riêng, không dùng form sinh từ `SECTIONS`.
 *
 * User 13/08/2026: "phần đóng gói xuất khẩu nhập quy cách rất khó hiểu". Form
 * sinh tự động bày bảy ô rời nhau, mỗi ô một nhãn viết tắt (NW, GW, Loading
 * 40'HC) — người nhập không thấy được ba con số carton hợp lại thành cái gì, và
 * phải tự nhẩm xem số mình gõ có vô lý không.
 *
 * Nên form này bám theo cách người ta MÔ TẢ một kiện hàng ngoài đời:
 *
 *   1. Cái thùng to bằng nào  →  ba ô nằm trên MỘT dòng `D × R × C`, và CBM
 *      hiện ra ngay bên cạnh khi gõ (số dẫn xuất, không có ô nhập).
 *   2. Trong thùng có mấy sản phẩm.
 *   3. Một cont 40′HC xếp được mấy thùng — kèm tổng khối đã chiếm, vì đó mới là
 *      con số người xếp cont nhìn (cont 40′HC chứa ~76 m³).
 *   4. Thùng nặng bao nhiêu — tịnh và cả bì, viết tiếng Việt, chữ viết tắt NW/GW
 *      để trong ngoặc cho người quen chứng từ.
 *
 * Cảnh báo MỀM ngay dưới ô, không chặn lưu: cả bì nhẹ hơn tịnh, tổng khối vượt
 * sức chứa cont. Đây là chỗ sai thì cả lô hàng tính sai, nhưng vẫn có ngoại lệ
 * thật (đóng ghép, cont cao) nên chặn cứng là cản người dùng đúng.
 */
export function PackingEditor({
  productId,
  packing,
  fallback,
  onClose,
}: {
  productId: string
  /** jsonb `packing` HIỆN CÓ — phải trộn lại khi lưu, jsonb ghi đè trọn khối. */
  packing: Packing
  /** Số đã bù từ phương án đóng gói mặc định — làm gợi ý xám cho ô trống. */
  fallback: Packing
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState<Record<string, string>>({
    carton_l_cm: str(packing.carton_l_cm),
    carton_w_cm: str(packing.carton_w_cm),
    carton_h_cm: str(packing.carton_h_cm),
    qty_per_carton: str(packing.qty_per_carton),
    loading_40hc: str(packing.loading_40hc),
    nw_kg: str(packing.nw_kg),
    gw_kg: str(packing.gw_kg),
    pack_unit_label: packing.pack_unit_label ?? '',
  })

  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const n = (k: string) => numOrNull(f[k])

  const l = n('carton_l_cm')
  const w = n('carton_w_cm')
  const h = n('carton_h_cm')
  const cbm = l != null && w != null && h != null ? (l * w * h) / 1_000_000 : null
  const loading = n('loading_40hc')
  const totalCbm = cbm != null && loading != null ? cbm * loading : null
  const nw = n('nw_kg')
  const gw = n('gw_kg')

  /** Sức chứa lý thuyết cont 40′HC ≈ 76 m³; quá 10% là gần như chắc sai số. */
  const contWarn = totalCbm != null && totalCbm > 76 * 1.1
  const weightWarn = nw != null && gw != null && gw < nw

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      // jsonb bị ghi đè trọn khối → trộn lên giá trị cũ, ô để trống thì XOÁ khoá
      // đó thay vì ghi null (giữ đúng nếp của ProductSectionForm).
      const next: Record<string, unknown> = { ...packing }
      for (const k of [
        'carton_l_cm',
        'carton_w_cm',
        'carton_h_cm',
        'qty_per_carton',
        'loading_40hc',
        'nw_kg',
        'gw_kg',
      ]) {
        const v = numOrNull(f[k])
        if (v === null) delete next[k]
        else next[k] = v
      }
      const label = f.pack_unit_label.trim()
      if (label) next.pack_unit_label = label
      else delete next.pack_unit_label

      await api(`/api/dept/technical/products/${productId}`, {
        method: 'PATCH',
        body: { packing: next },
      })
      router.refresh()
      toast.success('Đã lưu', 'Quy cách đóng gói')
      onClose()
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* ── 1. Kích thước thùng: một dòng D × R × C, CBM tự hiện ── */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Thùng carton</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Num
            value={f.carton_l_cm}
            onChange={set('carton_l_cm')}
            label="Dài"
            unit="cm"
            placeholder={str(fallback.carton_l_cm)}
          />
          <span className="text-muted-foreground">×</span>
          <Num
            value={f.carton_w_cm}
            onChange={set('carton_w_cm')}
            label="Rộng"
            unit="cm"
            placeholder={str(fallback.carton_w_cm)}
          />
          <span className="text-muted-foreground">×</span>
          <Num
            value={f.carton_h_cm}
            onChange={set('carton_h_cm')}
            label="Cao"
            unit="cm"
            placeholder={str(fallback.carton_h_cm)}
          />
          <span
            className={cn(
              'ms-1 rounded-md px-2.5 py-1.5 text-sm',
              cbm != null ? 'bg-muted font-medium' : 'text-muted-foreground',
            )}
          >
            {cbm != null ? `= ${cbm.toFixed(3)} m³/thùng` : '= — m³/thùng'}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Đo mặt ngoài thùng, đơn vị <strong>cm</strong>. Thể tích (CBM) máy tự tính,
          không nhập tay.
        </p>
      </fieldset>

      {/* ── 2 & 3. Sức chứa ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Số sản phẩm trong 1 thùng</span>
          <Num
            value={f.qty_per_carton}
            onChange={set('qty_per_carton')}
            unit="SP"
            placeholder={str(fallback.qty_per_carton)}
            wide
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Số thùng xếp trong 1 container 40′HC{' '}
            <span className="text-muted-foreground font-normal">(Loading 40′HC)</span>
          </span>
          <Num
            value={f.loading_40hc}
            onChange={set('loading_40hc')}
            unit="thùng"
            placeholder={str(fallback.loading_40hc)}
            wide
            warn={contWarn}
          />
          {totalCbm != null && (
            <span
              className={cn(
                'text-xs',
                contWarn ? 'text-amber-700 dark:text-amber-500' : 'text-muted-foreground',
              )}
            >
              {contWarn ? '⚠ ' : ''}
              Tổng khối: {totalCbm.toFixed(1)} m³ — cont 40′HC chứa khoảng 76 m³
            </span>
          )}
        </label>
      </div>

      {/* ── 4. Khối lượng ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Khối lượng tịnh mỗi thùng{' '}
            <span className="text-muted-foreground font-normal">(NW)</span>
          </span>
          <Num
            value={f.nw_kg}
            onChange={set('nw_kg')}
            unit="kg"
            step="0.01"
            placeholder={str(fallback.nw_kg)}
            wide
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Khối lượng cả bì mỗi thùng{' '}
            <span className="text-muted-foreground font-normal">(GW)</span>
          </span>
          <Num
            value={f.gw_kg}
            onChange={set('gw_kg')}
            unit="kg"
            step="0.01"
            placeholder={str(fallback.gw_kg)}
            wide
            warn={weightWarn}
          />
          {weightWarn && (
            <span className="text-xs text-amber-700 dark:text-amber-500">
              ⚠ Cả bì đang NHẸ hơn tịnh — cả bì gồm cả vỏ thùng nên phải lớn hơn.
            </span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm sm:max-w-56">
        <span className="font-medium">Đơn vị đóng gói</span>
        <select
          value={f.pack_unit_label}
          onChange={(e) => set('pack_unit_label')(e.target.value)}
          className={inputCls}
        >
          <option value="">— thùng carton (mặc định) —</option>
          <option value="ctn">ctn — thùng carton</option>
          <option value="pallet">pallet</option>
          <option value="set">set — bộ</option>
        </select>
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-md border px-4 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-900"
        >
          Huỷ
        </button>
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-1.5 text-sm font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </form>
  )
}

const inputCls =
  'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]'

/** Ô số có đơn vị dính trong ô + nhãn nhỏ phía trên (dùng cho bộ D × R × C). */
function Num({
  value,
  onChange,
  label,
  unit,
  step = '0.1',
  placeholder,
  wide,
  warn,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  unit: string
  step?: string
  placeholder?: string
  wide?: boolean
  warn?: boolean
}) {
  return (
    <span className={cn('flex flex-col gap-0.5', !wide && 'w-24')}>
      {label && <span className="text-muted-foreground text-[11px]">{label}</span>}
      <span className="relative">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            inputCls,
            'pe-10',
            warn && 'border-amber-400 dark:border-amber-600',
          )}
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-xs font-medium">
          {unit}
        </span>
      </span>
    </span>
  )
}

const str = (v: number | null | undefined) => (v == null ? '' : String(v))

function numOrNull(v: string | undefined): number | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
