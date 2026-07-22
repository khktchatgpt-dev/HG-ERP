'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/erp/Spinner'

export type MaterialOption = { id: string; code: string; name: string; unit: string }

export type PriceRow = {
  id: string
  material_id: string
  material_code: string
  material_name: string
  material_unit: string
  price: number
  currency: string
  valid_from: string
  note: string | null
}

export function fmtPrice(r: { price: number; currency: string }) {
  return `${r.price.toLocaleString('vi-VN')} ${r.currency}`
}

/**
 * Bảng giá NCC (FR-SUP-06). Đổi giá = THÊM bản ghi mới (valid_from) — giữ lịch
 * sử; bản ghi hiện hành (valid_from lớn nhất ≤ hôm nay) có badge "Hiện hành".
 */
export function PricesPanel({
  supplier,
  materials,
  canEdit,
}: {
  supplier: { id: string; name: string }
  materials: MaterialOption[]
  canEdit: boolean
}) {
  const toast = useToast()
  const [rows, setRows] = useState<PriceRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [materialId, setMaterialId] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('VND')
  const [validFrom, setValidFrom] = useState('')
  const [note, setNote] = useState('')

  async function reload() {
    const data = await api<{ prices: PriceRow[] }>(
      `/api/dept/supply/prices?supplier_id=${supplier.id}`,
    )
    setRows(data.prices)
  }

  useEffect(() => {
    let alive = true
    api<{ prices: PriceRow[] }>(`/api/dept/supply/prices?supplier_id=${supplier.id}`)
      .then((d) => {
        if (alive) setRows(d.prices)
      })
      .catch((e) => {
        if (alive) {
          setRows([])
          toast.error(
            'Không tải được bảng giá',
            e instanceof ApiError ? e.message : 'Có lỗi',
          )
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.id])

  // Bản ghi hiện hành per vật tư: valid_from lớn nhất ≤ hôm nay.
  const today = new Date().toISOString().slice(0, 10)
  const currentIds = new Set<string>()
  const currentRows: PriceRow[] = []
  if (rows) {
    const best = new Map<string, PriceRow>()
    for (const r of rows) {
      if (r.valid_from > today) continue
      const cur = best.get(r.material_id)
      if (!cur || r.valid_from > cur.valid_from) best.set(r.material_id, r)
    }
    for (const r of best.values()) {
      currentIds.add(r.id)
      currentRows.push(r)
    }
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/api/dept/supply/prices', {
        method: 'POST',
        body: {
          supplier_id: supplier.id,
          material_id: materialId,
          price: Number(price),
          currency,
          valid_from: validFrom || undefined,
          note: note.trim() || null,
        },
      })
      toast.success('Đã thêm giá chào', supplier.name)
      setPrice('')
      setNote('')
      await reload()
    } catch (err) {
      toast.error('Thêm giá thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: PriceRow) {
    if (!window.confirm(`Xoá giá ${row.material_code} (${fmtPrice(row)})?`)) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/prices/${row.id}`, { method: 'DELETE' })
      await reload()
    } catch (err) {
      toast.error('Xoá thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const [bulkOpen, setBulkOpen] = useState(false)
  async function submitBulk(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await api<{ count: number }>('/api/dept/supply/prices/bulk', {
        method: 'POST',
        body,
      })
      toast.success(`Đã cập nhật ${res.count} dòng giá`, supplier.name)
      setBulkOpen(false)
      await reload()
    } catch (e) {
      toast.error('Lưu báo giá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="rounded-md border border-sky-300 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40"
          >
            📋 Nhập báo giá (nhiều dòng)
          </button>
        </div>
      )}
      {canEdit && (
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            Vật tư <span className="text-red-500">*</span>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              required
              className={inp}
            >
              <option value="">— chọn vật tư —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Giá <span className="text-red-500">*</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className={inp}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Tiền tệ
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inp}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Hiệu lực từ
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className={inp}
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={busy || !materialId || price === ''}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}+ Thêm giá
            </button>
          </div>
          <label className="flex flex-col gap-1 text-xs sm:col-span-6">
            Ghi chú (quy cách, MOQ…)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className={inp}
            />
          </label>
        </form>
      )}

      {rows === null ? (
        <p className="py-4 text-center text-xs text-zinc-400">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">
          Chưa có giá chào nào — thêm ở trên (giá giữ nguyên tệ, không quy đổi).
        </p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-zinc-950">
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
                <th className="py-1.5 pr-2">Vật tư</th>
                <th className="py-1.5 pr-2 text-right">Giá</th>
                <th className="py-1.5 pr-2">Hiệu lực từ</th>
                <th className="py-1.5 pr-2">Ghi chú</th>
                <th className="w-8 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    <span className="font-mono text-xs text-zinc-400">
                      {r.material_code}
                    </span>{' '}
                    {r.material_name}
                    {currentIds.has(r.id) && (
                      <span className="ml-1.5">
                        <Badge tone="green">Hiện hành</Badge>
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-medium whitespace-nowrap">
                    {fmtPrice(r)}
                    <span className="text-xs text-zinc-400">/{r.material_unit}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-xs">
                    {new Date(r.valid_from).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="max-w-40 truncate py-1.5 pr-2 text-xs text-zinc-500">
                    {r.note ?? '—'}
                  </td>
                  <td className="py-1.5 text-right">
                    {canEdit && (
                      <button
                        onClick={() => void remove(r)}
                        className="text-xs text-red-500 hover:underline"
                        title="Xoá bản ghi giá"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={bulkOpen}
        title={`Nhập báo giá — ${supplier.name}`}
        onClose={() => setBulkOpen(false)}
        maxWidth="sm:max-w-2xl"
      >
        {bulkOpen && (
          <BulkQuoteForm
            supplierId={supplier.id}
            materials={materials}
            current={currentRows}
            busy={busy}
            onSubmit={submitBulk}
          />
        )}
      </Modal>
    </div>
  )
}

/**
 * Nhập BÁO GIÁ hàng loạt cho 1 NCC: prefill giá HIỆN HÀNH (chỉ sửa số), thêm
 * vật tư mới qua ô chọn. Bỏ trống giá = không gửi dòng đó. 1 ngày hiệu lực chung.
 */
function BulkQuoteForm({
  supplierId,
  materials,
  current,
  busy,
  onSubmit,
}: {
  supplierId: string
  materials: MaterialOption[]
  current: PriceRow[]
  busy: boolean
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  type BLine = {
    material_id: string
    code: string
    name: string
    unit: string
    price: number | ''
  }
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [currency, setCurrency] = useState(current[0]?.currency ?? 'VND')
  const [lines, setLines] = useState<BLine[]>(
    current.map((r) => ({
      material_id: r.material_id,
      code: r.material_code,
      name: r.material_name,
      unit: r.material_unit,
      price: r.price,
    })),
  )
  const [addId, setAddId] = useState('')

  const usedIds = new Set(lines.map((l) => l.material_id))
  const addable = materials.filter((m) => !usedIds.has(m.id))

  function addMaterial() {
    const m = materials.find((x) => x.id === addId)
    if (!m) return
    setLines((ls) => [
      ...ls,
      { material_id: m.id, code: m.code, name: m.name, unit: m.unit, price: '' },
    ])
    setAddId('')
  }
  const setPrice = (i: number, v: number | '') =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, price: v } : l)))
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i))

  const validLines = lines.filter((l) => l.price !== '' && Number(l.price) >= 0)
  const invalid = validLines.length === 0

  function submit() {
    if (invalid || busy) return
    void onSubmit({
      supplier_id: supplierId,
      currency,
      valid_from: validFrom || undefined,
      lines: validLines.map((l) => ({
        material_id: l.material_id,
        price: Number(l.price),
      })),
    })
  }

  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          Hiệu lực từ
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className={inp}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Tiền tệ
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inp}
          >
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>

      {lines.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-400">
          NCC chưa có giá — thêm vật tư bên dưới rồi nhập giá.
        </p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-zinc-950">
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
                <th className="py-1.5 pr-2">Vật tư</th>
                <th className="w-40 py-1.5 pr-2 text-right">Giá</th>
                <th className="w-8 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr
                  key={l.material_id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-1 pr-2">
                    <span className="font-mono text-xs text-zinc-400">{l.code}</span>{' '}
                    {l.name}
                  </td>
                  <td className="py-1 pr-2">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.price}
                        onChange={(e) =>
                          setPrice(i, e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="—"
                        className={`${inp} w-28 text-right tabular-nums`}
                      />
                      <span className="w-8 shrink-0 text-xs text-zinc-400">
                        /{l.unit}
                      </span>
                    </div>
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-xs text-zinc-400 hover:text-red-500"
                      aria-label="Bỏ dòng"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className={`${inp} flex-1`}
        >
          <option value="">＋ Thêm vật tư…</option>
          {addable.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addMaterial}
          disabled={!addId}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Thêm
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          Sẽ lưu <b>{validLines.length}</b> dòng (bỏ trống giá = không lưu).
        </span>
        <button
          type="button"
          disabled={busy || invalid}
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}Lưu báo giá
        </button>
      </div>
    </div>
  )
}
