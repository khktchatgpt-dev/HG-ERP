'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type {
  CurrencyTotal,
  PayablePoRow,
  PayableSupplierRow,
} from '@/modules/dept/accounting/payables.service'
import type { SupplierPayment } from '@/modules/dept/accounting/payables.repo'

/**
 * SỔ CÔNG NỢ NCC (GĐ C.1 — plan-ke-toan-cong-no-ncc): còn nợ = phát sinh
 * (phiếu nhập có giá, phiếu đảo cấn trừ) − đã trả. Tiền tách theo TIỀN TỆ.
 * VAT/hoá đơn đỏ chưa đối chiếu ở màn này (GĐ C.1b).
 */

const fmtM = (n: number) => n.toLocaleString('vi-VN')
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const today = () => new Date().toISOString().slice(0, 10)

function MoneyLines({ totals }: { totals: CurrencyTotal[] }) {
  if (!totals.length) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col gap-0.5">
      {totals.map((t) => (
        <span key={t.currency} className="t-data whitespace-nowrap tabular-nums">
          <b className={t.balance > 0 ? 'text-[var(--stop)]' : 'text-[var(--done)]'}>
            {fmtM(t.balance)}
          </b>{' '}
          <span className="text-muted-foreground text-xs">
            {t.currency} (PS {fmtM(t.incurred)} · trả {fmtM(t.paid)})
          </span>
        </span>
      ))}
    </div>
  )
}

