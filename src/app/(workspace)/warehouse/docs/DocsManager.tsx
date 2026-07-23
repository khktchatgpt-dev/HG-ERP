'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type DocKind = 'receipt' | 'issue' | 'transfer' | 'stocktake'

type Doc = {
  id: string
  code: string
  kind: DocKind
  doc_date: string
  counterparty: string | null
  reason: string | null
  note: string | null
  created_by_name: string | null
  created_at: string
}

type DocLine = {
  id: string
  direction: 'in' | 'out'
  qty: number
  qty_rejected: number
  qc_status: string | null
  ref_type: string
  shelf_location: string | null
  note: string | null
  material_code: string | null
  material_name: string | null
  material_unit: string | null
  qty_ordered: number | null
}

type MaterialOption = {
  id: string
  code: string
  name: string
  unit: string
  /** Mã vạch NCC (0078) — ScanInput khớp cả code lẫn barcode. */
  barcode: string | null
  shelf_location: string | null
}
type PoOption = {
  id: string
  code: string
  status: string
  supplier_name: string
  /** null = PO ngoài LSX (0076). */
  lsx_code: string | null
}
type LsxOption = { id: string; code: string; customer_name: string }

type PoLine = {
  id: string
  material_id: string
  qty_ordered: number
  qty_received: number
  qty_missing: number
  material_code: string
  material_name: string
  material_unit: string
}

type LsxNeed = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_remaining: number
}

/** Dòng đang biên tập trong form phiếu. */
type Row = {
  material_id: string
  qty: number | ''
  qty_rejected: number | ''
  qc_status: '' | 'pass' | 'partial' | 'fail'
  po_line_id: string | null
  qty_ordered: number | null
  shelf_location: string
  note: string
}

/** Dòng biên bản kiểm kê (0077) — API docDetail trả kèm khi kind='stocktake'. */
type StocktakeLine = {
  id: string
  material_id: string
  system_qty: number
  counted_qty: number
  diff: number
  note: string | null
  material_code: string | null
  material_name: string | null
  material_unit: string | null
}

