'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type {
  ChangeView,
  DonView,
  LenhView,
  LotView,
  MergeCandidate,
  NhomView,
  PoView,
  SyncPreview,
} from './lenh.shared'

export type LenhProps = {
  lsx: LenhView
  orders: DonView[]
  groups: NhomView[]
  lots: LotView[]
  /** Lô lệch lệnh (kiemKeHoach lúc đọc): vượt SL / SP lạ / đợt rỗng. */
  lotIssues: string[]
  /** SP chưa xếp đủ vào lô: mã → còn lại. */
  lotLeft: Record<string, number>
  jobs: { done: number; total: number }
  changes: ChangeView[]
  pos: PoView[]
  mergeCandidates: MergeCandidate[]
  canApprove: boolean
  canOwn: boolean
  canIssue: boolean
}

export type Panel =
  | 'header'
  | 'submit'
  | 'resubmit'
  | 'reject'
  | 'cancel'
  | 'delete'
  | 'sync'
  | 'merge'
  | null

export function useLenh(p: LenhProps) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [err, setErr] = useState<string | null>(null)
  const l = p.lsx

  const tong = useMemo(() => {
    const lines = p.groups.flatMap((g) => g.lines)
    return {
      lines: lines.length,
      qty: lines.reduce((s, x) => s + x.qty, 0),
      lotQty: p.lots.reduce((s, x) => s + x.qty, 0),
      bomMissing: lines.filter((x) => x.bom_missing).length,
      orderQty: p.orders.reduce((s, o) => s + o.qty, 0),
      shipped: p.orders.reduce((s, o) => s + o.shipped, 0),
    }
  }, [p.groups, p.lots, p.orders])

  const published = l.status === 'approved' || l.status === 'in_progress'
  const open = !['completed', 'cancelled'].includes(l.status)
  const can = {
    submit: p.canOwn && l.status === 'draft',
    resubmit: p.canOwn && l.status === 'rejected',
    decide: p.canApprove && l.status === 'pending_approval',
    header: p.canOwn && open,
    lines: p.canOwn && open,
    delete: p.canOwn && (l.status === 'draft' || l.status === 'rejected'),
    cancel:
      p.canOwn && ['pending_approval', 'approved', 'in_progress'].includes(l.status),
    sync: p.canOwn && open,
    merge: p.canOwn && open && p.mergeCandidates.length > 0,
    lots: published || l.status === 'pending_approval',
  }

  const nextStep = (() => {
    switch (l.status) {
      case 'draft':
        return tong.lines === 0 ? 'Soạn dòng lệnh' : 'Gửi Giám đốc duyệt'
      case 'pending_approval':
        return 'Chờ Giám đốc duyệt'
      case 'rejected':
        return 'Sửa theo lý do từ chối, trình lại'
      case 'approved':
        return p.lots.length === 0
          ? 'Chia đợt xuất'
          : l.materials_received_at
            ? 'Xưởng đang làm'
            : 'Chờ vật tư về'
      case 'in_progress':
        return p.lots.length === 0
          ? 'Chia đợt xuất'
          : `Xưởng ${p.jobs.done}/${p.jobs.total} công đoạn`
      case 'completed':
        return tong.shipped < tong.orderQty ? 'Ghi xuất ở đơn' : 'Đã xong'
      default:
        return 'Đã huỷ'
    }
  })()

  async function call(
    path: string,
    body: unknown,
    ok: string,
    method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  ) {
    setBusy(true)
    setErr(null)
    try {
      await api(path, { method, body })
      toast.success(ok, l.code)
      setPanel(null)
      router.refresh()
      return true
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Thao tác thất bại')
      return false
    } finally {
      setBusy(false)
    }
  }
  const base = `/api/dept/production/lsx/${l.id}`

  /* header */
  const [hCode, setHCode] = useState(l.code)
  const [hShip, setHShip] = useState(l.ship_date ?? '')
  const [hRecv, setHRecv] = useState(l.received_date ?? '')
  const [hCont, setHCont] = useState(l.container_summary ?? '')
  const [hNote, setHNote] = useState(l.note ?? '')
  const [hPriority, setHPriority] = useState(String(l.priority))
  const lotsLockShip = p.lots.some((x) => x.ship_date)
  const headerBody = () => ({
    code: hCode.trim() || undefined,
    ship_date: lotsLockShip ? undefined : hShip || null,
    received_date: hRecv || null,
    container_summary: hCont.trim() || null,
    note: hNote.trim() || null,
    priority: Number(hPriority) || 0,
  })
  const saveHeader = () => call(base, headerBody(), 'Đã lưu đầu lệnh', 'PATCH')

  /* submit / resubmit / decide */
  const submit = () => call(`${base}/submit`, {}, 'Đã gửi Giám đốc duyệt')
  const resubmit = () =>
    call(`${base}/resubmit`, { ship_date: hShip || null, received_date: hRecv || null, container_summary: hCont.trim() || null, note: hNote.trim() || null }, 'Đã trình duyệt lại') // prettier-ignore
  const approve = () => call(`${base}/approve`, {}, 'Đã duyệt lệnh')
  const [rejectReason, setRejectReason] = useState('')
  const reject = () =>
    rejectReason.trim()
      ? call(`${base}/reject`, { reason: rejectReason.trim() }, 'Đã từ chối lệnh')
      : setErr('Nhập lý do từ chối')

  /* cancel / delete */
  const [cancelReason, setCancelReason] = useState('')
  const cancel = () =>
    cancelReason.trim()
      ? call(
          `${base}/cancel`,
          { reason: cancelReason.trim() },
          'Đã huỷ lệnh — đơn về Xác nhận',
        )
      : setErr('Nhập lý do huỷ')
  async function deleteDraft() {
    const ok = await call(base, undefined, 'Đã xoá lệnh — đơn về Xác nhận', 'DELETE')
    if (ok) router.push('/sales/lsx')
  }

  /* sync from orders */
  const [sync, setSync] = useState<SyncPreview | null>(null)
  const [syncNote, setSyncNote] = useState('')
  async function previewSync() {
    setBusy(true)
    setErr(null)
    try {
      setSync(
        await api<SyncPreview>(`${base}/sync-orders`, {
          method: 'POST',
          body: { apply: false },
        }),
      )
      setPanel('sync')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không so được với đơn')
    } finally {
      setBusy(false)
    }
  }
  const applySync = () =>
    published && !syncNote.trim()
      ? setErr('Lệnh đã duyệt — ghi lý do rồi mới áp (sinh bản phát lại)')
      : call(`${base}/sync-orders`, { apply: true, revision_note: syncNote.trim() || null }, 'Đã đồng bộ dòng lệnh theo đơn') // prettier-ignore

  /* merge / remove orders */
  const [mergeIds, setMergeIds] = useState<string[]>([])
  const toggleMerge = (id: string) =>
    setMergeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  const addOrders = () =>
    mergeIds.length
      ? call(
          `${base}/orders`,
          { order_ids: mergeIds },
          `Đã gộp ${mergeIds.length} đơn vào lệnh`,
        )
      : setErr('Chọn đơn cần gộp')
  const removeOrder = (orderId: string) =>
    call(`${base}/orders`, { order_ids: [orderId] }, 'Đã gỡ đơn khỏi lệnh', 'DELETE')

  function openPanel(next: Panel) {
    setErr(null)
    if (next === 'sync') return void previewSync()
    setPanel(next)
  }

  return {
    ...p,
    busy,
    err,
    panel,
    open: openPanel,
    close: () => {
      setPanel(null)
      setErr(null)
    },
    tong,
    published,
    isOpen: open,
    can,
    nextStep,
    header: {
      code: hCode,
      setCode: setHCode,
      ship: hShip,
      setShip: setHShip,
      recv: hRecv,
      setRecv: setHRecv,
      cont: hCont,
      setCont: setHCont,
      note: hNote,
      setNote: setHNote,
      priority: hPriority,
      setPriority: setHPriority,
      lotsLockShip,
      save: saveHeader,
    },
    submit,
    resubmit,
    approve,
    rejectReason,
    setRejectReason,
    reject,
    cancelReason,
    setCancelReason,
    cancel,
    deleteDraft,
    sync,
    syncNote,
    setSyncNote,
    applySync,
    mergeIds,
    toggleMerge,
    addOrders,
    removeOrder,
  } as const
}

export type LenhCtx = ReturnType<typeof useLenh>
