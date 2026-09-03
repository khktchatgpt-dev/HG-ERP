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
import {
  SupplierFields,
  emptySupplier,
  toSupplierPayload,
  type SupplierFormValues,
} from './SupplierFields'
import { Button } from '@/components/shadcn/button'

type Supplier = {
  id: string
  code: string | null
  name: string
  tax_no: string | null
  type: string | null
  status: string
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

const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'gray' }> = {
  active: { label: 'Hoạt động', tone: 'green' },
  suspended: { label: 'Tạm ngưng', tone: 'amber' },
  terminated: { label: 'Ngừng hợp tác', tone: 'gray' },
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
  /** Bản nháp NCC đang tạo — form có kiểm soát nên state nằm ở đây. */
  const [draft, setDraft] = useState<SupplierFormValues>(emptySupplier)
  const [pricing, setPricing] = useState<Supplier | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
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
      if (groupFilter !== 'all' && !s.groups.includes(groupFilter)) return false
      if (ql && !`${s.code ?? ''} ${s.name} ${s.tax_no ?? ''}`.toLowerCase().includes(ql))
        return false
      return true
    })
  }, [suppliers, q, statusFilter, typeFilter, groupFilter])

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
    /*
     * 28/08 — BỎ cột "Tổng chi": rỗng ở cả 154 dòng (chưa nhập đơn thật), mà
     * vẫn ăn 140px và đẩy bảng sang cuộn ngang. Số này vốn thuộc về TRANG CHI
     * TIẾT của NCC, nơi nó nằm cạnh số PO và lần mua gần nhất để đọc thành
     * một câu; đứng lẻ ở danh sách thì chỉ là một cột số không so với ai.
     */
    {
      key: 'status',
      header: 'Trạng thái',
      width: '140px',
      sortValue: (s) => s.status,
      cell: (s) => {
        /*
         * 28/08: 154/154 NCC đều "Hoạt động" — in 154 badge xanh giống hệt
         * nhau thì cột này không phân biệt được gì, chỉ dạy mắt bỏ qua nó.
         * Nay cột chỉ LÊN TIẾNG khi có chuyện: tạm ngưng, ngừng hợp tác, hoặc
         * khoá đặt hàng. Bình thường để trống — im lặng cũng là thông tin.
         */
        const st = STATUS[s.status] ?? { label: s.status, tone: 'gray' as const }
        const normal = s.status === 'active' && s.can_order
        if (normal) return <span className="text-muted-foreground/50 text-xs">—</span>
        return (
          <div className="flex flex-col gap-0.5">
            {s.status !== 'active' && <Badge tone={st.tone}>{st.label}</Badge>}
            {!s.can_order && (
              <span className="text-[11px] font-medium text-[var(--stop)]">
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
          { label: 'Cung ứng', href: '/planning' },
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
        /*
         * 28/08: ba thẻ cũ là "Tổng 154 · Đang giao dịch 154 · Có lịch sử mua
         * 0" — hai thẻ đầu trùng y hệt nhau (chưa ai ngừng giao dịch NCC nào)
         * và thẻ ba bằng 0. Ba con số không nói được gì.
         *
         * Nay chỉ giữ thẻ có KHẢ NĂNG ĐỔI và đáng nhìn: đang giao dịch, đã
         * ngừng, khoá đặt hàng. Thẻ nào đếm 0 thì TỰ ẨN — bảng trắng ba số 0
         * là chỗ mắt học cách bỏ qua cả dải KPI.
         */
        stats={[
          {
            label: 'Đang giao dịch',
            value: suppliers.filter((s) => s.is_active).length,
            tone: 'green',
          },
          ...(suppliers.some((s) => !s.is_active)
            ? [
                {
                  label: 'Đã ngừng',
                  value: suppliers.filter((s) => !s.is_active).length,
                  tone: 'gray' as const,
                },
              ]
            : []),
          ...(suppliers.some((s) => !s.can_order)
            ? [
                {
                  label: 'Khoá đặt hàng',
                  value: suppliers.filter((s) => !s.can_order).length,
                  tone: 'red' as const,
                },
              ]
            : []),
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

      {/*
        TẠO NCC = HỒ SƠ ĐẦY ĐỦ, không còn "thêm nhanh 6 ô" (03/09/2026).
        Bản cũ chỉ hỏi tên/mã/loại/MST/ĐT/email rồi đá sang trang hồ sơ, và
        thực tế không ai quay lại điền tiếp — nên điều khoản thanh toán, tiền tệ,
        lead time (đúng ba thứ form soạn đơn đọc để mồi) trống ở phần lớn NCC.
        Nay hỏi ngay tại đây, mảng nào chưa cần thì vẫn gập lại.
      */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm nhà cung cấp"
        maxWidth="sm:max-w-3xl"
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const body = toSupplierPayload(draft)
            setBusy(true)
            try {
              const { supplier } = await api<{ supplier: { id: string; name: string } }>(
                '/api/dept/supply/suppliers',
                { method: 'POST', body },
              )
              setOpenCreate(false)
              setDraft(emptySupplier)
              toast.success('Đã thêm NCC', supplier.name)
              router.push(`/planning/suppliers/${supplier.id}`)
            } catch (err) {
              toast.error(
                'Thêm thất bại',
                err instanceof ApiError ? err.message : 'Có lỗi',
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          <SupplierFields
            mode="create"
            value={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            existing={suppliers.map((s) => ({
              id: s.id,
              name: s.name,
              tax_no: s.tax_no,
            }))}
          />
          <div className="bg-card sticky bottom-0 flex items-center justify-end gap-2 border-t py-2">
            <span className="text-muted-foreground mr-auto text-[12px]">
              Chỉ tên là bắt buộc — phần còn lại điền được lúc nào cũng được.
            </span>
            <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner size={14} />}
              {busy ? 'Đang tạo…' : 'Tạo & mở hồ sơ'}
            </Button>
          </div>
        </form>
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
