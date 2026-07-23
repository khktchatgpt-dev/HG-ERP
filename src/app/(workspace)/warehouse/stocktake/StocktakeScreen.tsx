'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Stock = {
  material_id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  shelf_location: string | null
  on_hand: number
}

/** Số đếm + ghi chú người kiểm nhập cho 1 vật tư (state theo material_id). */
type Count = { counted: number | ''; note: string }

const inputCls =
  'h-[30px] w-full rounded-md border border-zinc-300 px-2 text-[13px] focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Màn KIỂM KÊ (0077): liệt kê vật tư + tồn sổ → người kiểm nhập số ĐẾM THỰC TẾ
 * từng dòng (chỉ dòng đã nhập mới vào biên bản) → xem chênh lệch → ghi phiếu KK.
 * Dòng lệch sổ được server sinh movement điều chỉnh; tồn sau kiểm = số đếm.
 */
export function StocktakeScreen({ stock }: { stock: Stock[] }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const [q, setQ] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [onlyCounted, setOnlyCounted] = useState<'all' | 'counted' | 'diff'>('all')
  const [reason, setReason] = useState('Kiểm kê định kỳ')
  const [note, setNote] = useState('')
  const [counts, setCounts] = useState<Record<string, Count>>({})

  const groups = useMemo(() => {
    const set = new Set<string>()
    for (const s of stock) if (s.group_name) set.add(s.group_name)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [stock])

  const diffOf = (s: Stock): number | null => {
    const c = counts[s.material_id]
    if (!c || c.counted === '') return null
    return c.counted - s.on_hand
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return stock.filter((s) => {
      if (groupFilter !== 'all' && (s.group_name ?? '') !== groupFilter) return false
      if (onlyCounted === 'counted' && (counts[s.material_id]?.counted ?? '') === '')
        return false
      if (onlyCounted === 'diff') {
        const d = diffOf(s)
        if (d === null || d === 0) return false
      }
      if (ql && !`${s.code} ${s.name} ${s.group_name ?? ''}`.toLowerCase().includes(ql))
        return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock, q, groupFilter, onlyCounted, counts])

  const summary = useMemo(() => {
    let counted = 0
    let over = 0
    let short = 0
    for (const s of stock) {
      const d = diffOf(s)
      if (d === null) continue
      counted++
      if (d > 0) over++
      if (d < 0) short++
    }
    return { counted, over, short }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock, counts])

  function setCount(id: string, patch: Partial<Count>) {
    setCounts((m) => {
      const cur = m[id] ?? { counted: '' as const, note: '' }
      return { ...m, [id]: { ...cur, ...patch } }
    })
  }

  /** Điền số đếm = tồn sổ cho mọi dòng ĐANG LỌC chưa nhập — rồi chỉ sửa dòng lệch. */
  function fillFromSystem() {
    setCounts((m) => {
      const next = { ...m }
      for (const s of filtered) {
        if ((next[s.material_id]?.counted ?? '') === '') {
          const cur = next[s.material_id] ?? { counted: '' as const, note: '' }
          next[s.material_id] = { ...cur, counted: s.on_hand }
        }
      }
      return next
    })
  }

  async function submit() {
    const lines = stock
      .filter((s) => (counts[s.material_id]?.counted ?? '') !== '')
      .map((s) => ({
        material_id: s.material_id,
        counted_qty: Number(counts[s.material_id].counted),
        note: counts[s.material_id].note.trim() || null,
      }))
    if (lines.length === 0 || busy) return
    setBusy(true)
    try {
      const r = await api<{ code: string; diff_count: number }>(
        '/api/dept/warehouse/docs/stocktake',
        {
          method: 'POST',
          body: { reason: reason.trim() || null, note: note.trim() || null, lines },
        },
      )
      toast.success(
        `Đã ghi phiếu ${r.code}`,
        r.diff_count > 0
          ? `${r.diff_count} dòng lệch sổ đã được điều chỉnh tồn`
          : 'Tất cả khớp sổ — không cần điều chỉnh',
      )
      setCounts({})
      router.push('/warehouse/docs')
      router.refresh()
    } catch (e) {
      toast.error('Ghi phiếu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      setBusy(false)
    }
  }

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Kiểm kê' }]}
        title="Kiểm kê kho"
        description="Nhập số ĐẾM THỰC TẾ cho từng vật tư (chỉ dòng đã nhập vào biên bản). Ghi phiếu KK: dòng lệch sổ tự sinh điều chỉnh tồn — tồn sau kiểm = số đếm."
      />

      <StatsBar
        stats={[
          { label: 'Vật tư', value: stock.length, tone: 'default' },
          { label: 'Đã đếm', value: summary.counted, tone: 'blue' },
          {
            label: 'Thừa sổ',
            value: summary.over,
            tone: summary.over ? 'amber' : 'gray',
          },
          {
            label: 'Thiếu sổ',
            value: summary.short,
            tone: summary.short ? 'red' : 'gray',
          },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm theo mã, tên, nhóm…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={groupFilter}
                onChange={setGroupFilter}
                options={[
                  { value: 'all', label: 'Mọi nhóm' },
                  ...groups.map((g) => ({ value: g, label: g })),
                ]}
              />
              <ToolbarSelect
                value={onlyCounted}
                onChange={(v) => setOnlyCounted(v)}
                options={[
                  { value: 'all' as const, label: 'Tất cả dòng' },
                  { value: 'counted' as const, label: 'Đã nhập đếm' },
                  { value: 'diff' as const, label: 'Lệch sổ' },
                ]}
              />
            </>
          }
          right={
            <button type="button" onClick={fillFromSystem} className={btnSecondary}>
              Điền theo sổ ({filtered.length} dòng lọc)
            </button>
          }
        />

        <div className="overflow-x-auto rounded-b-xl border border-t-0 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {filtered.length === 0 ? (
            <EmptyState
              icon="▧"
              title={stock.length === 0 ? 'Chưa có vật tư' : 'Không khớp bộ lọc'}
              description={
                stock.length === 0
                  ? 'Thêm vật tư ở Danh mục vật tư trước.'
                  : 'Thử điều chỉnh bộ lọc.'
              }
            />
          ) : (
            <table className="w-full min-w-[840px] text-[13px] tabular-nums">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr className="text-left text-[10px] text-zinc-500 uppercase">
                  <th className="min-w-[220px] py-2 pl-3">Vật tư</th>
                  <th className="w-[90px] py-2 pr-2">Kệ</th>
                  <th className="w-[110px] py-2 pr-2 text-right">Tồn sổ</th>
                  <th className="w-[130px] py-2 pr-2 text-right">Đếm thực tế</th>
                  <th className="w-[120px] py-2 pr-2 text-right">Chênh lệch</th>
                  <th className="w-[180px] py-2 pr-3">Ghi chú dòng</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const c = counts[s.material_id]
                  const d = diffOf(s)
                  return (
                    <tr
                      key={s.material_id}
                      className="border-t border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1.5 pl-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-mono text-xs text-zinc-400">
                            {s.code}
                          </span>
                          <span className="truncate font-medium">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 font-mono text-xs text-zinc-500">
                        {s.shelf_location ?? '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-medium">
                        {num(s.on_hand)}{' '}
                        <span className="text-xs font-normal text-zinc-400">
                          {s.unit}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c?.counted ?? ''}
                          onChange={(e) =>
                            setCount(s.material_id, {
                              counted:
                                e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          className={`${inputCls} text-right font-medium`}
                          aria-label={`Đếm thực tế ${s.name}`}
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {d === null ? (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        ) : d === 0 ? (
                          <span className="font-medium text-green-600 dark:text-green-400">
                            khớp ✓
                          </span>
                        ) : (
                          <span
                            className={
                              'font-semibold ' +
                              (d > 0
                                ? 'text-amber-600 dark:text-amber-500'
                                : 'text-red-600 dark:text-red-400')
                            }
                          >
                            {d > 0 ? `+${num(d)}` : num(d)}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          value={c?.note ?? ''}
                          maxLength={500}
                          placeholder="lý do lệch…"
                          onChange={(e) =>
                            setCount(s.material_id, { note: e.target.value })
                          }
                          className={inputCls}
                          aria-label={`Ghi chú ${s.name}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Chốt phiếu */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
          Lý do kiểm kê
          <input
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
          Ghi chú phiếu
          <input
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
          />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {summary.counted} dòng đếm · {summary.over + summary.short} lệch
          </span>
          <button
            type="button"
            disabled={busy || summary.counted === 0}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {busy ? 'Đang ghi…' : 'Ghi phiếu kiểm kê'}
          </button>
        </div>
      </div>
    </div>
  )
}
