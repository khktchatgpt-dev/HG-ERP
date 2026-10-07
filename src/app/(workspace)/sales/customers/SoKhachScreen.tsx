'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, FileText, Plus, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { TopProgressBar } from '@/components/erp/Spinner'
import {
  Chon,
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  Nhan,
  NUM,
  TD,
  TH,
  ToolBtn,
} from '../_erp/ui'
import { KhachForm } from './KhachForm'
import {
  fmtD,
  fmtN,
  STATUS_LABEL,
  termsMissing,
  type Activity,
  type CustomerView,
  type MemberOption,
  type StatusFilter,
} from './khach.shared'

export type CustomerFilters = { q: string; owner: string; status: StatusFilter }

const INPUT =
  'h-7 rounded-sm border border-border bg-card px-2 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none'

/**
 * SỔ KHÁCH HÀNG — khuôn C · Danh sách, kiểu ERP (07/10/2026): "khách nào cần tôi
 * động vào?" Lọc / tìm / phân trang ở SERVER qua query param (bảng khách dài dần
 * theo năm). Dải ô đếm = trạng thái giao dịch + rổ việc (chưa gán phụ trách,
 * của tôi). Thêm khách mở NGĂN tại chỗ, không hộp thoại.
 */
export function SoKhachScreen({
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
  mineCount,
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
  /** Số khách tôi phụ trách (mọi trạng thái) — ô đếm "Của tôi". */
  mineCount: number
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const [navigating, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState(filters.q)

  /** Đổi bộ lọc / trang → đẩy xuống URL để server lọc lại đúng một trang. */
  const applyParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || v === 'all') next.delete(k)
        else next.set(k, v)
      }
      if (!('page' in patch)) next.delete('page')
      const qs = next.toString()
      startTransition(() =>
        router.replace(qs ? `/sales/customers?${qs}` : '/sales/customers'),
      )
    },
    [router, sp],
  )
  useEffect(() => {
    if (q.trim() === filters.q) return
    const t = setTimeout(() => applyParams({ q: q.trim() || undefined }), 500)
    return () => clearTimeout(t)
  }, [q, filters.q, applyParams])

  const hasFilter = !!filters.q || filters.owner !== 'all' || filters.status !== 'active'
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const canCreate = role === 'admin' || role === 'manager' || role === 'employee'

  const cell = (status: StatusFilter, owner = 'all') =>
    filters.status === status && filters.owner === owner && !filters.q

  return (
    <ErpPage>
      <TopProgressBar active={navigating || saving} />
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Khách hàng' }]}
        title="Khách hàng"
        sub="Hồ sơ, người phụ trách, điều khoản mặc định — nguồn tự điền cho báo giá và đơn."
        actions={
          canCreate ? (
            <ToolBtn onClick={() => setCreating((v) => !v)} icon={Plus} primary>
              Thêm khách hàng
            </ToolBtn>
          ) : undefined
        }
      />

      <CountStrip>
        <CountCell
          label="Đang giao dịch"
          value={fmtN(counts.active)}
          on={cell('active')}
          onClick={() => {
            setQ('')
            applyParams({ status: undefined, owner: undefined, q: undefined })
          }}
        />
        <CountCell
          label="Ngừng giao dịch"
          value={fmtN(counts.inactive)}
          on={cell('inactive')}
          onClick={() => applyParams({ status: 'inactive', owner: undefined })}
        />
        <CountCell
          label="Chưa gán phụ trách"
          value={fmtN(counts.unassigned)}
          sub="không ai theo dõi"
          tone={counts.unassigned ? 'warn' : 'neutral'}
          on={filters.owner === 'none'}
          onClick={() => applyParams({ owner: 'none', status: 'all' })}
        />
        <CountCell
          label="Của tôi"
          value={fmtN(mineCount)}
          sub="tôi phụ trách"
          on={filters.owner === currentUserId}
          onClick={() => applyParams({ owner: currentUserId, status: 'all' })}
        />
        <CountCell
          label="Tổng"
          value={fmtN(counts.total)}
          on={cell('all')}
          onClick={() => applyParams({ status: 'all', owner: undefined })}
        />
      </CountStrip>

      <FilterRow>
        <Chon
          label="Phụ trách"
          value={filters.owner}
          onChange={(v) => applyParams({ owner: v })}
          options={[
            { value: 'all', label: 'Mọi người' },
            { value: currentUserId, label: 'Tôi' },
            { value: 'none', label: 'Chưa gán ai' },
            ...members
              .filter((m) => m.id !== currentUserId)
              .map((m) => ({ value: m.id, label: m.label })),
          ]}
          width={180}
        />
        <Chon
          label="Trạng thái"
          value={filters.status}
          onChange={(v) => applyParams({ status: v === 'active' ? undefined : v })}
          options={(['active', 'inactive', 'all'] as StatusFilter[]).map((s) => ({
            value: s,
            label: STATUS_LABEL[s],
          }))}
          width={150}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Tìm
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="tên · mã · email · người liên hệ · ĐT · MST · quốc gia"
            className={`${INPUT} w-[320px]`}
          />
        </label>
        {q.trim() !== filters.q && (
          <span className="text-muted-foreground text-xs">đang tìm…</span>
        )}
        <span className="ml-auto">
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setQ('')
                applyParams({ q: undefined, owner: undefined, status: undefined })
              }}
              className="inline-flex h-7 items-center gap-1 rounded-sm border border-[var(--primary)] bg-[var(--accent)] px-2 text-xs text-[var(--primary)]"
            >
              <X className="size-3" strokeWidth={2} /> Xoá lọc
            </button>
          )}
        </span>
      </FilterRow>

      {creating && (
        <div className="border-border border-b bg-[var(--accent)]/40 px-6 py-3">
          <h3 className="text-foreground mb-2 text-[14px] font-semibold">
            Thêm khách hàng
          </h3>
          <KhachForm
            members={members}
            currentUserId={currentUserId}
            submitLabel="Thêm khách hàng"
            saving={saving}
            onCancel={() => setCreating(false)}
            onSubmit={async (body) => {
              setSaving(true)
              try {
                const { customer } = await api<{ customer: { id: string } }>(
                  '/api/dept/sales/customers',
                  {
                    method: 'POST',
                    body,
                  },
                )
                toast.success('Đã thêm khách hàng', String(body.name ?? ''))
                setCreating(false)
                router.push(`/sales/customers/${customer.id}`)
              } catch (e) {
                toast.error('Chưa thêm được', apiErrorText(e))
              } finally {
                setSaving(false)
              }
            }}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col />
            <col className="w-[200px]" />
            <col className="w-[220px]" />
            <col className="w-[130px]" />
            <col className="w-[120px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Khách hàng · mã</th>
              <th className={TH}>Liên hệ</th>
              <th className={TH}>Điều khoản mặc định</th>
              <th className={`${TH} text-right`}>Báo giá · đơn</th>
              <th className={TH}>Phụ trách</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const a = activity[c.id] ?? { quotes: 0, orders: 0, openOrders: 0 }
              const miss = termsMissing(c)
              return (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground`}>{from + i}</td>
                  <td className={`${TD} min-w-0`}>
                    <Link
                      href={`/sales/customers/${c.id}`}
                      className="block truncate font-medium text-[var(--primary)] hover:underline"
                      title={c.name}
                    >
                      {c.name}
                    </Link>
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate text-[11px] leading-4">
                      {c.code && <span className="font-mono">{c.code}</span>}
                      {c.country && <span>· {c.country}</span>}
                      {!c.is_active && <Nhan tone="neutral">ngừng giao dịch</Nhan>}
                    </span>
                  </td>
                  <td className={`${TD} min-w-0 text-xs`}>
                    {c.contact_person || c.email || c.phone ? (
                      <>
                        <span className="block truncate">
                          {c.contact_person ?? c.email ?? c.phone}
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px] leading-4">
                          {[c.contact_person && c.email, c.phone]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">chưa có</span>
                    )}
                  </td>
                  <td className={`${TD} min-w-0 text-xs`}>
                    <span className="block truncate">
                      {[c.default_currency, c.default_price_term]
                        .filter(Boolean)
                        .join(' · ') || (
                        <span className="text-[var(--warn)]">chưa khai</span>
                      )}
                    </span>
                    <span
                      className="block truncate text-[11px] leading-4"
                      title={c.default_payment_terms ?? ''}
                    >
                      {miss.length === 0 ? (
                        <span className="text-muted-foreground">
                          {c.default_payment_terms}
                        </span>
                      ) : (
                        <span className="text-[var(--warn)]">
                          thiếu {miss.join(' · ')}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`${TD} ${NUM}`}>
                    {a.quotes === 0 && a.orders === 0 ? (
                      <span className="text-muted-foreground text-xs">
                        chưa phát sinh
                      </span>
                    ) : (
                      <>
                        <span className="block">
                          {fmtN(a.quotes)} · {fmtN(a.orders)}
                        </span>
                        {a.openOrders > 0 && (
                          <span className="block text-[11px] leading-4 text-[var(--warn)]">
                            {a.openOrders} đơn đang mở
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className={`${TD} min-w-0 text-xs`}>
                    {c.owner_name ? (
                      <span
                        className={`block truncate ${c.owner_id === currentUserId ? 'font-medium' : ''}`}
                      >
                        {c.owner_name}
                        {c.owner_id === currentUserId && (
                          <span className="text-muted-foreground"> (tôi)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--warn)]">chưa gán</span>
                    )}
                  </td>
                  <td className={`${TD} text-right`}>
                    {c.is_active && (
                      <Link
                        href={`/sales/quotes/new?customer=${c.id}`}
                        className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                        title="Lập báo giá cho khách này"
                      >
                        <FileText className="size-3.5" strokeWidth={1.8} /> Báo giá
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
            {customers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className={`${TD} text-muted-foreground py-8 text-center`}
                >
                  {hasFilter
                    ? 'Không có khách khớp bộ lọc. '
                    : 'Chưa có khách hàng nào. '}
                  {hasFilter ? (
                    <button
                      type="button"
                      className="text-[var(--primary)] hover:underline"
                      onClick={() => {
                        setQ('')
                        applyParams({ q: undefined, owner: undefined, status: undefined })
                      }}
                    >
                      Xoá lọc
                    </button>
                  ) : (
                    'Bấm "Thêm khách hàng" để bắt đầu.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-border bg-card flex flex-wrap items-center gap-3 border-t px-6 py-1.5 text-[13px]">
        <span>
          Hiện{' '}
          <span className="font-mono tabular-nums">
            {from}–{to}
          </span>{' '}
          / <span className="font-mono tabular-nums">{fmtN(total)}</span> khách
        </span>
        <span className="bg-border h-4 w-px" />
        <button
          type="button"
          className="border-border bg-card hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-sm border disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => applyParams({ page: String(page - 1) })}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} />
        </button>
        <span className="font-mono tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="border-border bg-card hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-sm border disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => applyParams({ page: String(page + 1) })}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4" strokeWidth={1.8} />
        </button>
      </div>

      <ErpStatusBar
        left={`Sửa hồ sơ, ngừng giao dịch, xoá: mở hồ sơ từng khách · chỉ người phụ trách (hoặc quản lý) sửa được`}
        right={`Hôm nay ${fmtD(new Date().toISOString())}`}
      />
    </ErpPage>
  )
}