export function PayablesManager({
  rows,
  grand,
  canManage,
}: {
  rows: PayableSupplierRow[]
  grand: CurrencyTotal[]
  canManage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<PayableSupplierRow | null>(null)
  const [detail, setDetail] = useState<{
    pos: PayablePoRow[]
    payments: SupplierPayment[]
  } | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [form, setForm] = useState({
    amount: '' as number | '',
    currency: 'VND',
    paid_on: today(),
    po_id: '',
    method: 'ck',
    ref_no: '',
    note: '',
  })

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return ql ? rows.filter((r) => r.supplier_name.toLowerCase().includes(ql)) : rows
  }, [rows, q])

  const missingTotal = rows.reduce((a, r) => a + r.missing_price_count, 0)

  async function openDetail(row: PayableSupplierRow) {
    setSelected(row)
    setDetail(null)
    try {
      const d = await api<{ pos: PayablePoRow[]; payments: SupplierPayment[] }>(
        `/api/dept/accounting/payables/${row.supplier_id}`,
      )
      setDetail(d)
    } catch (e) {
      toast.error('Không tải được chi tiết', e instanceof ApiError ? e.message : 'Lỗi')
    }
  }

  function openPayForm() {
    if (!selected) return
    setForm({
      amount: '',
      // Mặc định tiền tệ theo dòng nợ lớn nhất của NCC.
      currency: selected.totals[0]?.currency ?? 'VND',
      paid_on: today(),
      po_id: '',
      method: 'ck',
      ref_no: '',
      note: '',
    })
    setPayOpen(true)
  }

  async function submitPayment() {
    if (!selected || form.amount === '' || Number(form.amount) <= 0) {
      toast.error('Nhập số tiền > 0')
      return
    }
    setBusy(true)
    try {
      await api('/api/dept/accounting/payments', {
        method: 'POST',
        body: {
          supplier_id: selected.supplier_id,
          po_id: form.po_id || null,
          amount: Number(form.amount),
          currency: form.currency,
          paid_on: form.paid_on,
          method: form.method || null,
          ref_no: form.ref_no.trim() || null,
          note: form.note.trim() || null,
        },
      })
      toast.success('Đã ghi thanh toán', `${fmtM(Number(form.amount))} ${form.currency}`)
      setPayOpen(false)
      await openDetail(selected)
      router.refresh()
    } catch (e) {
      toast.error('Ghi thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function removePayment(id: string) {
    if (!selected) return
    setBusy(true)
    try {
      await api(`/api/dept/accounting/payments/${id}`, { method: 'DELETE' })
      toast.success('Đã xoá bút toán')
      await openDetail(selected)
      router.refresh()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<PayableSupplierRow>[] = [
    {
      key: 'name',
      header: 'Nhà cung cấp',
      cell: (r) => (
        <button
          onClick={() => void openDetail(r)}
          className="font-medium hover:text-[var(--primary)] hover:underline"
        >
          {r.supplier_name}
        </button>
      ),
      sortValue: (r) => r.supplier_name,
    },
    {
      key: 'balance',
      header: 'Còn nợ (PS · đã trả)',
      cell: (r) => <MoneyLines totals={r.totals} />,
      sortValue: (r) => Math.max(0, ...r.totals.map((t) => t.balance)),
      align: 'left',
      width: '320px',
    },
    {
      key: 'terms',
      header: 'Điều khoản TT',
      cell: (r) => (
        <span className="text-muted-foreground line-clamp-2 text-xs">
          {r.payment_terms ?? '—'}
        </span>
      ),
      width: '220px',
    },
    {
      key: 'last',
      header: 'Nhận gần nhất',
      cell: (r) => <span className="t-data text-xs">{fmtD(r.last_receipt_at)}</span>,
      sortValue: (r) => r.last_receipt_at ?? '',
      width: '110px',
    },
    {
      key: 'missing',
      header: '',
      cell: (r) =>
        r.missing_price_count > 0 ? (
          <span title="Phiếu nhận gắn PO nhưng CHƯA CÓ GIÁ — phát sinh đang đếm hụt, Kho/Cung ứng bổ sung giá phiếu.">
            <Badge tone="amber">{r.missing_price_count} phiếu chưa giá</Badge>
          </span>
        ) : null,
      width: '140px',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Tài chính - Kế toán', href: '/finance' },
          { label: 'Công nợ NCC' },
        ]}
        title="Công nợ nhà cung cấp"
        description="Phát sinh theo PHIẾU NHẬP có giá (phiếu đảo tự cấn trừ) − đã trả. Tiền tách theo tiền tệ; VAT/hoá đơn đỏ đối chiếu ở giai đoạn sau."
      />

      <StatsBar
        stats={[
          ...grand.slice(0, 3).map((g) => ({
            label: `Còn nợ ${g.currency}`,
            value: fmtM(g.balance),
            tone: (g.balance > 0 ? 'red' : 'green') as 'red' | 'green',
            hint: `PS ${fmtM(g.incurred)} · đã trả ${fmtM(g.paid)}`,
          })),
          { label: 'NCC theo dõi', value: rows.length, tone: 'blue' as const },
          {
            label: 'Phiếu chưa có giá',
            value: missingTotal,
            tone: (missingTotal > 0 ? 'amber' : 'gray') as 'amber' | 'gray',
            hint: missingTotal > 0 ? 'phát sinh đang đếm hụt' : undefined,
          },
        ]}
      />

      <Toolbar
        left={
          <ToolbarInput
            value={q}
            onChange={setQ}
            placeholder="Tìm NCC…"
            icon="⌕"
            className="w-64"
          />
        }
        right={<span className="text-muted-foreground text-xs">{shown.length} NCC</span>}
      />

      <DataTable
        rows={shown}
        columns={columns}
        keyFn={(r) => r.supplier_id}
        emptyState={
          <EmptyState
            icon="₫"
            title="Chưa có công nợ nào"
            description="Phiếu nhập kho có giá gắn PO sẽ tự thành phát sinh ở đây."
          />
        }
      />

      {/* Chi tiết NCC đang chọn */}
      {selected && (
        <section className="bg-card rounded-lg border p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{selected.supplier_name}</h2>
            <MoneyLines totals={selected.totals} />
            <span className="ml-auto flex gap-2">
              {canManage && (
                <button
                  onClick={openPayForm}
                  className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  + Ghi thanh toán
                </button>
              )}
              <button
                onClick={() => {
                  setSelected(null)
                  setDetail(null)
                }}
                className="rounded-md border px-3 py-1.5 text-xs"
              >
                Đóng
              </button>
            </span>
          </div>

          {!detail ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner size={14} /> Đang tải chi tiết…
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                  Phát sinh theo đơn hàng
                </h3>
                {detail.pos.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Chưa có phiếu nhập có giá.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {detail.pos.map((p) => (
                      <li key={p.po_id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="t-data text-xs font-semibold">
                            {p.po_code}
                          </span>
                          <span className="t-data ml-auto tabular-nums">
                            {fmtM(p.incurred)} {p.currency}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-1 flex flex-wrap gap-1.5 text-xs">
                          {p.receipts.map((d, i) => (
                            <span key={i} className="bg-muted rounded px-1.5 py-0.5">
                              {d.doc_code ?? '(không phiếu)'} · {fmtD(d.doc_date)} ·{' '}
                              {fmtM(d.value)}
                              {d.supplier_doc_no ? ` · HĐ ${d.supplier_doc_no}` : ''}
                            </span>
                          ))}
                          {p.paid_linked > 0 && (
                            <span className="text-[var(--done)]">
                              đã trả gắn đơn: {fmtM(p.paid_linked)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                  Lịch sử thanh toán
                </h3>
                {detail.payments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Chưa ghi thanh toán nào.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {detail.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-1.5"
                      >
                        <span className="t-data text-xs">{fmtD(p.paid_on)}</span>
                        <span className="t-data font-semibold tabular-nums">
                          {fmtM(p.amount)} {p.currency}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {p.po_code ? `${p.po_code} · ` : ''}
                          {p.method === 'ck'
                            ? 'CK'
                            : p.method === 'tm'
                              ? 'TM'
                              : (p.method ?? '')}
                          {p.ref_no ? ` · ${p.ref_no}` : ''}
                          {p.created_by_name ? ` · ${p.created_by_name}` : ''}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => void removePayment(p.id)}
                            disabled={busy}
                            className="ml-auto text-xs text-[var(--stop)] hover:underline disabled:opacity-50"
                            title="Xoá bút toán ghi nhầm (người ghi hoặc Ban quản lý)"
                          >
                            Xoá
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Form ghi thanh toán */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Ghi thanh toán — ${selected?.supplier_name ?? ''}`}
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Số tiền</span>
              <input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    amount: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="bg-background rounded-md border px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Tiền tệ</span>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="bg-background rounded-md border px-2 py-1.5"
              >
                {[
                  ...new Set([
                    'VND',
                    'USD',
                    ...(selected?.totals.map((t) => t.currency) ?? []),
                  ]),
                ].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Ngày trả</span>
              <input
                type="date"
                value={form.paid_on}
                onChange={(e) => setForm({ ...form, paid_on: e.target.value })}
                className="bg-background rounded-md border px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Hình thức</span>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="bg-background rounded-md border px-2 py-1.5"
              >
                <option value="ck">Chuyển khoản</option>
                <option value="tm">Tiền mặt</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              Gắn đơn đặt hàng (tuỳ chọn — trả gộp thì bỏ trống)
            </span>
            <select
              value={form.po_id}
              onChange={(e) => setForm({ ...form, po_id: e.target.value })}
              className="bg-background rounded-md border px-2 py-1.5"
            >
              <option value="">— Không gắn đơn —</option>
              {(detail?.pos ?? []).map((p) => (
                <option key={p.po_id} value={p.po_id}>
                  {p.po_code} · {fmtM(p.incurred)} {p.currency}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Số UNC / phiếu chi</span>
            <input
              value={form.ref_no}
              onChange={(e) => setForm({ ...form, ref_no: e.target.value })}
              className="bg-background rounded-md border px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Ghi chú</span>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="bg-background rounded-md border px-2 py-1.5"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPayOpen(false)}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              Huỷ
            </button>
            <button
              onClick={() => void submitPayment()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />} Ghi thanh toán
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
