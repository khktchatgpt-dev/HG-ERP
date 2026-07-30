'use client'

import { useMemo, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import {
  invalidateProductPickCache,
  type Packing,
  type ProductPick,
} from '@/components/sales/ProductPicker'

type PackKey = keyof Packing

const PACK_FIELDS: { key: PackKey; label: string; int?: boolean }[] = [
  { key: 'l_cm', label: 'Dài SP (cm)' },
  { key: 'w_cm', label: 'Rộng SP (cm)' },
  { key: 'h_cm', label: 'Cao SP (cm)' },
  { key: 'carton_l_cm', label: 'Carton dài (cm)' },
  { key: 'carton_w_cm', label: 'Carton rộng (cm)' },
  { key: 'carton_h_cm', label: 'Carton cao (cm)' },
  { key: 'qty_per_carton', label: 'SL/thùng', int: true },
  { key: 'loading_40hc', label: 'Loading 40HC', int: true },
  { key: 'nw_kg', label: 'NW/thùng (kg)' },
  { key: 'gw_kg', label: 'GW/thùng (kg)' },
]

/** Ô nào của SP còn TRỐNG — chỉ những ô này mới cho Kinh doanh điền. */
export function missingSpecKeys(p: ProductPick): {
  pack: PackKey[]
  descEn: boolean
  itemCode: boolean
} {
  const pk = p.packing ?? {}
  return {
    pack: PACK_FIELDS.filter((f) => pk[f.key] == null).map((f) => f.key),
    descEn: !p.description_en,
    itemCode: !p.customer_item_code,
  }
}

/** SP thiếu quy cách tới mức in báo giá ra trống chỗ kích thước / đóng gói. */
export function hasNoSpec(p: ProductPick): boolean {
  const pk = p.packing ?? {}
  const noDims = pk.l_cm == null || pk.w_cm == null || pk.h_cm == null
  return noDims && pk.qty_per_carton == null
}

const cls =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/**
 * Bổ sung quy cách cho SP ĐÃ CÓ trong thư viện, ngay tại dòng báo giá.
 *
 * Chỉ mở những ô đang TRỐNG: số Kỹ thuật đã khai thì Kinh doanh không ghi đè (cần
 * sửa thì vào hồ sơ SP bên Kỹ thuật). Lưu xong SP trong thư viện cũng có luôn —
 * không phải "quy cách riêng của báo giá này".
 */
export function ProductSpecFill({
  product,
  onSaved,
}: {
  product: ProductPick
  onSaved: (p: ProductPick) => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const missing = useMemo(() => missingSpecKeys(product), [product])
  const [pack, setPack] = useState<Record<string, string>>({})
  const [descEn, setDescEn] = useState('')
  const [itemCode, setItemCode] = useState('')

  const nothingMissing = missing.pack.length === 0 && !missing.descEn && !missing.itemCode
  if (nothingMissing) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 rounded-md border border-dashed border-amber-300 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-500 dark:hover:bg-amber-950/30"
      >
        ✎ Bổ sung quy cách cho {product.code} ({missing.pack.length} ô trống)
      </button>
    )
  }

  async function submit() {
    const packing: Record<string, number> = {}
    for (const key of missing.pack) {
      const raw = (pack[key] ?? '').trim()
      if (raw === '') continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0) continue
      const f = PACK_FIELDS.find((x) => x.key === key)!
      packing[key] = f.int ? Math.round(n) : n
    }
    const body: Record<string, unknown> = {}
    if (Object.keys(packing).length > 0) body.packing = packing
    if (missing.descEn && descEn.trim()) body.description_en = descEn.trim()
    if (missing.itemCode && itemCode.trim()) body.customer_item_code = itemCode.trim()
    if (Object.keys(body).length === 0) {
      toast.error('Chưa điền gì', 'Nhập ít nhất một ô rồi lưu')
      return
    }

    setBusy(true)
    try {
      const { product: updated } = await api<{ product: ProductPick }>(
        `/api/dept/sales/products/${product.id}/specs`,
        { method: 'PATCH', body },
      )
      // Ô chọn SP đang cache kết quả cũ (chưa có quy cách) — bỏ đi.
      invalidateProductPickCache()
      onSaved(updated)
      toast.success('Đã bổ sung quy cách', `${updated.code} — lưu vào thư viện SP`)
      setOpen(false)
    } catch (err) {
      toast.error('Chưa lưu được quy cách', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50/40 p-2.5 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="mb-2 text-[11px] font-semibold text-amber-700 uppercase dark:text-amber-500">
        Bổ sung quy cách {product.code} — lưu vào thư viện SP, in ngay lên báo giá
      </div>
      {missing.pack.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PACK_FIELDS.filter((f) => missing.pack.includes(f.key)).map((f) => (
            <label key={f.key} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                {f.label}
              </span>
              <input
                value={pack[f.key] ?? ''}
                onChange={(e) => setPack((p) => ({ ...p, [f.key]: e.target.value }))}
                type="number"
                step={f.int ? '1' : '0.01'}
                min="0"
                className={cls}
              />
            </label>
          ))}
        </div>
      )}
      {(missing.itemCode || missing.descEn) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {missing.itemCode && (
            <input
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              maxLength={100}
              placeholder="Mã KH đặt"
              className={`${cls} font-mono`}
            />
          )}
          {missing.descEn && (
            <input
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
              maxLength={2000}
              placeholder="Mô tả tiếng Anh (in trên báo giá)"
              className={`${cls} sm:col-span-2`}
            />
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Huỷ
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy && <Spinner size={12} />}
          Lưu quy cách
        </button>
      </div>
    </div>
  )
}
