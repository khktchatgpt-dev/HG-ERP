'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { MaterialPicker } from '@/components/supply/MaterialPicker'
import { parseBkvt } from './bkvt-parse'

export type PlanRowView = {
  id: string
  product_code: string | null
  product_name: string | null
  material_id: string | null
  material_name: string
  material_code: string | null
  unit: string | null
  qty_per_product: number | null
  product_qty: number | null
  qty_required: number
  waste_pct: number
  qty_on_hand: number | null
  qty_to_order: number
  unit_price: number | null
  supplier_id: string | null
  supplier_name: string | null
  supplier_label: string | null
  status: string
  po_line_id: string | null
  note: string | null
}

export type SupplierOption = { id: string; code: string | null; name: string }

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chưa quyết',
  assigned: 'Đã gán NCC',
  self_make: 'Xưởng tự làm',
  enough: 'Tồn đủ',
  other: 'Mua ngoài',
  ordered: 'Đã vào đơn',
}

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  self_make: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  enough: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  other: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  ordered: 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
}

const n = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('vi-VN').format(v)

/**
 * BẢNG KÊ VẬT TƯ CỦA LỆNH → TÁCH ĐƠN THEO NCC.
 *
 * Đúng nếp phòng Cung ứng đang làm trên Excel: một bảng cho cả lệnh (nhiều SP,
 * mỗi dòng mang mã SP + đm/sp), gán NCC trên từng dòng, rồi lọc theo cột đó ra
 * 7–8 đơn. Nút "Tách đơn" làm nốt bước cuối trong một lần bấm.
 */
