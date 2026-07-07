'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type PoStatus =
  | 'pending_approval'
  | 'approved'
  | 'ordered'
  | 'confirmed'
  | 'in_transit'
  | 'partial'
  | 'received'
  | 'cancelled'

type Po = {
  id: string
  code: string
  production_order_id: string
  supplier_id: string
  status: PoStatus
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  expected_at: string | null
  terms: string | null
  note: string | null
  created_at: string
  supplier_name: string
  lsx_code: string
  order_code: string | null
}

type PoLine = {
  id: string
  material_id: string
  qty_ordered: number
  unit_price: number | null
  spec: string | null
  qty2: number | null
  unit2: string | null
  note: string | null
  material_code: string
  material_name: string
  material_unit: string
}

type StatusLine = {
  id: string
  material_id: string
  qty_ordered: number
  qty_received: number
  qty_missing: number
  material_code: string
  material_name: string
  material_unit: string
}

type SupplierOption = { id: string; name: string }
type LsxOption = { id: string; code: string; customer_name: string }
type MaterialOption = { id: string; code: string; name: string; unit: string }

type Need = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  qty_issued: number
  qty_remaining: number
  on_hand: number
}

type Row = {
  material_id: string
  qty_ordered: number | ''
  unit_price: number | ''
  spec: string
  qty2: number | ''
  unit2: string
  note: string
}

