'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { PricesPanel, type MaterialOption } from './PricesPanel'
import { SupplierForm } from './SupplierForm'

type Supplier = {
  id: string
  code: string | null
  name: string
  tax_no: string | null
  type: string | null
  status: string
  rating: string | null
  region: string | null
  can_order: boolean
  is_active: boolean
  po_count: number
  open_po_count: number
  last_po: string | null
  last_po_at: string | null
  total_spend: number
  groups: string[]
}

const money = (n: number) => n.toLocaleString('vi-VN')

const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'gray' }> = {
  active: { label: 'Hoạt động', tone: 'green' },
  suspended: { label: 'Tạm ngưng', tone: 'amber' },
  terminated: { label: 'Ngừng hợp tác', tone: 'gray' },
}
const GRADE_BG: Record<string, string> = {
  A: 'bg-green-600',
  B: 'bg-blue-600',
  C: 'bg-amber-500',
  D: 'bg-red-600',
}

function Grade({ r }: { r: string | null }) {
  if (!r)
    return (
      <span className="grid h-6 w-6 place-items-center rounded-md bg-zinc-200 text-xs font-bold text-zinc-400 dark:bg-zinc-800">
        —
      </span>
    )
  return (
    <span
      className={`grid h-6 w-6 place-items-center rounded-md text-xs font-bold text-white ${GRADE_BG[r] ?? 'bg-zinc-500'}`}
    >
      {r}
    </span>
  )
}