export function BkvtManager({
  lsxId,
  lsxCode,
  rows,
  suppliers,
}: {
  lsxId: string
  lsxCode: string
  rows: PlanRowView[]
  suppliers: SupplierOption[]
}) {
  const router = useRouter()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  /*
   * `router.refresh()` KHÔNG chờ được: gọi xong là trả về ngay, còn bảng mới thì
   * server phải truy vấn lại rồi mới về. UAT 01/08 bấm "Tách đơn" thấy spinner
   * tắt mà bảng vẫn nguyên trạng thái cũ → tưởng nút hỏng, đi tải lại trang tay.
   * Bọc trong transition thì `refreshing` giữ true tới lúc dữ liệu mới hiện lên.
   */
  const [refreshing, startTransition] = useTransition()
  const busy = saving || refreshing
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<PlanRowView[]>([])
  const [bulkSupplier, setBulkSupplier] = useState('')
  /** Dòng đang mở ô chọn vật tư (chỉ mở một dòng để bảng khỏi loạn). */
  const [pickingId, setPickingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (!key) return true
      return [r.material_name, r.product_code, r.product_name, r.supplier_name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(key))
    })
  }, [rows, q, status])

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length
    const noMaterial = rows.filter((r) => !r.material_id).length
    return [
      { label: 'Dòng', value: rows.length },
      { label: 'Chưa quyết', value: by('pending'), tone: 'amber' as const },
      { label: 'Đã gán NCC', value: by('assigned'), tone: 'blue' as const },
      { label: 'Đã vào đơn', value: by('ordered'), tone: 'green' as const },
      { label: 'Không mua', value: by('self_make') + by('enough') + by('other') },
      {
        label: 'Chưa khớp kho',
        value: noMaterial,
        tone: noMaterial ? ('red' as const) : ('gray' as const),
        hint: 'Dòng không khớp danh mục vật tư thì chưa tách đơn được',
      },
    ]
  }, [rows])

  /** Số đơn sẽ tạo — hiện ngay trên nút để không bấm mù. */
  const readySuppliers = useMemo(() => {
    const m = new Set<string>()
    for (const r of rows) {
      if (
        r.status === 'assigned' &&
        r.supplier_id &&
        r.material_id &&
        r.qty_to_order > 0
      ) {
        m.add(r.supplier_id)
      }
    }
    return m
  }, [rows])

  async function assign(patch: Record<string, unknown>) {
    if (selected.length === 0) return
    setSaving(true)
    try {
      await api('/api/dept/supply/lsx-plan', {
        method: 'PATCH',
        body: { ids: selected.map((r) => r.id), ...patch },
      })
      setSelected([])
      setBulkSupplier('')
      startTransition(() => router.refresh())
      toast.success('Đã cập nhật', `${selected.length} dòng`)
    } catch (e) {
      toast.error('Không cập nhật được', apiErrorText(e))
    } finally {
      setSaving(false)
    }
  }

  /** Gán tay vật tư kho cho một dòng bảng kê chưa khớp. */
  async function assignMaterial(id: string, materialId: string) {
    setSaving(true)
    try {
      await api('/api/dept/supply/lsx-plan', {
        method: 'PATCH',
        body: { ids: [id], material_id: materialId },
      })
      setPickingId(null)
      startTransition(() => router.refresh())
      toast.success('Đã gán vật tư')
    } catch (e) {
      toast.error('Không gán được vật tư', apiErrorText(e))
    } finally {
      setSaving(false)
    }
  }

  async function split() {
    setSaving(true)
    try {
      const res = await api<{ created: { code: string; lines: number }[] }>(
        '/api/dept/supply/lsx-plan/split',
        { method: 'POST', body: { production_order_id: lsxId, currency: 'VND' } },
      )
      startTransition(() => router.refresh())
      toast.success(
        `Đã tạo ${res.created.length} đơn đặt`,
        res.created.map((c) => `${c.code} (${c.lines} dòng)`).join(' · '),
      )
    } catch (e) {
      toast.error('Không tách đơn được', apiErrorText(e))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Nạp từ chính file LSX của phòng: đọc sheet BKVT ngay trên máy người dùng rồi
   * gửi dòng lên server. Thư viện xlsx nạp động — trang không kéo theo nó khi
   * chỉ vào xem bảng.
   */
  async function onFile(file: File) {
    setSaving(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet =
        wb.SheetNames.find((s) => /^bkvt|bảng kê|bang ke/i.test(s.trim())) ??
        wb.SheetNames[0]
      const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheet], {
        header: 1,
        blankrows: false,
        defval: '',
        raw: false,
      })
      const parsed = parseBkvt(grid)
      if (parsed.length === 0) {
        toast.error(
          'Không đọc được dòng nào',
          `Sheet "${sheet}" không có cột "Tên vật tư"`,
        )
        return
      }
      const res = await api<{
        inserted: number
        matched_material: number
        matched_supplier: number
      }>('/api/dept/supply/lsx-plan', {
        method: 'POST',
        body: {
          production_order_id: lsxId,
          source: 'excel',
          replace: true,
          rows: parsed,
        },
      })
      startTransition(() => router.refresh())
      toast.success(
        `Đã nạp ${res.inserted} dòng từ sheet "${sheet}"`,
        `Khớp kho ${res.matched_material}/${res.inserted} · khớp NCC ${res.matched_supplier}/${res.inserted}`,
      )
    } catch (e) {
      toast.error('Nạp file thất bại', apiErrorText(e))
    } finally {
      setSaving(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const columns: Column<PlanRowView>[] = [
    {
      key: 'product',
      header: 'Sản phẩm',
      width: '170px',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{r.product_name ?? '—'}</div>
          <div className="truncate text-[11px] text-zinc-500">{r.product_code ?? ''}</div>
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Vật tư',
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-xs break-words">{r.material_name}</div>
          {r.material_code ? (
            <div className="truncate text-[11px] text-zinc-500">
              {r.material_code}
              {r.note ? ` · ${r.note}` : ''}
            </div>
          ) : (
            /*
             * Tên trong bảng kê nhiều khi mơ hồ thật ("Vít 4x15" có 7 biến thể
             * trong kho: 7 màu / xi trắng / ren gỗ / ĐBĐC…). Server chỉ tự gán
             * khi CHỈ CÓ MỘT ứng viên, còn lại để người mua chọn tại chỗ — không
             * phải bỏ màn này chạy sang danh mục kho rồi nạp lại file.
             */
            <div className="mt-1">
              {pickingId === r.id ? (
                <MaterialPicker
                  template="accessory"
                  usedIds={new Set()}
                  autoFocus
                  placeholder={`Chọn vật tư cho "${r.material_name}"…`}
                  onPick={(m) => void assignMaterial(r.id, m.id)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPickingId(r.id)}
                  className="rounded border border-red-300 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  chưa khớp kho — chọn vật tư
                </button>
              )}
              {r.note && <span className="ml-1 text-[11px] text-zinc-500">{r.note}</span>}
            </div>
          )}
        </div>
      ),
    },
    { key: 'unit', header: 'ĐVT', width: '60px', cell: (r) => r.unit ?? '—' },
    {
      key: 'dm',
      header: 'đm/sp',
      width: '70px',
      align: 'right',
      cell: (r) => n(r.qty_per_product),
    },
    {
      key: 'sl',
      header: 'SL SP',
      width: '70px',
      align: 'right',
      cell: (r) => n(r.product_qty),
    },
    {
      key: 'required',
      header: 'SL đặt',
      width: '80px',
      align: 'right',
      cell: (r) => n(r.qty_required),
    },
    {
      key: 'waste',
      header: 'Hao',
      width: '60px',
      align: 'right',
      cell: (r) => (r.waste_pct ? `${r.waste_pct}%` : '—'),
    },
    {
      key: 'order',
      header: 'Cần đặt',
      width: '85px',
      align: 'right',
      cell: (r) => <span className="font-medium">{n(r.qty_to_order)}</span>,
    },
    {
      key: 'supplier',
      header: 'Nhà cung cấp',
      width: '150px',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-xs">{r.supplier_name ?? '—'}</div>
          {r.supplier_label && (
            <div className="truncate text-[11px] text-zinc-500">
              trên file: {r.supplier_label}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      cell: (r) => (
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${STATUS_TONE[r.status] ?? ''}`}
        >
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: `LSX ${lsxCode}`, href: `/planning/lsx/${lsxId}` },
          { label: 'Bảng kê vật tư' },
        ]}
        title="Bảng kê vật tư"
        description="Gán nhà cung cấp cho từng dòng rồi tách thành đơn đặt — mỗi NCC một đơn."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Nạp từ file LSX
            </button>
            <button
              type="button"
              disabled={busy || readySuppliers.size === 0}
              onClick={() => void split()}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy && <Spinner />}
              Tách {readySuppliers.size} đơn theo NCC
            </button>
          </>
        }
      />

      <StatsBar stats={stats} />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm vật tư / sản phẩm / NCC"
                icon="🔎"
                className="w-64"
              />
              <ToolbarSelect
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: 'Mọi trạng thái' },
                  ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
            </>
          }
          right={
            selected.length > 0 ? (
              <>
                <span className="text-xs text-zinc-500">{selected.length} dòng chọn</span>
                <ToolbarSelect
                  value={bulkSupplier}
                  onChange={(v) => {
                    setBulkSupplier(v)
                    if (v) void assign({ supplier_id: v })
                  }}
                  options={[
                    { value: '', label: '— Gán NCC —' },
                    ...suppliers.map((s) => ({
                      value: s.id,
                      label: s.code ? `${s.code} · ${s.name}` : s.name,
                    })),
                  ]}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void assign({ status: 'self_make', supplier_id: null })}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Xưởng tự làm
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void assign({ status: 'enough', supplier_id: null })}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Tồn đủ, khỏi mua
                </button>
              </>
            ) : null
          }
        />
        <DataTable
          rows={filtered}
          columns={columns}
          storageKey="bkvt"
          selection={{ selected, onChange: setSelected, keyFn: (r) => r.id }}
          rowClassName={(r) => (r.status === 'ordered' ? 'opacity-60' : undefined)}
          emptyState={
            <EmptyState
              icon="📋"
              title={rows.length ? 'Không khớp bộ lọc' : 'Chưa có bảng kê'}
              description={
                rows.length
                  ? undefined
                  : 'Bấm "Nạp từ file LSX" và chọn file Excel của lệnh — sheet BKVT.'
              }
            />
          }
        />
      </div>
    </div>
  )
}
