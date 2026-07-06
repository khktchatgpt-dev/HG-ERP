'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Material = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  min_stock: number
  shelf_location: string | null
  note: string | null
  is_active: boolean
}

type StatusFilter = 'all' | 'active' | 'inactive'

export function MaterialsManager({
  materials,
  canEdit,
}: {
  materials: Material[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)

  const [q, setQ] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const groups = useMemo(() => {
    const set = new Set<string>()
    for (const m of materials) if (m.group_name) set.add(m.group_name)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [materials])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return materials.filter((m) => {
      if (groupFilter !== 'all' && (m.group_name ?? '') !== groupFilter) return false
      if (statusFilter === 'active' && !m.is_active) return false
      if (statusFilter === 'inactive' && m.is_active) return false
      if (ql) {
        const hay = `${m.code} ${m.name} ${m.group_name ?? ''}`.toLowerCase()
        if (!hay.includes(ql)) return false
      }
      return true
    })
  }, [materials, q, groupFilter, statusFilter])

  const stats = useMemo(() => {
    let active = 0
    let noShelf = 0
    for (const m of materials) {
      if (m.is_active) active++
      if (!m.shelf_location) noShelf++
    }
    return { active, noShelf }
  }, [materials])

  async function send(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<boolean> {
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

  async function deleteMaterial(m: Material) {
    const ok = await confirm({
      title: `Xoá vật tư "${m.name}"?`,
      description: 'Hành động không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/warehouse/materials/${m.id}`, 'DELETE')
    if (ok2) toast.success('Đã xoá', m.name)
  }

  function exportCsv() {
    downloadCsv(`vat-tu-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'code', header: 'Mã' },
      { key: 'name', header: 'Tên' },
      { key: 'unit', header: 'ĐVT' },
      { key: 'group_name', header: 'Nhóm', get: (m) => m.group_name ?? '' },
      { key: 'min_stock', header: 'Tồn tối thiểu', get: (m) => String(m.min_stock) },
      { key: 'shelf_location', header: 'Vị trí kệ', get: (m) => m.shelf_location ?? '' },
      {
        key: 'is_active',
        header: 'Trạng thái',
        get: (m) => (m.is_active ? 'Đang dùng' : 'Ngừng'),
      },
      { key: 'note', header: 'Ghi chú', get: (m) => m.note ?? '' },
    ])
    toast.success(`Đã xuất ${filtered.length} dòng CSV`)
  }

  const columns: Column<Material>[] = [
    {
      key: 'code',
      header: 'Mã / Tên',
      sortValue: (m) => m.code,
      cell: (m) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">{m.code}</span>
          <span className="truncate font-medium">{m.name}</span>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'ĐVT',
      width: '90px',
      sortValue: (m) => m.unit,
      cell: (m) => <span className="text-zinc-600 dark:text-zinc-300">{m.unit}</span>,
    },
    {
      key: 'group_name',
      header: 'Nhóm',
      width: '160px',
      sortValue: (m) => m.group_name ?? 'zzz',
      cell: (m) =>
        m.group_name ? (
          <Badge>{m.group_name}</Badge>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'min_stock',
      header: 'Tồn tối thiểu',
      width: '120px',
      align: 'right',
      sortValue: (m) => m.min_stock,
      cell: (m) => <span className="tabular-nums">{m.min_stock}</span>,
    },
    {
      key: 'shelf_location',
      header: 'Vị trí kệ',
      width: '110px',
      sortValue: (m) => m.shelf_location ?? 'zzz',
      cell: (m) =>
        m.shelf_location ? (
          <span className="font-mono text-xs">{m.shelf_location}</span>
        ) : (
          <span className="text-amber-600">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      sortValue: (m) => (m.is_active ? 0 : 1),
      cell: (m) =>
        m.is_active ? (
          <Badge tone="green">Đang dùng</Badge>
        ) : (
          <Badge tone="gray">Ngừng</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (m) => {
        if (!canEdit) return null
        return (
          <RowMenu
            items={[
              { label: 'Sửa', onClick: () => setEditing(m) },
              {
                label: m.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại',
                onClick: () =>
                  send(`/api/dept/warehouse/materials/${m.id}`, 'PATCH', {
                    is_active: !m.is_active,
                  }),
              },
              { label: 'Xoá', onClick: () => deleteMaterial(m), danger: true },
            ]}
          />
        )
      },
    },
  ]

  const groupOptions = [
    { value: 'all', label: 'Mọi nhóm' },
    ...groups.map((g) => ({ value: g, label: g })),
  ]
  const statusOptions = [
    { value: 'all' as const, label: 'Mọi trạng thái' },
    { value: 'active' as const, label: 'Đang dùng' },
    { value: 'inactive' as const, label: 'Ngừng' },
  ]

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'
  const btnPrimary =
    'rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Danh mục vật tư' }]}
        title="Danh mục vật tư"
        description={`${filtered.length} / ${materials.length} vật tư. Mã, ĐVT, nhóm, tồn tối thiểu, vị trí kệ.`}
        actions={
          <>
            <button onClick={exportCsv} className={btnSecondary}>
              Export CSV
            </button>
            {canEdit && (
              <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                + Thêm vật tư
              </button>
            )}
          </>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng VT', value: materials.length, tone: 'default' },
          { label: 'Đang dùng', value: stats.active, tone: 'green' },
          { label: 'Nhóm', value: groups.length, tone: 'blue' },
          {
            label: 'Chưa gán kệ',
            value: stats.noShelf,
            tone: stats.noShelf ? 'amber' : 'gray',
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
                placeholder="Tìm theo mã, tên, nhóm…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={groupFilter}
                onChange={setGroupFilter}
                options={groupOptions}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
              {(q || groupFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setQ('')
                    setGroupFilter('all')
                    setStatusFilter('all')
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Xoá lọc
                </button>
              )}
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

        <DataTable<Material>
          rows={filtered}
          columns={columns}
          storageKey="warehouse-materials"
          rowClassName={(m) => (!m.is_active ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="▤"
              title={
                materials.length === 0 ? 'Danh mục vật tư trống' : 'Không khớp bộ lọc'
              }
              description={
                materials.length === 0
                  ? canEdit
                    ? 'Thêm vật tư đầu tiên để khởi tạo danh mục.'
                    : 'Chưa có vật tư nào — liên hệ Kho để bổ sung.'
                  : 'Thử điều chỉnh bộ lọc.'
              }
              action={
                canEdit && materials.length === 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Thêm vật tư
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Thêm vật tư">
        <MaterialForm
          submitLabel="Thêm vật tư"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/warehouse/materials', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã thêm vật tư', String(body.name))
            }
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.name}` : ''}
      >
        {editing && (
          <MaterialForm
            initial={editing}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/warehouse/materials/${editing.id}`,
                'PATCH',
                body,
              )
              if (ok) {
                setEditing(null)
                toast.success('Đã cập nhật', String(body.name))
              }
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────

function MaterialForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<Material>
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      unit: String(fd.get('unit') ?? '').trim() || 'cái',
      group_name: String(fd.get('group_name') ?? '').trim() || null,
      min_stock: Number(fd.get('min_stock') ?? 0) || 0,
      shelf_location: String(fd.get('shelf_location') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Mã vật tư <span className="text-red-500">*</span>
        <input
          name="code"
          required
          maxLength={60}
          defaultValue={initial?.code ?? ''}
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ĐVT <span className="text-red-500">*</span>
        <input
          name="unit"
          required
          maxLength={30}
          defaultValue={initial?.unit ?? 'cái'}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Tên vật tư <span className="text-red-500">*</span>
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nhóm
        <input
          name="group_name"
          maxLength={100}
          defaultValue={initial?.group_name ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tồn tối thiểu
        <input
          name="min_stock"
          type="number"
          min={0}
          step="0.01"
          defaultValue={initial?.min_stock ?? 0}
          className={`${cls} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Vị trí kệ
        <input
          name="shelf_location"
          maxLength={60}
          placeholder="VD: A-01"
          defaultValue={initial?.shelf_location ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.note ?? ''}
          className={cls}
        />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
