'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
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
  if (rows) {
    const best = new Map<string, PriceRow>()
    for (const r of rows) {
      if (r.valid_from > today) continue
      const cur = best.get(r.material_id)
      if (!cur || r.valid_from > cur.valid_from) best.set(r.material_id, r)
    }
    for (const r of best.values()) currentIds.add(r.id)
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

  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-3">
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
    </div>
  )
}
