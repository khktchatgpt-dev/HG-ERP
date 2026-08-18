'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  /** Vòng duyệt kiểm kê (0157) — nhập/xuất luôn 'posted'. */
  status: 'pending' | 'posted' | 'rejected'
  approved_by_name: string | null
  approved_at: string | null
  reject_reason: string | null
  /** Phiếu ĐẢO (0161/K1): trỏ phiếu gốc — null = phiếu thường. */
  reversal_of_doc_id: string | null
  reversal_of_code: string | null
  /** Số phiếu giao / hoá đơn NCC (K3). */
  supplier_doc_no: string | null
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
  /** Còn CHỜ VỀ (0154) — dòng Cung ứng đã chốt thiếu = 0, không gợi nhận nữa. */
  qty_open: number
  /** Dung sai nhận vượt % của vật tư (0156) — chip "trong dung sai" trên form. */
  over_tolerance_pct: number
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
  /**
   * CÒN THIẾU của dòng PO (không phải SL đặt). Cột trên form vẫn ghi "Còn thiếu"
   * nhưng trước đây đổ `qty_ordered` — với đơn giao nhiều đợt, người nhận đối
   * chiếu thực nhập với một con số to hơn thực tế rồi nhập thừa.
   */
  qty_missing: number | null
  /** SL đặt + dung sai % của dòng PO (0156) — nuôi chip "trong dung sai". */
  qty_ordered: number | null
  over_tolerance_pct: number | null
  /** SL của dòng trong ĐỢT GIAO đang chọn (0153) — null = phiếu không theo đợt. */
  ship_qty: number | null
  /**
   * MÃ/TÊN/ĐVT mang theo TỪNG DÒNG — nguồn là chính dòng PO/nhu cầu LSX (API đã
   * trả sẵn). Trước đây tên tra qua danh mục nạp sẵn `materials`, mà danh mục
   * 13k dòng chỉ nạp 1.000 → vật tư ngoài top đó hiện "?" dù dòng PO biết rõ
   * tên. Danh mục giờ chỉ còn là fallback cho dòng gõ tay.
   */
  material_code: string | null
  material_name: string | null
  material_unit: string | null
  shelf_location: string
  note: string
}

