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
  email: string | null
  phone: string | null
  address: string | null
  tax_no: string | null
  note: string | null
  is_active: boolean
  po_count: number
  open_po_count: number // PO chưa về đủ/chưa huỷ — cảnh báo khi ngừng giao dịch
  last_po: string | null
  last_po_at: string | null
  total_spend: number
}

const money = (n: number) => n.toLocaleString('vi-VN')

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return suppliers.filter((s) => {
      if (statusFilter === 'active' && !s.is_active) return false
      if (statusFilter === 'inactive' && s.is_active) return false
      if (ql && !`${s.code ?? ''} ${s.name} ${s.tax_no ?? ''}`.toLowerCase().includes(ql))
        return false
      return true
    })
  }, [suppliers, q, statusFilter])

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
      key: 'contact',
      header: 'Liên hệ',
      cell: (s) => (
        <div className="flex flex-col text-xs text-zinc-500">
          {s.phone && <span>{s.phone}</span>}
          {s.email && <span className="truncate">{s.email}</span>}
          {!s.phone && !s.email && '—'}
        </div>
      ),
    },
    {
      key: 'tax',
      header: 'MST',
      width: '120px',
      cell: (s) => <span className="font-mono text-xs">{s.tax_no ?? '—'}</span>,
    },
    {
      key: 'history',
      header: 'Lịch sử mua',
      sortValue: (s) => s.po_count,
      width: '130px',
      cell: (s) =>
        s.po_count > 0 ? (
          <div className="flex flex-col text-xs">
            <span>{s.po_count} đơn đặt</span>
            {s.last_po_at && (
              <span className="text-zinc-400">
                gần nhất {new Date(s.last_po_at).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-zinc-400">Chưa mua</span>
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
      width: '110px',
      cell: (s) =>
        s.is_active ? (
          <Badge tone="green">Đang giao dịch</Badge>
        ) : (
          <Badge tone="gray">Ngừng</Badge>
        ),
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
                className="w-64"
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi trạng thái' },
                  { value: 'active' as const, label: 'Đang giao dịch' },
                  { value: 'inactive' as const, label: 'Ngừng' },
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
