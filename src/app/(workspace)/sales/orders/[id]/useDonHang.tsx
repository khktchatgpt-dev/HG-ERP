'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { todayVn } from '@/lib/date-vn'
import {
  deliveryShortfall,
  shipCapacity,
  DELIVERABLE_STATUSES,
} from '@/lib/order-ship-status'
import { isOrderClosed, orderNextStep } from '@/lib/order-status-ui'
import type {
  CancelImpact,
  ChangeView,
  DongView,
  DonHangView,
  DotXuatView,
  LsxView,
  MergeCandidate,
} from './don-hang.shared'

export type DonHangProps = {
  order: DonHangView
  lines: DongView[]
  shipments: DotXuatView[]
  changes: ChangeView[]
  lsx: LsxView | null
  cancelImpact: CancelImpact | null
  mergeCandidates: MergeCandidate[]
  canEdit: boolean
  canIssue: boolean
  canShip: boolean
  canDeliver: boolean
}

export type Panel = 'ship' | 'deliver' | 'cancel' | 'issue' | null

/**
 * Toàn bộ state + hành động của màn chi tiết đơn bán. Khối con nhận `d` và gọi
 * hàm, KHÔNG ghi thẳng vào state của hook.
 */
export function useDonHang(p: DonHangProps) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [err, setErr] = useState<string | null>(null)

  /* ── số tổng ───────────────────────────────────────────────────────────── */
  const tong = useMemo(() => {
    const qty = p.lines.reduce((s, l) => s + l.qty, 0)
    const shipped = p.lines.reduce((s, l) => s + l.shipped, 0)
    const value = p.lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
    const priced = p.lines.filter((l) => l.unit_price > 0).length
    return { qty, shipped, left: Math.max(qty - shipped, 0), value, priced }
  }, [p.lines])

  const editable = !isOrderClosed(p.order.status)
  /** Dòng còn xuất được (đã tính dung sai). */
  const openLines = useMemo(
    () =>
      p.lines.filter(
        (l) => shipCapacity(l.qty, l.shipped, p.order.qty_tolerance_pct) > 0,
      ),
    [p.lines, p.order.qty_tolerance_pct],
  )
  const shortfall = deliveryShortfall(tong.shipped, tong.qty, p.order.qty_tolerance_pct)
  const canDeliverNow =
    p.canDeliver && editable && DELIVERABLE_STATUSES.has(p.order.status)
  const canShipNow = p.canShip && editable && openLines.length > 0
  const canIssueNow = p.canIssue && p.order.status === 'confirmed' && !p.lsx
  const canCancelNow = p.canEdit && editable
  const nextStep = orderNextStep({
    status: p.order.status,
    hasLsx: !!p.lsx,
    lsxStatus: p.lsx?.status ?? null,
    shipped: tong.shipped,
    total: tong.qty,
  })

  /** Điều khoản hợp đồng còn trống → bản in Sales Contract sẽ thiếu Article 3/5. */
  const contractMissing = useMemo(() => {
    const o = p.order
    const m: string[] = []
    if (!o.price_term) m.push('Incoterm')
    if (!o.payment_terms && !o.payment_method) m.push('Thanh toán')
    if (!o.port_of_loading) m.push('Cảng xếp')
    if (!o.port_of_discharge) m.push('Cảng dỡ')
    if (tong.priced < p.lines.length) m.push(`${p.lines.length - tong.priced} dòng giá 0`)
    return m
  }, [p.order, p.lines.length, tong.priced])

  /* ── ghi xuất một đợt (nhiều dòng) ────────────────────────────────────── */
  const [shipDate, setShipDate] = useState(() => todayVn())
  const [shipNote, setShipNote] = useState('')
  const [shipQty, setShipQty] = useState<Record<string, string>>({})
  const [shipPick, setShipPick] = useState<Record<string, boolean>>({})

  function openShip() {
    const q: Record<string, string> = {}
    const pick: Record<string, boolean> = {}
    for (const l of openLines) {
      q[l.id] = String(shipCapacity(l.qty, l.shipped, p.order.qty_tolerance_pct))
      pick[l.id] = true
    }
    setShipQty(q)
    setShipPick(pick)
    setShipDate(todayVn())
    setShipNote('')
    setErr(null)
    setPanel('ship')
  }
  const shipLines = useMemo(
    () =>
      openLines
        .filter((l) => shipPick[l.id])
        .map((l) => ({ order_line_id: l.id, qty: Number(shipQty[l.id] ?? 0) })),
    [openLines, shipPick, shipQty],
  )
  const shipBlocked = useMemo(() => {
    if (shipLines.length === 0) return 'Chưa chọn dòng nào để xuất'
    for (const s of shipLines) {
      const l = openLines.find((x) => x.id === s.order_line_id)!
      const cap = shipCapacity(l.qty, l.shipped, p.order.qty_tolerance_pct)
      if (!(s.qty > 0)) return `Dòng ${l.product_code}: số lượng phải > 0`
      if (s.qty > cap) return `Dòng ${l.product_code}: chỉ còn xuất được ${cap}`
    }
    if (!shipDate) return 'Chưa có ngày xuất'
    return null
  }, [shipLines, openLines, p.order.qty_tolerance_pct, shipDate])

  async function doShip() {
    if (shipBlocked) return setErr(shipBlocked)
    setBusy(true)
    setErr(null)
    try {
      await api(`/api/dept/sales/orders/${p.order.id}/shipments`, {
        method: 'POST',
        body: { shipped_at: shipDate, note: shipNote.trim() || null, lines: shipLines },
      })
      toast.success(
        `Đã ghi xuất ${shipLines.length} dòng`,
        `${p.order.code} · ${shipLines.reduce((s, l) => s + l.qty, 0).toLocaleString('vi-VN')} sp`,
      )
      setPanel(null)
      router.refresh()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Ghi xuất thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function removeShipment(s: DotXuatView) {
    const line = p.lines.find((l) => l.id === s.order_line_id)
    const ok = await confirm({
      title: `Gỡ đợt xuất ${s.qty.toLocaleString('vi-VN')} × ${line?.product_code ?? '?'}?`,
      description: 'Dùng khi ghi nhầm — thao tác được lưu vào lịch sử đơn.',
      confirmLabel: 'Gỡ',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/orders/${p.order.id}/shipments/${s.id}`, {
        method: 'DELETE',
      })
      toast.success('Đã gỡ đợt xuất')
      router.refresh()
    } catch (e) {
      toast.error('Gỡ thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /* ── xác nhận đã giao ───────────────────────────────────────────────────── */
  const [deliverNote, setDeliverNote] = useState('')
  const deliverBlocked =
    shortfall > 0 && !deliverNote.trim()
      ? `Mới xuất ${tong.shipped.toLocaleString('vi-VN')}/${tong.qty.toLocaleString('vi-VN')} — còn thiếu ${shortfall.toLocaleString('vi-VN')}. Ghi lý do giao thiếu.`
      : null
  async function doDeliver() {
    if (deliverBlocked) return setErr(deliverBlocked)
    setBusy(true)
    setErr(null)
    try {
      await api(`/api/dept/sales/orders/${p.order.id}/deliver`, {
        method: 'POST',
        body: { note: deliverNote.trim() || null },
      })
      toast.success('Đã xác nhận giao hàng', p.order.code)
      setPanel(null)
      router.refresh()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Xác nhận thất bại')
    } finally {
      setBusy(false)
    }
  }

  /* ── huỷ đơn ────────────────────────────────────────────────────────────── */
  const [cancelReason, setCancelReason] = useState('')
  async function doCancel() {
    if (!cancelReason.trim()) return setErr('Huỷ đơn phải kèm lý do')
    setBusy(true)
    setErr(null)
    try {
      await api(`/api/dept/sales/orders/${p.order.id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason.trim() },
      })
      toast.success('Đã huỷ đơn', p.order.code)
      setPanel(null)
      router.refresh()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Huỷ thất bại')
    } finally {
      setBusy(false)
    }
  }

  /* ── phát lệnh sản xuất ─────────────────────────────────────────────────── */
  const [lsxCode, setLsxCode] = useState('')
  const [lsxShipDate, setLsxShipDate] = useState(p.order.due_date ?? '')
  const [lsxContainer, setLsxContainer] = useState(p.order.container_summary ?? '')
  const [mergeIds, setMergeIds] = useState<string[]>([])
  function toggleMerge(id: string) {
    setMergeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  const issueBlocked = !lsxCode.trim()
    ? 'Nhập số lệnh (vd 11/26-27 - MX)'
    : p.lines.length === 0
      ? 'Đơn chưa có dòng sản phẩm'
      : null
  async function doIssue() {
    if (issueBlocked) return setErr(issueBlocked)
    setBusy(true)
    setErr(null)
    try {
      await api('/api/dept/production/lsx', {
        method: 'POST',
        body: {
          code: lsxCode.trim(),
          order_ids: [p.order.id, ...mergeIds],
          ship_date: lsxShipDate || null,
          container_summary: lsxContainer.trim() || p.order.container_summary,
        },
      })
      toast.success(
        'Đã phát lệnh — chờ Giám đốc duyệt',
        mergeIds.length ? `${p.order.code} + ${mergeIds.length} đơn gộp` : p.order.code,
      )
      setPanel(null)
      router.refresh()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Phát lệnh thất bại')
    } finally {
      setBusy(false)
    }
  }

  function open(next: Panel) {
    setErr(null)
    if (next === 'ship') return openShip()
    setPanel(next)
  }

  return {
    ...p,
    busy,
    err,
    panel,
    open,
    close: () => {
      setPanel(null)
      setErr(null)
    },
    tong,
    editable,
    openLines,
    shortfall,
    nextStep,
    contractMissing,
    canDeliverNow,
    canShipNow,
    canIssueNow,
    canCancelNow,
    ship: {
      date: shipDate,
      setDate: setShipDate,
      note: shipNote,
      setNote: setShipNote,
      qty: shipQty,
      setQty: (id: string, v: string) => setShipQty((q) => ({ ...q, [id]: v })),
      pick: shipPick,
      setPick: (id: string, v: boolean) => setShipPick((q) => ({ ...q, [id]: v })),
      lines: shipLines,
      blocked: shipBlocked,
      submit: doShip,
    },
    removeShipment,
    deliver: {
      note: deliverNote,
      setNote: setDeliverNote,
      blocked: deliverBlocked,
      submit: doDeliver,
    },
    cancel: { reason: cancelReason, setReason: setCancelReason, submit: doCancel },
    issue: {
      code: lsxCode,
      setCode: setLsxCode,
      shipDate: lsxShipDate,
      setShipDate: setLsxShipDate,
      container: lsxContainer,
      setContainer: setLsxContainer,
      mergeIds,
      toggleMerge,
      blocked: issueBlocked,
      submit: doIssue,
    },
  } as const
}

export type DonHangCtx = ReturnType<typeof useDonHang>
