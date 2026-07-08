'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { TopProgressBar } from '@/components/erp/Spinner'

type Customer = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  tax_code: string | null
  country: string | null
  contact_person: string | null
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
  port_of_discharge: string | null
  fax: string | null
  representative_title: string | null
  fsc_cert: string | null
  is_active: boolean
  created_at: string
}

type Member = { id: string; label: string }

export function CustomersManager({
  initial,
  total,
  page,
  q,
  currentUserId,
  role,
  members,
}: {
  initial: Customer[]
  total: number
  page: number
  q: string
  currentUserId: string
  role: 'admin' | 'manager' | 'employee'
  members: Member[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [search, setSearch] = useState(q)

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    p.delete('page')
    router.push(`?${p.toString()}`)
  }

  function canEdit(c: Customer) {
    return role === 'admin' || role === 'manager' || c.owner_id === currentUserId
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

  async function remove(c: Customer) {
    const ok = await confirm({
      title: `Xoá KH "${c.name}"?`,
      description: 'Hành động này không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    try {
      await api(`/api/dept/sales/customers/${c.id}`, { method: 'DELETE' })
      toast.success('Đã xoá', c.name)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Mã / Tên',
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
          {c.country && <span className="text-xs text-zinc-500">{c.country}</span>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Liên hệ',
      cell: (c) => (
        <div className="text-sm">
          {c.contact_person && <div>{c.contact_person}</div>}
          {c.email && <div className="text-zinc-500">{c.email}</div>}
          {c.phone && <div className="text-zinc-500">{c.phone}</div>}
          {!c.contact_person && !c.email && !c.phone && (
            <span className="text-zinc-400">—</span>
          )}
        </div>
      ),
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
          <span className="text-xs text-zinc-400">— chưa gán —</span>
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
              label: 'Sửa',
              onClick: () => setEditing(c),
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

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy || saving} />
      <PageHeader
        breadcrumbs={[{ label: 'Kinh doanh', href: '/sales' }, { label: 'Khách hàng' }]}
        title="Khách hàng"
        description="Hồ sơ KH, phân công phụ trách, điều khoản mặc định phục vụ báo giá."
        actions={
          <Button variant="primary" onClick={() => setOpenCreate(true)}>
            + Thêm khách hàng
          </Button>
        }
      />

      <StatsBar
        stats={[{ label: 'Tổng KH đang giao dịch', value: total, tone: 'blue' }]}
      />

      <div>
        <Toolbar
          left={
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setParam('q', search.trim())
              }}
              className="flex gap-2"
            >
              <ToolbarInput
                value={search}
                onChange={setSearch}
                placeholder="Tìm theo tên, mã KH, email…"
                icon="⌕"
                className="w-72"
              />
              <Button size="sm">Tìm</Button>
            </form>
          }
        />

        <DataTable<Customer>
          rows={initial}
          columns={columns}
          storageKey="sales-customers"
          pagination={false}
          emptyState={
            <EmptyState
              icon="◍"
              title={q ? 'Không khớp tìm kiếm' : 'Chưa có khách hàng nào'}
              description={
                q
                  ? 'Thử từ khoá khác hoặc thêm khách hàng mới.'
                  : 'Bấm "+ Thêm khách hàng" để bắt đầu xây dựng danh sách KH.'
              }
              action={
                <Button variant="primary" onClick={() => setOpenCreate(true)}>
                  + Thêm khách hàng
                </Button>
              }
            />
          }
        />

        {/* Phân trang server-side */}
        <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
          <span>
            Trang {page} · Tổng {total}
          </span>
          <div className="flex gap-3">
            {page > 1 && (
              <button
                onClick={() => setParam('page', String(page - 1))}
                className="underline"
              >
                ← Trước
              </button>
            )}
            {page * 20 < total && (
              <button
                onClick={() => setParam('page', String(page + 1))}
                className="underline"
              >
                Sau →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm khách hàng"
      >
        <CustomerForm
          members={members}
          currentUserId={currentUserId}
          submitLabel="Thêm"
          saving={saving}
          onSubmit={async (body) => {
            const ok = await submit('/api/dept/sales/customers', 'POST', body)
            if (ok) {
              toast.success('Đã thêm khách hàng', String(body.name ?? ''))
              setOpenCreate(false)
            }
          }}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.name}` : ''}
      >
        {editing && (
          <CustomerForm
            members={members}
            currentUserId={currentUserId}
            initial={editing}
            submitLabel="Lưu"
            saving={saving}
            withActive
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

function CustomerForm({
  members,
  currentUserId,
  initial,
  submitLabel,
  saving,
  withActive,
  onSubmit,
}: {
  members: Member[]
  currentUserId: string
  initial?: Partial<Customer>
  submitLabel: string
  saving: boolean
  withActive?: boolean
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (k: string) => String(fd.get(k) ?? '').trim() || null
    const body: Record<string, unknown> = {
      name: String(fd.get('name') ?? '').trim(),
      code: str('code'),
      owner_id: String(fd.get('owner_id') ?? '') || null,
      contact_person: str('contact_person'),
      email: str('email'),
      phone: str('phone'),
      address: str('address'),
      country: str('country'),
      tax_code: str('tax_code'),
      fax: str('fax'),
      representative_title: str('representative_title'),
      fsc_cert: str('fsc_cert'),
      default_currency: (str('default_currency') ?? '')?.toUpperCase() || null,
      default_price_term: str('default_price_term'),
      default_payment_terms: str('default_payment_terms'),
      port_of_discharge: str('port_of_discharge'),
      notes: str('notes'),
    }
    if (withActive) body.is_active = fd.get('is_active') === 'on'
    void onSubmit(body)
  }

  return (
    <form onSubmit={handle} className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
      <Section title="Cơ bản">
        <L label="Tên khách hàng" span2>
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={initial?.name ?? ''}
            className={cls}
          />
        </L>
        <L label="Mã KH">
          <input
            name="code"
            maxLength={50}
            defaultValue={initial?.code ?? ''}
            className={cls}
          />
        </L>
        <L label="Phụ trách">
          <select
            name="owner_id"
            defaultValue={initial?.owner_id ?? currentUserId}
            className={cls}
          >
            <option value="">— chưa gán —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </L>
      </Section>

      <Section title="Liên hệ">
        <L label="Người liên hệ">
          <input
            name="contact_person"
            maxLength={200}
            defaultValue={initial?.contact_person ?? ''}
            className={cls}
          />
        </L>
        <L label="Quốc gia">
          <input
            name="country"
            maxLength={100}
            defaultValue={initial?.country ?? ''}
            className={cls}
          />
        </L>
        <L label="Email">
          <input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ''}
            className={cls}
          />
        </L>
        <L label="Điện thoại">
          <input
            name="phone"
            maxLength={30}
            defaultValue={initial?.phone ?? ''}
            className={cls}
          />
        </L>
        <L label="Địa chỉ" span2>
          <input
            name="address"
            maxLength={500}
            defaultValue={initial?.address ?? ''}
            className={cls}
          />
        </L>
        <L label="Mã số thuế">
          <input
            name="tax_code"
            maxLength={50}
            defaultValue={initial?.tax_code ?? ''}
            className={cls}
          />
        </L>
        <L label="Fax">
          <input
            name="fax"
            maxLength={50}
            defaultValue={initial?.fax ?? ''}
            className={cls}
          />
        </L>
        <L label="Chức danh người đại diện">
          <input
            name="representative_title"
            maxLength={100}
            defaultValue={initial?.representative_title ?? ''}
            className={cls}
            placeholder="Director / Manager…"
          />
        </L>
        <L label="FSC Cert (KH)">
          <input
            name="fsc_cert"
            maxLength={100}
            defaultValue={initial?.fsc_cert ?? ''}
            className={`${cls} font-mono`}
            placeholder="SCS-COC-001485"
          />
        </L>
      </Section>

      <Section title="Điều khoản mặc định (auto-fill báo giá)">
        <L label="Tiền tệ (3 ký tự)">
          <input
            name="default_currency"
            maxLength={3}
            placeholder="USD"
            defaultValue={initial?.default_currency ?? ''}
            className={`${cls} uppercase`}
          />
        </L>
        <L label="Điều kiện giá">
          <input
            name="default_price_term"
            maxLength={100}
            placeholder="FOB Quy Nhon"
            defaultValue={initial?.default_price_term ?? ''}
            className={cls}
          />
        </L>
        <L label="Thanh toán">
          <input
            name="default_payment_terms"
            maxLength={500}
            placeholder="L/C at sight"
            defaultValue={initial?.default_payment_terms ?? ''}
            className={cls}
          />
        </L>
        <L label="Cảng đích">
          <input
            name="port_of_discharge"
            maxLength={200}
            defaultValue={initial?.port_of_discharge ?? ''}
            className={cls}
          />
        </L>
      </Section>

      <L label="Ghi chú" span2>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.notes ?? ''}
          className={cls}
        />
      </L>

      {withActive && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial?.is_active ?? true}
          />
          Đang giao dịch (bỏ chọn để ngừng)
        </label>
      )}

      <div className="flex justify-end">
        <Button variant="primary" disabled={saving}>
          {saving ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function L({
  label,
  span2,
  children,
}: {
  label: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${span2 ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  )
}