export function SuppliersManager({
  suppliers,
  materials,
  canEdit,
}: {
  suppliers: Supplier[]
  materials: MaterialOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [pricing, setPricing] = useState<Supplier | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')

  // Options lọc lấy từ dữ liệu thật.
  const typeOptions = useMemo(
    () => [...new Set(suppliers.map((s) => s.type).filter(Boolean))] as string[],
    [suppliers],
  )
  const groupOptions = useMemo(
    () => [...new Set(suppliers.flatMap((s) => s.groups))].sort(),
    [suppliers],
  )

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return suppliers.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (typeFilter !== 'all' && s.type !== typeFilter) return false
      if (ratingFilter !== 'all' && s.rating !== ratingFilter) return false
      if (groupFilter !== 'all' && !s.groups.includes(groupFilter)) return false
      if (ql && !`${s.code ?? ''} ${s.name} ${s.tax_no ?? ''}`.toLowerCase().includes(ql))
        return false
      return true
    })
  }, [suppliers, q, statusFilter, typeFilter, ratingFilter, groupFilter])

  // Ngừng giao dịch khi còn PO mở là tình huống thật (NCC ngưng cung cấp) —
  // không chặn, nhưng confirm phải nói rõ để Cung ứng xử lý các PO dở dang.
  async function toggleActive(s: Supplier) {
    if (s.is_active) {
      const warn =
        s.open_po_count > 0
          ? ` CHÚ Ý: còn ${s.open_po_count} PO đang mở với NCC này — hàng chưa về đủ, cần xử lý (huỷ hoặc chờ về) trước khi ngừng hẳn.`
          : ''
      const ok = await confirm({
        title: `Ngừng giao dịch với ${s.name}?`,
        description: `NCC ngừng sẽ không chọn được khi tạo PO / so giá.${warn}`,
        tone: s.open_po_count > 0 ? 'danger' : undefined,
        confirmLabel: 'Ngừng giao dịch',
      })
      if (!ok) return
    }
    const ok2 = await send(`/api/dept/supply/suppliers/${s.id}`, 'PATCH', {
      is_active: !s.is_active,
    })
    if (ok2)
      toast.success(s.is_active ? 'Đã ngừng giao dịch' : 'Đã kích hoạt lại', s.name)
  }

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

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'NCC',
      sortValue: (s) => s.name,
      cell: (s) => (
        <Link
          href={`/planning/suppliers/${s.id}`}
          className="flex min-w-0 flex-col hover:text-sky-600 dark:hover:text-sky-400"
        >
          {s.code && <span className="font-mono text-xs text-zinc-400">{s.code}</span>}
          <span className="truncate font-medium">{s.name}</span>
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Loại',
      width: '150px',
      sortValue: (s) => s.type ?? '',
      cell: (s) =>
        s.type ? (
          <Badge tone="blue">{s.type}</Badge>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
    },
    {
      key: 'groups',
      header: 'Nhóm hàng',
      width: '210px',
      cell: (s) =>
        s.groups.length ? (
          <div className="flex flex-wrap gap-1">
            {s.groups.map((g) => (
              <Badge key={g} tone="purple">
                {g}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
    },
    {
      key: 'rating',
      header: 'Hạng',
      width: '70px',
      align: 'center',
      sortValue: (s) => s.rating ?? 'Z',
      cell: (s) => (
        <div className="flex justify-center">
          <Grade r={s.rating} />
        </div>
      ),
    },
    {
      key: 'spend',
      header: 'Tổng chi',
      align: 'right',
      width: '140px',
      sortValue: (s) => s.total_spend,
      cell: (s) =>
        s.total_spend > 0 ? (
          <span className="font-medium tabular-nums">
            {money(s.total_spend)} <span className="text-xs text-zinc-400">₫</span>
          </span>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '140px',
      sortValue: (s) => s.status,
      cell: (s) => {
        const st = STATUS[s.status] ?? { label: s.status, tone: 'gray' as const }
        return (
          <div className="flex flex-col gap-0.5">
            <Badge tone={st.tone}>{st.label}</Badge>
            {!s.can_order && (
              <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
                ⚠ khoá đặt hàng
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (s) => (
        <RowMenu
          items={[
            {
              label: 'Xem chi tiết',
              onClick: () => router.push(`/planning/suppliers/${s.id}`),
            },
            // Xem bảng giá: mọi NV; sửa trong panel theo canEdit (FR-SUP-06).
            { label: 'Bảng giá', onClick: () => setPricing(s) },
            ...(canEdit
              ? [
                  {
                    label: 'Sửa hồ sơ',
                    onClick: () => router.push(`/planning/suppliers/${s.id}`),
                  },
                  {
                    label: s.is_active ? 'Ngừng giao dịch' : 'Kích hoạt lại',
                    onClick: () => void toggleActive(s),
                  },
                ]
              : []),
          ]}
        />
      ),
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
          { label: 'Nhà cung cấp' },
        ]}
        title="Nhà cung cấp"
        description={`${filtered.length} / ${suppliers.length} NCC — mỗi đơn đặt vật tư gắn đúng 1 NCC (BR-06).`}
        actions={
          canEdit && (
            <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
              + Thêm NCC
            </button>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng NCC', value: suppliers.length, tone: 'default' },
          {
            label: 'Đang giao dịch',
            value: suppliers.filter((s) => s.is_active).length,
            tone: 'green',
          },
          {
            label: 'Có lịch sử mua',
            value: suppliers.filter((s) => s.po_count > 0).length,
            tone: 'blue',
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
                placeholder="Tìm tên, mã, MST…"
                icon="⌕"
                className="w-56"
              />
              <ToolbarSelect
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: 'Mọi loại' },
                  ...typeOptions.map((t) => ({ value: t, label: t })),
                ]}
              />
              <ToolbarSelect
                value={groupFilter}
                onChange={setGroupFilter}
                options={[
                  { value: 'all', label: 'Mọi nhóm hàng' },
                  ...groupOptions.map((g) => ({ value: g, label: g })),
                ]}
              />
              <ToolbarSelect
                value={ratingFilter}
                onChange={setRatingFilter}
                options={[
                  { value: 'all', label: 'Mọi hạng' },
                  { value: 'A', label: 'Hạng A' },
                  { value: 'B', label: 'Hạng B' },
                  { value: 'C', label: 'Hạng C' },
                  { value: 'D', label: 'Hạng D' },
                ]}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Mọi trạng thái' },
                  { value: 'active', label: 'Hoạt động' },
                  { value: 'suspended', label: 'Tạm ngưng' },
                  { value: 'terminated', label: 'Ngừng hợp tác' },
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

        <DataTable<Supplier>
          rows={filtered}
          columns={columns}
          storageKey="supply-suppliers"
          rowClassName={(s) => (!s.is_active ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="◒"
              title={suppliers.length === 0 ? 'Chưa có NCC nào' : 'Không khớp bộ lọc'}
              description="Thêm NCC để tạo được đơn đặt vật tư."
              action={
                canEdit && suppliers.length === 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Thêm NCC
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm nhà cung cấp"
        maxWidth="sm:max-w-3xl"
      >
        <SupplierForm
          submitLabel="Thêm NCC"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/supply/suppliers', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã thêm NCC', String(body.name))
            }
          }}
        />
      </Modal>

      <Modal
        open={!!pricing}
        onClose={() => setPricing(null)}
        title={pricing ? `Bảng giá — ${pricing.name}` : ''}
      >
        {pricing && (
          <PricesPanel supplier={pricing} materials={materials} canEdit={canEdit} />
        )}
      </Modal>
    </div>
  )
}
