'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type SupplierOption = { id: string; name: string }
type LsxOption = { id: string; code: string; customer_name: string }
type MaterialOption = {
  id: string
  code: string
  name: string
  unit: string
  on_hand: number
}

/** Dòng đặt — người mua tự tìm vật tư (đọc file BOM), hệ thống tự hiện tồn/ĐVT. */
type Line = {
  material_id: string
  code: string
  name: string
  unit: string
  on_hand: number
  qty: number | ''
  price: number | ''
  note: string
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Tạo đơn đặt vật tư — trang riêng, luồng do NGƯỜI MUA chủ động (đặc tả 4.4):
 * Cung ứng đọc file BOM → tìm vật tư cần mua → hệ thống tự điền tồn kho + ĐVT,
 * người mua chỉ gõ SỐ LƯỢNG. Không kéo nhu cầu tự động từ bảng chi tiết/BOM.
 * Vẫn giữ BR-06: 1 đơn = 1 NCC + 1 LSX.
 */
export function PoCreateForm({
  suppliers,
  lsxs,
  materials,
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  materials: MaterialOption[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const [lsxId, setLsxId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [currency, setCurrency] = useState('VND')
  const [vat, setVat] = useState('')
  const [inclVat, setInclVat] = useState('true')
  const [terms, setTerms] = useState('')
  const [note, setNote] = useState('')

  const [lines, setLines] = useState<Line[]>([])
  const [search, setSearch] = useState('')

  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])

  // Tìm vật tư (theo mã / tên) — bỏ vật tư đã thêm; giới hạn 8 gợi ý.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return materials
      .filter(
        (m) => !usedIds.has(m.id) && `${m.code} ${m.name}`.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [search, materials, usedIds])

  function addMaterial(m: MaterialOption) {
    if (usedIds.has(m.id)) return
    setLines((ls) => [
      ...ls,
      {
        material_id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        on_hand: m.on_hand,
        qty: '',
        price: '',
        note: '',
      },
    ])
    setSearch('')
  }

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i))
  }

  const total = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  )
  const invalid =
    !lsxId ||
    !supplierId ||
    lines.length === 0 ||
    lines.some((l) => l.qty === '' || Number(l.qty) <= 0)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    try {
      const { po } = await api<{ po: { code: string } }>('/api/dept/supply/pos', {
        method: 'POST',
        body: {
          production_order_id: lsxId,
          supplier_id: supplierId,
          currency,
          vat_rate: vat.trim() ? Number(vat) : null,
          price_includes_vat: inclVat === 'true',
          expected_at: expectedAt || null,
          terms: terms.trim() || null,
          note: note.trim() || null,
          lines: lines.map((l) => ({
            material_id: l.material_id,
            qty_ordered: Number(l.qty),
            unit_price: l.price === '' ? null : Number(l.price),
            note: l.note.trim() || null,
          })),
        },
      })
      toast.success(`Đã tạo ${po.code}`, 'Đơn đang chờ Giám đốc duyệt')
      router.push('/planning/pos')
      router.refresh()
    } catch (err) {
      toast.error('Tạo đơn thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Đơn đặt vật tư', href: '/planning/pos' },
          { label: 'Tạo đơn đặt' },
        ]}
        title="Tạo đơn đặt vật tư"
        description="Chọn LSX + NCC, tìm vật tư cần mua (đối chiếu file BOM) — hệ thống tự hiện tồn kho, bạn chỉ điền số lượng. Mỗi đơn = 1 NCC + 1 LSX (BR-06)."
        actions={
          <Link
            href="/planning/pos"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Về danh sách
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          LSX <span className="text-red-500">*</span>
          <select
            value={lsxId}
            onChange={(e) => setLsxId(e.target.value)}
            required
            className={inputCls}
          >
            <option value="">— chọn LSX đã duyệt —</option>
            {lsxs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.customer_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nhà cung cấp <span className="text-red-500">*</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
            className={inputCls}
          >
            <option value="">— chọn NCC —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hẹn giao hàng
          <input
            type="date"
            value={expectedAt}
            onChange={(e) => setExpectedAt(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {/* Tìm vật tư cần đặt */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-900">
          <div className="mb-1 text-xs font-semibold text-zinc-500 uppercase">
            Vật tư cần đặt
          </div>
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Tìm vật tư theo mã hoặc tên (đối chiếu file BOM)…"
              className={inputCls}
            />
            {matches.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => addMaterial(m)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sky-50 dark:hover:bg-sky-950/40"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs text-zinc-400">{m.code}</span>{' '}
                        {m.name}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        tồn {num(m.on_hand)} {m.unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
                <th className="py-2 pr-2 pl-3">Vật tư</th>
                <th className="w-24 py-2 pr-2 text-right">Tồn kho</th>
                <th className="w-16 py-2 pr-2">ĐVT</th>
                <th className="w-28 py-2 pr-2 text-right">Số lượng đặt</th>
                <th className="w-32 py-2 pr-2 text-right">Đơn giá</th>
                <th className="py-2 pr-2">Ghi chú</th>
                <th className="w-8 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-400">
                    Dùng ô tìm phía trên để thêm vật tư cần đặt.
                  </td>
                </tr>
              )}
              {lines.map((l, i) => {
                const overStock = l.qty !== '' && Number(l.qty) <= l.on_hand
                return (
                  <tr
                    key={l.material_id}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1.5 pr-2 pl-3">
                      <span className="font-mono text-xs text-zinc-400">{l.code}</span>{' '}
                      {l.name}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-zinc-600 dark:text-zinc-300">
                      {num(l.on_hand)}
                    </td>
                    <td className="py-1.5 pr-2 text-zinc-500">{l.unit}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.qty}
                        onChange={(e) =>
                          setLine(i, {
                            qty: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className={`${inputCls} text-right`}
                        aria-label={`Số lượng đặt ${l.name}`}
                      />
                      {overStock && (
                        <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-500">
                          kho còn {num(l.on_hand)} {l.unit}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={l.price}
                        onChange={(e) =>
                          setLine(i, {
                            price: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className={`${inputCls} text-right`}
                        aria-label={`Đơn giá ${l.name}`}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={l.note}
                        maxLength={500}
                        placeholder="quy cách / bộ phận…"
                        onChange={(e) => setLine(i, { note: e.target.value })}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        aria-label="Xoá dòng"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Tiền tệ
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={inputCls}
          >
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          VAT (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="10"
            value={vat}
            onChange={(e) => setVat(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Đơn giá
          <select
            value={inclVat}
            onChange={(e) => setInclVat(e.target.value)}
            className={inputCls}
          >
            <option value="true">Đã gồm VAT</option>
            <option value="false">Chưa gồm VAT</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Điều kiện / bảo hành
          <input
            maxLength={1000}
            placeholder="Bảo hành 24 tháng…"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Ghi chú
        <textarea
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputCls}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-500">
          Tổng tạm tính:{' '}
          <b className="font-mono text-zinc-800 dark:text-zinc-200">{num(total)}</b>{' '}
          {currency}
        </span>
        <button
          disabled={busy || invalid}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : 'Tạo đơn → gửi GĐ duyệt'}
        </button>
      </div>
    </form>
  )
}
