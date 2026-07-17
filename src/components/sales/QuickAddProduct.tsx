'use client'

import { useRef, useState } from 'react'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { uploadFile, MAX_UPLOAD_BYTES as MAX_BYTES } from '@/lib/upload'

/** Quy cách đóng gói (in trên báo giá) — mọi field optional. */
export type Packing = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
  nw_kg?: number
  gw_kg?: number
}

export type QuickProduct = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  image_file_id: string | null
  description_en: string | null
  packing: Packing
}

const PACK_FIELDS: { key: keyof Packing; label: string; int?: boolean }[] = [
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

/**
 * Tạo nhanh SP mới trong form báo giá/đơn: điền cơ bản + quy cách đóng gói (in
 * ngay lên báo giá) + thông tin XK + ảnh → tạo SP vào thư viện (BOM 'chưa có').
 * Kỹ thuật vẫn sửa/bổ sung BOM & thông số sau.
 */
export function QuickAddProduct({
  customerId,
  onCreated,
}: {
  customerId?: string | null
  onCreated: (p: QuickProduct, unitPrice: number | null) => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('cai')
  const [itemCode, setItemCode] = useState('')
  const [price, setPrice] = useState('')
  const [descEn, setDescEn] = useState('')
  const [notes, setNotes] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [pack, setPack] = useState<Record<keyof Packing, string>>(
    () =>
      Object.fromEntries(PACK_FIELDS.map((f) => [f.key, ''])) as Record<
        keyof Packing,
        string
      >,
  )
  const [material, setMaterial] = useState('')
  const [hsCode, setHsCode] = useState('')
  const [origin, setOrigin] = useState('')
  const [nameForeign, setNameForeign] = useState('')
  const [shippingMark, setShippingMark] = useState('')
  const [showExport, setShowExport] = useState(false)

  const setP = (k: keyof Packing, v: string) => setPack((p) => ({ ...p, [k]: v }))

  const cls =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  function reset() {
    setCode('')
    setName('')
    setUnit('cai')
    setItemCode('')
    setPrice('')
    setDescEn('')
    setNotes('')
    setImage(null)
    setPack(
      Object.fromEntries(PACK_FIELDS.map((f) => [f.key, ''])) as Record<
        keyof Packing,
        string
      >,
    )
    setMaterial('')
    setHsCode('')
    setOrigin('')
    setNameForeign('')
    setShippingMark('')
    setShowExport(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function buildPacking(): Packing {
    const out: Packing = {}
    for (const f of PACK_FIELDS) {
      const raw = pack[f.key].trim()
      if (raw === '') continue
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) out[f.key] = f.int ? Math.round(n) : n
    }
    return out
  }

  async function submit() {
    if (!code.trim() || !name.trim()) {
      toast.error('Thiếu thông tin', 'Cần mã SP và tên SP')
      return
    }
    if (image && image.size > MAX_BYTES) {
      toast.error('Ảnh quá lớn', `Tối đa ${MAX_BYTES / 1024 / 1024} MB`)
      return
    }
    const unitPrice = price.trim() ? Number(price) : null
    setBusy(true)
    try {
      const { product } = await api<{ product: QuickProduct }>(
        '/api/dept/sales/products',
        {
          method: 'POST',
          body: {
            code: code.trim(),
            name: name.trim(),
            unit: unit.trim() || 'cai',
            customer_id: customerId ?? null,
            customer_item_code: itemCode.trim() || null,
            description_en: descEn.trim() || null,
            notes: notes.trim() || null,
            reference_price: unitPrice,
            packing: buildPacking(),
            material: material.trim() || null,
            hs_code: hsCode.trim() || null,
            origin_country: origin.trim() || null,
            name_foreign: nameForeign.trim() || null,
            shipping_mark: shippingMark.trim() || null,
          },
        },
      )

      let imageFileId: string | null = null
      if (image) {
        try {
          imageFileId = await uploadFile(image, { kind: 'product', id: product.id })
          await api(`/api/dept/sales/products/${product.id}/image`, {
            method: 'POST',
            body: { file_id: imageFileId },
          })
        } catch (err) {
          toast.error(
            'SP đã tạo nhưng tải ảnh lỗi',
            err instanceof ApiError ? err.message : 'Có lỗi — thêm ảnh lại ở Kỹ thuật',
          )
        }
      }

      toast.success('Đã tạo sản phẩm mới', `${product.code} — ${product.name}`)
      onCreated({ ...product, image_file_id: imageFileId }, unitPrice)
      reset()
      setOpen(false)
    } catch (err) {
      toast.error('Tạo SP thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
      >
        + SP mới (tạo nhanh vào thư viện)
      </button>
    )
  }

  return (
    <div className="w-full rounded-md border border-emerald-300 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
      <div className="mb-2 text-xs font-semibold text-emerald-700 uppercase dark:text-emerald-400">
        Tạo nhanh sản phẩm mới — điền đủ để in ngay lên báo giá; Kỹ thuật bổ sung BOM sau
      </div>

      {/* Cơ bản */}
      <Section label="Cơ bản">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Mã SP *"
            maxLength={100}
            className={`${cls} font-mono`}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên SP *"
            maxLength={200}
            className={`${cls} col-span-2`}
          />
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="ĐVT"
            maxLength={30}
            className={cls}
          />
          <input
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value)}
            placeholder="Mã KH đặt"
            maxLength={100}
            className={`${cls} col-span-2 font-mono`}
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="Đơn giá"
            className={cls}
          />
          <label className="col-span-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-300 px-2 py-1.5 text-xs text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700">
            {image ? '🖼 Đổi ảnh' : '🖼 Chọn ảnh'}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImage(e.currentTarget.files?.[0] ?? null)}
            />
          </label>
        </div>
        <input
          value={descEn}
          onChange={(e) => setDescEn(e.target.value)}
          placeholder="Mô tả tiếng Anh (in trên báo giá) — vd 'Alu frame, powder coating, Eukalyptus FSC 100%'"
          maxLength={2000}
          className={`${cls} mt-2`}
        />
      </Section>

      {/* Quy cách đóng gói */}
      <Section label="Quy cách đóng gói (in trên báo giá)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PACK_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                {f.label}
              </span>
              <input
                value={pack[f.key]}
                onChange={(e) => setP(f.key, e.target.value)}
                type="number"
                step={f.int ? '1' : '0.01'}
                min="0"
                className={cls}
              />
            </label>
          ))}
        </div>
      </Section>

      {/* Xuất khẩu (tuỳ chọn) */}
      <Section
        label="Xuất khẩu (tuỳ chọn)"
        toggle
        open={showExport}
        onToggle={() => setShowExport((v) => !v)}
      >
        {showExport && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Chất liệu chính"
              maxLength={300}
              className={`${cls} col-span-2`}
            />
            <input
              value={hsCode}
              onChange={(e) => setHsCode(e.target.value)}
              placeholder="Mã HS"
              maxLength={20}
              className={`${cls} font-mono`}
            />
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Xuất xứ (vd Vietnam)"
              maxLength={100}
              className={cls}
            />
            <input
              value={nameForeign}
              onChange={(e) => setNameForeign(e.target.value)}
              placeholder="Tên theo khách — mọi ngôn ngữ (in trên LSX)"
              maxLength={300}
              className={`${cls} col-span-2 sm:col-span-4`}
            />
            <textarea
              value={shippingMark}
              onChange={(e) => setShippingMark(e.target.value)}
              placeholder="Shipping mark — ký mã hiệu in trên thùng"
              maxLength={2000}
              rows={2}
              className={`${cls} col-span-2 sm:col-span-4`}
            />
          </div>
        )}
      </Section>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Ghi chú nội bộ cho Kỹ thuật (lưu ý sản xuất, vật liệu chi tiết…)"
        className={`${cls} mt-2`}
      />

      <div className="mt-2 flex items-center gap-3">
        {image && (
          <span className="truncate text-xs text-emerald-700 dark:text-emerald-400">
            Ảnh: {image.name}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              reset()
              setOpen(false)
            }}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Spinner size={12} />}
            Tạo & thêm
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  label,
  children,
  toggle,
  open,
  onToggle,
}: {
  label: string
  children: React.ReactNode
  toggle?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="mt-2 border-t border-emerald-200/60 pt-2 first:mt-0 first:border-t-0 first:pt-0 dark:border-emerald-800/60">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-emerald-700/80 uppercase dark:text-emerald-400/80">
          {label}
        </span>
        {toggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {open ? 'Thu gọn ▲' : 'Mở rộng ▼'}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