const STATUS_LABEL: Record<PoStatus, string> = {
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  ordered: 'Đã gửi NCC',
  confirmed: 'NCC xác nhận',
  in_transit: 'Đang giao',
  partial: 'Về một phần',
  received: 'Về đủ',
  cancelled: 'Đã huỷ',
}
const STATUS_TONE: Record<PoStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  pending_approval: 'amber',
  approved: 'blue',
  ordered: 'blue',
  confirmed: 'blue',
  in_transit: 'amber',
  partial: 'amber',
  received: 'green',
  cancelled: 'red',
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function PosManager({
  pos,
  suppliers,
  lsxs,
  materials,
  canEdit,
  canApprove,
}: {
  pos: Po[]
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  materials: MaterialOption[]
  canEdit: boolean
  canApprove: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [viewing, setViewing] = useState<{
    po: Po
    lines: PoLine[]
    statusLines: StatusLine[]
  } | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PoStatus>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return pos.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (supplierFilter !== 'all' && p.supplier_id !== supplierFilter) return false
      if (ql && !`${p.code} ${p.supplier_name} ${p.lsx_code}`.toLowerCase().includes(ql))
        return false
      return true
    })
  }, [pos, q, statusFilter, supplierFilter])

  const stats = useMemo(() => {
    let pending = 0
    let open = 0
    let done = 0
    for (const p of pos) {
      if (p.status === 'pending_approval') pending++
      if (
        ['approved', 'ordered', 'confirmed', 'in_transit', 'partial'].includes(p.status)
      )
        open++
      if (p.status === 'received') done++
    }
    return { pending, open, done }
  }, [pos])

  async function send(url: string, method: 'POST' | 'PATCH', body?: unknown) {
    setBusy(true)
    try {
      await api(url, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function openView(po: Po) {
    setBusy(true)
    try {
      const data = await api<{ lines: PoLine[]; status_lines: StatusLine[] }>(
        `/api/dept/supply/pos/${po.id}`,
      )
      setViewing({ po, lines: data.lines, statusLines: data.status_lines })
    } catch (e) {
      toast.error('Không tải được đơn đặt', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function decide(po: Po, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối ${po.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt đơn đặt ${po.code}?`,
        description: `NCC: ${po.supplier_name} · LSX ${po.lsx_code}. Duyệt xong Cung ứng mới gửi được cho NCC (BR-05).`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    const ok2 = await send(`/api/dept/supply/pos/${po.id}/decide`, 'POST', {
      decision,
      reason,
    })
    if (ok2) {
      toast.success(decision === 'approve' ? 'Đã duyệt' : 'Đã từ chối', po.code)
      setViewing(null)
    }
  }

  async function advance(po: Po, to: 'ordered' | 'confirmed' | 'in_transit') {
    const labels = {
      ordered: 'Gửi NCC',
      confirmed: 'NCC xác nhận',
      in_transit: 'Đang giao',
    }
    const ok = await confirm({
      title: `${labels[to]} — ${po.code}?`,
      confirmLabel: labels[to],
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/supply/pos/${po.id}/advance`, 'POST', { to })
    if (ok2) {
      toast.success(labels[to], po.code)
      setViewing(null)
    }
  }

  async function cancelPo(po: Po) {
    const reason = window.prompt(`Lý do huỷ ${po.code}:`)?.trim()
    if (!reason) return
    const ok = await send(`/api/dept/supply/pos/${po.id}/cancel`, 'POST', { reason })
    if (ok) {
      toast.success('Đã huỷ', po.code)
      setViewing(null)
    }
  }

  const columns: Column<Po>[] = [
    {
      key: 'code',
      header: 'Số PO / NCC',
      sortValue: (p) => p.code,
      cell: (p) => (
        <button
          onClick={() => void openView(p)}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
        >
          <span className="font-mono text-xs text-zinc-400">{p.code}</span>
          <span className="truncate font-medium">{p.supplier_name}</span>
        </button>
      ),
    },
    {
      key: 'lsx',
      header: 'LSX / Đơn hàng',
      width: '170px',
      cell: (p) => (
        <div className="flex flex-col text-xs">
          <span className="font-mono">{p.lsx_code}</span>
          {p.order_code && <span className="text-zinc-400">{p.order_code}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortValue: (p) => p.status,
      width: '130px',
      cell: (p) => <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>,
    },
    {
      key: 'expected',
      header: 'Hẹn giao',
      sortValue: (p) => p.expected_at ?? '9999',
      width: '110px',
      cell: (p) =>
        p.expected_at ? (
          new Date(p.expected_at).toLocaleDateString('vi-VN')
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'created',
      header: 'Ngày tạo',
      sortValue: (p) => p.created_at,
      width: '110px',
      cell: (p) => new Date(p.created_at).toLocaleDateString('vi-VN'),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (p) => {
        const items: { label: string; onClick: () => void; danger?: boolean }[] = [
          { label: 'Xem chi tiết', onClick: () => void openView(p) },
        ]
        if (canApprove && p.status === 'pending_approval') {
          items.push(
            { label: 'Duyệt', onClick: () => void decide(p, 'approve') },
            { label: 'Từ chối', onClick: () => void decide(p, 'reject'), danger: true },
          )
        }
        if (canEdit && p.status === 'approved') {
          items.push({ label: 'Gửi NCC', onClick: () => void advance(p, 'ordered') })
        }
        if (canEdit && p.status === 'ordered') {
          items.push({
            label: 'NCC xác nhận',
            onClick: () => void advance(p, 'confirmed'),
          })
        }
        if (canEdit && ['ordered', 'confirmed'].includes(p.status)) {
          items.push({ label: 'Đang giao', onClick: () => void advance(p, 'in_transit') })
        }
        if (canEdit && !['received', 'cancelled'].includes(p.status)) {
          items.push({ label: 'Huỷ đơn', onClick: () => void cancelPo(p), danger: true })
        }
        return <RowMenu items={items} />
      },
    },
  ]

  const btnPrimary =
    'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Đơn đặt vật tư' },
        ]}
        title="Đơn đặt vật tư (PO)"
        description="Mỗi đơn = 1 NCC + 1 LSX (BR-06). GĐ duyệt xong mới gửi NCC (BR-05); về hàng do Kho ghi nhận."
        actions={
          canEdit && (
            <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
              + Tạo đơn đặt
            </button>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng PO', value: pos.length, tone: 'default' },
          {
            label: 'Chờ duyệt',
            value: stats.pending,
            tone: stats.pending ? 'amber' : 'gray',
          },
          { label: 'Đang mở', value: stats.open, tone: 'blue' },
          { label: 'Về đủ', value: stats.done, tone: 'green' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số PO, NCC, LSX…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi trạng thái' },
                  ...(Object.keys(STATUS_LABEL) as PoStatus[]).map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s],
                  })),
                ]}
              />
              <ToolbarSelect
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={[
                  { value: 'all', label: 'Mọi NCC' },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </>
          }
          right={
            busy ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <Spinner size={12} /> Đang xử lý…
              </span>
            ) : undefined
          }
        />

        <DataTable<Po>
          rows={filtered}
          columns={columns}
          storageKey="supply-pos"
          rowClassName={(p) => (p.status === 'cancelled' ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="▩"
              title={pos.length === 0 ? 'Chưa có đơn đặt nào' : 'Không khớp bộ lọc'}
              description="Tạo đơn đặt từ LSX — hệ thống gợi ý nhu cầu vật tư theo BOM."
              action={
                canEdit && pos.length === 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Tạo đơn đặt
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {/* Tạo PO */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Tạo đơn đặt vật tư"
        maxWidth="sm:max-w-4xl"
      >
        {openCreate && (
          <PoForm
            suppliers={suppliers}
            lsxs={lsxs}
            materials={materials}
            onDone={(code) => {
              setOpenCreate(false)
              toast.success(`Đã tạo ${code}`, 'Đơn đang chờ Giám đốc duyệt')
              router.refresh()
            }}
          />
        )}
      </Modal>

      {/* Chi tiết */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.po.code} — ${viewing.po.supplier_name}` : ''}
        maxWidth="sm:max-w-4xl"
      >
        {viewing && (
          <PoDetail
            po={viewing.po}
            lines={viewing.lines}
            statusLines={viewing.statusLines}
            canEdit={canEdit}
            canApprove={canApprove}
            onDecide={(d) => void decide(viewing.po, d)}
            onAdvance={(to) => void advance(viewing.po, to)}
            onCancel={() => void cancelPo(viewing.po)}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Form tạo PO ─────────────────────────────────────────────────────────────

function PoForm({
  suppliers,
  lsxs,
  materials,
  onDone,
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  materials: MaterialOption[]
  onDone: (code: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [lsxId, setLsxId] = useState('')
  const [needs, setNeeds] = useState<Need[]>([])
  const [rows, setRows] = useState<Row[]>([])

  async function selectLsx(id: string) {
    setLsxId(id)
    setRows([])
    setNeeds([])
    if (!id) return
    try {
      const data = await api<{ needs: Need[] }>(
        `/api/dept/supply/needs?production_order_id=${id}`,
      )
      setNeeds(data.needs)
    } catch (e) {
      toast.error('Không tải được nhu cầu', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  function addFromNeed(n: Need) {
    if (rows.some((r) => r.material_id === n.material_id)) return
    setRows((rs) => [
      ...rs,
      {
        material_id: n.material_id,
        qty_ordered: Math.max(n.qty_remaining - n.on_hand, 0) || n.qty_remaining,
        unit_price: '',
        spec: '',
        qty2: '',
        unit2: '',
        note: '',
      },
    ])
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      {
        material_id: '',
        qty_ordered: '',
        unit_price: '',
        spec: '',
        qty2: '',
        unit2: '',
        note: '',
      },
    ])
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const usedIds = new Set(rows.map((r) => r.material_id))
  const invalid =
    !lsxId ||
    rows.length === 0 ||
    rows.length !== usedIds.size ||
    rows.some((r) => !r.material_id || r.qty_ordered === '' || Number(r.qty_ordered) <= 0)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    try {
      const { po } = await api<{ po: { code: string } }>('/api/dept/supply/pos', {
        method: 'POST',
        body: {
          production_order_id: lsxId,
          supplier_id: String(fd.get('supplier_id') ?? ''),
          currency: String(fd.get('currency') ?? 'VND'),
          vat_rate: String(fd.get('vat_rate') ?? '').trim()
            ? Number(fd.get('vat_rate'))
            : null,
          price_includes_vat: String(fd.get('price_includes_vat')) === 'true',
          expected_at: String(fd.get('expected_at') ?? '') || null,
          terms: String(fd.get('terms') ?? '').trim() || null,
          note: String(fd.get('note') ?? '').trim() || null,
          lines: rows.map((r) => ({
            material_id: r.material_id,
            qty_ordered: Number(r.qty_ordered),
            unit_price: r.unit_price === '' ? null : Number(r.unit_price),
            spec: r.spec.trim() || null,
            qty2: r.qty2 === '' ? null : Number(r.qty2),
            unit2: r.unit2.trim() || null,
            note: r.note.trim() || null,
          })),
        },
      })
      onDone(po.code)
    } catch (err) {
      toast.error('Tạo đơn thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          LSX <span className="text-red-500">*</span>
          <select
            value={lsxId}
            onChange={(e) => void selectLsx(e.target.value)}
            required
            className={inputCls}
          >
            <option value="">— chọn LSX —</option>
            {lsxs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.customer_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nhà cung cấp <span className="text-red-500">*</span>
          <select name="supplier_id" required className={inputCls}>
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
          <input name="expected_at" type="date" className={inputCls} />
        </label>
      </div>

      {/* Gợi ý nhu cầu theo BOM (FR-SUP-01) */}
      {lsxId && (
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 text-xs font-semibold text-zinc-500 uppercase">
            Nhu cầu theo BOM (cần − đã xuất) — bấm để thêm vào đơn; tồn kho chỉ để tham
            khảo
          </div>
          {needs.length === 0 ? (
            <p className="text-xs text-zinc-400">
              LSX chưa có BOM — thêm dòng thủ công bên dưới (BR-07: không bắt buộc đủ
              BOM).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {needs.map((n) => (
                <button
                  key={n.material_id}
                  type="button"
                  disabled={usedIds.has(n.material_id)}
                  onClick={() => addFromNeed(n)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:border-sky-400 hover:text-sky-600 disabled:opacity-40 dark:border-zinc-700"
                  title={`Cần ${n.qty_remaining} · Tồn ${n.on_hand}`}
                >
                  <span className="font-mono">{n.material_code}</span> {n.material_name} —
                  cần <b>{n.qty_remaining}</b> {n.unit} (tồn {n.on_hand})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dòng đặt */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              <th className="w-24 py-2 pr-2">SL đặt</th>
              <th className="w-28 py-2 pr-2">Đơn giá</th>
              <th className="w-28 py-2 pr-2">Quy cách</th>
              <th className="w-20 py-2 pr-2">SL phụ</th>
              <th className="w-16 py-2 pr-2">ĐVT phụ</th>
              <th className="py-2 pr-2">Ghi chú</th>
              <th className="w-8 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-zinc-400">
                  Chọn từ gợi ý BOM hoặc thêm dòng thủ công.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-1.5 pr-2">
                  <select
                    value={r.material_id}
                    onChange={(e) => setRow(i, { material_id: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">— chọn vật tư —</option>
                    {materials.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={usedIds.has(m.id) && m.id !== r.material_id}
                      >
                        {m.code} — {m.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.qty_ordered}
                    onChange={(e) =>
                      setRow(i, {
                        qty_ordered: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.unit_price}
                    onChange={(e) =>
                      setRow(i, {
                        unit_price: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={r.spec}
                    maxLength={100}
                    placeholder="25x50x1li"
                    onChange={(e) => setRow(i, { spec: e.target.value })}
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={r.qty2}
                    onChange={(e) =>
                      setRow(i, {
                        qty2: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={r.unit2}
                    maxLength={30}
                    placeholder="kg / m²"
                    onChange={(e) => setRow(i, { unit2: e.target.value })}
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={r.note}
                    maxLength={500}
                    placeholder="chân trước…"
                    onChange={(e) => setRow(i, { note: e.target.value })}
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label="Xoá dòng"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="self-start rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        + Thêm dòng thủ công
      </button>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Tiền tệ
          <select name="currency" defaultValue="VND" className={inputCls}>
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          VAT (%)
          <input
            name="vat_rate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="10"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Đơn giá
          <select name="price_includes_vat" defaultValue="true" className={inputCls}>
            <option value="true">Đã gồm VAT</option>
            <option value="false">Chưa gồm VAT</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Điều kiện / bảo hành
          <input
            name="terms"
            maxLength={1000}
            placeholder="Bảo hành 24 tháng…"
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Ghi chú
        <textarea name="note" rows={2} maxLength={2000} className={inputCls} />
      </label>

      <div className="flex justify-end">
        <button
          disabled={busy || invalid}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang tạo…' : 'Tạo đơn → gửi GĐ duyệt'}
        </button>
      </div>
    </form>
  )
}

// ── Chi tiết PO ─────────────────────────────────────────────────────────────

function PoDetail({
  po,
  lines,
  statusLines,
  canEdit,
  canApprove,
  onDecide,
  onAdvance,
  onCancel,
}: {
  po: Po
  lines: PoLine[]
  statusLines: StatusLine[]
  canEdit: boolean
  canApprove: boolean
  onDecide: (d: 'approve' | 'reject') => void
  onAdvance: (to: 'ordered' | 'confirmed' | 'in_transit') => void
  onCancel: () => void
}) {
  const receivedById = new Map(statusLines.map((s) => [s.id, s]))
  const total = lines.reduce((s, l) => s + l.qty_ordered * (l.unit_price ?? 0), 0)
  const showReceived = !['pending_approval', 'approved', 'cancelled'].includes(po.status)

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={STATUS_TONE[po.status]}>{STATUS_LABEL[po.status]}</Badge>
        <Badge>LSX {po.lsx_code}</Badge>
        {po.order_code && <Badge>{po.order_code}</Badge>}
        {po.vat_rate != null && (
          <Badge>
            VAT {po.vat_rate}% ({po.price_includes_vat ? 'đã gồm' : 'chưa gồm'})
          </Badge>
        )}
        {po.expected_at && (
          <span className="text-zinc-500">
            Hẹn giao: {new Date(po.expected_at).toLocaleDateString('vi-VN')}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              <th className="w-24 py-2 pr-2">Quy cách</th>
              <th className="w-20 py-2 pr-2 text-right">SL đặt</th>
              {showReceived && (
                <>
                  <th className="w-20 py-2 pr-2 text-right">Đã về</th>
                  <th className="w-20 py-2 pr-2 text-right">Còn thiếu</th>
                </>
              )}
              <th className="w-24 py-2 pr-2 text-right">Đơn giá</th>
              <th className="w-28 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const st = receivedById.get(l.id)
              return (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    <div className="flex flex-col">
                      <span>
                        <span className="font-mono text-xs text-zinc-400">
                          {l.material_code}
                        </span>{' '}
                        {l.material_name}
                      </span>
                      {(l.qty2 != null || l.note) && (
                        <span className="text-xs text-zinc-500">
                          {l.qty2 != null && `${l.qty2} ${l.unit2 ?? ''}`}
                          {l.qty2 != null && l.note && ' · '}
                          {l.note}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 text-xs">{l.spec ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {l.qty_ordered.toLocaleString('vi-VN')} {l.material_unit}
                  </td>
                  {showReceived && (
                    <>
                      <td className="py-1.5 pr-2 text-right">
                        {(st?.qty_received ?? 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {st && st.qty_missing > 0 ? (
                          <span className="font-medium text-amber-600">
                            {st.qty_missing.toLocaleString('vi-VN')}
                          </span>
                        ) : (
                          <Badge tone="green">Đủ</Badge>
                        )}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 pr-2 text-right">
                    {l.unit_price != null ? l.unit_price.toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="py-1.5 text-right font-medium">
                    {l.unit_price != null
                      ? (l.qty_ordered * l.unit_price).toLocaleString('vi-VN')
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={showReceived ? 6 : 4}
                className="py-2 pr-2 text-right font-semibold"
              >
                Tổng cộng
              </td>
              <td className="py-2 text-right font-bold">
                {total.toLocaleString('vi-VN')} {po.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {po.terms && <p className="text-xs text-zinc-500">Điều kiện: {po.terms}</p>}
      {po.note && <p className="text-xs text-zinc-500">{po.note}</p>}

      <div className="flex justify-end gap-2">
        <a
          href={`/print/supply/${po.id}`}
          target="_blank"
          rel="noopener"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          🖨 In đơn đặt hàng
        </a>
        {canApprove && po.status === 'pending_approval' && (
          <>
            <button
              onClick={() => onDecide('reject')}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              Từ chối
            </button>
            <button
              onClick={() => onDecide('approve')}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Duyệt đơn đặt
            </button>
          </>
        )}
        {canEdit && po.status === 'approved' && (
          <button
            onClick={() => onAdvance('ordered')}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Gửi NCC
          </button>
        )}
        {canEdit && po.status === 'ordered' && (
          <button
            onClick={() => onAdvance('confirmed')}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            NCC xác nhận
          </button>
        )}
        {canEdit && !['received', 'cancelled'].includes(po.status) && (
          <button
            onClick={onCancel}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Huỷ
          </button>
        )}
      </div>
    </div>
  )
}
