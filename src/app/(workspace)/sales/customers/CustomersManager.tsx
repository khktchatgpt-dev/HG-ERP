'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { TopProgressBar } from '@/components/erp/Spinner'
import {
  CustomerForm,
  type CustomerView,
  type MemberOption,
} from '@/components/sales/CustomerForm'

/** Số báo giá/đơn của KH — server đếm cho đúng trang đang hiện. */
export type Activity = { quotes: number; orders: number; openOrders: number }

export type CustomerFilters = {
  q: string
  owner: string
  status: 'all' | 'active' | 'inactive'
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang giao dịch' },
  { value: 'inactive', label: 'Ngừng giao dịch' },
  { value: 'all', label: 'Tất cả trạng thái' },
] as const

export function CustomersManager({
  customers,
  activity,
  counts,
  total,
  page,
  pageSize,
  filters,
  currentUserId,
  role,
  members,
}: {
  customers: CustomerView[]
  activity: Record<string, Activity>
  counts: { total: number; active: number; inactive: number; unassigned: number }
  total: number
  page: number
  pageSize: number
  filters: CustomerFilters
  currentUserId: string
  role: 'admin' | 'manager' | 'employee'
  members: MemberOption[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [navigating, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<CustomerView | null>(null)
  const [q, setQ] = useState(filters.q)

  /** Đổi bộ lọc/trang → đẩy xuống URL để SERVER lọc lại đúng một trang. */
  const applyParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || v === 'all') next.delete(k)
        else next.set(k, v)
      }
      if (!('page' in patch)) next.delete('page') // đổi lọc → về trang 1
      const qs = next.toString()
      // `replace`: lọc/tìm không phải "đi tới trang khác" — push vào lịch sử chỉ
      // khiến nút Back phải bấm hàng chục lần mới ra khỏi danh sách.
      startTransition(() =>
        router.replace(qs ? `/sales/customers?${qs}` : '/sales/customers'),
      )
    },
    [router, sp],
  )

  // Gõ xong 500ms mới lọc — mỗi lượt đẩy là một truy vấn server.
  useEffect(() => {
    if (q.trim() === filters.q) return
    const t = setTimeout(() => applyParams({ q: q.trim() || undefined }), 500)
    return () => clearTimeout(t)
  }, [q, filters.q, applyParams])

  const searching = q.trim() !== filters.q
  const hasFilter = !!filters.q || filters.owner !== 'all' || filters.status !== 'active'
  const busy = navigating || saving

  function canEdit(c: CustomerView) {
    return role === 'admin' || role === 'manager' || c.owner_id === currentUserId
  }

  function clearFilters() {
    setQ('')
    applyParams({ q: undefined, owner: undefined, status: undefined })
  }

  async function submit(
    url: string,
    method: 'POST' | 'PATCH',
    body: unknown,
  ): Promise<boolean> {
    setSaving(true)
    try {
      await api(url, { method, body })
      startTransition(() => router.refresh())
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setSaving(false)
    }
  }

  /** Ngừng / mở lại giao dịch — lối thay thế cho việc xoá KH đã có lịch sử. */
  async function toggleActive(c: CustomerView) {
    const turningOff = c.is_active
    const ok = await confirm({
      title: turningOff ? `Ngừng giao dịch với "${c.name}"?` : `Mở lại "${c.name}"?`,
      description: turningOff
        ? 'KH bị ẩn khỏi danh sách mặc định và không chọn được khi lập báo giá / tạo đơn. Lịch sử vẫn giữ nguyên, mở lại được bất cứ lúc nào.'
        : 'KH trở lại danh sách đang giao dịch và chọn được khi lập báo giá.',
      confirmLabel: turningOff ? 'Ngừng giao dịch' : 'Mở lại',
      tone: turningOff ? 'danger' : 'default',
    })
    if (!ok) return
    const done = await submit(`/api/dept/sales/customers/${c.id}`, 'PATCH', {
      is_active: !c.is_active,
    })
    if (done) {
      toast.success(turningOff ? 'Đã ngừng giao dịch' : 'Đã mở lại', c.name)
    }
  }

  async function remove(c: CustomerView) {
    const act = activity[c.id]
    const used = (act?.quotes ?? 0) + (act?.orders ?? 0) > 0
    if (used) {
      // Server cũng chặn (FK restrict), nhưng nói trước thì đỡ một lượt thất bại.
      toast.error(
        'Không xoá được KH đã có lịch sử',
        `${c.name} đang có ${act.quotes} báo giá / ${act.orders} đơn. Dùng "Ngừng giao dịch" để ẩn mà vẫn giữ lịch sử.`,
      )
      return
    }
    const ok = await confirm({
      title: `Xoá KH "${c.name}"?`,
      description: 'KH chưa có báo giá / đơn nào nên xoá được. Hành động không hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    try {
      await api(`/api/dept/sales/customers/${c.id}`, { method: 'DELETE' })
      toast.success('Đã xoá', c.name)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error('Xoá thất bại', apiErrorText(e))
    }
  }

  const columns: Column<CustomerView>[] = [
    {
      key: 'name',
      header: 'Mã / Tên khách hàng',
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex min-w-0 flex-col">
          {c.code && <span className="font-mono text-xs text-zinc-400">{c.code}</span>}
          <Link
            href={`/sales/customers/${c.id}`}
            className="truncate font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {c.name}
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            {c.country && <span>{c.country}</span>}
            {!c.is_active && <Badge tone="gray">Ngừng giao dịch</Badge>}
          </span>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Liên hệ',
      cell: (c) => (
        <div className="text-sm">
          {c.contact_person && <div>{c.contact_person}</div>}
          {c.email && <div className="truncate text-zinc-500">{c.email}</div>}
          {c.phone && <div className="text-zinc-500 tabular-nums">{c.phone}</div>}
          {!c.contact_person && !c.email && !c.phone && (
            <span className="text-zinc-400">— chưa có —</span>
          )}
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Báo giá / Đơn',
      width: '150px',
      sortValue: (c) => activity[c.id]?.orders ?? 0,
      cell: (c) => {
        const a = activity[c.id] ?? { quotes: 0, orders: 0, openOrders: 0 }
        if (a.quotes === 0 && a.orders === 0) {
          return <span className="text-xs text-zinc-400">chưa phát sinh</span>
        }
        return (
          <div className="flex flex-col text-sm tabular-nums">
            <span>
              {a.quotes} báo giá · {a.orders} đơn
            </span>
            {a.openOrders > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-500">
                {a.openOrders} đơn đang mở
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'terms',
      header: 'Điều khoản mặc định',
      width: '190px',
      cell: (c) => {
        const parts = [c.default_currency, c.default_price_term].filter(Boolean)
        if (parts.length === 0) {
          return (
            <span
              className="text-xs text-amber-600 dark:text-amber-500"
              title="Báo giá cho KH này sẽ không tự điền điều khoản"
            >
              chưa khai
            </span>
          )
        }
        return (
          <div className="flex flex-col text-xs text-zinc-600 dark:text-zinc-400">
            <span>{parts.join(' · ')}</span>
            {c.default_payment_terms && (
              <span className="truncate" title={c.default_payment_terms}>
                {c.default_payment_terms}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'owner',
      header: 'Phụ trách',
      width: '150px',
      sortValue: (c) => c.owner_name ?? '',
      cell: (c) =>
        c.owner_name ? (
          <Badge tone={c.owner_id === currentUserId ? 'blue' : 'gray'}>
            {c.owner_name}
          </Badge>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-500">— chưa gán —</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      cell: (c) => (
        <RowMenu
          items={[
            {
              label: 'Xem hồ sơ',
              onClick: () => router.push(`/sales/customers/${c.id}`),
            },
            {
              label: 'Lập báo giá',
              onClick: () => router.push(`/sales/quotes/new?customer=${c.id}`),
              disabled: !c.is_active,
              disabledReason: 'KH đã ngừng giao dịch',
            },
            {
              label: 'Sửa',
              onClick: () => setEditing(c),
              disabled: !canEdit(c),
              disabledReason: 'Chỉ sửa KH do mình phụ trách',
            },
            {
              label: c.is_active ? 'Ngừng giao dịch' : 'Mở lại giao dịch',
              onClick: () => void toggleActive(c),
              disabled: !canEdit(c),
              disabledReason: 'Chỉ sửa KH do mình phụ trách',
            },
            {
              label: 'Xoá',
              danger: true,
              onClick: () => void remove(c),
              disabled: !canEdit(c),
              disabledReason: 'Chỉ xoá KH do mình phụ trách',
            },
          ]}
        />
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kinh doanh', href: '/sales' }, { label: 'Khách hàng' }]}
        title="Khách hàng"
        description="Hồ sơ KH, phân công phụ trách, điều khoản mặc định để báo giá tự điền."
        actions={
          <Button variant="primary" onClick={() => setOpenCreate(true)}>
            + Thêm khách hàng
          </Button>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng khách hàng', value: counts.total, tone: 'blue' },
          { label: 'Đang giao dịch', value: counts.active, tone: 'green' },
          {
            label: 'Ngừng giao dịch',
            value: counts.inactive,
            tone: counts.inactive ? 'gray' : 'gray',
          },
          {
            label: 'Chưa gán phụ trách',
            value: counts.unassigned,
            tone: counts.unassigned ? 'amber' : 'gray',
            hint: counts.unassigned ? 'không ai theo dõi' : undefined,
          },
          {
            label: 'Đang hiện',
            value: total,
            tone: 'default',
            hint: hasFilter ? 'theo bộ lọc' : undefined,
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
                placeholder="Tìm tên, mã KH, email, người liên hệ, ĐT, MST…"
                icon="⌕"
                className="w-80"
              />
              <ToolbarSelect
                value={filters.owner}
                onChange={(v) => applyParams({ owner: v })}
                options={[
                  { value: 'all', label: 'Mọi người phụ trách' },
                  { value: currentUserId, label: 'KH của tôi' },
                  { value: 'none', label: 'Chưa gán phụ trách' },
                  ...members
                    .filter((m) => m.id !== currentUserId)
                    .map((m) => ({ value: m.id, label: m.label })),
                ]}
              />
              <ToolbarSelect
                value={filters.status}
                onChange={(v) => applyParams({ status: v })}
                options={STATUS_OPTIONS}
              />
              {searching && <span className="text-xs text-zinc-400">đang tìm…</span>}
            </>
          }
          right={
            hasFilter ? (
              <Button size="sm" onClick={clearFilters}>
                Xoá lọc
              </Button>
            ) : undefined
          }
        />

        <DataTable<CustomerView>
          rows={customers}
          columns={columns}
          storageKey="sales-customers"
          pagination={false}
          emptyState={
            <EmptyState
              icon="◍"
              title={hasFilter ? 'Không khớp bộ lọc' : 'Chưa có khách hàng nào'}
              description={
                hasFilter
                  ? 'Thử từ khoá khác, hoặc bỏ lọc để xem toàn bộ khách hàng.'
                  : 'Bấm "+ Thêm khách hàng" để bắt đầu xây dựng danh sách KH.'
              }
              action={
                hasFilter ? (
                  <Button onClick={clearFilters}>Xoá lọc</Button>
                ) : (
                  <Button variant="primary" onClick={() => setOpenCreate(true)}>
                    + Thêm khách hàng
                  </Button>
                )
              }
            />
          }
        />

        {/* Phân trang server-side */}
        {total > 0 && (
          <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
            <span>
              Trang {page}/{totalPages} · {total} khách hàng
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={page <= 1}
                onClick={() => applyParams({ page: String(page - 1) })}
              >
                ← Trước
              </Button>
              <Button
                size="sm"
                disabled={page >= totalPages}
                onClick={() => applyParams({ page: String(page + 1) })}
              >
                Sau →
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm khách hàng"
        maxWidth="sm:max-w-3xl"
      >
        <CustomerForm
          members={members}
          currentUserId={currentUserId}
          submitLabel="Thêm khách hàng"
          saving={saving}
          onCancel={() => setOpenCreate(false)}
          onSubmit={async (body) => {
            const ok = await submit('/api/dept/sales/customers', 'POST', body)
            if (ok) {
              toast.success('Đã thêm khách hàng', String(body.name ?? ''))
              setOpenCreate(false)
            }
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.name}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {editing && (
          <CustomerForm
            members={members}
            currentUserId={currentUserId}
            initial={editing}
            submitLabel="Lưu thay đổi"
            saving={saving}
            withActive
            onCancel={() => setEditing(null)}
            onSubmit={async (body) => {
              const ok = await submit(
                `/api/dept/sales/customers/${editing.id}`,
                'PATCH',
                body,
              )
              if (ok) {
                toast.success('Đã lưu', editing.name)
                setEditing(null)
              }
            }}
          />
        )}
      </Modal>
    </div>
  )
}
