'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

/**
 * GIA CÔNG NGOÀI per LSX (0084) — sổ giao/nhận per (chi tiết × NCC) + đối
 * chiếu thiếu/dư. Self-fetch theo lsxId; form ghi 1 dòng (thống kê).
 */

type Entry = {
  id: string
  component_id: string
  supplier_id: string
  direction: 'send' | 'receive'
  entry_date: string
  qty: number
  kg: number | null
  defect_qty: number
  note: string | null
  supplier_name: string | null
  component_name: string | null
  created_by_name: string | null
}

type Pair = {
  component_id: string
  component_name: string | null
  supplier_id: string
  supplier_name: string | null
  summary: {
    sent: number
    received: number
    defect: number
    missing: number
    pct: number
  }
}

type Data = { entries: Entry[]; pairs: Pair[] }

type ComponentOpt = { id: string; name: string }
type SupplierOpt = { id: string; name: string }

const fmtN = (n: number) => n.toLocaleString('vi-VN')
const fmtD = (d: string) => new Date(d).toLocaleDateString('vi-VN')
const inp =
  'rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900'

export function LsxOutsourcePanel({
  lsxId,
  canRecord,
}: {
  lsxId: string
  canRecord: boolean
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [data, setData] = useState<Data | null>(null)
  const [components, setComponents] = useState<ComponentOpt[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    component_id: '',
    supplier_id: '',
    direction: 'send' as 'send' | 'receive',
    entry_date: new Date().toISOString().slice(0, 10),
    qty: '',
    defect_qty: '',
    note: '',
  })

  const load = useCallback(async () => {
    try {
      const d = await api<Data>(`/api/dept/production/lsx/${lsxId}/outsource`)
      setData(d)
    } catch (e) {
      toast.error('Không tải được sổ gia công', e instanceof ApiError ? e.message : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsxId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Danh mục chi tiết (per lệnh) + NCC — nạp 1 lần cho form.
  useEffect(() => {
    if (!canRecord) return
    let alive = true
    void api<{ lines: { id: string; name: string }[] }>(
      `/api/dept/production/lsx/${lsxId}/components`,
    ).then((d) => {
      if (alive) setComponents((d.lines ?? []).map((l) => ({ id: l.id, name: l.name })))
    })
    void api<{ rows: { id: string; name: string }[] }>(
      '/api/dept/supply/suppliers?page=1&page_size=500',
    ).then((d) => {
      if (alive) setSuppliers((d.rows ?? []).map((s) => ({ id: s.id, name: s.name })))
    })
    return () => {
      alive = false
    }
  }, [lsxId, canRecord])

  async function submit() {
    if (!form.component_id || !form.supplier_id || !form.qty) {
      toast.error('Chọn chi tiết + NCC + số lượng')
      return
    }
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/outsource`, {
        method: 'POST',
        body: JSON.stringify({
          component_id: form.component_id,
          supplier_id: form.supplier_id,
          direction: form.direction,
          entry_date: form.entry_date,
          qty: Number(form.qty),
          defect_qty: form.defect_qty ? Number(form.defect_qty) : 0,
          note: form.note.trim() || null,
        }),
      })
      toast.success(form.direction === 'send' ? 'Đã ghi GIAO gia công' : 'Đã ghi NHẬN về')
      setForm((f) => ({ ...f, qty: '', defect_qty: '', note: '' }))
      await load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Ghi thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function remove(en: Entry) {
    const ok = await confirm({
      title: 'Xoá bản ghi gia công?',
      description: `${en.component_name ?? ''} · ${en.direction === 'send' ? 'giao' : 'nhận'} ${fmtN(en.qty)} · ${en.supplier_name ?? ''}`,
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
      toast.error(e instanceof ApiError ? e.message : 'Xoá thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Đối chiếu per (chi tiết, NCC) */}
      {data && data.pairs.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-2 text-sm font-semibold">Đối chiếu giao / nhận</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="py-1.5 pr-2">Chi tiết</th>
                  <th className="py-1.5 pr-2">NCC</th>
                  <th className="py-1.5 pr-2 text-right">Giao</th>
                  <th className="py-1.5 pr-2 text-right">Nhận</th>
                  <th className="py-1.5 pr-2 text-right">Phế</th>
                  <th className="py-1.5 text-right">Thiếu/(Dư)</th>
                </tr>
              </thead>
              <tbody>
                {data.pairs.map((p) => (
                  <tr
                    key={`${p.component_id}|${p.supplier_id}`}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1.5 pr-2 font-medium">{p.component_name}</td>
                    <td className="py-1.5 pr-2">{p.supplier_name}</td>
                    <td className="py-1.5 pr-2 text-right">{fmtN(p.summary.sent)}</td>
                    <td className="py-1.5 pr-2 text-right">{fmtN(p.summary.received)}</td>
                    <td className="py-1.5 pr-2 text-right text-red-500">
                      {p.summary.defect > 0 ? fmtN(p.summary.defect) : '—'}
                    </td>
                    <td
                      className={`py-1.5 text-right font-semibold ${p.summary.missing > 0 ? 'text-amber-600' : 'text-green-600'}`}
                    >
                      {fmtN(p.summary.missing)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Form ghi */}
      {canRecord && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-2 text-sm font-semibold">Ghi giao / nhận</h3>
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={form.direction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  direction: e.target.value as 'send' | 'receive',
                }))
              }
              className={inp}
            >
              <option value="send">GIAO đi</option>
              <option value="receive">NHẬN về</option>
            </select>
            <select
              value={form.component_id}
              onChange={(e) => setForm((f) => ({ ...f, component_id: e.target.value }))}
              className={`${inp} min-w-44`}
            >
              <option value="">— Chi tiết —</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className={`${inp} min-w-44`}
            >
              <option value="">— Nhà gia công —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
              className={inp}
            />
            <input
              type="number"
              min="0"
              placeholder="SL"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              className={`${inp} w-24`}
            />
            {form.direction === 'receive' && (
              <input
                type="number"
                min="0"
                placeholder="Phế"
                value={form.defect_qty}
                onChange={(e) => setForm((f) => ({ ...f, defect_qty: e.target.value }))}
                className={`${inp} w-20`}
              />
            )}
            <input
              placeholder="Ghi chú"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className={`${inp} min-w-40 flex-1`}
            />
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy && <Spinner size={14} />} Ghi sổ
            </button>
          </div>
        </section>
      )}

      {/* Sổ */}
      {!data ? (
        <p className="py-6 text-center text-xs text-zinc-400">Đang tải…</p>
      ) : data.entries.length === 0 ? (
        <EmptyState
          icon="⇄"
          title="Chưa có gia công ngoài"
          description="Ghi giao đi / nhận về khi chi tiết được đưa ra ngoài gia công."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="px-3 py-1.5">Ngày</th>
                <th className="py-1.5 pr-2">Chiều</th>
                <th className="py-1.5 pr-2">Chi tiết</th>
                <th className="py-1.5 pr-2">NCC</th>
                <th className="py-1.5 pr-2 text-right">SL</th>
                <th className="py-1.5 pr-2 text-right">Phế</th>
                <th className="py-1.5 pr-2">Ghi chú</th>
                <th className="py-1.5 pr-2">Người ghi</th>
                <th className="w-8 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {data.entries.map((en) => (
                <tr key={en.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="px-3 py-1.5 text-xs">{fmtD(en.entry_date)}</td>
                  <td className="py-1.5 pr-2">
                    <Badge tone={en.direction === 'send' ? 'blue' : 'green'}>
                      {en.direction === 'send' ? 'Giao' : 'Nhận'}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-2 font-medium">{en.component_name}</td>
                  <td className="py-1.5 pr-2">{en.supplier_name}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold">{fmtN(en.qty)}</td>
                  <td className="py-1.5 pr-2 text-right text-red-500">
                    {en.defect_qty > 0 ? fmtN(en.defect_qty) : '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">{en.note ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-xs text-zinc-500">
                    {en.created_by_name ?? '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {canRecord && (
                      <button
                        onClick={() => void remove(en)}
                        disabled={busy}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30"
                        aria-label="Xoá"
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
