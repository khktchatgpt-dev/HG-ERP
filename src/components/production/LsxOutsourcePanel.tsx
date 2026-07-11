'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'

/**
 * Gia công ngoài của LSX (SX-P4 — FR-OS): sổ giao ↔ nhận per chi tiết × đơn vị
 * (TTP, Vinh… = NCC dịch vụ trong danh mục NCC), đối chiếu thiếu/dư + %HT.
 */

type Pair = {
  component_id: string
  component_name: string
  supplier_id: string
  supplier_name: string
  sent: number
  received: number
  defect: number
  missing: number
  pct: number
}
type Entry = {
  id: string
  component_id: string
  supplier_id: string
  direction: 'send' | 'receive'
  entry_date: string
  qty: number
  defect_qty: number
  note: string | null
  supplier_name: string | null
  created_by_name: string | null
}
type ComponentOpt = { id: string; name: string }
type SupplierOpt = { id: string; name: string }

const inp =
  'w-full rounded border border-zinc-300 px-1.5 py-1 text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function LsxOutsourcePanel({
  lsxId,
  canRecord,
  active,
}: {
  lsxId: string
  canRecord: boolean
  active: boolean
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [pairs, setPairs] = useState<Pair[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [components, setComponents] = useState<ComponentOpt[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([])
  const [showEntries, setShowEntries] = useState(false)

  const [form, setForm] = useState({
    component_id: '',
    supplier_id: '',
    direction: 'send' as 'send' | 'receive',
    entry_date: new Date().toISOString().slice(0, 10),
    qty: '' as number | '',
    defect_qty: '' as number | '',
    note: '',
  })

  const load = useCallback(async () => {
    try {
      const [os, comps, sups] = await Promise.all([
        api<{ pairs: Pair[]; entries: Entry[] }>(
          `/api/dept/production/lsx/${lsxId}/outsource`,
        ),
        api<{ lines: { id: string; name: string }[] }>(
          `/api/dept/production/lsx/${lsxId}/components`,
        ),
        api<{ rows: { id: string; name: string }[] }>(
          `/api/dept/supply/suppliers?active_only=true&page=1&page_size=200`,
        ),
      ])
      setPairs(os.pairs)
      setEntries(os.entries)
      setComponents(comps.lines.map((l) => ({ id: l.id, name: l.name })))
      setSuppliers(sups.rows.map((s) => ({ id: s.id, name: s.name })))
    } catch (e) {
      toast.error(
        'Không tải được gia công ngoài',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsxId])

  useEffect(() => {
    // load() là async — setState chạy trong callback đã resolve, không đồng bộ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function save() {
    if (!form.component_id || !form.supplier_id || form.qty === '' || form.qty <= 0) {
      toast.error('Thiếu dữ liệu', 'Chọn chi tiết + đơn vị + SL > 0')
      return
    }
    setBusy(true)
    try {
      const res = await api<{ warnings: string[] }>(
        `/api/dept/production/lsx/${lsxId}/outsource`,
        {
          method: 'POST',
          body: {
            component_id: form.component_id,
            supplier_id: form.supplier_id,
            direction: form.direction,
            entry_date: form.entry_date,
            qty: Number(form.qty),
            defect_qty: form.defect_qty === '' ? 0 : Number(form.defect_qty),
            note: form.note.trim() || null,
          },
        },
      )
      toast.success(
        form.direction === 'send' ? 'Đã ghi đợt giao' : 'Đã ghi nhận về',
        form.entry_date,
      )
      for (const w of res.warnings) toast.error('⚠ Lệch giao/nhận', w)
      setForm((f) => ({ ...f, qty: '', defect_qty: '', note: '' }))
      await load()
    } catch (e) {
      toast.error('Ghi thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry(en: Entry) {
    const ok = await confirm({
      title: 'Xoá bản ghi gia công?',
      description: `${en.entry_date} · ${en.direction === 'send' ? 'giao' : 'nhận'} ${en.qty}. Xoá rồi nhập lại nếu ghi nhầm.`,
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/outsource/${en.id}`, { method: 'DELETE' })
      toast.success('Đã xoá bản ghi')
      await load()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const componentName = (id: string) => components.find((c) => c.id === id)?.name ?? '?'

  // LSX chưa dùng gia công ngoài + không nhập được → ẩn cho gọn màn.
  if (pairs.length === 0 && !(canRecord && active)) return null

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Gia công ngoài ({pairs.length} cặp chi tiết × đơn vị)
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {pairs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                  <th className="py-1.5 pr-2">Chi tiết</th>
                  <th className="py-1.5 pr-2">Đơn vị GC</th>
                  <th className="w-20 py-1.5 pr-2 text-right">Đã giao</th>
                  <th className="w-20 py-1.5 pr-2 text-right">Nhận về</th>
                  <th className="w-20 py-1.5 pr-2 text-right">Thiếu/(Dư)</th>
                  <th className="w-16 py-1.5 pr-2 text-right">Hỏng</th>
                  <th className="w-16 py-1.5 pr-2 text-right">%HT</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => (
                  <tr
                    key={`${p.component_id}|${p.supplier_id}`}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1.5 pr-2 font-medium">{p.component_name}</td>
                    <td className="py-1.5 pr-2">{p.supplier_name}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {p.sent.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {p.received.toLocaleString('vi-VN')}
                    </td>
                    <td
                      className={`py-1.5 pr-2 text-right ${p.missing > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}
                    >
                      {p.missing.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {p.defect > 0 ? (
                        <span className="text-red-500">{p.defect}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-medium">
                      {Math.round(p.pct * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canRecord && active && components.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <label className="flex flex-col gap-1 text-xs">
              Chi tiết
              <select
                value={form.component_id}
                onChange={(e) => setForm({ ...form, component_id: e.target.value })}
                className={`${inp} min-w-32`}
              >
                <option value="">— chọn —</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Đơn vị GC
              <select
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className={`${inp} min-w-28`}
              >
                <option value="">— chọn —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Loại
              <select
                value={form.direction}
                onChange={(e) =>
                  setForm({ ...form, direction: e.target.value as 'send' | 'receive' })
                }
                className={inp}
              >
                <option value="send">Giao đi</option>
                <option value="receive">Nhận về</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Ngày
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                className={inp}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              SL
              <input
                type="number"
                min="0"
                step="1"
                value={form.qty}
                onChange={(e) =>
                  setForm({
                    ...form,
                    qty: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className={`${inp} w-20`}
              />
            </label>
            {form.direction === 'receive' && (
              <label className="flex flex-col gap-1 text-xs">
                Hỏng
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.defect_qty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defect_qty: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  className={`${inp} w-16`}
                />
              </label>
            )}
            <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs">
              Ghi chú
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className={inp}
              />
            </label>
            <button
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}Ghi
            </button>
          </div>
        )}

        {entries.length > 0 && (
          <div>
            <button
              onClick={() => setShowEntries((v) => !v)}
              className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              {showEntries ? '▾' : '▸'} Sổ giao/nhận ({entries.length})
            </button>
            {showEntries && (
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {entries.slice(0, 50).map((en) => (
                  <li
                    key={en.id}
                    className="flex flex-wrap items-center gap-2 border-l-2 border-zinc-300 pl-2 dark:border-zinc-700"
                  >
                    <span className="text-zinc-500">
                      {new Date(en.entry_date).toLocaleDateString('vi-VN')}
                    </span>
                    <Badge tone={en.direction === 'send' ? 'blue' : 'green'}>
                      {en.direction === 'send' ? 'Giao' : 'Nhận'}
                    </Badge>
                    <span className="font-medium">{componentName(en.component_id)}</span>
                    <span>
                      → {en.supplier_name ?? '?'} · SL <b>{en.qty}</b>
                      {en.defect_qty > 0 && (
                        <span className="text-red-500"> · hỏng {en.defect_qty}</span>
                      )}
                    </span>
                    {en.note && <span className="text-zinc-400">{en.note}</span>}
                    <span className="text-zinc-400">{en.created_by_name ?? '—'}</span>
                    {canRecord && active && (
                      <button
                        onClick={() => void removeEntry(en)}
                        className="text-red-500 hover:text-red-700"
                        title="Xoá bản ghi (nhập nhầm)"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
