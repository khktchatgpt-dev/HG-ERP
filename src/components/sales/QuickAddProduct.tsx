'use client'

import { useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { uploadFile, MAX_UPLOAD_BYTES as MAX_BYTES } from '@/lib/upload'

export type QuickProduct = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  image_file_id: string | null
}

/**
 * Tạo nhanh SP mới trong form báo giá/đơn (hướng B): sale điền mã+tên+ĐVT+giá+
 * ghi chú + ảnh → tạo SP vào thư viện (BOM 'chưa có'); ảnh lưu vào hồ sơ SP và
 * đặt làm ảnh đại diện. Kỹ thuật bổ sung BOM/thông số sau.
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
  const [notes, setNotes] = useState('')
  const [image, setImage] = useState<File | null>(null)

  const cls =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  function reset() {
    setCode('')
    setName('')
    setUnit('cai')
    setItemCode('')
    setPrice('')
    setNotes('')
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
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
            notes: notes.trim() || null,
            reference_price: unitPrice,
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
      toast.error('Tạo SP thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
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
        Tạo nhanh sản phẩm mới — ảnh & ghi chú lưu vào hồ sơ Kỹ thuật để bổ sung sau
      </div>
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
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Ghi chú đầy đủ cho SP (vật liệu, mô tả, lưu ý sản xuất…) — Kỹ thuật đọc để bổ sung BOM/thông số"
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
