'use client'

import { useMemo, useState } from 'react'
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
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

/**
 * Danh mục NGUYÊN NHÂN LỖI SX (0067) — sổ sản lượng tham chiếu CODE nên code
 * BẤT BIẾN sau tạo: sai thì Ẩn rồi tạo code mới. Lỗi gắn công đoạn để dropdown
 * của tổ chỉ hiện lỗi công đoạn mình (null = mọi công đoạn).
 */

type Stage = { code: string; label: string }
type Item = {
  id: string
  code: string
  label: string
  stage_code: string | null
  sort_order: number
  is_active: boolean
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function DefectCodesManager({
  items,
  stages,
}: {
  items: Item[]
  stages: Stage[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [q, setQ] = useState('')
  const [stageFilter, setStageFilter] = useState('all')

  const stageLabel = (code: string | null) =>
    code === null ? 'Mọi công đoạn' : (stages.find((s) => s.code === code)?.label ?? code)

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items.filter((it) => {
      if (stageFilter === 'common' && it.stage_code !== null) return false
      if (
        stageFilter !== 'all' &&
        stageFilter !== 'common' &&
        it.stage_code !== stageFilter
      )
        return false
      if (ql && !`${it.code} ${it.label}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [items, q, stageFilter])

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

  const columns: Column<Item>[] = [
    {
      key: 'code',
      header: 'Code',
      sortValue: (it) => it.code,
      width: '170px',
      cell: (it) => <span className="font-mono text-xs">{it.code}</span>,
    },
    {
      key: 'label',
      header: 'Nguyên nhân lỗi',
      sortValue: (it) => it.label,
      cell: (it) => it.label,
    },
    {
      key: 'stage',
      header: 'Công đoạn',
      sortValue: (it) => it.stage_code ?? '',
      width: '150px',
      cell: (it) =>
        it.stage_code === null ? (
          <Badge tone="gray">Mọi công đoạn</Badge>
        ) : (
          <Badge>{stageLabel(it.stage_code)}</Badge>
        ),
    },
    {
      key: 'sort',
      header: 'Thứ tự',
      sortValue: (it) => it.sort_order,
      width: '80px',
      align: 'right',
      cell: (it) => it.sort_order,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      cell: (it) =>
        it.is_active ? (
          <Badge tone="green">Đang dùng</Badge>
        ) : (
          <Badge tone="gray">Ẩn</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (it) => (
        <RowMenu
          items={[
            { label: 'Sửa tên / công đoạn / thứ tự', onClick: () => setEditing(it) },
            {
              label: it.is_active ? 'Ẩn (ngừng dùng)' : 'Hiện lại',
              danger: it.is_active,
              onClick: async () => {
                const ok = await send(`/api/admin/defect-codes/${it.id}`, 'PATCH', {
                  is_active: !it.is_active,
                })
                if (ok) toast.success(it.is_active ? 'Đã ẩn' : 'Đã hiện lại', it.label)
              },
            },
          ]}
        />
      ),
    },
  ]

  const btnPrimary =
    'rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Quản trị', href: '/admin' },
          { label: 'Nguyên nhân lỗi SX' },
        ]}
        title="Nguyên nhân lỗi sản xuất"
        description="Danh mục lý do phế phẩm cho sổ sản lượng — tổ chỉ thấy lỗi của công đoạn mình. Code bất biến sau tạo (sổ tham chiếu code): sai thì Ẩn rồi tạo mới."
        actions={
          <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
            + Thêm nguyên nhân
          </button>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng', value: items.length, tone: 'default' },
          {
            label: 'Đang dùng',
            value: items.filter((i) => i.is_active).length,
            tone: 'green',
          },
          {
            label: 'Lỗi chung (mọi CĐ)',
            value: items.filter((i) => i.stage_code === null).length,
            tone: 'blue',
          },
          {
            label: 'Đã ẩn',
            value: items.filter((i) => !i.is_active).length,
            tone: 'gray',
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
                placeholder="Tìm theo code, tên lỗi…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={stageFilter}
                onChange={setStageFilter}
                options={[
                  { value: 'all', label: 'Mọi công đoạn' },
                  { value: 'common', label: 'Lỗi chung' },
                  ...stages.map((s) => ({ value: s.code, label: s.label })),
                ]}
              />
            </>
          }
        />
        <DataTable<Item>
          rows={filtered}
          columns={columns}
          storageKey="admin-defect-codes"
          emptyState={
            <EmptyState
              icon="⚑"
              title={
                items.length === 0 ? 'Chưa có nguyên nhân lỗi nào' : 'Không khớp bộ lọc'
              }
              description="Sổ sản lượng bắt buộc chọn nguyên nhân khi có phế phẩm."
            />
          }
        />
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm nguyên nhân lỗi"
      >
        <DefectForm
          stages={stages}
          submitLabel="Tạo"
          onSubmit={async (body) => {
            const ok = await send('/api/admin/defect-codes', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã thêm nguyên nhân lỗi', body.label)
            }
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa — ${editing?.label ?? ''}`}
      >
        {editing && (
          <DefectForm
            stages={stages}
            initial={editing}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              // Code bất biến — chỉ gửi các trường sửa được.
              const patch = {
                label: body.label,
                stage_code: body.stage_code,
                sort_order: body.sort_order,
              }
              const ok = await send(
                `/api/admin/defect-codes/${editing.id}`,
                'PATCH',
                patch,
              )
              if (ok) {
                setEditing(null)
                toast.success('Đã cập nhật', body.label)
              }
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function DefectForm({
  stages,
  initial,
  submitLabel,
  onSubmit,
}: {
  stages: Stage[]
  initial?: Item
  submitLabel: string
  onSubmit: (body: {
    code: string
    label: string
    stage_code: string | null
    sort_order: number
  }) => Promise<void> | void
}) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [stageCode, setStageCode] = useState(initial?.stage_code ?? '')
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [busy, setBusy] = useState(false)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        await onSubmit({
          code: code.trim(),
          label: label.trim(),
          stage_code: stageCode || null,
          sort_order: Number(sortOrder) || 0,
        })
        setBusy(false)
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        Code {initial && <span className="text-xs text-zinc-400">(bất biến)</span>}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          disabled={!!initial}
          maxLength={50}
          pattern="[a-z0-9_\-]+"
          title="Chỉ chữ thường / số / gạch (a-z 0-9 _ -)"
          placeholder="vd: han_ro_khi"
          className={`${inputCls} font-mono disabled:opacity-60`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tên hiển thị
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          maxLength={100}
          placeholder="vd: Rỗ khí mối hàn"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Công đoạn áp dụng
        <select
          value={stageCode}
          onChange={(e) => setStageCode(e.target.value)}
          className={inputCls}
        >
          <option value="">Mọi công đoạn</option>
          {stages.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Thứ tự hiển thị
        <input
          type="number"
          min="0"
          max="9999"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={inputCls}
        />
      </label>
      <div className="mt-2 flex justify-end">
        <button
          disabled={busy || !code.trim() || !label.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