const KIND_LABEL: Record<DocKind, string> = {
  receipt: 'Phiếu nhập',
  issue: 'Phiếu xuất',
  transfer: 'Điều chuyển',
  stocktake: 'Kiểm kê',
}
const KIND_TONE: Record<DocKind, 'green' | 'amber' | 'blue' | 'gray'> = {
  receipt: 'green',
  issue: 'amber',
  transfer: 'blue',
  stocktake: 'gray',
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function DocsManager({
  docs,
  materials,
  pos,
  lsxs,
  canEdit,
}: {
  docs: Doc[]
  materials: MaterialOption[]
  pos: PoOption[]
  lsxs: LsxOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [openReceipt, setOpenReceipt] = useState(false)
  const [openIssue, setOpenIssue] = useState(false)
  const [viewing, setViewing] = useState<{
    doc: Doc
    lines: DocLine[]
    stocktakeLines: StocktakeLine[]
  } | null>(null)

  const [q, setQ] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | DocKind>('all')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return docs.filter((d) => {
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false
      if (ql && !`${d.code} ${d.counterparty ?? ''}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [docs, q, kindFilter])

  const stats = useMemo(() => {
    const by: Record<string, number> = { receipt: 0, issue: 0 }
    for (const d of docs) by[d.kind] = (by[d.kind] ?? 0) + 1
    return by
  }, [docs])

  async function openView(doc: Doc) {
    setBusy(true)
    try {
      const data = await api<{ lines: DocLine[]; stocktake_lines?: StocktakeLine[] }>(
        `/api/dept/warehouse/docs/${doc.id}`,
      )
      setViewing({ doc, lines: data.lines, stocktakeLines: data.stocktake_lines ?? [] })
    } catch (e) {
      toast.error('Không tải được phiếu', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Doc>[] = [
    {
      key: 'code',
      header: 'Số phiếu',
      sortValue: (d) => d.code,
      width: '150px',
      cell: (d) => (
        <button
          onClick={() => void openView(d)}
          className="font-mono text-xs hover:text-sky-600 dark:hover:text-sky-400"
        >
          {d.code}
        </button>
      ),
    },
    {
      key: 'kind',
      header: 'Loại',
      sortValue: (d) => d.kind,
      width: '110px',
      cell: (d) => <Badge tone={KIND_TONE[d.kind]}>{KIND_LABEL[d.kind]}</Badge>,
    },
    {
      key: 'counterparty',
      header: 'Người giao / nhận',
      cell: (d) => d.counterparty ?? <span className="text-zinc-400">—</span>,
    },
    {
      key: 'creator',
      header: 'Người lập',
      width: '150px',
      cell: (d) => d.created_by_name ?? '—',
    },
    {
      key: 'date',
      header: 'Ngày',
      sortValue: (d) => d.created_at,
      width: '110px',
      cell: (d) => new Date(d.created_at).toLocaleDateString('vi-VN'),
    },
    {
      key: 'print',
      header: '',
      width: '70px',
      align: 'right',
      cell: (d) => (
        <a
          href={`/print/warehouse/${d.id}`}
          target="_blank"
          rel="noopener"
          className="text-xs text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
        >
          🖨 In
        </a>
      ),
    },
  ]

  const btnPrimary =
    'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'
  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Phiếu kho' }]}
        title="Phiếu nhập / xuất kho"
        description="Phiếu nhiều dòng có số chứng từ — nhập theo đơn đặt, xuất theo LSX, in mẫu 01-VT/02-VT."
        actions={
          canEdit && (
            <>
              <a href="/warehouse/stocktake" className={btnSecondary}>
                ▧ Kiểm kê
              </a>
              <button onClick={() => setOpenIssue(true)} className={btnSecondary}>
                − Phiếu xuất
              </button>
              <button onClick={() => setOpenReceipt(true)} className={btnPrimary}>
                + Phiếu nhập
              </button>
            </>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng phiếu', value: docs.length, tone: 'default' },
          { label: 'Phiếu nhập', value: stats.receipt ?? 0, tone: 'green' },
          { label: 'Phiếu xuất', value: stats.issue ?? 0, tone: 'amber' },
          { label: 'PO đang mở', value: pos.length, tone: pos.length ? 'blue' : 'gray' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số phiếu, người giao/nhận…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={kindFilter}
                onChange={(v) => setKindFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi loại' },
                  { value: 'receipt' as const, label: 'Phiếu nhập' },
                  { value: 'issue' as const, label: 'Phiếu xuất' },
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

        <DataTable<Doc>
          rows={filtered}
          columns={columns}
          storageKey="warehouse-docs"
          emptyState={
            <EmptyState
              icon="▥"
              title={docs.length === 0 ? 'Chưa có phiếu nào' : 'Không khớp bộ lọc'}
              description="Lập phiếu nhập khi hàng về, phiếu xuất khi cấp vật tư cho xưởng."
            />
          }
        />
      </div>

      {/* Phiếu nhập */}
      <Modal
        open={openReceipt}
        onClose={() => setOpenReceipt(false)}
        title="Lập phiếu nhập kho (PNK)"
        maxWidth="sm:max-w-4xl"
      >
        {openReceipt && (
          <ReceiptForm
            materials={materials}
            pos={pos}
            onDone={(code, poStatus) => {
              setOpenReceipt(false)
              toast.success(
                `Đã lập ${code}`,
                poStatus === 'received'
                  ? 'Đơn đặt đã VỀ ĐỦ'
                  : poStatus === 'partial'
                    ? 'Đơn đặt về một phần'
                    : undefined,
              )
              router.refresh()
            }}
          />
        )}
      </Modal>

      {/* Phiếu xuất */}
      <Modal
        open={openIssue}
        onClose={() => setOpenIssue(false)}
        title="Lập phiếu xuất kho (PXK)"
        maxWidth="sm:max-w-4xl"
      >
        {openIssue && (
          <IssueForm
            materials={materials}
            lsxs={lsxs}
            onDone={(code) => {
              setOpenIssue(false)
              toast.success(`Đã lập ${code}`)
              router.refresh()
            }}
          />
        )}
      </Modal>

      {/* Chi tiết phiếu */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.doc.code} — ${KIND_LABEL[viewing.doc.kind]}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {viewing && (
          <DocDetail
            doc={viewing.doc}
            lines={viewing.lines}
            stocktakeLines={viewing.stocktakeLines}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Ô quét mã (FR-WMS-09: máy scan = bàn phím, kết thúc bằng Enter) ─────────

function ScanInput({
  materials,
  onHit,
}: {
  materials: MaterialOption[]
  onHit: (m: MaterialOption) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const toast = useToast()
  return (
    <input
      ref={ref}
      placeholder="⌨ Quét mã vạch / gõ mã vật tư rồi Enter…"
      className={`${inputCls} max-w-xs font-mono`}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        const code = e.currentTarget.value.trim().toLowerCase()
        if (!code) return
        // Khớp mã nội bộ TRƯỚC, rồi tới barcode NCC (0078) — máy scan = bàn phím.
        const m =
          materials.find((x) => x.code.toLowerCase() === code) ??
          materials.find((x) => x.barcode?.toLowerCase() === code)
        if (m) {
          onHit(m)
          e.currentTarget.value = ''
        } else {
          toast.error('Không tìm thấy mã', code)
          e.currentTarget.select()
        }
      }}
    />
  )
}

// ── Form phiếu nhập ─────────────────────────────────────────────────────────

function ReceiptForm({
  materials,
  pos,
  onDone,
}: {
  materials: MaterialOption[]
  pos: PoOption[]
  onDone: (code: string, poStatus: string | null) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [poId, setPoId] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  async function selectPo(id: string) {
    setPoId(id)
    if (!id) {
      setRows([])
      return
    }
    try {
      const { lines } = await api<{ lines: PoLine[] }>(`/api/dept/warehouse/po-open?po_id=${id}`)
      setRows(
        lines
          .filter((l) => l.qty_missing > 0)
          .map((l) => ({
            material_id: l.material_id,
            qty: l.qty_missing, // mặc định = còn thiếu, sửa theo thực nhận
            qty_rejected: '',
            qc_status: '',
            po_line_id: l.id,
            qty_ordered: l.qty_ordered,
            shelf_location: materialById.get(l.material_id)?.shelf_location ?? '',
            note: '',
          })),
      )
    } catch (e) {
      toast.error('Không tải được dòng PO', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  function addRow(m?: MaterialOption) {
    setRows((rs) => [
      ...rs,
      {
        material_id: m?.id ?? '',
        qty: '',
        qty_rejected: '',
        qc_status: '',
        po_line_id: null,
        qty_ordered: null,
        shelf_location: m?.shelf_location ?? '',
        note: '',
      },
    ])
  }

  const invalid =
    rows.length === 0 || rows.some((r) => !r.material_id || r.qty === '' || Number(r.qty) <= 0)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    try {
      const result = await api<{ code: string; po_status: string | null }>(
        '/api/dept/warehouse/docs/receipt',
        {
          method: 'POST',
          body: {
            po_id: poId || null,
            counterparty: String(fd.get('counterparty') ?? '').trim() || null,
            note: String(fd.get('note') ?? '').trim() || null,
            lines: rows.map((r) => ({
              material_id: r.material_id,
              qty: Number(r.qty),
              qty_rejected: r.qty_rejected === '' ? 0 : Number(r.qty_rejected),
              qc_status: r.qc_status || undefined,
              po_line_id: r.po_line_id,
              shelf_location: r.shelf_location.trim() || null,
              note: r.note.trim() || null,
            })),
          },
        },
      )
      onDone(result.code, result.po_status)
    } catch (err) {
      toast.error('Lập phiếu thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Nguồn nhập
          <select value={poId} onChange={(e) => void selectPo(e.target.value)} className={inputCls}>
            <option value="">Mua ngoài (không theo đơn đặt)</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.supplier_name} ({p.lsx_code ? `LSX ${p.lsx_code}` : 'ngoài LSX'})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Người giao hàng
          <input name="counterparty" maxLength={200} className={inputCls} />
        </label>
      </div>

      {!poId && <ScanInput materials={materials} onHit={(m) => addRow(m)} />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              {poId && <th className="w-24 py-2 pr-2 text-right">Còn thiếu</th>}
              <th className="w-24 py-2 pr-2">Thực nhập (đạt)</th>
              <th className="w-24 py-2 pr-2">QC loại</th>
              <th className="w-24 py-2 pr-2">QC</th>
              <th className="w-20 py-2 pr-2">Kệ</th>
              <th className="py-2 pr-2">Ghi chú</th>
              <th className="w-8 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-zinc-400">
                  {poId ? 'PO này không còn dòng thiếu.' : 'Quét mã hoặc thêm dòng vật tư.'}
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const mat = materialById.get(r.material_id)
              return (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    {r.po_line_id ? (
                      <span>
                        <span className="font-mono text-xs text-zinc-400">{mat?.code}</span>{' '}
                        {mat?.name ?? '?'}
                      </span>
                    ) : (
                      <select
                        value={r.material_id}
                        onChange={(e) => {
                          const m = materialById.get(e.target.value)
                          setRows((rs) =>
                            rs.map((x, idx) =>
                              idx === i
                                ? {
                                    ...x,
                                    material_id: e.target.value,
                                    shelf_location: m?.shelf_location ?? x.shelf_location,
                                  }
                                : x,
                            ),
                          )
                        }}
                        className={inputCls}
                      >
                        <option value="">— chọn vật tư —</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  {poId && (
                    <td className="py-1.5 pr-2 text-right text-zinc-500">
                      {r.qty_ordered != null ? r.qty_ordered : ''}
                    </td>
                  )}
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.qty}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, idx) =>
                            idx === i
                              ? { ...x, qty: e.target.value === '' ? '' : Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                      className={inputCls}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.qty_rejected}
                      placeholder="0"
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, idx) =>
                            idx === i
                              ? {
                                  ...x,
                                  qty_rejected:
                                    e.target.value === '' ? '' : Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                      className={inputCls}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={r.qc_status}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, idx) =>
                            idx === i ? { ...x, qc_status: e.target.value as Row['qc_status'] } : x,
                          ),
                        )
                      }
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="pass">Đạt</option>
                      <option value="partial">Đạt 1 phần</option>
                      <option value="fail">Không đạt</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={r.shelf_location}
                      maxLength={60}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, idx) =>
                            idx === i ? { ...x, shelf_location: e.target.value } : x,
                          ),
                        )
                      }
                      className={inputCls}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={r.note}
                      maxLength={500}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)),
                        )
                      }
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
              )
            })}
          </tbody>
        </table>
      </div>

      {!poId && (
        <button
          type="button"
          onClick={() => addRow()}
          className="self-start rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          + Thêm dòng
        </button>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Ghi chú phiếu
        <textarea name="note" rows={2} maxLength={2000} className={inputCls} />
      </label>

      <p className="text-xs text-zinc-500">
        Số QC loại <b>không</b> cộng vào tồn (BR-10) nhưng vẫn tính là &quot;đã về&quot; khi đối
        chiếu đơn đặt (BR-08) — Cung ứng thấy ghi chú để xử lý với NCC.
      </p>

      <div className="flex justify-end">
        <button
          disabled={busy || invalid}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lập…' : 'Lập phiếu nhập'}
        </button>
      </div>
    </form>
  )
}

// ── Form phiếu xuất ─────────────────────────────────────────────────────────

function IssueForm({
  materials,
  lsxs,
  onDone,
}: {
  materials: MaterialOption[]
  lsxs: LsxOption[]
  onDone: (code: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'daily' | 'lsx'>('daily')
  const [lsxId, setLsxId] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  async function selectLsx(id: string) {
    setLsxId(id)
    if (!id) {
      setRows([])
      return
    }
    try {
      const { needs } = await api<{ needs: LsxNeed[] }>(
        `/api/dept/warehouse/lsx-needs?production_order_id=${id}`,
      )
      setRows(
        needs
          .filter((n) => n.qty_remaining > 0)
          .map((n) => ({
            material_id: n.material_id,
            qty: n.qty_remaining, // gợi ý = còn phải xuất theo BOM
            qty_rejected: '',
            qc_status: '' as const,
            po_line_id: null,
            qty_ordered: null,
            shelf_location: materialById.get(n.material_id)?.shelf_location ?? '',
            note: '',
          })),
      )
      if (needs.length === 0) {
        toast.error('LSX chưa có nhu cầu BOM', 'Kiểm tra BOM sản phẩm hoặc thêm dòng thủ công')
      }
    } catch (e) {
      toast.error('Không tải được nhu cầu LSX', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  function addRow(m?: MaterialOption) {
    setRows((rs) => [
      ...rs,
      {
        material_id: m?.id ?? '',
        qty: '',
        qty_rejected: '',
        qc_status: '',
        po_line_id: null,
        qty_ordered: null,
        shelf_location: m?.shelf_location ?? '',
        note: '',
      },
    ])
  }

  const invalid =
    rows.length === 0 ||
    rows.some((r) => !r.material_id || r.qty === '' || Number(r.qty) <= 0) ||
    (kind === 'lsx' && !lsxId)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    try {
      const result = await api<{ code: string }>('/api/dept/warehouse/docs/issue', {
        method: 'POST',
        body: {
          kind,
          production_order_id: kind === 'lsx' ? lsxId : null,
          counterparty: String(fd.get('counterparty') ?? '').trim() || null,
          reason: String(fd.get('reason') ?? '').trim() || null,
          note: String(fd.get('note') ?? '').trim() || null,
          lines: rows.map((r) => ({
            material_id: r.material_id,
            qty: Number(r.qty),
            shelf_location: r.shelf_location.trim() || null,
            note: r.note.trim() || null,
          })),
        },
      })
      onDone(result.code)
    } catch (err) {
      toast.error('Lập phiếu thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Loại xuất
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as 'daily' | 'lsx')
              setLsxId('')
              setRows([])
            }}
            className={inputCls}
          >
            <option value="daily">Thường ngày (không gắn LSX)</option>
            <option value="lsx">Theo LSX (cấp cho sản xuất)</option>
          </select>
        </label>
        {kind === 'lsx' && (
          <label className="flex flex-col gap-1 text-sm">
            LSX <span className="text-red-500">*</span>
            <select value={lsxId} onChange={(e) => void selectLsx(e.target.value)} className={inputCls}>
              <option value="">— chọn LSX —</option>
              {lsxs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.customer_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Người nhận
          <input name="counterparty" maxLength={200} className={inputCls} />
        </label>
      </div>

      <ScanInput materials={materials} onHit={(m) => addRow(m)} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              <th className="w-28 py-2 pr-2">SL xuất</th>
              <th className="w-20 py-2 pr-2">Kệ</th>
              <th className="py-2 pr-2">Ghi chú</th>
              <th className="w-8 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-400">
                  {kind === 'lsx'
                    ? 'Chọn LSX để gợi ý theo BOM, hoặc quét mã thêm dòng.'
                    : 'Quét mã hoặc thêm dòng vật tư.'}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-1.5 pr-2">
                  <select
                    value={r.material_id}
                    onChange={(e) => {
                      const m = materialById.get(e.target.value)
                      setRows((rs) =>
                        rs.map((x, idx) =>
                          idx === i
                            ? {
                                ...x,
                                material_id: e.target.value,
                                shelf_location: m?.shelf_location ?? x.shelf_location,
                              }
                            : x,
                        ),
                      )
                    }}
                    className={inputCls}
                  >
                    <option value="">— chọn vật tư —</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
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
                    value={r.qty}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x, idx) =>
                          idx === i
                            ? { ...x, qty: e.target.value === '' ? '' : Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={r.shelf_location}
                    maxLength={60}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x, idx) =>
                          idx === i ? { ...x, shelf_location: e.target.value } : x,
                        ),
                      )
                    }
                    className={inputCls}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={r.note}
                    maxLength={500}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)),
                      )
                    }
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
        onClick={() => addRow()}
        className="self-start rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        + Thêm dòng
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Lý do xuất
          <input name="reason" maxLength={500} placeholder="Cấp vật tư sản xuất / sửa chữa…" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ghi chú phiếu
          <input name="note" maxLength={2000} className={inputCls} />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          disabled={busy || invalid}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lập…' : 'Lập phiếu xuất'}
        </button>
      </div>
    </form>
  )
}

// ── Chi tiết phiếu ──────────────────────────────────────────────────────────

function DocDetail({
  doc,
  lines,
  stocktakeLines = [],
}: {
  doc: Doc
  lines: DocLine[]
  stocktakeLines?: StocktakeLine[]
}) {
  // Phiếu KK: hiển thị BIÊN BẢN đầy đủ (mọi dòng đếm) thay vì movements (chỉ dòng lệch).
  if (doc.kind === 'stocktake') {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Badge tone={KIND_TONE[doc.kind]}>{KIND_LABEL[doc.kind]}</Badge>
          <span>Ngày: {new Date(doc.created_at).toLocaleString('vi-VN')}</span>
          {doc.created_by_name && <span>· Người lập: {doc.created_by_name}</span>}
          {doc.reason && <span>· Lý do: {doc.reason}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Vật tư</th>
                <th className="w-24 py-2 pr-2 text-right">Tồn sổ</th>
                <th className="w-24 py-2 pr-2 text-right">Đếm thực tế</th>
                <th className="w-24 py-2 pr-2 text-right">Chênh lệch</th>
                <th className="py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {stocktakeLines.map((l) => (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    <span className="font-mono text-xs text-zinc-400">
                      {l.material_code}
                    </span>{' '}
                    {l.material_name}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-zinc-500">
                    {l.system_qty.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-medium">
                    {l.counted_qty.toLocaleString('vi-VN')} {l.material_unit}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {l.diff === 0 ? (
                      <span className="text-green-600 dark:text-green-400">khớp ✓</span>
                    ) : (
                      <span
                        className={
                          'font-semibold ' +
                          (l.diff > 0
                            ? 'text-amber-600 dark:text-amber-500'
                            : 'text-red-600 dark:text-red-400')
                        }
                      >
                        {l.diff > 0 ? '+' : ''}
                        {l.diff.toLocaleString('vi-VN')}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-zinc-500">{l.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-400">
          {stocktakeLines.filter((l) => l.diff !== 0).length} dòng lệch sổ đã sinh điều
          chỉnh tồn (ref &quot;adjust&quot;) — tồn sau kiểm = số đếm thực tế.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <Badge tone={KIND_TONE[doc.kind]}>{KIND_LABEL[doc.kind]}</Badge>
        <span>Ngày: {new Date(doc.created_at).toLocaleString('vi-VN')}</span>
        {doc.counterparty && <span>· Giao/nhận: {doc.counterparty}</span>}
        {doc.created_by_name && <span>· Người lập: {doc.created_by_name}</span>}
        {doc.reason && <span>· Lý do: {doc.reason}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              {doc.kind === 'receipt' && <th className="w-24 py-2 pr-2 text-right">Chứng từ</th>}
              <th className="w-24 py-2 pr-2 text-right">
                {doc.kind === 'receipt' ? 'Thực nhập' : 'Thực xuất'}
              </th>
              {doc.kind === 'receipt' && <th className="w-20 py-2 pr-2 text-right">QC loại</th>}
              <th className="w-16 py-2 pr-2">Kệ</th>
              <th className="py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-1.5 pr-2">
                  <span className="font-mono text-xs text-zinc-400">{l.material_code}</span>{' '}
                  {l.material_name}
                </td>
                {doc.kind === 'receipt' && (
                  <td className="py-1.5 pr-2 text-right text-zinc-500">{l.qty_ordered ?? '—'}</td>
                )}
                <td className="py-1.5 pr-2 text-right font-medium">
                  {l.qty.toLocaleString('vi-VN')} {l.material_unit}
                </td>
                {doc.kind === 'receipt' && (
                  <td className="py-1.5 pr-2 text-right">
                    {l.qty_rejected > 0 ? (
                      <span className="text-red-600">{l.qty_rejected}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                <td className="py-1.5 pr-2">{l.shelf_location ?? '—'}</td>
                <td className="py-1.5 text-zinc-500">{l.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <a
          href={`/print/warehouse/${doc.id}`}
          target="_blank"
          rel="noopener"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          🖨 In phiếu ({doc.kind === 'receipt' ? '01-VT' : '02-VT'})
        </a>
      </div>
    </div>
  )
}