/** Đợt giao còn nhận được của PO (0153) — từ /api/dept/supply/pos/[id]/shipments. */
type ReceiptShipment = {
  id: string
  seq: number
  expected_date: string
  status: string
  lines: { po_line_id: string; qty: number }[]
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
  /** Tồn HIỆN TẠI (0157) — chỉ biên bản chờ duyệt mới kèm (chênh áp theo số này). */
  current_qty?: number
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

/**
 * Phiếu TRẢ NCC (0080) là kind='issue' + reason "Trả hàng NCC — PO…" (service
 * tự ghi). Hiện "Phiếu xuất" trần thì người đọc tưởng cấp vật tư — gọi đúng tên.
 */
const isReturnDoc = (d: { kind: DocKind; reason: string | null }) =>
  d.kind === 'issue' && (d.reason ?? '').startsWith('Trả hàng NCC')
const kindLabel = (d: { kind: DocKind; reason: string | null }) =>
  isReturnDoc(d) ? 'Trả NCC' : KIND_LABEL[d.kind]
const kindTone = (d: { kind: DocKind; reason: string | null }) =>
  isReturnDoc(d) ? ('red' as const) : KIND_TONE[d.kind]

/**
 * Dung sai nhận vượt (0156): dòng PO nhập vượt còn-thiếu nhưng TRONG ngưỡng →
 * % vượt so SL đặt (cộng dồn); null = trong định mức hoặc vượt quá ngưỡng (để
 * server 409 như cũ). Cùng công thức với lib/po-receipt — đây chỉ là bản xem
 * trước trên form, server vẫn là người quyết.
 */
function withinTolerancePct(r: Row): number | null {
  if (r.po_line_id == null || r.qty_missing == null || r.qty_ordered == null) return null
  const total = (Number(r.qty) || 0) + (Number(r.qty_rejected) || 0)
  if (total <= r.qty_missing + 1e-6) return null
  const allowance = (r.qty_ordered * (r.over_tolerance_pct ?? 0)) / 100
  if (total > r.qty_missing + allowance + 1e-6) return null
  const cumulative = r.qty_ordered - r.qty_missing + total
  return r.qty_ordered > 0 ? ((cumulative - r.qty_ordered) / r.qty_ordered) * 100 : 0
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function DocsManager({
  initial = null,
  initialKind = null,
  docs,
  total,
  page,
  kindCounts,
  materials,
  pos,
  lsxs,
  canEdit,
}: {
  /** Deep-link từ màn nghiệp vụ: mở sẵn form + chọn sẵn đơn/đợt/lệnh. */
  initial?: {
    form: 'receipt' | 'issue' | 'return'
    poId: string | null
    shipmentId: string | null
    lsxId: string | null
  } | null
  /** Lọc loại phiếu — SERVER lọc (?kind=), select chỉ đẩy URL. */
  initialKind?: DocKind | null
  docs: Doc[]
  /** Tổng phiếu KHỚP BỘ LỌC hiện tại (server đếm) — nuôi phân trang. */
  total: number
  page: number
  /** Đếm toàn sổ theo loại — stats không còn bị trần trang che. */
  kindCounts: { total: number; receipt: number; issue: number }
  materials: MaterialOption[]
  pos: PoOption[]
  lsxs: LsxOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [navigating, startTransition] = useTransition()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [openReceipt, setOpenReceipt] = useState(canEdit && initial?.form === 'receipt')
  const [openIssue, setOpenIssue] = useState(canEdit && initial?.form === 'issue')
  const [openReturn, setOpenReturn] = useState(canEdit && initial?.form === 'return')
  const [viewing, setViewing] = useState<{
    doc: Doc
    lines: DocLine[]
    stocktakeLines: StocktakeLine[]
    /** K1: phiếu đảo của phiếu đang xem — null = chưa bị đảo. */
    reversedBy: { id: string; code: string } | null
  } | null>(null)

  const [q, setQ] = useState('')

  /** Đẩy kind/page xuống URL → server lọc + phân trang lại. */
  function pushFilter(patch: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === 'all') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in patch)) next.delete('page') // đổi lọc → về trang 1
    const qs = next.toString()
    startTransition(() => router.replace(qs ? `?${qs}` : '?'))
  }

  // Ô tìm chỉ lọc TRANG đang xem (số phiếu/người giao) — sổ dài thì lật trang.
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return docs.filter(
      (d) => !ql || `${d.code} ${d.counterparty ?? ''}`.toLowerCase().includes(ql),
    )
  }, [docs, q])

  const stats = kindCounts

  async function openView(doc: Doc) {
    setBusy(true)
    try {
      const data = await api<{
        lines: DocLine[]
        stocktake_lines?: StocktakeLine[]
        reversed_by?: { id: string; code: string } | null
      }>(`/api/dept/warehouse/docs/${doc.id}`)
      setViewing({
        doc,
        lines: data.lines,
        stocktakeLines: data.stocktake_lines ?? [],
        reversedBy: data.reversed_by ?? null,
      })
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
      cell: (d) => (
        <span className="inline-flex items-center gap-1">
          <Badge tone={kindTone(d)}>{kindLabel(d)}</Badge>
          {/* Vòng duyệt kiểm kê (0157) — posted là mặc định, không cần nhãn. */}
          {d.status === 'pending' && <Badge tone="amber">Chờ duyệt</Badge>}
          {d.status === 'rejected' && <Badge tone="red">Từ chối</Badge>}
        </span>
      ),
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
              <button onClick={() => setOpenReturn(true)} className={btnSecondary}>
                ↩ Trả NCC
              </button>
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
          { label: 'Tổng phiếu', value: stats.total, tone: 'default' },
          { label: 'Phiếu nhập', value: stats.receipt, tone: 'green' },
          { label: 'Phiếu xuất', value: stats.issue, tone: 'amber' },
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
                value={initialKind ?? 'all'}
                onChange={(v) => pushFilter({ kind: v })}
                options={[
                  { value: 'all' as const, label: 'Mọi loại' },
                  { value: 'receipt' as const, label: 'Phiếu nhập' },
                  { value: 'issue' as const, label: 'Phiếu xuất' },
                  // 0157: dashboard deep-link ?kind=stocktake — thiếu option thì
                  // select hiện "Mọi loại" trong khi bảng đang lọc Kiểm kê.
                  { value: 'stocktake' as const, label: 'Kiểm kê' },
                ]}
              />
            </>
          }
          right={
            busy || navigating ? (
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

        {/* Phân trang server (50 phiếu/trang) — sổ vượt trang đầu là bản cũ cắt đuôi im lặng. */}
        {total > 50 && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
            <span>
              {((page - 1) * 50 + 1).toLocaleString('vi-VN')}–
              {Math.min(page * 50, total).toLocaleString('vi-VN')} trên{' '}
              <b className="text-zinc-700 dark:text-zinc-200">
                {total.toLocaleString('vi-VN')}
              </b>{' '}
              phiếu
            </span>
            <span className="flex items-center gap-2">
              {navigating && <Spinner size={12} />}
              <button
                disabled={page <= 1 || navigating}
                onClick={() => pushFilter({ page: String(page - 1) })}
                className="rounded border border-zinc-300 px-2 py-0.5 disabled:opacity-40 dark:border-zinc-700"
              >
                ← Trước
              </button>
              <span>
                trang {page} / {Math.max(1, Math.ceil(total / 50))}
              </span>
              <button
                disabled={page * 50 >= total || navigating}
                onClick={() => pushFilter({ page: String(page + 1) })}
                className="rounded border border-zinc-300 px-2 py-0.5 disabled:opacity-40 dark:border-zinc-700"
              >
                Sau →
              </button>
            </span>
          </div>
        )}
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
            lsxs={lsxs}
            initialPoId={initial?.form === 'receipt' ? initial.poId : null}
            initialShipmentId={initial?.form === 'receipt' ? initial.shipmentId : null}
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
            initialLsxId={initial?.form === 'issue' ? initial.lsxId : null}
            onDone={(code) => {
              setOpenIssue(false)
              toast.success(`Đã lập ${code}`)
              router.refresh()
            }}
          />
        )}
      </Modal>

      {/* Trả hàng NCC (⑤, 0080) */}
      <Modal
        open={openReturn}
        onClose={() => setOpenReturn(false)}
        title="Trả hàng NCC (phiếu xuất trả)"
        maxWidth="sm:max-w-4xl"
      >
        {openReturn && (
          <ReturnForm
            onDone={(code, poStatus) => {
              setOpenReturn(false)
              toast.success(
                `Đã lập ${code}`,
                poStatus === 'partial'
                  ? 'PO quay lại "Về một phần" — chờ NCC giao bù'
                  : undefined,
              )
              router.refresh()
            }}
          />
        )}
      </Modal>

      {/* Chi tiết phiếu */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.doc.code} — ${kindLabel(viewing.doc)}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {viewing && (
          <DocDetail
            doc={viewing.doc}
            lines={viewing.lines}
            stocktakeLines={viewing.stocktakeLines}
            reversedBy={viewing.reversedBy}
            canEdit={canEdit}
            busy={busy}
            onReverse={async (reason) => {
              setBusy(true)
              try {
                const out = await api<{ code: string }>(
                  `/api/dept/warehouse/docs/${viewing.doc.id}/reverse`,
                  { method: 'POST', body: { reason } },
                )
                setViewing(null)
                router.refresh()
                toast.success(
                  `Đã lập phiếu đảo ${out.code}`,
                  `${viewing.doc.code} coi như chưa ghi — tồn và đối chiếu đã lùi theo`,
                )
              } catch (e) {
                toast.error(
                  'Không đảo được phiếu',
                  e instanceof ApiError ? e.message : 'Có lỗi',
                )
              } finally {
                setBusy(false)
              }
            }}
            onDecide={async (decision, reason) => {
              setBusy(true)
              try {
                await api(`/api/dept/warehouse/docs/${viewing.doc.id}/stocktake-decide`, {
                  method: 'POST',
                  body: { decision, reason },
                })
                setViewing(null)
                router.refresh()
                toast.success(
                  decision === 'approve'
                    ? 'Đã duyệt — chênh lệch áp vào tồn'
                    : 'Đã từ chối biên bản',
                  viewing.doc.code,
                )
              } catch (e) {
                toast.error(
                  'Không xử lý được biên bản',
                  e instanceof ApiError ? e.message : 'Có lỗi',
                )
              } finally {
                setBusy(false)
              }
            }}
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
  lsxs,
  initialPoId = null,
  initialShipmentId = null,
  onDone,
}: {
  materials: MaterialOption[]
  pos: PoOption[]
  /** LSX cho HOÀN KHO (K2) — xưởng trả vật tư thừa về. */
  lsxs: LsxOption[]
  /** Deep-link: chọn sẵn đơn (+ đợt) khi mở từ màn "Nhập kho · Chờ nhận". */
  initialPoId?: string | null
  initialShipmentId?: string | null
  onDone: (code: string, poStatus: string | null) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [poId, setPoId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  /** Đợt giao của PO đang chọn (0153) — chỉ đợt còn nhận được (planned/arrived). */
  const [shipments, setShipments] = useState<ReceiptShipment[]>([])
  const [shipmentId, setShipmentId] = useState('')
  const [poLines, setPoLines] = useState<PoLine[]>([])
  /** HOÀN KHO từ LSX (K2): xưởng lĩnh không hết trả về — nguồn thứ ba của PNK. */
  const [returnLsxId, setReturnLsxId] = useState('')
  const isLsxReturn = returnLsxId !== ''

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  /** Dựng dòng phiếu: theo ĐỢT (SL = NCC hứa chở hôm nay) hoặc cả đơn (= còn thiếu). */
  function buildRows(lines: PoLine[], shipment: ReceiptShipment | null) {
    const shipQtyByLine = new Map(
      (shipment?.lines ?? []).map((l) => [l.po_line_id, l.qty]),
    )
    // qty_open (0154): dòng Cung ứng đã CHỐT THIẾU không gợi nhận nữa — NCC vẫn
    // chở tới thật thì Kho thêm dòng tay (nút "+ vật tư"), sổ vẫn ghi được.
    return lines
      .filter((l) => (shipment ? shipQtyByLine.has(l.id) : l.qty_open > 0))
      .map((l) => {
        // Theo đợt: prefill = SL của đợt nhưng không quá phần đơn còn chờ về
        // (đợt trước đã nhận dư phần nào thì không prefill quá — allow_over
        // vẫn là đường thoát khi NCC thật sự giao vượt).
        const shipQty = shipQtyByLine.get(l.id)
        const qty = shipment ? Math.min(shipQty ?? 0, Math.max(l.qty_open, 0)) : l.qty_open
        return {
          material_id: l.material_id,
          qty,
          qty_rejected: '' as const,
          qc_status: '' as const,
          po_line_id: l.id,
          qty_missing: l.qty_missing,
          qty_ordered: l.qty_ordered,
          over_tolerance_pct: l.over_tolerance_pct,
          ship_qty: shipQty ?? null,
          material_code: l.material_code,
          material_name: l.material_name,
          material_unit: l.material_unit,
          shelf_location: materialById.get(l.material_id)?.shelf_location ?? '',
          note: '',
        }
      })
  }

  async function selectPo(id: string, preferShipmentId?: string | null) {
    setPoId(id)
    setShipmentId('')
    setShipments([])
    if (!id) {
      setRows([])
      setPoLines([])
      return
    }
    try {
      const [{ lines }, ships] = await Promise.all([
        api<{ lines: PoLine[] }>(`/api/dept/warehouse/po-open?po_id=${id}`),
        api<{ shipments: ReceiptShipment[] }>(`/api/dept/supply/pos/${id}/shipments`)
          .then((r) => r.shipments.filter((s) => s.status === 'planned' || s.status === 'arrived'))
          // Đơn cũ chưa có đợt / lỗi mạng phụ: form vẫn chạy kiểu cả đơn.
          .catch(() => [] as ReceiptShipment[]),
      ])
      setPoLines(lines)
      setShipments(ships)
      // Deep-link chỉ định đợt thì tôn trọng; không thì chọn đợt gần ngày nhất.
      const first = ships.find((s) => s.id === preferShipmentId) ?? ships[0] ?? null
      setShipmentId(first?.id ?? '')
      setRows(buildRows(lines, first))
    } catch (e) {
      toast.error('Không tải được dòng PO', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  // Deep-link từ màn "Nhập kho · Chờ nhận" — nạp sẵn đơn/đợt đúng một lần lúc mở.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp 1 lần theo deep-link
    if (initialPoId) void selectPo(initialPoId, initialShipmentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy một lần theo deep-link
  }, [])

  function selectShipment(id: string) {
    setShipmentId(id)
    setRows(buildRows(poLines, shipments.find((s) => s.id === id) ?? null))
  }

  /** Chọn LSX hoàn kho (K2): prefill danh sách ĐÃ CẤP còn lại — SL trả gõ tay. */
  async function selectReturnLsx(id: string) {
    setReturnLsxId(id)
    setPoId('')
    setShipments([])
    setShipmentId('')
    setPoLines([])
    if (!id) {
      setRows([])
      return
    }
    try {
      const { items } = await api<{
        items: {
          material_id: string
          code: string
          name: string
          unit: string
          issued: number
        }[]
      }>(`/api/dept/warehouse/lsx-issued?production_order_id=${id}`)
      setRows(
        items.map((it) => ({
          material_id: it.material_id,
          qty: '' as const, // SL TRẢ người kiểm gõ — không prefill (trả hết là ca hiếm)
          qty_rejected: '' as const,
          qc_status: '' as const,
          po_line_id: null,
          qty_missing: it.issued, // cột hiện "Đã cấp (tối đa trả)"
          qty_ordered: null,
          over_tolerance_pct: null,
          ship_qty: null,
          material_code: it.code,
          material_name: it.name,
          material_unit: it.unit,
          shelf_location: materialById.get(it.material_id)?.shelf_location ?? '',
          note: '',
        })),
      )
      if (items.length === 0) {
        toast.error('LSX chưa lĩnh vật tư nào', 'Không có gì để hoàn kho')
      }
    } catch (e) {
      toast.error(
        'Không tải được vật tư đã cấp',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
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
        qty_missing: null,
        qty_ordered: null,
        over_tolerance_pct: null,
        ship_qty: null,
        material_code: m?.code ?? null,
        material_name: m?.name ?? null,
        material_unit: m?.unit ?? null,
        shelf_location: m?.shelf_location ?? '',
        note: '',
      },
    ])
  }

  const invalid =
    rows.length === 0 || rows.some((r) => !r.material_id || r.qty === '' || Number(r.qty) <= 0)

  /**
   * Nhận vượt số còn thiếu → server trả 409 OVER_RECEIPT. Không chặn cứng: NCC
   * giao dư vài cây là chuyện có thật — hiện cảnh báo, bắt nhập lý do rồi gửi
   * lại kèm cờ. Cùng lối với RESERVED_CONFLICT của phiếu xuất.
   */
  const [conflict, setConflict] = useState<{
    message: string
    body: Record<string, unknown>
  } | null>(null)
  const [overReason, setOverReason] = useState('')

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const result = await api<{ code: string; po_status: string | null }>(
        '/api/dept/warehouse/docs/receipt',
        { method: 'POST', body },
      )
      setConflict(null)
      onDone(result.code, result.po_status)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OVER_RECEIPT') {
        setConflict({ message: err.message, body })
        return
      }
      toast.error('Lập phiếu thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const shipment = shipments.find((s) => s.id === shipmentId) ?? null
    await post({
      po_id: poId || null,
      shipment_id: shipmentId || null,
      // Hoàn kho (K2) — loại trừ với po_id (server enforce lại).
      production_order_id: returnLsxId.trim() || null,
      counterparty: String(fd.get('counterparty') ?? '').trim() || null,
      // K3: số phiếu NCC + ngày chứng từ (lùi ≤7 ngày, schema chặn).
      supplier_doc_no: String(fd.get('supplier_doc_no') ?? '').trim() || null,
      doc_date: String(fd.get('doc_date') ?? '') || null,
      note: String(fd.get('note') ?? '').trim() || null,
      lines: rows.map((r) => {
        /*
         * CHÊNH SO ĐỢT (0153) tự ghi vào ghi chú dòng: thực nhận (đạt + loại)
         * ít hơn NCC hứa chở đợt này → "[Thiếu 20 so đợt 1]". Người nhận khỏi
         * gõ tay, và Cung ứng đọc phiếu là biết ngay phải đòi NCC bao nhiêu.
         */
        const received =
          (r.qty === '' ? 0 : Number(r.qty)) +
          (r.qty_rejected === '' ? 0 : Number(r.qty_rejected))
        const short =
          shipment && r.ship_qty != null && received < r.ship_qty - 1e-4
            ? `[Thiếu ${(r.ship_qty - received).toLocaleString('vi-VN')} so đợt ${shipment.seq}]`
            : ''
        const note = [short, r.note.trim()].filter(Boolean).join(' ')
        return {
          material_id: r.material_id,
          qty: Number(r.qty),
          // Hoàn kho không có QC loại (server chặn) — ép 0 cho chắc tay.
          qty_rejected: isLsxReturn || r.qty_rejected === '' ? 0 : Number(r.qty_rejected),
          qc_status: isLsxReturn ? undefined : r.qc_status || undefined,
          po_line_id: r.po_line_id,
          shelf_location: r.shelf_location.trim() || null,
          note: note || null,
        }
      }),
    })
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      {conflict && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
            ⚠ Nhận vượt số còn thiếu của đơn đặt
          </div>
          <div className="mt-1 text-xs text-amber-700 dark:text-amber-300/90">
            {conflict.message}
          </div>
          <label className="mt-2 flex flex-col gap-1 text-xs">
            Lý do vẫn nhập <span className="text-red-500">*</span>
            <input
              value={overReason}
              onChange={(e) => setOverReason(e.target.value)}
              maxLength={500}
              placeholder="VD: NCC giao dư theo thoả thuận bù hao"
              className={inputCls}
            />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConflict(null)
                setOverReason('')
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sửa lại số lượng
            </button>
            <button
              type="button"
              disabled={busy || !overReason.trim()}
              onClick={() =>
                void post({
                  ...conflict.body,
                  allow_over: true,
                  over_reason: overReason.trim(),
                })
              }
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}Vẫn nhập
            </button>
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Nguồn nhập
          <select
            value={isLsxReturn ? '__lsx__' : poId}
            onChange={(e) => {
              const v = e.target.value
              if (v === '__lsx__') {
                // Hoàn kho (K2): bật khối chọn LSX bên dưới, tắt đường PO.
                // ' ' = đã chọn chế độ nhưng chưa chọn lệnh (trim khi dùng).
                setPoId('')
                setShipments([])
                setShipmentId('')
                setPoLines([])
                setRows([])
                setReturnLsxId(' ')
                return
              }
              setReturnLsxId('')
              void selectPo(v)
            }}
            className={inputCls}
          >
            <option value="">Mua ngoài (không theo đơn đặt)</option>
            <option value="__lsx__">↩ Hoàn kho từ LSX (xưởng trả vật tư thừa)</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.supplier_name} ({p.lsx_code ? `LSX ${p.lsx_code}` : 'ngoài LSX'})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {isLsxReturn ? 'Người trả hàng (tổ/xưởng)' : 'Người giao hàng'}
          <input name="counterparty" maxLength={200} className={inputCls} />
        </label>
      </div>

      {/* HOÀN KHO (K2): chọn lệnh — bảng prefill vật tư ĐÃ CẤP, SL trả gõ tay. */}
      {isLsxReturn && (
        <label className="flex flex-col gap-1 text-sm">
          Lệnh sản xuất trả vật tư
          <select
            value={returnLsxId.trim()}
            onChange={(e) => void selectReturnLsx(e.target.value)}
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
      )}

      {/* K3: số chứng từ NCC + ngày chứng từ — chìa khoá đối chiếu 3 chiều. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {!isLsxReturn && (
          <label className="flex flex-col gap-1 text-sm">
            Số phiếu giao / hoá đơn NCC
            <input
              name="supplier_doc_no"
              maxLength={60}
              placeholder="số trên phiếu NCC đưa kèm xe hàng"
              className={inputCls}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Ngày chứng từ
          <input
            name="doc_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputCls}
          />
          <span className="text-[11px] text-zinc-400">
            Hàng về hôm trước nhập máy hôm sau thì lùi ngày — tối đa 7 ngày.
          </span>
        </label>
      </div>

      {/* ĐỢT GIAO (0153) — chỉ hiện khi PO có đợt còn nhận được. Chọn đợt thì
          dòng phiếu prefill đúng số NCC hứa chở hôm nay thay vì cả phần thiếu. */}
      {poId && shipments.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          Đợt giao
          <select
            value={shipmentId}
            onChange={(e) => selectShipment(e.target.value)}
            className={inputCls}
          >
            <option value="">Không theo đợt (nhận theo phần còn thiếu cả đơn)</option>
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                Đợt {s.seq} — hẹn{' '}
                {new Date(s.expected_date).toLocaleDateString('vi-VN')} · {s.lines.length}{' '}
                dòng{s.status === 'arrived' ? ' · xe đã tới' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {!poId && !isLsxReturn && <ScanInput materials={materials} onHit={(m) => addRow(m)} />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              {shipmentId && <th className="w-24 py-2 pr-2 text-right">NCC giao đợt này</th>}
              {poId && <th className="w-24 py-2 pr-2 text-right">Còn thiếu</th>}
              {isLsxReturn && (
                <th className="w-28 py-2 pr-2 text-right">Đã cấp (tối đa trả)</th>
              )}
              <th className="w-24 py-2 pr-2">{isLsxReturn ? 'SL trả về' : 'Thực nhập (đạt)'}</th>
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
                <td colSpan={shipmentId ? 9 : 8} className="py-6 text-center text-zinc-400">
                  {poId
                    ? 'PO này không còn dòng thiếu.'
                    : isLsxReturn
                      ? 'Chọn LSX ở trên — bảng tự nạp vật tư đã cấp.'
                      : 'Quét mã hoặc thêm dòng vật tư.'}
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const mat = materialById.get(r.material_id)
              // Dòng theo PO/đợt tự mang tên — danh mục (nạp 1.000/13k) chỉ là fallback.
              const code = r.material_code ?? mat?.code ?? ''
              const name = r.material_name ?? mat?.name ?? '?'
              const unit = r.material_unit ?? mat?.unit ?? ''
              return (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    {r.po_line_id ? (
                      <span>
                        <span className="font-mono text-xs text-zinc-400">{code}</span>{' '}
                        {name}
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
                                    material_code: m?.code ?? null,
                                    material_name: m?.name ?? null,
                                    material_unit: m?.unit ?? null,
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
                  {shipmentId && (
                    <td className="py-1.5 pr-2 text-right font-medium tabular-nums">
                      {r.ship_qty != null
                        ? `${r.ship_qty.toLocaleString('vi-VN')} ${unit}`
                        : '—'}
                    </td>
                  )}
                  {(poId || isLsxReturn) && (
                    <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-500">
                      {r.qty_missing != null
                        ? `${r.qty_missing.toLocaleString('vi-VN')} ${unit}`
                        : ''}
                      {/* Dung sai (0156): vượt còn-thiếu nhưng trong ngưỡng —
                          báo trước là sẽ được nhận, khỏi bất ngờ 409. */}
                      {(() => {
                        const tol = withinTolerancePct(r)
                        return tol != null ? (
                          <span className="mt-0.5 block rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            vượt {tol.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                            % — trong dung sai
                          </span>
                        ) : null
                      })()}
                      {/* Hoàn kho (K2): trả nhiều hơn đã lĩnh là nhầm nguồn — server chặn. */}
                      {isLsxReturn &&
                        r.qty !== '' &&
                        r.qty_missing != null &&
                        Number(r.qty) > r.qty_missing + 1e-6 && (
                          <span className="mt-0.5 block rounded bg-red-50 px-1 py-0.5 text-[10px] text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            vượt phần đã cấp — sẽ bị chặn
                          </span>
                        )}
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
  initialLsxId = null,
  onDone,
}: {
  materials: MaterialOption[]
  lsxs: LsxOption[]
  /** Deep-link: chọn sẵn lệnh khi mở từ màn "Cấp vật tư SX". */
  initialLsxId?: string | null
  onDone: (code: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'daily' | 'lsx'>(initialLsxId ? 'lsx' : 'daily')
  const [lsxId, setLsxId] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  // Deep-link từ màn "Cấp vật tư SX" — nạp nhu cầu lệnh đúng một lần lúc mở.
  useEffect(() => {
     
    if (initialLsxId) void selectLsx(initialLsxId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy một lần theo deep-link
  }, [])

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
            // K5: nhớ "còn phải cấp" để cảnh báo khi người gõ vượt (không chặn).
            qty_missing: n.qty_remaining,
            qty_ordered: null,
            over_tolerance_pct: null,
            ship_qty: null,
            material_code: n.material_code,
            material_name: n.material_name,
            material_unit: n.unit,
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
        qty_missing: null,
        qty_ordered: null,
        over_tolerance_pct: null,
        ship_qty: null,
        material_code: m?.code ?? null,
        material_name: m?.name ?? null,
        material_unit: m?.unit ?? null,
        shelf_location: m?.shelf_location ?? '',
        note: '',
      },
    ])
  }

  const invalid =
    rows.length === 0 ||
    rows.some((r) => !r.material_id || r.qty === '' || Number(r.qty) <= 0) ||
    (kind === 'lsx' && !lsxId)

  // Xuất lấn phần đang GIỮ cho LSX khác → server trả 409 RESERVED_CONFLICT.
  // Không chặn cứng: hiện cảnh báo + bắt nhập lý do rồi gửi lại kèm cờ override.
  const [conflict, setConflict] = useState<{
    message: string
    body: Record<string, unknown>
  } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const result = await api<{ code: string }>('/api/dept/warehouse/docs/issue', {
        method: 'POST',
        body,
      })
      setConflict(null)
      onDone(result.code)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESERVED_CONFLICT') {
        setConflict({ message: err.message, body })
        return
      }
      toast.error('Lập phiếu thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await post({
      kind,
      production_order_id: kind === 'lsx' ? lsxId : null,
      counterparty: String(fd.get('counterparty') ?? '').trim() || null,
      reason: String(fd.get('reason') ?? '').trim() || null,
      doc_date: String(fd.get('doc_date') ?? '') || null, // K3
      note: String(fd.get('note') ?? '').trim() || null,
      lines: rows.map((r) => ({
        material_id: r.material_id,
        qty: Number(r.qty),
        shelf_location: r.shelf_location.trim() || null,
        note: r.note.trim() || null,
      })),
    })
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      {conflict && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
            ⚠ Vượt tồn khả dụng — phần này đang giữ cho LSX khác
          </div>
          <div className="mt-1 text-xs text-amber-700 dark:text-amber-300/90">
            {conflict.message}
          </div>
          <label className="mt-2 flex flex-col gap-1 text-xs">
            Lý do vẫn xuất <span className="text-red-500">*</span>
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              maxLength={500}
              placeholder="VD: Giám đốc duyệt ưu tiên đơn A"
              className={inputCls}
            />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConflict(null)
                setOverrideReason('')
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sửa lại số lượng
            </button>
            <button
              type="button"
              disabled={busy || !overrideReason.trim()}
              onClick={() =>
                void post({
                  ...conflict.body,
                  override_reserved: true,
                  override_reason: overrideReason.trim(),
                })
              }
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}Vẫn xuất
            </button>
          </div>
        </div>
      )}
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
        {/* K3: ngày chứng từ — xuất chiều tối, sáng sau mới nhập máy. */}
        <label className="flex flex-col gap-1 text-sm">
          Ngày chứng từ
          <input
            name="doc_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputCls}
          />
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
                  {/* K5: vượt "còn phải cấp" của lệnh → cảnh báo vàng, không
                      chặn (bốc lố đỡ chạy kho là chuyện thật — nhưng phải thấy). */}
                  {kind === 'lsx' &&
                    r.qty_missing != null &&
                    r.qty !== '' &&
                    Number(r.qty) > r.qty_missing + 1e-6 && (
                      <span className="mt-0.5 block rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        vượt nhu cầu còn lại của lệnh (còn cần{' '}
                        {r.qty_missing.toLocaleString('vi-VN')})
                      </span>
                    )}
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

// ── Form trả hàng NCC (⑤, 0080) ─────────────────────────────────────────────

type ReturnablePo = { id: string; code: string; status: string; supplier_name: string }

/**
 * Phiếu XUẤT TRẢ NCC: chọn PO đã có hàng về (partial/received) → liệt kê dòng
 * đã về → nhập SL trả (≤ đã về) + lý do. Server ghi movement out gắn po_line_id
 * → view đối chiếu trừ "đã về" → PO có thể quay lại partial (NCC giao bù).
 */
function ReturnForm({
  onDone,
}: {
  onDone: (code: string, poStatus: string | null) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useState<ReturnablePo[] | null>(null)
  const [poId, setPoId] = useState('')
  const [lines, setLines] = useState<PoLine[]>([])
  const [qtys, setQtys] = useState<Record<string, number | ''>>({}) // key = po_line_id
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')

  useEffect(() => {
    let alive = true
    api<{ pos: ReturnablePo[] }>('/api/dept/warehouse/po-open?returnable=1')
      .then((r) => alive && setPos(r.pos))
      .catch(() => alive && setPos([]))
    return () => {
      alive = false
    }
  }, [])

  async function selectPo(id: string) {
    setPoId(id)
    setLines([])
    setQtys({})
    if (!id) return
    setBusy(true)
    try {
      const { lines } = await api<{ lines: PoLine[] }>(
        `/api/dept/warehouse/po-open?po_id=${id}`,
      )
      setLines(lines.filter((l) => l.qty_received > 0))
    } catch (e) {
      toast.error('Không tải được dòng PO', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const payload = lines
    .filter((l) => Number(qtys[l.id]) > 0)
    .map((l) => ({
      material_id: l.material_id,
      po_line_id: l.id,
      qty: Number(qtys[l.id]),
      note: (notes[l.id] ?? '').trim() || null,
    }))
  const overLine = lines.find((l) => Number(qtys[l.id] ?? 0) > l.qty_received)
  const invalid = !poId || !reason.trim() || payload.length === 0 || !!overLine

  async function submit() {
    if (invalid || busy) return
    setBusy(true)
    try {
      const r = await api<{ code: string; po_status: string | null }>(
        '/api/dept/warehouse/docs/return',
        {
          method: 'POST',
          body: { po_id: poId, reason: reason.trim(), lines: payload },
        },
      )
      onDone(r.code, r.po_status)
    } catch (e) {
      toast.error('Lập phiếu trả thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Đơn đặt (PO) đã có hàng về <span className="text-red-500">*</span>
          <select
            value={poId}
            onChange={(e) => void selectPo(e.target.value)}
            className={inputCls}
          >
            <option value="">
              {pos === null ? 'Đang tải…' : '— chọn PO cần trả hàng —'}
            </option>
            {(pos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.supplier_name} (
                {p.status === 'received' ? 'về đủ' : 'về một phần'})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Lý do trả <span className="text-red-500">*</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Hàng lỗi sơn, sai quy cách…"
            className={inputCls}
          />
        </label>
      </div>

      {poId && lines.length === 0 && !busy && (
        <p className="py-4 text-center text-xs text-zinc-400">
          PO này chưa có dòng nào đã về (hoặc đã trả hết).
        </p>
      )}
      {lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Vật tư</th>
                <th className="w-24 py-2 pr-2 text-right">Đã về</th>
                <th className="w-28 py-2 pr-2">SL trả</th>
                <th className="py-2 pr-2">Ghi chú dòng</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const over = Number(qtys[l.id] ?? 0) > l.qty_received
                return (
                  <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-1.5 pr-2">
                      <span className="font-mono text-xs text-zinc-400">
                        {l.material_code}
                      </span>{' '}
                      {l.material_name}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {l.qty_received} {l.material_unit}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min={0}
                        max={l.qty_received}
                        step="0.01"
                        value={qtys[l.id] ?? ''}
                        onChange={(e) =>
                          setQtys((m) => ({
                            ...m,
                            [l.id]: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                        className={`${inputCls} tabular-nums ${over ? 'border-red-500' : ''}`}
                        aria-label={`SL trả ${l.material_name}`}
                      />
                      {over && (
                        <span className="text-[10px] text-red-600">vượt số đã về</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={notes[l.id] ?? ''}
                        maxLength={500}
                        onChange={(e) =>
                          setNotes((m) => ({ ...m, [l.id]: e.target.value }))
                        }
                        className={inputCls}
                        aria-label={`Ghi chú ${l.material_name}`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-400">
        Phiếu trả = phiếu xuất 02-VT, trừ tồn ngay; số &quot;đã về&quot; của dòng PO giảm
        tương ứng — PO về đủ sẽ quay lại &quot;Về một phần&quot; chờ NCC giao bù.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy || invalid}
          onClick={() => void submit()}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}↩ Lập phiếu trả NCC
        </button>
      </div>
    </div>
  )
}

// ── Chi tiết phiếu ──────────────────────────────────────────────────────────

function DocDetail({
  doc,
  lines,
  stocktakeLines = [],
  reversedBy = null,
  canEdit = false,
  busy = false,
  onDecide,
  onReverse,
}: {
  doc: Doc
  lines: DocLine[]
  stocktakeLines?: StocktakeLine[]
  /** K1: phiếu đảo của phiếu này — null = chưa bị đảo (nút đảo còn hiện). */
  reversedBy?: { id: string; code: string } | null
  /** Vòng duyệt kiểm kê (0157) — nút duyệt/từ chối; server chặn tự duyệt. */
  canEdit?: boolean
  busy?: boolean
  onDecide?: (decision: 'approve' | 'reject', reason?: string) => void
  /** K1: lập phiếu đảo — reason bắt buộc. */
  onReverse?: (reason: string) => void
}) {
  // Lý do từ chối (0157) — ô chỉ mở khi bấm "Từ chối".
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  // Lý do ĐẢO PHIẾU (K1) — ô chỉ mở khi bấm "Lập phiếu đảo…".
  const [reversing, setReversing] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  // Phiếu KK: hiển thị BIÊN BẢN đầy đủ (mọi dòng đếm) thay vì movements (chỉ dòng lệch).
  if (doc.kind === 'stocktake') {
    const pending = doc.status === 'pending'
    return (
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Badge tone={KIND_TONE[doc.kind]}>{KIND_LABEL[doc.kind]}</Badge>
          {doc.status === 'pending' && <Badge tone="amber">Chờ duyệt — tồn CHƯA đổi</Badge>}
          {doc.status === 'rejected' && <Badge tone="red">Từ chối</Badge>}
          {doc.status === 'posted' && <Badge tone="green">Đã áp sổ</Badge>}
          <span>Ngày: {new Date(doc.created_at).toLocaleString('vi-VN')}</span>
          {doc.created_by_name && <span>· Người lập: {doc.created_by_name}</span>}
          {doc.approved_by_name && (
            <span>
              · {doc.status === 'rejected' ? 'Từ chối bởi' : 'Duyệt bởi'}:{' '}
              {doc.approved_by_name}
            </span>
          )}
          {doc.reason && <span>· Lý do: {doc.reason}</span>}
        </div>
        {doc.reject_reason && (
          <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
            Lý do từ chối: {doc.reject_reason}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Vật tư</th>
                <th className="w-24 py-2 pr-2 text-right">Tồn lúc đếm</th>
                <th className="w-24 py-2 pr-2 text-right">Đếm thực tế</th>
                <th className="w-24 py-2 pr-2 text-right">Chênh lệch</th>
                {pending && <th className="w-24 py-2 pr-2 text-right">Tồn hiện tại</th>}
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
                  {pending && (
                    <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-500">
                      {l.current_qty != null ? (
                        <>
                          {l.current_qty.toLocaleString('vi-VN')}
                          {/* Tồn trôi so với lúc đếm — nhắc người duyệt: chênh áp
                              theo số NÀY, không phải cột Tồn lúc đếm. */}
                          {l.current_qty !== l.system_qty && (
                            <span className="ml-1 text-[10px] text-amber-600">≠</span>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td className="py-1.5 text-zinc-500">{l.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pending ? (
          <>
            <p className="text-xs text-zinc-400">
              Biên bản CHƯA áp sổ. Duyệt sẽ áp <b>số đếm</b> làm sự thật: chênh lệch
              tính theo <b>tồn hiện tại</b> lúc duyệt (phiếu nhập/xuất chen giữa vẫn
              được tôn trọng). Người lập không tự duyệt được.
            </p>
            {canEdit && onDecide && (
              <div className="flex flex-col gap-2">
                {rejecting && (
                  <textarea
                    rows={2}
                    maxLength={1000}
                    autoFocus
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Lý do từ chối (bắt buộc) — đếm sai khu? thiếu chữ ký đối chứng?…"
                    className={inputCls}
                  />
                )}
                <div className="flex justify-end gap-2">
                  {rejecting ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejecting(false)}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        disabled={busy || !rejectReason.trim()}
                        onClick={() => onDecide('reject', rejectReason.trim())}
                        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {busy && <Spinner size={14} />} Từ chối biên bản
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRejecting(true)}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                      >
                        Từ chối…
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDecide('approve')}
                        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {busy && <Spinner size={14} />} Duyệt — áp chênh lệch vào tồn
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        ) : doc.status === 'posted' ? (
          <p className="text-xs text-zinc-400">
            {stocktakeLines.filter((l) => l.diff !== 0).length} dòng lệch sổ đã sinh
            điều chỉnh tồn (ref &quot;adjust&quot;) — tồn sau kiểm = số đếm thực tế.
          </p>
        ) : (
          <p className="text-xs text-zinc-400">
            Biên bản bị từ chối — tồn không thay đổi. Đếm lại thì lập biên bản mới.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <Badge tone={kindTone(doc)}>{kindLabel(doc)}</Badge>
        {/* K1: quan hệ đảo hai chiều — đọc phiếu nào cũng thấy phiếu kia. */}
        {doc.reversal_of_code && (
          <Badge tone="red">Phiếu đảo của {doc.reversal_of_code}</Badge>
        )}
        {reversedBy && <Badge tone="red">ĐÃ BỊ ĐẢO bởi {reversedBy.code}</Badge>}
        <span>Ngày: {new Date(doc.doc_date ?? doc.created_at).toLocaleDateString('vi-VN')}</span>
        {doc.supplier_doc_no && (
          <span>
            · Số phiếu NCC: <b className="font-mono">{doc.supplier_doc_no}</b>
          </span>
        )}
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

      {/* K1: PHIẾU ĐẢO — ghi sai thì ghi ngược có vết, không sửa đè/xoá. */}
      {reversing && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-xs text-red-700 dark:text-red-300">
            Phiếu đảo ghi NGƯỢC toàn bộ dòng của {doc.code} — tồn và đối chiếu đơn
            đặt/lệnh SX tự lùi theo. Không sửa được phiếu gốc; sai tiếp thì lập phiếu
            thường.
          </p>
          <textarea
            rows={2}
            maxLength={500}
            autoFocus
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="Lý do đảo (bắt buộc) — gõ nhầm số lượng? chọn nhầm vật tư?…"
            className={`${inputCls} mt-2`}
          />
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        {canEdit &&
          onReverse &&
          !reversedBy &&
          !doc.reversal_of_doc_id &&
          doc.status === 'posted' &&
          (reversing ? (
            <>
              <button
                type="button"
                onClick={() => setReversing(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={busy || !reverseReason.trim()}
                onClick={() => onReverse(reverseReason.trim())}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />} Lập phiếu đảo
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setReversing(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
            >
              ↩ Phiếu ghi sai? Lập phiếu đảo…
            </button>
          ))}
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
