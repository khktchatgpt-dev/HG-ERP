'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, apiErrorText } from '@/lib/api'
import { todayVn } from '@/lib/date-vn'
import { isOrderClosed } from '@/lib/order-status-ui'
import {
  profileMissing,
  termsMissing,
  type CustomerView,
  type MemberOption,
} from '../khach.shared'

export type QuoteRow = {
  id: string
  code: string
  status: string
  currency: string
  valid_from: string | null
  valid_to: string | null
  revision_no: number
  created_at: string
}
export type OrderRow = {
  id: string
  code: string
  quote_code: string | null
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  created_at: string
  updated_at: string
  total: number
}
export type ChangeRow = {
  id: string
  order_id: string
  order_code: string
  changed_by_name: string | null
  type: string
  note: string | null
  created_at: string
}
export type HoSoKhachProps = {
  customer: CustomerView
  quotes: QuoteRow[]
  orders: OrderRow[]
  changes: ChangeRow[]
  /** SP trong thư viện gắn khách này (hồ sơ danh mục: "dùng ở đâu"). */
  productCount: number
  currentUserId: string
  role: 'admin' | 'manager' | 'employee'
  members: MemberOption[]
}

/**
 * State + xử lý hồ sơ khách (khuôn E). Khối con nhận `d`. Hành động mở NGĂN tại
 * chỗ (sửa hồ sơ); ngừng / mở lại / xoá qua hộp xác nhận.
 */
export function useHoSoKhach(p: HoSoKhachProps) {
  const c = p.customer
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [navigating, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const today = todayVn()
  const thisYear = today.slice(0, 4)

  const canEdit =
    p.role === 'admin' || p.role === 'manager' || c.owner_id === p.currentUserId

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setSaving(true)
    try {
      await api(`/api/dept/sales/customers/${c.id}`, { method: 'PATCH', body })
      startTransition(() => router.refresh())
      return true
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
      return false
    } finally {
      setSaving(false)
    }
  }
  async function save(body: Record<string, unknown>) {
    if (await patch(body)) {
      toast.success('Đã lưu hồ sơ', c.name)
      setEditing(false)
    }
  }
  async function toggleActive() {
    const off = c.is_active
    const ok = await confirm({
      title: off ? `Ngừng giao dịch với "${c.name}"?` : `Mở lại "${c.name}"?`,
      description: off
        ? 'Khách bị ẩn khỏi danh sách mặc định và không chọn được khi lập báo giá / tạo đơn. Lịch sử giữ nguyên, mở lại được bất cứ lúc nào.'
        : 'Khách trở lại danh sách đang giao dịch và chọn được khi lập báo giá.',
      confirmLabel: off ? 'Ngừng giao dịch' : 'Mở lại',
      tone: off ? 'danger' : 'default',
    })
    if (!ok) return
    if (await patch({ is_active: !c.is_active }))
      toast.success(off ? 'Đã ngừng giao dịch' : 'Đã mở lại', c.name)
  }
  const canDelete = p.quotes.length === 0 && p.orders.length === 0 && p.productCount === 0
  async function remove() {
    if (!canDelete) {
      toast.error(
        'Không xoá được khách đã có lịch sử',
        `${p.quotes.length} báo giá · ${p.orders.length} đơn · ${p.productCount} SP. Dùng "Ngừng giao dịch".`,
      )
      return
    }
    const ok = await confirm({
      title: `Xoá khách "${c.name}"?`,
      description: 'Khách chưa có báo giá / đơn / SP nên xoá được. Không hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setSaving(true)
    try {
      await api(`/api/dept/sales/customers/${c.id}`, { method: 'DELETE' })
      toast.success('Đã xoá khách hàng', c.name)
      router.push('/sales/customers')
    } catch (e) {
      toast.error('Xoá thất bại', apiErrorText(e))
    } finally {
      setSaving(false)
    }
  }

  /* ── dải hiệu suất (mỗi ô kèm mẫu số) ───────────────────────────────── */
  const stats = useMemo(() => {
    const live = p.orders.filter((o) => o.status !== 'cancelled')
    const open = live.filter((o) => !isOrderClosed(o.status))
    const late = open.filter((o) => o.due_date && o.due_date < today)
    const yearOrders = live.filter((o) => o.created_at.slice(0, 4) === thisYear)
    const byCur = (rows: OrderRow[]) => {
      const m = new Map<string, number>()
      for (const o of rows)
        if (o.total > 0) m.set(o.currency, (m.get(o.currency) ?? 0) + o.total)
      return m
    }
    const yearByCur = byCur(yearOrders)
    const allByCur = byCur(live)
    const sentQuotes = p.quotes.filter((q) => ['sent', 'won'].includes(q.status)).length
    const wonQuotes = p.quotes.filter((q) => q.status === 'won').length
    const lastOrder = live.reduce<string | null>(
      (a, o) => (!a || o.created_at > a ? o.created_at : a),
      null,
    )
    const lastDelivered = p.orders
      .filter((o) => o.status === 'delivered' || o.status === 'shipped')
      .reduce<string | null>((a, o) => (!a || o.updated_at > a ? o.updated_at : a), null)
    return {
      yearByCur,
      allByCur,
      yearOrders: yearOrders.length,
      live: live.length,
      open: open.length,
      late: late.length,
      sentQuotes,
      wonQuotes,
      lastOrder,
      lastDelivered,
      noPrice: live.filter((o) => o.total <= 0).length,
    }
  }, [p.orders, p.quotes, today, thisYear])

  /* ── dòng thời gian hoạt động ───────────────────────────────────────── */
  const activity = useMemo(() => {
    type Ev = {
      at: string
      text: string
      who: string | null
      href: string | null
      tone: 'stop' | 'done' | 'warn' | 'neutral'
    }
    const evs: Ev[] = [
      ...p.quotes.map<Ev>((q) => ({
        at: q.created_at,
        text: `Lập báo giá ${q.code}${q.revision_no > 1 ? ` (bản ${q.revision_no})` : ''}`,
        who: null,
        href: `/sales/quotes/${q.id}`,
        tone: 'neutral',
      })),
      ...p.orders.map<Ev>((o) => ({
        at: o.created_at,
        text: `Tạo đơn ${o.code}${o.customer_po_no ? ` — PO ${o.customer_po_no}` : ''}`,
        who: null,
        href: `/sales/orders/${o.id}`,
        tone: 'neutral',
      })),
      ...p.changes.map<Ev>((ch) => ({
        at: ch.created_at,
        text:
          ch.type === 'cancel'
            ? `Huỷ đơn ${ch.order_code}${ch.note ? ` — ${ch.note}` : ''}`
            : ch.type === 'delivered'
              ? `Giao xong đơn ${ch.order_code}`
              : `Sửa đơn ${ch.order_code}${ch.note ? ` — ${ch.note}` : ''}`,
        who: ch.changed_by_name,
        href: `/sales/orders/${ch.order_id}`,
        tone: ch.type === 'cancel' ? 'stop' : ch.type === 'delivered' ? 'done' : 'warn',
      })),
    ]
    return evs.sort((a, b) => b.at.localeCompare(a.at))
  }, [p.quotes, p.orders, p.changes])

  return {
    ...p,
    c,
    today,
    thisYear,
    busy: navigating || saving,
    saving,
    canEdit,
    canDelete,
    editing,
    setEditing,
    save,
    toggleActive,
    remove,
    stats,
    activity,
    termsMissing: termsMissing(c),
    profileMissing: profileMissing(c),
  } as const
}

export type HoSoKhachCtx = ReturnType<typeof useHoSoKhach>
