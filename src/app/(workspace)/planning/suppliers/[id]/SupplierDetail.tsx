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
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { RefChain } from '@/components/erp/RefChain'
import { PricesPanel, type MaterialOption } from '../PricesPanel'
import { SupplierForm } from '../SupplierForm'

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
  created_at: string
  updated_at: string
}

type PoRow = {
  id: string
  code: string
  status: string
  lsx_code: string
  order_code: string | null
  expected_at: string | null
  created_at: string
  total: number
}

const PO_STATUS: Record<
  string,
  { label: string; tone: 'gray' | 'amber' | 'blue' | 'green' | 'red' }
> = {
  pending_approval: { label: 'Chờ duyệt', tone: 'amber' },
  approved: { label: 'Đã duyệt', tone: 'blue' },
  ordered: { label: 'Đã gửi NCC', tone: 'blue' },
  confirmed: { label: 'NCC xác nhận', tone: 'blue' },
  in_transit: { label: 'Đang giao', tone: 'blue' },
  partial: { label: 'Về một phần', tone: 'amber' },
  received: { label: 'Về đủ', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'red' },
}
const OPEN = [
  'pending_approval',
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
]
const money = (n: number) => n.toLocaleString('vi-VN')
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')

type Tab = 'overview' | 'prices' | 'history'

export function SupplierDetail({
  supplier,
  pos,
  materials,
  canEdit,
}: {
  supplier: Supplier
  pos: PoRow[]
  materials: MaterialOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const stats = useMemo(() => {
    const open = pos.filter((p) => OPEN.includes(p.status)).length
    const spend = pos
      .filter((p) => p.status !== 'cancelled')
      .reduce((s, p) => s + p.total, 0)
    const last = pos.reduce<string | null>(
      (acc, p) => (!acc || p.created_at > acc ? p.created_at : acc),
      null,
    )
    return { total: pos.length, open, spend, last }
  }, [pos])

  async function send(method: 'PATCH', body: unknown) {
    setBusy(true)
    try {
      await api(`/api/dept/supply/suppliers/${supplier.id}`, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive() {
    if (supplier.is_active) {
      const open = pos.filter((p) => OPEN.includes(p.status)).length
      const ok = await confirm({
        title: `Ngừng giao dịch với ${supplier.name}?`,
        description:
          'NCC ngừng sẽ không chọn được khi tạo PO / so giá.' +
          (open > 0 ? ` CHÚ Ý: còn ${open} PO đang mở với NCC này.` : ''),
        tone: open > 0 ? 'danger' : undefined,
        confirmLabel: 'Ngừng giao dịch',
      })
      if (!ok) return
    }
    const ok = await send('PATCH', { is_active: !supplier.is_active })
    if (ok)
      toast.success(
        supplier.is_active ? 'Đã ngừng giao dịch' : 'Đã kích hoạt lại',
        supplier.name,
      )
  }

  const historyCols: Column<PoRow>[] = [
    {
      key: 'code',
      header: 'Số PO',
      width: '150px',
      sortValue: (p) => p.code,
      cell: (p) => (
        <span className="font-mono text-xs text-violet-600 dark:text-violet-400">
          {p.code}
        </span>
      ),
    },
    {
      key: 'chain',
      header: 'LSX / Đơn hàng',
      width: '170px',
      cell: (p) => (
        <RefChain
          size="sm"
          nodes={[
            ...(p.order_code ? [{ label: 'Đơn hàng', value: p.order_code }] : []),
            { label: 'LSX', value: p.lsx_code },
          ]}
        />
      ),
    },
    {
      key: 'total',
      header: 'Giá trị',
      align: 'right',
      width: '150px',
      sortValue: (p) => p.total,
      cell: (p) => <span className="font-medium tabular-nums">{money(p.total)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      sortValue: (p) => p.status,
      cell: (p) => {
        const st = PO_STATUS[p.status] ?? { label: p.status, tone: 'gray' as const }
        return <Badge tone={st.tone}>{st.label}</Badge>
      },
    },
    {
      key: 'expected',
      header: 'Hẹn giao',
      width: '110px',
      sortValue: (p) => p.expected_at ?? '9999',
      cell: (p) => date(p.expected_at),
    },
    { key: '_spacer', header: '', cell: () => null },
    {
      key: 'created',
      header: 'Ngày tạo',
      width: '110px',
      align: 'right',
      sortValue: (p) => p.created_at,
      cell: (p) => date(p.created_at),
    },
  ]

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'prices', label: 'Bảng giá' },
    { id: 'history', label: `Lịch sử mua (${pos.length})` },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Nhà cung cấp', href: '/planning/suppliers' },
          { label: supplier.name },
        ]}
        title={supplier.name}
        description={supplier.code ? `Mã NCC: ${supplier.code}` : 'Hồ sơ nhà cung cấp'}
        actions={
          canEdit && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Sửa hồ sơ
              </button>
              <button
                onClick={() => void toggleActive()}
                className={
                  supplier.is_active
                    ? 'rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900'
                    : 'rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700'
                }
              >
                {supplier.is_active ? 'Ngừng giao dịch' : 'Kích hoạt lại'}
              </button>
            </div>
          )
        }
      />

      <StatsBar
        stats={[
          {
            label: 'Trạng thái',
            value: supplier.is_active ? 'Đang giao dịch' : 'Ngừng',
            tone: supplier.is_active ? 'green' : 'gray',
          },
          { label: 'Tổng PO', value: stats.total, tone: 'blue' },
          { label: 'PO đang mở', value: stats.open, tone: stats.open ? 'amber' : 'gray' },
          { label: 'Tổng chi (VND)', value: money(stats.spend), tone: 'purple' },
          { label: 'Mua gần nhất', value: date(stats.last), tone: 'default' },
          {
            label: 'Số vật tư báo giá',
            value: '—',
            tone: 'gray',
            hint: 'xem tab Bảng giá',
          },
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
              (tab === t.id
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mã NCC" value={supplier.code} mono />
          <Field label="Mã số thuế" value={supplier.tax_no} mono />
          <Field label="Điện thoại" value={supplier.phone} />
          <Field label="Email" value={supplier.email} />
          <Field label="Địa chỉ" value={supplier.address} className="sm:col-span-2" />
          <Field label="Ghi chú" value={supplier.note} className="sm:col-span-2" />
        </div>
      )}

      {tab === 'prices' && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <PricesPanel supplier={supplier} materials={materials} canEdit={canEdit} />
        </div>
      )}

      {tab === 'history' && (
        <DataTable<PoRow>
          rows={pos}
          columns={historyCols}
          storageKey="supplier-po-history"
          emptyState={
            <EmptyState
              icon="◫"
              title="Chưa có đơn đặt nào"
              description="NCC này chưa từng nhận đơn đặt vật tư."
            />
          }
        />
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`Sửa — ${supplier.name}`}
      >
        <SupplierForm
          initial={supplier}
          submitLabel="Lưu thay đổi"
          onSubmit={async (body) => {
            const ok = await send('PATCH', body)
            if (ok) {
              setEditing(false)
              toast.success('Đã cập nhật', supplier.name)
            }
          }}
        />
      </Modal>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string | null
  mono?: boolean
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 ${className ?? ''}`}
    >
      <div className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
        {label}
      </div>
      <div
        className={`mt-1 text-sm ${mono ? 'font-mono' : ''} ${value ? '' : 'text-zinc-400'}`}
      >
        {value || '—'}
      </div>
    </div>
  )
}
