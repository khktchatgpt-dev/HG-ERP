'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { RefChain } from '@/components/erp/RefChain'
import { PricesPanel, type MaterialOption } from '../PricesPanel'
import { CertsPanel } from '../CertsPanel'
import { MaterialGroupsPanel, type MaterialGroup } from '../MaterialGroupsPanel'
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
  /** null = giá theo ĐVT mua; 'kg'/'m²' = giá theo đv2 (giá đv kép 0053). */
  last_price_unit: string | null
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
const RATING_TONE: Record<string, 'green' | 'blue' | 'amber' | 'red'> = {
  A: 'green',
  B: 'blue',
  C: 'amber',
  D: 'red',
}
const GRADE_BG: Record<string, string> = {
  A: 'bg-green-600',
  B: 'bg-blue-600',
  C: 'bg-amber-500',
  D: 'bg-red-600',
}
const TYPES = ['Nguyên vật liệu', 'Bao bì', 'Máy móc', 'Dịch vụ', 'Logistics', 'Khác']

type Tab = 'profile' | 'eval' | 'purchased' | 'prices' | 'certs' | 'history'

export function SupplierDetail({
  supplier,
  pos,
  purchased,
  materials,
  allGroups,
  groupIds,
  canEdit,
}: {
  supplier: Supplier
  pos: PoRow[]
  purchased: PurchasedMaterial[]
  materials: MaterialOption[]
  allGroups: MaterialGroup[]
  groupIds: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('profile')
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

  const groupLabels = groupIds
    .map((id) => allGroups.find((g) => g.id === id)?.label)
    .filter(Boolean) as string[]
  const scores = [
    supplier.quality_score,
    supplier.service_score,
    supplier.price_score,
  ].filter((n): n is number => n != null)
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  async function toggleActive() {
    if (supplier.is_active) {
      const ok = await confirm({
        title: `Ngừng giao dịch với ${supplier.name}?`,
        description:
          'NCC ngừng sẽ không chọn được khi tạo PO / so giá.' +
          (stats.open > 0 ? ` CHÚ Ý: còn ${stats.open} PO đang mở với NCC này.` : ''),
        tone: stats.open > 0 ? 'danger' : undefined,
        confirmLabel: 'Ngừng giao dịch',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await api(`/api/dept/supply/suppliers/${supplier.id}`, {
        method: 'PATCH',
        body: { is_active: !supplier.is_active },
      })
      toast.success(
        supplier.is_active ? 'Đã ngừng giao dịch' : 'Đã kích hoạt lại',
        supplier.name,
      )
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const historyCols: Column<PoRow>[] = [
    {
      key: 'code',
      header: 'Số PO',
      width: '140px',
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
      width: '160px',
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
      width: '140px',
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
    { id: 'profile', label: 'Hồ sơ' },
    { id: 'eval', label: 'Đánh giá' },
    { id: 'purchased', label: `Vật tư đã mua (${purchased.length})` },
    { id: 'prices', label: 'Bảng giá' },
    { id: 'certs', label: 'Chứng chỉ' },
    { id: 'history', label: `Lịch sử mua (${pos.length})` },
  ]

  const S = supplier // ngắn gọn

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />

      {/* Topbar */}
      <div>
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-zinc-400">
          <Link href="/planning" className="hover:text-zinc-600 dark:hover:text-zinc-300">
            Kế hoạch - Cung ứng
          </Link>
          <span>/</span>
          <Link
            href="/planning/suppliers"
            className="hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Nhà cung cấp
          </Link>
          <span>/</span>
          <span className="text-zinc-500">{S.name}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-xl font-bold">
            {S.name}
            {S.rating && (
              <span
                className={`grid h-7 w-7 place-items-center rounded-lg text-sm font-bold text-white ${GRADE_BG[S.rating] ?? 'bg-zinc-500'}`}
              >
                {S.rating}
              </span>
            )}
          </h1>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/planning/pos/new?supplier=${S.id}`)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
              >
                + Tạo PO
              </button>
              <button
                onClick={() => void toggleActive()}
                className={
                  S.is_active
                    ? 'rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900'
                    : 'rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700'
                }
              >
                {S.is_active ? 'Ngừng giao dịch' : 'Kích hoạt lại'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2 cột: sidebar nhận diện + vùng chi tiết */}
      <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
        <VendorSidebar
          s={S}
          groupLabels={groupLabels}
          avgScore={avgScore}
          spend={stats.spend}
          openPo={stats.open}
          totalPo={stats.total}
          lastAt={stats.last}
        />

        <div className="min-w-0">
          {/* Tabs */}
          <div className="mb-3 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  'border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ' +
                  (tab === t.id
                    ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <div className="flex flex-col gap-3">
              <MaterialGroupsPanel
                supplierId={S.id}
                allGroups={allGroups}
                initialGroupIds={groupIds}
                canEdit={canEdit}
              />
              <EditableSection
                title="Cơ bản"
                supplierId={S.id}
                canEdit={canEdit}
                fields={[
                  { key: 'code', label: 'Mã NCC', value: S.code, mono: true },
                  { key: 'short_name', label: 'Tên viết tắt', value: S.short_name },
                  {
                    key: 'type',
                    label: 'Loại NCC',
                    value: S.type,
                    kind: 'select',
                    options: TYPES.map((t) => ({ value: t, label: t })),
                  },
                  {
                    key: 'status',
                    label: 'Trạng thái',
                    value: S.status,
                    display: STATUS_LABEL[S.status] ?? S.status,
                    kind: 'select',
                    options: [
                      { value: 'active', label: 'Hoạt động' },
                      { value: 'suspended', label: 'Tạm ngưng' },
                      { value: 'terminated', label: 'Ngừng hợp tác' },
                    ],
                  },
                  {
                    key: 'lock_reason',
                    label: 'Lý do khoá',
                    value: S.lock_reason,
                    full: true,
                  },
                ]}
              />
              <EditableSection
                title="Pháp lý"
                supplierId={S.id}
                canEdit={canEdit}
                fields={[
                  { key: 'company_name', label: 'Tên công ty', value: S.company_name },
                  { key: 'tax_no', label: 'Mã số thuế', value: S.tax_no, mono: true },
                  {
                    key: 'business_license',
                    label: 'Giấy phép KD',
                    value: S.business_license,
                  },
                  {
                    key: 'founded_on',
                    label: 'Ngày thành lập',
                    value: S.founded_on,
                    kind: 'date',
                    display: S.founded_on ? date(S.founded_on) : null,
                  },
                  { key: 'legal_rep', label: 'Người đại diện PL', value: S.legal_rep },
                  { key: 'country', label: 'Quốc gia', value: S.country },
                  {
                    key: 'registered_address',
                    label: 'Địa chỉ đăng ký',
                    value: S.registered_address,
                    full: true,
                  },
                ]}
              />
              <EditableSection
                title="Liên hệ"
                supplierId={S.id}
                canEdit={canEdit}
                fields={[
                  { key: 'phone', label: 'Điện thoại', value: S.phone },
                  { key: 'email', label: 'Email', value: S.email },
                  { key: 'website', label: 'Website', value: S.website },
                  {
                    key: 'address',
                    label: 'Địa chỉ giao dịch',
                    value: S.address,
                    full: true,
                  },
                  {
                    key: 'warehouse_address',
                    label: 'Địa chỉ kho giao hàng',
                    value: S.warehouse_address,
                    full: true,
                  },
                ]}
              />
              <EditableSection
                title="Thanh toán"
                supplierId={S.id}
                canEdit={canEdit}
                fields={[
                  {
                    key: 'payment_terms',
                    label: 'Điều khoản TT',
                    value: S.payment_terms,
                  },
                  {
                    key: 'currency',
                    label: 'Tiền tệ',
                    value: S.currency,
                    kind: 'select',
                    options: ['VND', 'USD', 'EUR', 'CNY', 'JPY'].map((c) => ({
                      value: c,
                      label: c,
                    })),
                  },
                  {
                    key: 'invoice_terms',
                    label: 'ĐK xuất hoá đơn',
                    value: S.invoice_terms,
                  },
                  { key: 'bank_name', label: 'Ngân hàng', value: S.bank_name },
                  {
                    key: 'bank_account',
                    label: 'Số tài khoản',
                    value: S.bank_account,
                    mono: true,
                  },
                  { key: 'swift_code', label: 'SWIFT', value: S.swift_code, mono: true },
                ]}
              />
              <EditableSection
                title="Mua hàng"
                supplierId={S.id}
                canEdit={canEdit}
                fields={[
                  { key: 'moq', label: 'MOQ', value: S.moq },
                  {
                    key: 'lead_time_days',
                    label: 'Lead time (ngày)',
                    value: S.lead_time_days,
                    kind: 'number',
                    display: S.lead_time_days != null ? `${S.lead_time_days} ngày` : null,
                  },
                  { key: 'incoterms', label: 'Incoterms', value: S.incoterms },
                  {
                    key: 'delivery_method',
                    label: 'Phương thức giao',
                    value: S.delivery_method,
                  },
                  {
                    key: 'return_policy',
                    label: 'Chính sách đổi trả',
                    value: S.return_policy,
                    full: true,
                  },
                  {
                    key: 'warranty_policy',
                    label: 'Chính sách bảo hành',
                    value: S.warranty_policy,
                    full: true,
                  },
                ]}
              />
              <EditableSection
                title="Phân loại"
                supplierId={S.id}
                canEdit={canEdit}
                fields={[
                  { key: 'region', label: 'Khu vực', value: S.region },
                  {
                    key: 'import_export',
                    label: 'Hình thức',
                    value: S.import_export,
                    display:
                      { domestic: 'Nội địa', import: 'Nhập khẩu' }[
                        S.import_export ?? ''
                      ] ?? S.import_export,
                    kind: 'select',
                    options: [
                      { value: 'domestic', label: 'Nội địa' },
                      { value: 'import', label: 'Nhập khẩu' },
                    ],
                  },
                  {
                    key: 'priority',
                    label: 'Mức ưu tiên',
                    value: S.priority,
                    display:
                      { primary: 'Chính', backup: 'Dự phòng' }[S.priority ?? ''] ??
                      S.priority,
                    kind: 'select',
                    options: [
                      { value: 'primary', label: 'Chính' },
                      { value: 'backup', label: 'Dự phòng' },
                    ],
                  },
                  {
                    key: 'note',
                    label: 'Ghi chú',
                    value: S.note,
                    kind: 'textarea',
                    full: true,
                  },
                ]}
              />
            </div>
          )}

          {tab === 'eval' && <EvalTab supplier={S} pos={pos} canEdit={canEdit} />}

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
                                {m.last_currency}/{m.last_price_unit ?? m.material_unit}
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
              <PricesPanel supplier={S} materials={materials} canEdit={canEdit} />
            </div>
          )}

          {tab === 'certs' && (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <CertsPanel supplierId={S.id} canEdit={canEdit} />
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
        </div>
      </div>
    </div>
  )
}

// ── Sidebar nhận diện ────────────────────────────────────────────────────────

function VendorSidebar({
  s,
  groupLabels,
  avgScore,
  spend,
  openPo,
  totalPo,
  lastAt,
}: {
  s: Supplier
  groupLabels: string[]
  avgScore: number | null
  spend: number
  openPo: number
  totalPo: number
  lastAt: string | null
}) {
  const stTone = ({ active: 'green', suspended: 'amber', terminated: 'gray' } as const)[
    s.status as 'active' | 'suspended' | 'terminated'
  ]
  const initials = s.name.trim().slice(0, 2).toUpperCase()
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-600 text-lg font-bold text-white">
          {initials}
        </div>
        <div className="mt-2.5 text-base font-bold">{s.name}</div>
        <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
          {s.code ?? '—'}
          {s.tax_no ? ` · MST ${s.tax_no}` : ''}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          {s.rating ? (
            <span
              className={`grid h-8 w-8 place-items-center rounded-lg text-base font-bold text-white ${GRADE_BG[s.rating] ?? 'bg-zinc-500'}`}
            >
              {s.rating}
            </span>
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-200 text-sm font-bold text-zinc-400 dark:bg-zinc-800">
              —
            </span>
          )}
          <div className="text-left">
            <div className="text-sm leading-none text-amber-500">
              {'★'.repeat(Math.round(avgScore ?? 0))}
              <span className="text-zinc-300 dark:text-zinc-600">
                {'★'.repeat(5 - Math.round(avgScore ?? 0))}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              {avgScore != null ? `Điểm TB ${avgScore}/5` : 'Chưa đánh giá'}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {s.type && <Badge tone="blue">{s.type}</Badge>}
          <Badge tone={stTone ?? 'gray'}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
          {s.can_order ? (
            <Badge tone="green">✓ Cho đặt hàng</Badge>
          ) : (
            <Badge tone="red">⚠ Khoá</Badge>
          )}
        </div>
        {groupLabels.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {groupLabels.map((g) => (
              <Badge key={g} tone="purple">
                {g}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        <Mini label="Tổng chi" value={money(spend)} />
        <Mini label="PO đang mở" value={openPo} />
        <Mini label="Tổng PO" value={totalPo} />
        <Mini label="Mua gần nhất" value={lastAt ? date(lastAt) : '—'} small />
      </div>

      {(s.phone || s.email) && (
        <SideCard title="Liên hệ mua hàng">
          {s.phone && <SideRow k="Điện thoại" v={s.phone} mono />}
          {s.email && <SideRow k="Email" v={s.email} />}
        </SideCard>
      )}
      {(s.payment_terms || s.lead_time_days != null || s.incoterms || s.bank_name) && (
        <SideCard title="Điều khoản & ngân hàng">
          {s.payment_terms && <SideRow k="Thanh toán" v={s.payment_terms} />}
          {s.lead_time_days != null && (
            <SideRow k="Lead time" v={`${s.lead_time_days} ngày`} />
          )}
          {s.incoterms && <SideRow k="Incoterms" v={s.incoterms} />}
          {s.bank_name && <SideRow k="Ngân hàng" v={s.bank_name} />}
        </SideCard>
      )}
    </aside>
  )
}

function Mini({
  label,
  value,
  small,
}: {
  label: string
  value: number | string
  small?: boolean
}) {
  return (
    <div className="bg-white px-3 py-2.5 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
        {label}
      </div>
      <div className={`mt-0.5 font-bold tabular-nums ${small ? 'text-sm' : 'text-lg'}`}>
        {value}
      </div>
    </div>
  )
}
function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}
function SideRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-1 text-[12.5px]">
      <span className="text-zinc-400">{k}</span>
      <span
        className={`min-w-0 truncate text-right font-medium ${mono ? 'font-mono' : ''}`}
      >
        {v}
      </span>
    </div>
  )
}

// ── Mục hồ sơ sửa inline ─────────────────────────────────────────────────────

type EField = {
  key: string
  label: string
  value: string | number | null
  kind?: 'text' | 'textarea' | 'select' | 'date' | 'number'
  options?: { value: string; label: string }[]
  mono?: boolean
  display?: string | null
  full?: boolean
}

function EditableSection({
  title,
  supplierId,
  canEdit,
  fields,
}: {
  title: string
  supplierId: string
  canEdit: boolean
  fields: EField[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  function startEdit() {
    setForm(
      Object.fromEntries(
        fields.map((f) => [f.key, f.value == null ? '' : String(f.value)]),
      ),
    )
    setEditing(true)
  }

  async function save() {
    const body: Record<string, unknown> = {}
    for (const f of fields) {
      const raw = form[f.key] ?? ''
      body[f.key] = raw === '' ? null : f.kind === 'number' ? Number(raw) : raw
    }
    setBusy(true)
    try {
      await api(`/api/dept/supply/suppliers/${supplierId}`, { method: 'PATCH', body })
      toast.success('Đã lưu', title)
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const filled = fields.filter((f) => f.value != null && f.value !== '')
  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <b className="text-[13px]">{title}</b>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400"
          >
            ✎ Sửa mục này
          </button>
        )}
      </div>

      <div className="p-4">
        {editing ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <label
                  key={f.key}
                  className={`flex flex-col gap-1 text-xs ${f.full ? 'sm:col-span-2 lg:col-span-3' : ''}`}
                >
                  <span className="font-medium text-zinc-500">{f.label}</span>
                  {f.kind === 'select' ? (
                    <select
                      value={form[f.key] ?? ''}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                      className={inp}
                    >
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === 'textarea' ? (
                    <textarea
                      rows={2}
                      value={form[f.key] ?? ''}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                      className={inp}
                    />
                  ) : (
                    <input
                      type={
                        f.kind === 'date'
                          ? 'date'
                          : f.kind === 'number'
                            ? 'number'
                            : 'text'
                      }
                      value={form[f.key] ?? ''}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                      className={`${inp} ${f.mono ? 'font-mono' : ''}`}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Huỷ
              </button>
              <button
                onClick={() => void save()}
                disabled={busy}
                className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy ? 'Đang lưu…' : 'Lưu mục'}
              </button>
            </div>
          </>
        ) : filled.length === 0 ? (
          <p className="py-1 text-sm text-zinc-400">
            Chưa có thông tin{canEdit ? ' — bấm “Sửa mục này” để thêm.' : '.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {filled.map((f) => (
              <div
                key={f.key}
                className={`flex justify-between gap-3 border-b border-dashed border-zinc-100 py-2 text-[13px] dark:border-zinc-800 ${f.full ? 'sm:col-span-2 lg:col-span-3' : ''}`}
              >
                <span className="whitespace-nowrap text-zinc-400">{f.label}</span>
                <span
                  className={`min-w-0 truncate text-right font-medium ${f.mono ? 'font-mono' : ''}`}
                >
                  {f.display ?? String(f.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Tab Đánh giá ─────────────────────────────────────────────────────────────

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
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
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
