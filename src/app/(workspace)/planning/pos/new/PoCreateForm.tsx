'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type SupplierOption = {
  id: string
  name: string
  rating: string | null
  lead_time_days: number | null
  payment_terms: string | null
  phone: string | null
  open_po_count: number
}
type LsxOption = { id: string; code: string; order_code: string; customer_name: string }
type MaterialOption = {
  id: string
  code: string
  name: string
  unit: string
  on_hand: number
}

/**
 * Dòng đặt — người mua gõ SL CẦN (đọc từ file BOM), hệ thống so với tồn kho
 * để tự tính SL ĐẶT = cần − tồn (sửa tay được). `need` chỉ dùng phía client
 * làm máy tính hỗ trợ; API vẫn chỉ nhận qty_ordered.
 */
type Line = {
  material_id: string
  code: string
  name: string
  unit: string
  on_hand: number
  need: number | ''
  qty: number | ''
  price: number | ''
  note: string
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
const num = (n: number) => n.toLocaleString('vi-VN')
const GRADE_BG: Record<string, string> = {
  A: 'bg-green-600',
  B: 'bg-blue-600',
  C: 'bg-amber-500',
  D: 'bg-red-600',
}

/**
 * Tạo đơn đặt vật tư — trang riêng, luồng do NGƯỜI MUA chủ động (đặc tả 4.4):
 * Cung ứng đọc file BOM → tìm vật tư cần mua → hệ thống tự điền tồn kho + ĐVT,
 * người mua chỉ gõ SỐ LƯỢNG. Không kéo nhu cầu tự động từ bảng chi tiết/BOM.
 * Vẫn giữ BR-06: 1 đơn = 1 NCC + 1 LSX.
 *
 * Bố cục: cột trái 3 bước (bối cảnh → vật tư → điều khoản); cột phải dính
 * (thẻ NCC + tổng tách VAT + checklist điều kiện gửi).
 */
export function PoCreateForm({
  suppliers,
  lsxs,
  materials,
  defaultSupplierId,
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  materials: MaterialOption[]
  defaultSupplierId?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const [lsxId, setLsxId] = useState('')
  const [supplierId, setSupplierId] = useState(
    defaultSupplierId && suppliers.some((s) => s.id === defaultSupplierId)
      ? defaultSupplierId
      : '',
  )
  const [expectedAt, setExpectedAt] = useState('')
  const [currency, setCurrency] = useState('VND')
  const [vat, setVat] = useState('')
  const [inclVat, setInclVat] = useState('true')
  const [terms, setTerms] = useState('')
  const [note, setNote] = useState('')

  const [lines, setLines] = useState<Line[]>([])
  const [search, setSearch] = useState('')

  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])
  const lsx = lsxs.find((l) => l.id === lsxId)
  const supplier = suppliers.find((s) => s.id === supplierId)

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
        need: '',
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

  // Gõ SL cần → tự tính SL đặt = cần − tồn (không âm). Sửa tay SL đặt vẫn được.
  function setNeed(i: number, raw: string) {
    const need = raw === '' ? '' : Number(raw)
    setLines((ls) =>
      ls.map((l, idx) =>
        idx === i
          ? { ...l, need, qty: need === '' ? '' : Math.max(0, need - l.on_hand) }
          : l,
      ),
    )
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i))
  }

  // Tổng: tạm tính từ dòng; VAT tách riêng theo "đơn giá đã/chưa gồm VAT".
  const subtotal = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  )
  const vatRate = vat.trim() === '' ? 0 : Number(vat) || 0
  const priceIncludesVat = inclVat === 'true'
  const vatAmount = priceIncludesVat
    ? Math.round((subtotal * vatRate) / (100 + vatRate)) // phần VAT nằm trong giá
    : Math.round((subtotal * vatRate) / 100)
  const grandTotal = priceIncludesVat ? subtotal : subtotal + vatAmount

  const linesOk =
    lines.length > 0 && lines.every((l) => l.qty !== '' && Number(l.qty) > 0)
  const invalid = !lsxId || !supplierId || !linesOk

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
          price_includes_vat: priceIncludesVat,
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
        description="Chọn LSX + NCC, tìm vật tư cần mua (đối chiếu file BOM) — hệ thống tự hiện tồn kho, bạn chỉ điền số lượng."
        actions={
          <Link
            href="/planning/pos"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Về danh sách
          </Link>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        {/* ── Cột trái: 3 bước ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <Step n={1} title="Bối cảnh đơn — LSX & NCC">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
              <label className="flex flex-col gap-1 text-sm">
                <span>
                  LSX <span className="text-red-500">*</span>
                </span>
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
                {lsx && (
                  <span className="text-xs text-zinc-400">
                    Đơn hàng <b className="font-mono text-zinc-500">{lsx.order_code}</b> ·
                    khách <b className="text-zinc-500">{lsx.customer_name}</b>
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>
                  Nhà cung cấp <span className="text-red-500">*</span>
                </span>
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
                      {s.rating ? ` (hạng ${s.rating})` : ''}
                    </option>
                  ))}
                </select>
                {supplier && (
                  <span className="text-xs text-zinc-400">
                    {[
                      supplier.rating ? `Hạng ${supplier.rating}` : null,
                      supplier.lead_time_days != null
                        ? `lead time ${supplier.lead_time_days} ngày`
                        : null,
                      supplier.payment_terms,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Chưa có hồ sơ điều khoản'}
                  </span>
                )}
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
          </Step>

          <Step n={2} title="Vật tư cần đặt" sub="đối chiếu file BOM">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Tìm vật tư theo mã hoặc tên…"
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
                          <span className="font-mono text-xs text-zinc-400">
                            {m.code}
                          </span>{' '}
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

            <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[780px] text-sm tabular-nums">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                  <tr className="text-left text-[11px] text-zinc-500 uppercase">
                    <th className="min-w-[200px] py-2 pr-2 pl-3">Vật tư</th>
                    <th className="w-24 py-2 pr-2 text-right">SL cần *</th>
                    <th className="w-20 py-2 pr-2 text-right">Tồn kho</th>
                    <th className="w-24 py-2 pr-2 text-right">SL đặt</th>
                    <th className="w-28 py-2 pr-2 text-right">Đơn giá</th>
                    <th className="w-28 py-2 pr-3 text-right">Thành tiền</th>
                    <th className="min-w-[130px] py-2 pr-2">Ghi chú</th>
                    <th className="w-8 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-400">
                        Dùng ô tìm phía trên để thêm vật tư cần đặt.
                      </td>
                    </tr>
                  )}
                  {lines.map((l, i) => {
                    const stockCovers = l.need !== '' && Number(l.need) <= l.on_hand // tồn đủ, khỏi đặt
                    const shortage =
                      l.need !== '' ? Math.max(0, Number(l.need) - l.on_hand) : null
                    const lineTotal = (Number(l.qty) || 0) * (Number(l.price) || 0)
                    // Mọi ô căn TOP; ô chữ tĩnh đệm pt-[15px] cho ngang mép chữ
                    // trong input (8px pad ô + 1px viền + 6px pad input).
                    return (
                      <tr
                        key={l.material_id}
                        className="border-t border-zinc-100 align-top dark:border-zinc-900"
                      >
                        <td className="py-2 pt-[15px] pr-2 pl-3">
                          <span className="font-mono text-xs text-zinc-400">
                            {l.code}
                          </span>{' '}
                          {l.name}
                          {stockCovers && (
                            <div className="mt-0.5 text-[10px] text-green-600 dark:text-green-400">
                              ✓ tồn đủ ({num(l.on_hand)} {l.unit}) — xoá dòng hoặc vẫn đặt
                              thêm
                            </div>
                          )}
                          {shortage !== null && shortage > 0 && (
                            <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-500">
                              ⚠ thiếu {num(shortage)} {l.unit} so với tồn
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.need}
                            onChange={(e) => setNeed(i, e.target.value)}
                            className={`${inputCls} text-right`}
                            aria-label={`Số lượng cần ${l.name}`}
                            placeholder="theo BOM"
                          />
                        </td>
                        <td className="py-2 pt-[15px] pr-2 text-right whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                          {num(l.on_hand)}{' '}
                          <span className="text-xs text-zinc-400">{l.unit}</span>
                        </td>
                        <td className="py-2 pr-2">
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
                            className={`${inputCls} text-right font-medium`}
                            aria-label={`Số lượng đặt ${l.name}`}
                            title="Tự tính = SL cần − tồn kho; sửa tay được"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={l.price}
                            onChange={(e) =>
                              setLine(i, {
                                price:
                                  e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                            className={`${inputCls} text-right`}
                            aria-label={`Đơn giá ${l.name}`}
                          />
                        </td>
                        <td className="py-2 pt-[15px] pr-3 text-right font-medium whitespace-nowrap">
                          {lineTotal > 0 ? (
                            num(lineTotal)
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            value={l.note}
                            maxLength={500}
                            placeholder="quy cách / bộ phận…"
                            onChange={(e) => setLine(i, { note: e.target.value })}
                            className={inputCls}
                          />
                        </td>
                        <td className="py-2 pt-[11px] text-right">
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
          </Step>

          <Step n={3} title="Điều khoản & ghi chú">
            <div className="grid gap-3 sm:grid-cols-[110px_110px_150px_1fr]">
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
            <label className="mt-3 flex flex-col gap-1 text-sm">
              Ghi chú
              <textarea
                rows={2}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
              />
            </label>
          </Step>
        </div>

        {/* ── Cột phải dính: NCC + tổng + checklist ── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
          <SideCard title="NCC đã chọn">
            {supplier ? (
              <>
                <div className="mb-1.5 flex items-center gap-2">
                  <b className="text-[13.5px]">{supplier.name}</b>
                  {supplier.rating && (
                    <span
                      className={`grid h-5 w-5 place-items-center rounded text-[11px] font-bold text-white ${GRADE_BG[supplier.rating] ?? 'bg-zinc-500'}`}
                    >
                      {supplier.rating}
                    </span>
                  )}
                </div>
                <SideRow
                  k="Lead time"
                  v={
                    supplier.lead_time_days != null
                      ? `${supplier.lead_time_days} ngày`
                      : '—'
                  }
                />
                <SideRow k="Thanh toán" v={supplier.payment_terms ?? '—'} />
                <SideRow k="Liên hệ" v={supplier.phone ?? '—'} mono />
                <SideRow k="PO đang mở" v={String(supplier.open_po_count)} />
              </>
            ) : (
              <p className="text-sm text-zinc-400">Chưa chọn NCC.</p>
            )}
          </SideCard>

          <SideCard title="Tổng đơn">
            <SideRow
              k={`${lines.length} dòng vật tư`}
              v={`${num(lines.reduce((s, l) => s + (Number(l.qty) || 0), 0))} đv`}
            />
            <SideRow k="Tạm tính" v={num(subtotal)} />
            <SideRow
              k={
                vatRate
                  ? priceIncludesVat
                    ? `VAT ${vatRate}% (đã gồm)`
                    : `VAT ${vatRate}%`
                  : 'VAT'
              }
              v={vatRate ? num(vatAmount) : '—'}
            />
            <div className="mt-1.5 flex items-baseline justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <span className="text-sm font-semibold">Tổng sau VAT</span>
              <span className="text-base font-bold tabular-nums">
                {num(grandTotal)} <span className="text-xs font-medium">{currency}</span>
              </span>
            </div>
          </SideCard>

          <SideCard>
            <Check ok={!!lsxId} label="Đã chọn LSX" />
            <Check ok={!!supplierId} label="Đã chọn NCC" />
            <Check
              ok={linesOk}
              label={
                lines.length === 0
                  ? 'Thêm ít nhất 1 vật tư'
                  : linesOk
                    ? `${lines.length} dòng vật tư có SL đặt`
                    : 'Mọi dòng cần SL đặt > 0 — dòng tồn đủ hãy xoá'
              }
            />
            <button
              disabled={busy || invalid}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : 'Tạo đơn → gửi GĐ duyệt'}
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-400">
              BR-06: mỗi đơn = 1 NCC + 1 LSX
            </p>
          </SideCard>
        </aside>
      </div>
    </form>
  )
}

function Step({
  n,
  title,
  sub,
  children,
}: {
  n: number
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
          {n}
        </span>
        <b className="text-[13px]">{title}</b>
        {sub && <span className="text-xs text-zinc-400">· {sub}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function SideCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {title && (
        <div className="border-b border-zinc-100 px-4 py-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase dark:border-zinc-800">
          {title}
        </div>
      )}
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function SideRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-1 text-[12.5px]">
      <span className="text-zinc-400">{k}</span>
      <span
        className={`min-w-0 truncate text-right font-medium tabular-nums ${mono ? 'font-mono' : ''}`}
      >
        {v}
      </span>
    </div>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <span
        className={
          ok
            ? 'font-bold text-green-600 dark:text-green-400'
            : 'text-zinc-300 dark:text-zinc-600'
        }
      >
        {ok ? '✓' : '○'}
      </span>
      <span className={ok ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-400'}>
        {label}
      </span>
    </div>
  )
}
