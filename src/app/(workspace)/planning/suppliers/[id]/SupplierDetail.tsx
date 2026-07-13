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
import { CertsPanel } from '../CertsPanel'
import { SupplierForm } from '../SupplierForm'
import type { Supplier } from '@/modules/dept/supply/supply.repo'

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

type PurchasedMaterial = {
  material_id: string
  material_code: string
  material_name: string
  material_unit: string
  total_qty: number
  order_lines: number
  last_price: number | null
  last_currency: string
  last_at: string
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

const STATUS_LABEL: Record<string, string> = {
  active: 'Hoạt động',
  suspended: 'Tạm ngưng',
  terminated: 'Ngừng hợp tác',
}
const IMPEX_LABEL: Record<string, string> = { domestic: 'Nội địa', import: 'Nhập khẩu' }
const PRIORITY_LABEL: Record<string, string> = { primary: 'Chính', backup: 'Dự phòng' }

type Tab = 'overview' | 'eval' | 'purchased' | 'prices' | 'certs' | 'history'

export function SupplierDetail({
  supplier,
  pos,
  purchased,
  materials,
  canEdit,
}: {
  supplier: Supplier
  pos: PoRow[]
  purchased: PurchasedMaterial[]
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
    { id: 'eval', label: 'Đánh giá' },
    { id: 'purchased', label: `Vật tư đã mua (${purchased.length})` },
    { id: 'prices', label: 'Bảng giá' },
    { id: 'certs', label: 'Chứng chỉ' },
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
          { label: 'Vật tư đã mua', value: purchased.length, tone: 'blue' },
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
        <div className="flex flex-col gap-5">
          <Group title="Cơ bản">
            <Field label="Mã NCC" value={supplier.code} mono />
            <Field label="Tên viết tắt" value={supplier.short_name} />
            <Field label="Loại NCC" value={supplier.type} />
            <Field
              label="Trạng thái"
              value={STATUS_LABEL[supplier.status] ?? supplier.status}
            />
            <Field
              label="Cho phép đặt hàng"
              value={supplier.can_order ? 'Có' : 'Không'}
            />
            {supplier.lock_reason && (
              <Field
                label="Lý do khoá"
                value={supplier.lock_reason}
                className="sm:col-span-3"
              />
            )}
          </Group>

          <Group title="Pháp lý">
            <Field label="Tên công ty" value={supplier.company_name} />
            <Field label="Mã số thuế" value={supplier.tax_no} mono />
            <Field label="Giấy phép KD" value={supplier.business_license} />
            <Field
              label="Ngày thành lập"
              value={supplier.founded_on ? date(supplier.founded_on) : null}
            />
            <Field label="Người đại diện PL" value={supplier.legal_rep} />
            <Field label="Quốc gia" value={supplier.country} />
            <Field
              label="Địa chỉ đăng ký"
              value={supplier.registered_address}
              className="sm:col-span-3"
            />
          </Group>

          <Group title="Liên hệ">
            <Field label="Điện thoại" value={supplier.phone} />
            <Field label="Email" value={supplier.email} />
            <Field label="Website" value={supplier.website} />
            <Field
              label="Địa chỉ giao dịch"
              value={supplier.address}
              className="sm:col-span-3"
            />
            <Field
              label="Địa chỉ kho giao hàng"
              value={supplier.warehouse_address}
              className="sm:col-span-3"
            />
          </Group>

          <Group title="Thanh toán">
            <Field label="Điều khoản TT" value={supplier.payment_terms} />
            <Field label="Tiền tệ" value={supplier.currency} />
            <Field label="ĐK xuất hoá đơn" value={supplier.invoice_terms} />
            <Field label="Ngân hàng" value={supplier.bank_name} />
            <Field label="Số tài khoản" value={supplier.bank_account} mono />
            <Field label="SWIFT" value={supplier.swift_code} mono />
          </Group>

          <Group title="Mua hàng">
            <Field label="MOQ" value={supplier.moq} />
            <Field
              label="Lead time"
              value={
                supplier.lead_time_days != null ? `${supplier.lead_time_days} ngày` : null
              }
            />
            <Field label="Incoterms" value={supplier.incoterms} />
            <Field label="Phương thức giao" value={supplier.delivery_method} />
            <Field
              label="Chính sách đổi trả"
              value={supplier.return_policy}
              className="sm:col-span-3"
            />
            <Field
              label="Chính sách bảo hành"
              value={supplier.warranty_policy}
              className="sm:col-span-3"
            />
          </Group>

          <Group title="Phân loại">
            <Field label="Khu vực" value={supplier.region} />
            <Field
              label="Hình thức"
              value={IMPEX_LABEL[supplier.import_export ?? ''] ?? supplier.import_export}
            />
            <Field
              label="Mức ưu tiên"
              value={PRIORITY_LABEL[supplier.priority ?? ''] ?? supplier.priority}
            />
            <Field label="Xếp hạng" value={supplier.rating} />
            <Field label="Ghi chú" value={supplier.note} className="sm:col-span-3" />
          </Group>
        </div>
      )}

      {tab === 'eval' && <EvalTab supplier={supplier} pos={pos} canEdit={canEdit} />}

      {tab === 'purchased' &&
        (purchased.length === 0 ? (
          <EmptyState
            icon="▤"
            title="Chưa mua vật tư nào"
            description="NCC này chưa có dòng vật tư nào trong các đơn đặt."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr className="text-left text-[11px] tracking-wide text-zinc-500 uppercase">
                  <th className="px-3 py-2">Vật tư</th>
                  <th className="px-3 py-2 text-right">Tổng SL đặt</th>
                  <th className="px-3 py-2 text-right">Giá gần nhất</th>
                  <th className="px-3 py-2 text-right">Mua gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {purchased.map((m) => (
                  <tr
                    key={m.material_id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-zinc-400">
                        {m.material_code}
                      </span>{' '}
                      {m.material_name}
                      <span className="ml-1.5 text-xs text-zinc-400">
                        · {m.order_lines} lần
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(m.total_qty)}{' '}
                      <span className="text-xs text-zinc-400">{m.material_unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                      {m.last_price != null ? (
                        <>
                          {money(m.last_price)}{' '}
                          <span className="text-xs text-zinc-400">
                            {m.last_currency}/{m.material_unit}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-zinc-500">
                      {date(m.last_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'prices' && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <PricesPanel supplier={supplier} materials={materials} canEdit={canEdit} />
        </div>
      )}

      {tab === 'certs' && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <CertsPanel supplierId={supplier.id} canEdit={canEdit} />
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
        maxWidth="sm:max-w-3xl"
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

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-0.5 text-lg leading-none">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n === value ? 0 : n)}
          className={
            (n <= value ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600') +
            (disabled ? '' : ' hover:text-amber-400')
          }
          aria-label={`${n} sao`}
        >
          ★
        </button>
      ))}
      <span className="ml-1 text-xs text-zinc-400">
        {value ? `${value}/5` : 'chưa chấm'}
      </span>
    </div>
  )
}

const RATING_TONE: Record<string, 'green' | 'blue' | 'amber' | 'red'> = {
  A: 'green',
  B: 'blue',
  C: 'amber',
  D: 'red',
}

function EvalTab({
  supplier,
  pos,
  canEdit,
}: {
  supplier: Supplier
  pos: PoRow[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState(supplier.quality_score ?? 0)
  const [s, setS] = useState(supplier.service_score ?? 0)
  const [p, setP] = useState(supplier.price_score ?? 0)
  const [complaint, setComplaint] = useState(String(supplier.complaint_count ?? 0))
  const [rating, setRating] = useState(supplier.rating ?? '')

  const kpi = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const active = pos.filter((x) => x.status !== 'cancelled')
    const received = active.filter((x) => x.status === 'received').length
    const late = pos.filter(
      (x) =>
        x.expected_at &&
        x.expected_at.slice(0, 10) < today &&
        !['received', 'cancelled'].includes(x.status),
    ).length
    const rate = active.length ? Math.round((received / active.length) * 100) : 0
    return { total: active.length, received, late, rate }
  }, [pos])

  async function save() {
    setBusy(true)
    try {
      await api(`/api/dept/supply/suppliers/${supplier.id}`, {
        method: 'PATCH',
        body: {
          quality_score: q || null,
          service_score: s || null,
          price_score: p || null,
          complaint_count: Number(complaint) || 0,
          rating: rating || null,
        },
      })
      toast.success('Đã lưu đánh giá', supplier.name)
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Giao hàng · tự tính từ PO
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Tổng PO" value={kpi.total} />
          <Kpi label="Đã hoàn tất" value={kpi.received} tone="green" />
          <Kpi label="Đang trễ hẹn" value={kpi.late} tone={kpi.late ? 'red' : 'gray'} />
          <Kpi label="Tỷ lệ hoàn tất" value={`${kpi.rate}%`} tone="blue" />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          “Đang trễ hẹn” = PO quá hẹn giao mà chưa về đủ. Tỷ lệ giao-đúng-hẹn chuẩn cần
          mốc ngày nhận (bổ sung sau).
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Chấm điểm · người mua đánh giá
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreRow label="Chất lượng">
            <Stars value={q} onChange={setQ} disabled={!canEdit} />
          </ScoreRow>
          <ScoreRow label="Dịch vụ">
            <Stars value={s} onChange={setS} disabled={!canEdit} />
          </ScoreRow>
          <ScoreRow label="Giá">
            <Stars value={p} onChange={setP} disabled={!canEdit} />
          </ScoreRow>
          <ScoreRow label="Số lần khiếu nại">
            <input
              type="number"
              min={0}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              disabled={!canEdit}
              className={`${inp} w-24`}
            />
          </ScoreRow>
          <ScoreRow label="Xếp hạng">
            {canEdit ? (
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className={`${inp} w-24`}
              >
                <option value="">—</option>
                {['A', 'B', 'C', 'D'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : rating ? (
              <Badge tone={RATING_TONE[rating] ?? 'gray'}>Hạng {rating}</Badge>
            ) : (
              <span className="text-sm text-zinc-400">Chưa xếp hạng</span>
            )}
          </ScoreRow>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {supplier.evaluated_at
              ? `Đánh giá gần nhất: ${date(supplier.evaluated_at)}`
              : 'Chưa có đánh giá.'}
          </span>
          {canEdit && (
            <button
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy ? 'Đang lưu…' : 'Lưu đánh giá'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

function Kpi({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number | string
  tone?: 'default' | 'green' | 'red' | 'blue' | 'gray'
}) {
  const color =
    tone === 'green'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : tone === 'blue'
          ? 'text-blue-600 dark:text-blue-400'
          : ''
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function ScoreRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
      <span className="text-sm text-zinc-600 dark:text-zinc-300">{label}</span>
      {children}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </section>
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
