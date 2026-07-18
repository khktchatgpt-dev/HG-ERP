'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import {
  SAMPLE_CONDITION_LABEL,
  SAMPLE_CONDITIONS,
  SAMPLE_KIND_LABEL,
  SAMPLE_KINDS,
  type SampleCondition,
  type SampleKind,
} from '@/modules/dept/technical/samples.schema'

/**
 * Thêm hiện vật vào showroom. `quantity` > 1 sinh nhiều mẫu, MỖI CÁI MỘT MÃ —
 * 3 ghế giống nhau là 3 hiện vật khác nhau, mượn/hỏng độc lập.
 *
 * `kind='product'` gắn SP trong thư viện; loại khác (vật liệu/đối thủ/prototype)
 * đứng độc lập với tên tự khai, khỏi làm bẩn danh mục SP thật.
 */
export function SampleCreateModal({
  products,
  onClose,
}: {
  products: { id: string; code: string; name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<SampleKind>('product')
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [condition, setCondition] = useState<SampleCondition>('good')
  const [quantity, setQuantity] = useState(1)
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')

  const isProduct = kind === 'product'
  const ready = isProduct ? !!productId : !!name.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    try {
      const { codes } = await api<{ codes: string[] }>('/api/dept/technical/samples', {
        method: 'POST',
        body: {
          kind,
          product_id: isProduct ? productId : null,
          name: isProduct ? null : name.trim(),
          category: isProduct ? null : category || null,
          source: isProduct ? null : source || null,
          condition,
          quantity,
          location: location || null,
          note: note || null,
        },
      })
      toast.success(
        codes.length > 1 ? `Đã thêm ${codes.length} mẫu` : 'Đã thêm mẫu',
        codes.join(', '),
      )
      onClose()
      router.refresh()
    } catch (e) {
      toast.error('Thêm mẫu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Thêm mẫu showroom">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Loại hiện vật *">
          <select
            value={kind}
            onChange={(e) => setKind(e.currentTarget.value as SampleKind)}
            className={INPUT}
          >
            {SAMPLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SAMPLE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>

        {isProduct ? (
          <Field label="Sản phẩm *">
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.currentTarget.value)}
              className={INPUT}
            >
              <option value="">— Chọn sản phẩm —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Tên hiện vật *">
              <input
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="Mẫu veneer óc chó, ghế đối thủ X…"
                className={INPUT}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nhóm / phân loại">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.currentTarget.value)}
                  placeholder="Veneer, sơn, phụ kiện…"
                  className={INPUT}
                />
              </Field>
              <Field label="Hãng / nguồn">
                <input
                  value={source}
                  onChange={(e) => setSource(e.currentTarget.value)}
                  placeholder="Hãng, nơi mua…"
                  className={INPUT}
                />
              </Field>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Số lượng hiện vật">
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Number(e.currentTarget.value) || 1))
              }
              className={INPUT}
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Mỗi cái được cấp một mã riêng.
            </p>
          </Field>
          <Field label="Tình trạng">
            <select
              value={condition}
              onChange={(e) => setCondition(e.currentTarget.value as SampleCondition)}
              className={INPUT}
            >
              {SAMPLE_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {SAMPLE_CONDITION_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Vị trí trong showroom">
          <input
            value={location}
            onChange={(e) => setLocation(e.currentTarget.value)}
            placeholder="Kệ A3, góc trưng bày…"
            className={INPUT}
          />
        </Field>

        <Field label="Ghi chú">
          <textarea
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            rows={2}
            className={INPUT}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Huỷ
          </button>
          <button type="submit" disabled={busy || !ready} className={BTN_PRIMARY}>
            {busy && <Spinner size={12} />}
            {busy ? 'Đang thêm…' : 'Thêm mẫu'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export const INPUT =
  'w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900'
export const BTN_GHOST =
  'rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900'
export const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700 disabled:opacity-50'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
