'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { todayVn } from '@/lib/date-vn'
import { quoteNetPrice } from '@/lib/quote-price'
import { avgLai, checkPrice, vsPlanTotal } from '@/lib/sale-price'
import type { BaoGiaView, DonView, DongBaoGia, RevisionView } from './bao-gia.shared'

export type BaoGiaProps = {
  quote: BaoGiaView
  lines: DongBaoGia[]
  orders: DonView[]
  revisions: RevisionView[]
  customers: { id: string; name: string }[]
  canSeeCost: boolean
  canEdit: boolean
  canApprove: boolean
}

export type Panel = 'lost' | 'copy' | 'reject' | 'cancel' | null

export function useBaoGia(p: BaoGiaProps) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [err, setErr] = useState<string | null>(null)
  const q = p.quote
  const today = todayVn()

  const tong = useMemo(() => {
    let ref = 0
    let noQty = 0
    let zero = 0
    let below = 0
    let belowPlan = 0
    let gain = 0
    let gainN = 0
    const rows: Parameters<typeof avgLai>[0] = []
    const vsRows: Parameters<typeof vsPlanTotal>[0] = []
    for (const l of p.lines) {
      const net = quoteNetPrice(l.unit_price, l.discount_pct)
      if (!(net > 0)) zero++
      if (l.qty) ref += l.qty * net
      else noQty++
      const c = checkPrice(net, p.quote.currency, l.plan)
      if (c.below_cost) below++
      else if (c.below_plan) belowPlan++
      const comparable = !!l.plan && !c.currency_mismatch
      rows.push({ price: net, qty: l.qty, cost: l.plan?.cost ?? null, comparable })
      vsRows.push({ price: net, qty: l.qty, plan: l.plan?.price ?? null, comparable })
      if (comparable && l.plan?.cost != null && net > 0 && l.qty) {
        gain += (net - l.plan.cost) * l.qty
        gainN++
      }
    }
    // Lãi thực bình quân GIA QUYỀN theo trị giá — trước đây là trung bình cộng % (13/10/2026).
    const lai = avgLai(rows)
    return {
      ref,
      noQty,
      zero,
      below,
      belowPlan,
      // null = không dòng nào tính được lãi (thiếu SL / chưa bóc vốn) — đừng in "0,00".
      gain: gainN ? gain : null,
      withCost: lai.n,
      avgLai: lai.pct,
      vsPlan: vsPlanTotal(vsRows),
    }
  }, [p.lines, p.quote.currency])

  const expired =
    !!q.valid_to &&
    q.valid_to < today &&
    !['won', 'lost', 'cancelled', 'superseded'].includes(q.status)
  const can = {
    edit: p.canEdit && (q.status === 'draft' || q.status === 'rejected'),
    send: p.canEdit && (q.status === 'draft' || q.status === 'approved'),
    submit: p.canEdit && (q.status === 'draft' || q.status === 'rejected'),
    decide: p.canApprove && q.status === 'pending_approval',
    order: p.canEdit && (q.status === 'sent' || q.status === 'won') && !expired,
    revise: p.canEdit && ['sent', 'approved', 'won', 'lost'].includes(q.status),
    copy: p.canEdit,
    lost: p.canEdit && q.status === 'sent',
    cancel: p.canEdit && ['draft', 'rejected', 'sent', 'approved'].includes(q.status),
    remove: p.canEdit && q.status === 'draft',
  }
  const sendBlocked =
    p.lines.length === 0
      ? 'Chưa có dòng sản phẩm'
      : tong.zero > 0
        ? `${tong.zero} dòng chưa có đơn giá`
        : !q.valid_to
          ? 'Chưa khai ngày hiệu lực'
          : expired
            ? `Hết hiệu lực từ ${q.valid_to} — sửa ngày hiệu lực`
            : null

  const nextStep = (() => {
    switch (q.status) {
      case 'draft':
        return sendBlocked ? `Sửa: ${sendBlocked}` : 'Chốt & gửi khách (hoặc trình GĐ)'
      case 'pending_approval':
        return 'Chờ Giám đốc duyệt'
      case 'approved':
        return 'Gửi khách'
      case 'rejected':
        return `GĐ trả lại: "${q.rejected_reason ?? 'không ghi lý do'}" — sửa rồi trình lại`
      case 'sent':
        return expired
          ? 'Hết hiệu lực — lập bản sửa đổi'
          : 'Chờ khách: Tạo đơn · Thua · Bản sửa đổi'
      case 'won':
        return 'Đã ra đơn'
      case 'lost':
        return 'Đã thua — lập bản sửa đổi nếu chào lại'
      case 'superseded':
        return 'Đã có bản mới'
      default:
        return 'Đã huỷ'
    }
  })()

  const base = `/api/dept/sales/quotes/${q.id}`
  async function call(
    path: string,
    body: unknown,
    ok: string,
    method: 'POST' | 'DELETE' = 'POST',
  ) {
    setBusy(true)
    setErr(null)
    try {
      const res = await api<{ quote?: { id: string } }>(path, { method, body })
      toast.success(ok, q.code)
      setPanel(null)
      router.refresh()
      return res
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Thao tác thất bại')
      return null
    } finally {
      setBusy(false)
    }
  }

  const send = () => call(`${base}/send`, {}, 'Đã chốt & gửi khách')
  const submit = () => call(`${base}/submit`, {}, 'Đã trình Giám đốc duyệt')
  const approve = () =>
    call(`${base}/decide`, { decision: 'approve' }, 'Đã duyệt báo giá')
  const [rejectReason, setRejectReason] = useState('')
  const reject = () =>
    rejectReason.trim()
      ? call(
          `${base}/decide`,
          { decision: 'reject', reason: rejectReason.trim() },
          'Đã từ chối báo giá',
        )
      : setErr('Nhập lý do từ chối')
  const [lostReason, setLostReason] = useState('')
  const markLost = () =>
    lostReason.trim()
      ? call(`${base}/lost`, { reason: lostReason.trim() }, 'Đã đánh dấu thua')
      : setErr('Nhập lý do thua')
  const cancel = () => call(`${base}/cancel`, {}, 'Đã huỷ báo giá')

  async function revise() {
    const ok = await confirm({
      title: `Lập bản sửa đổi của ${q.code}?`,
      description: `Sao chép thành báo giá NHÁP bản ${q.revision_no + 1} (cùng khách, cùng dòng). Bản này chỉ ngừng hiệu lực khi bản mới được gửi khách.`,
      confirmLabel: 'Lập bản sửa đổi',
    })
    if (!ok) return
    const res = await call(`${base}/revise`, {}, `Đã lập bản ${q.revision_no + 1} (nháp)`)
    if (res?.quote?.id) router.push(`/sales/quotes/${res.quote.id}/edit`)
  }
  const [copyCustomer, setCopyCustomer] = useState(q.customer_id)
  async function copy() {
    const res = await call(
      `${base}/copy`,
      { customer_id: copyCustomer },
      'Đã nhân bản thành báo giá nháp',
    )
    if (res?.quote?.id) router.push(`/sales/quotes/${res.quote.id}/edit`)
  }
  async function remove() {
    const ok = await confirm({
      title: `Xoá báo giá nháp ${q.code}?`,
      description: 'Không khôi phục được.',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const res = await call(base, undefined, 'Đã xoá báo giá nháp', 'DELETE')
    if (res) router.push('/sales/quotes')
  }

  return {
    ...p,
    today,
    busy,
    err,
    panel,
    open: (n: Panel) => {
      setErr(null)
      setPanel(n)
    },
    close: () => {
      setPanel(null)
      setErr(null)
    },
    tong,
    expired,
    can,
    sendBlocked,
    nextStep,
    send,
    submit,
    approve,
    rejectReason,
    setRejectReason,
    reject,
    lostReason,
    setLostReason,
    markLost,
    cancel,
    revise,
    copyCustomer,
    setCopyCustomer,
    copy,
    remove,
  } as const
}

export type BaoGiaCtx = ReturnType<typeof useBaoGia>
