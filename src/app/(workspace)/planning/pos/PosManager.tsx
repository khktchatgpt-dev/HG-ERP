'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { DocumentFiles } from '@/components/DocumentFiles'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { assessPoLate } from '@/lib/late-risk'
import { poLineAmount } from '@/lib/po-line'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { RefChain, type ChainNode } from '@/components/erp/RefChain'
import { PoStatusStepper } from './PoStatusStepper'
import { PosByLsx } from './PosByLsx'
import { groupPosByLsx, type LsxRef } from './pos-groups'
import { canReschedule } from '@/lib/po-reschedule'

type PoStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'ordered'
  | 'confirmed'
  | 'in_transit'
  | 'partial'
  | 'received'
  | 'cancelled'

export type Po = {
  id: string
  code: string
  /** null = PO ngoài LSX (0076). */
  production_order_id: string | null
  supplier_id: string
  status: PoStatus
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  expected_at: string | null
  terms: string | null
  note: string | null
  created_at: string
  // Mốc chuyển trạng thái (có ở detail API) — cho stepper. Optional để list row bỏ qua được.
  approved_at?: string | null
  ordered_at?: string | null
  /** Người PHỤ TRÁCH đơn (0128) — quyền thao tác xét theo đây, không phải cả phòng. */
  assigned_to?: string | null
  assignee_name?: string | null
  supplier_name: string
  /** null = PO ngoài LSX (0076). */
  lsx_code: string | null
  order_code: string | null
  // Tổng tiền (Σ dòng) — bơm từ page cho cột Giá trị ở danh sách.
  total?: number
  /** Tiến độ về kho theo DÒNG (0126) — bơm từ page, cột "Về kho x/y dòng". */
  lines_done?: number
  lines_total?: number
}

export type PoLine = {
  id: string
  material_id: string
  qty_ordered: number
  unit_price: number | null
  price_basis: 'unit' | 'unit2'
  spec: string | null
  qty2: number | null
  unit2: string | null
  note: string | null
  material_code: string
  material_name: string
  material_unit: string
}

export type StatusLine = {
  id: string
  material_id: string
  qty_ordered: number
  qty_received: number
  qty_missing: number
  material_code: string
  material_name: string
  material_unit: string
}

type SupplierOption = { id: string; name: string }
const STATUS_LABEL: Record<PoStatus, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  ordered: 'Đã gửi NCC',
  confirmed: 'NCC xác nhận',
  in_transit: 'Đang giao',
  partial: 'Về một phần',
  received: 'Về đủ',
  cancelled: 'Đã huỷ',
}
const STATUS_TONE: Record<PoStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  draft: 'gray',
  pending_approval: 'amber',
  approved: 'blue',
  ordered: 'blue',
  confirmed: 'blue',
  in_transit: 'amber',
  partial: 'amber',
  received: 'green',
  cancelled: 'red',
}
/** Gợi ý việc kế tiếp theo trạng thái — hiện dưới pill để người mua biết bước sau. */
const NEXT_HINT: Partial<Record<PoStatus, string>> = {
  draft: 'kiểm tra rồi gửi GĐ duyệt',
  pending_approval: 'chờ GĐ duyệt',
  approved: 'gửi NCC',
  ordered: 'chờ NCC xác nhận',
  confirmed: 'chờ giao',
  in_transit: 'chờ nhận hàng',
  partial: 'nhận tiếp',
}
const fmtMoney = (n: number) => n.toLocaleString('vi-VN')
/** Số ngày giữa 2 chuỗi yyyy-mm-dd (b − a). */
const daysBetween = (aIso: string, bIso: string) =>
  Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000)

export function PosManager({
  pos,
  suppliers,
  lsxs,
  canEdit,
  canApprove,
  canManageAny = false,
  meId = null,
  staff = [],
  openId = null,
}: {
  pos: Po[]
  suppliers: SupplierOption[]
  /** LSX đang chạy (đã duyệt / đang SX) — để nêu cả lệnh CHƯA có đơn nào. */
  lsxs: LsxRef[]
  canEdit: boolean
  canApprove: boolean
  /** Trưởng phòng CƯ / admin (0128) — thao tác MỌI đơn + bàn giao. */
  canManageAny?: boolean
  /** id người xem (0128) — để khoá thao tác theo người phụ trách từng đơn. */
  meId?: string | null
  /** NV cung ứng nhận bàn giao — chỉ nạp khi người xem bàn giao được. */
  staff?: { id: string; name: string }[]
  /** Mở sẵn chi tiết đơn này (form soạn redirect về sau khi lưu nháp — 0116). */
  openId?: string | null
}) {
  /**
   * Quyền thao tác theo TỪNG ĐƠN (0128): người phụ trách, trưởng phòng CƯ hoặc
   * admin. `canEdit` (là NV cung ứng) vẫn là điều kiện nền — người ngoài phòng
   * dù thấy đơn cũng không thao tác. Server enforce lại y hệt (assertPoOwner).
   */
  const rowCanEdit = (p: Po) =>
    canEdit && (canManageAny || (p.assigned_to != null && p.assigned_to === meId))
  const canReassign = canManageAny || canApprove
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<{
    po: Po
    lines: PoLine[]
    statusLines: StatusLine[]
  } | null>(null)
  /** Đơn đang dời hẹn giao — mở hộp thoại nhỏ, không mở lại cả form soạn đơn. */
  const [rescheduling, setRescheduling] = useState<{
    po: Po
    date: string
    reason: string
  } | null>(null)
  /** Đơn đang bàn giao (0128) — chọn NV cung ứng nhận phụ trách. */
  const [reassigning, setReassigning] = useState<{ po: Po; toId: string } | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'late' | PoStatus>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  /** Lọc "đơn của tôi" (0128) — NV đông lên thì mỗi người nhìn phần mình trước. */
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all')
  // Loại đơn: theo lệnh SX / ngoài LSX (0076).
  const [typeFilter, setTypeFilter] = useState<'all' | 'lsx' | 'standalone'>('all')
  /*
   * KIỂU XEM. Mặc định XẾP THEO LỆNH: câu hỏi thường trực của người làm kế hoạch
   * là "lệnh này đã đặt những gì, còn thiếu gì", mà bảng phẳng chỉ trả lời được
   * câu ngược lại. Bảng phẳng vẫn giữ nguyên cho lúc cần soi một đơn cụ thể hoặc
   * sắp xếp theo cột — không bỏ đi, chỉ thôi làm mặc định.
   */
  const [view, setView] = useState<'lsx' | 'flat'>('lsx')

  /**
   * `?view=<id>` (0116): form soạn đơn redirect về đây sau khi LƯU NHÁP — mở
   * ngay chi tiết để kiểm tra rồi bấm "Gửi GĐ duyệt". Chỉ mở MỘT lần; xoá query
   * khỏi URL để refresh / back không bật lại modal.
   */
  const openedRef = useRef(false)
  useEffect(() => {
    if (!openId || openedRef.current) return
    const target = pos.find((p) => p.id === openId)
    if (!target) return
    openedRef.current = true
    void openView(target)
    window.history.replaceState(null, '', '/planning/pos')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openView đổi identity mỗi render, openedRef đã chặn lặp
  }, [openId, pos])

  // PO quá hẹn giao NCC — chỉ hiển thị (notification đẩy để GĐ2, xem late-risk.ts).
  const today = new Date().toISOString().slice(0, 10)
  const lateOf = (p: Po) => assessPoLate(p, today)

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return pos.filter((p) => {
      if (statusFilter === 'late') {
        if (assessPoLate(p, today) !== 'overdue') return false
      } else if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (supplierFilter !== 'all' && p.supplier_id !== supplierFilter) return false
      if (typeFilter === 'lsx' && !p.lsx_code) return false
      if (typeFilter === 'standalone' && p.lsx_code) return false
      if (ownerFilter === 'mine' && p.assigned_to !== meId) return false
      if (
        ql &&
        !`${p.code} ${p.supplier_name} ${p.lsx_code ?? ''} ${p.assignee_name ?? ''}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })
  }, [pos, q, statusFilter, supplierFilter, typeFilter, ownerFilter, meId, today])

  // Gom theo lệnh — chạy trên KẾT QUẢ ĐÃ LỌC để bộ lọc trên thanh công cụ có tác
  // dụng ở cả hai kiểu xem.
  const grouped = useMemo(
    () => groupPosByLsx(filtered, lsxs, today),
    [filtered, lsxs, today],
  )

  const stats = useMemo(() => {
    let draft = 0
    let pending = 0
    let open = 0
    let done = 0
    let late = 0
    for (const p of pos) {
      if (p.status === 'draft') draft++
      if (p.status === 'pending_approval') pending++
      if (
        ['approved', 'ordered', 'confirmed', 'in_transit', 'partial'].includes(p.status)
      )
        open++
      if (p.status === 'received') done++
      if (assessPoLate(p, today) === 'overdue') late++
    }
    return { draft, pending, open, done, late }
  }, [pos, today])

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

  /** Đặt "Hạn VT phải về" của lệnh (0126) — ô sổ Tổng hợp ĐH, sửa ngay tại đầu nhóm. */
  async function setMaterialsDue(lsxId: string, date: string | null) {
    const ok = await send(`/api/dept/production/lsx/${lsxId}/materials-due`, 'PATCH', {
      materials_due_at: date,
    })
    if (ok) toast.success(date ? 'Đã đặt hạn vật tư phải về' : 'Đã xoá hạn vật tư')
  }

  async function openView(po: Po) {
    setBusy(true)
    try {
      const data = await api<{ lines: PoLine[]; status_lines: StatusLine[] }>(
        `/api/dept/supply/pos/${po.id}`,
      )
      setViewing({ po, lines: data.lines, statusLines: data.status_lines })
    } catch (e) {
      toast.error('Không tải được đơn đặt', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Sửa / nhân bản → sang trang soạn đơn, KHÔNG mở form riêng trong modal.
   *
   * Form cũ ở đây không biết mẫu đơn (0106): lưu lại là hạ mẫu về 'simple', xoá
   * kg/m + dài cây, thành tiền đơn nhôm tụt từ (tổng kg × giá/kg) xuống
   * (số cây × giá/kg). Một form duy nhất thì không có đường nào để lệch.
   */
  function openEdit(po: Po, mode: 'edit' | 'duplicate') {
    setViewing(null)
    router.push(
      mode === 'duplicate'
        ? `/planning/pos/${po.id}/edit?duplicate=1`
        : `/planning/pos/${po.id}/edit`,
    )
  }

  async function decide(po: Po, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối ${po.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt đơn đặt ${po.code}?`,
        description: `NCC: ${po.supplier_name} · ${po.lsx_code ? `LSX ${po.lsx_code}` : 'đơn ngoài LSX'}. Duyệt xong Cung ứng mới gửi được cho NCC (BR-05).`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    const ok2 = await send(`/api/dept/supply/pos/${po.id}/decide`, 'POST', {
      decision,
      reason,
    })
    if (ok2) {
      toast.success(decision === 'approve' ? 'Đã duyệt' : 'Đã từ chối', po.code)
      setViewing(null)
    }
  }

  async function advance(po: Po, to: 'ordered' | 'confirmed' | 'in_transit') {
    const labels = {
      ordered: 'Gửi NCC',
      confirmed: 'NCC xác nhận',
      in_transit: 'Đang giao',
    }
    const ok = await confirm({
      title: `${labels[to]} — ${po.code}?`,
      confirmLabel: labels[to],
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/supply/pos/${po.id}/advance`, 'POST', { to })
    if (ok2) {
      toast.success(labels[to], po.code)
      setViewing(null)
    }
  }

  /**
   * DỜI HẸN GIAO — thao tác duy nhất được phép trên đơn ĐÃ DUYỆT.
   *
   * Đơn đã duyệt không cho sửa lại (giá và dòng hàng là cam kết với GĐ và là bản
   * NCC đang cầm). Nhưng ngày giao thì đổi thật; không có đường ghi lại thì người
   * dùng phải chọn giữa để ngày sai (cảnh báo "quá hẹn" kêu oan) hoặc huỷ đơn
   * tạo lại (mất số PO đã gửi NCC).
   */
  async function submitReschedule() {
    if (!rescheduling) return
    const { po, date, reason } = rescheduling
    if (!date || !reason.trim()) return
    const ok = await send(`/api/dept/supply/pos/${po.id}/reschedule`, 'POST', {
      expected_at: date,
      reason: reason.trim(),
    })
    if (ok) {
      toast.success(
        `Đã dời hẹn giao ${po.code}`,
        `${new Date(date).toLocaleDateString('vi-VN')} — lý do đã ghi vào đơn`,
      )
      setRescheduling(null)
      setViewing(null)
    }
  }

  async function cancelPo(po: Po) {
    const reason = window.prompt(`Lý do huỷ ${po.code}:`)?.trim()
    if (!reason) return
    const ok = await send(`/api/dept/supply/pos/${po.id}/cancel`, 'POST', { reason })
    if (ok) {
      toast.success('Đã huỷ', po.code)
      setViewing(null)
    }
  }

  /** Gửi GĐ duyệt (0116): nháp → chờ duyệt, lúc này GĐ mới nhận thông báo. */
  async function submitPo(po: Po) {
    const ok = await confirm({
      title: `Gửi ${po.code} cho Giám đốc duyệt?`,
      description: `NCC: ${po.supplier_name} · ${po.lsx_code ? `LSX ${po.lsx_code}` : 'đơn ngoài LSX'}. Gửi rồi thì hết sửa thoải mái — chỉ còn sửa được khi đơn vẫn chưa duyệt.`,
      confirmLabel: 'Gửi duyệt',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/supply/pos/${po.id}/submit`, 'POST')
    if (ok2) {
      toast.success('Đã gửi GĐ duyệt', po.code)
      setViewing(null)
    }
  }

  /**
   * RÚT VỀ NHÁP (0128): đơn chờ duyệt không sửa trực tiếp — rút về, sửa, gửi
   * lại; con số GĐ thấy trong thông báo luôn là bản cuối.
   */
  async function withdrawPo(po: Po) {
    const ok = await confirm({
      title: `Rút ${po.code} về nháp?`,
      description:
        'Đơn rời bàn duyệt của Giám đốc — sửa xong bấm "Gửi GĐ duyệt" lại từ đầu.',
      confirmLabel: 'Rút về nháp',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/supply/pos/${po.id}/withdraw`, 'POST')
    if (ok2) {
      toast.success('Đã rút về nháp', po.code)
      setViewing(null)
    }
  }

  /** BÀN GIAO (0128): đổi người phụ trách — trưởng phòng CƯ / GĐ / admin. */
  async function submitReassign() {
    if (!reassigning || !reassigning.toId) return
    const { po, toId } = reassigning
    const ok = await send(`/api/dept/supply/pos/${po.id}/reassign`, 'POST', {
      user_id: toId,
    })
    if (ok) {
      const name = staff.find((s) => s.id === toId)?.name ?? ''
      toast.success(`Đã bàn giao ${po.code}`, name)
      setReassigning(null)
      setViewing(null)
    }
  }

  /** Xoá hẳn đơn NHÁP — chưa gửi ai nên xoá là sạch, không cần lý do huỷ. */
  async function deleteDraft(po: Po) {
    const ok = await confirm({
      title: `Xoá nháp ${po.code}?`,
      description: 'Đơn chưa gửi duyệt — xoá là mất hẳn, không khôi phục được.',
      confirmLabel: 'Xoá nháp',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/pos/${po.id}`, { method: 'DELETE' })
      toast.success('Đã xoá nháp', po.code)
      setViewing(null)
      router.refresh()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Menu ⋯ của một đơn — dùng chung cho cả bảng phẳng lẫn thẻ theo lệnh.
   * Thao tác GHI xét theo TỪNG đơn (0128): người phụ trách / trưởng phòng /
   * admin — không còn "cả phòng cùng sửa". "Tạo lại từ đơn này" (nhân bản ra
   * đơn MỚI của chính mình) vẫn mở cho mọi NV cung ứng.
   */
  function rowMenuFor(p: Po) {
    const mine = rowCanEdit(p)
    const items: { label: string; onClick: () => void; danger?: boolean }[] = [
      { label: 'Xem chi tiết', onClick: () => void openView(p) },
    ]
    // Sửa: CHỈ nháp (0128) — đơn chờ duyệt phải rút về nháp trước.
    if (mine && p.status === 'draft') {
      items.push(
        { label: 'Sửa', onClick: () => void openEdit(p, 'edit') },
        { label: 'Gửi GĐ duyệt', onClick: () => void submitPo(p) },
        { label: 'Xoá nháp', onClick: () => void deleteDraft(p), danger: true },
      )
    }
    if (mine && p.status === 'pending_approval') {
      items.push({ label: 'Rút về nháp để sửa', onClick: () => void withdrawPo(p) })
    }
    if (canEdit && p.status === 'cancelled') {
      items.push({
        label: 'Tạo lại từ đơn này',
        onClick: () => void openEdit(p, 'duplicate'),
      })
    }
    if (canApprove && p.status === 'pending_approval') {
      items.push(
        { label: 'Duyệt', onClick: () => void decide(p, 'approve') },
        { label: 'Từ chối', onClick: () => void decide(p, 'reject'), danger: true },
      )
    }
    if (mine && canReschedule(p.status).ok) {
      items.push({
        label: 'Đổi hẹn giao',
        onClick: () =>
          setRescheduling({
            po: p,
            date: p.expected_at?.slice(0, 10) ?? '',
            reason: '',
          }),
      })
    }
    if (mine && p.status === 'approved') {
      items.push({ label: 'Gửi NCC', onClick: () => void advance(p, 'ordered') })
    }
    if (mine && p.status === 'ordered') {
      items.push({ label: 'NCC xác nhận', onClick: () => void advance(p, 'confirmed') })
    }
    if (mine && ['ordered', 'confirmed'].includes(p.status)) {
      items.push({ label: 'Đang giao', onClick: () => void advance(p, 'in_transit') })
    }
    if (canReassign && !['received', 'cancelled'].includes(p.status)) {
      items.push({
        label: 'Bàn giao người phụ trách',
        onClick: () => setReassigning({ po: p, toId: '' }),
      })
    }
    // Nháp không có "Huỷ" — xoá hẳn ở trên; huỷ-có-lý-do dành cho đơn đã gửi đi.
    if (mine && !['draft', 'received', 'cancelled'].includes(p.status)) {
      items.push({ label: 'Huỷ đơn', onClick: () => void cancelPo(p), danger: true })
    }
    return <RowMenu items={items} />
  }

  const columns: Column<Po>[] = [
    {
      key: 'code',
      header: 'Số PO / NCC',
      width: '230px',
      sortValue: (p) => p.code,
      cell: (p) => (
        <button
          onClick={() => void openView(p)}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
        >
          <span className="font-mono text-xs text-zinc-400">{p.code}</span>
          <span className="truncate font-medium">{p.supplier_name}</span>
        </button>
      ),
    },
    {
      key: 'lsx',
      header: 'Chuỗi liên kết',
      width: '190px',
      cell: (p) =>
        p.lsx_code ? (
          <RefChain
            size="sm"
            nodes={[
              ...(p.order_code ? [{ label: 'Đơn hàng', value: p.order_code }] : []),
              { label: 'LSX', value: p.lsx_code },
            ]}
          />
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Ngoài LSX
          </span>
        ),
    },
    {
      key: 'total',
      header: 'Giá trị',
      align: 'right',
      width: '140px',
      sortValue: (p) => p.total ?? 0,
      cell: (p) => (
        <span className="font-medium tabular-nums">
          {fmtMoney(p.total ?? 0)}{' '}
          <span className="text-xs text-zinc-400">{p.currency}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortValue: (p) => p.status,
      width: '140px',
      cell: (p) => (
        <div className="flex flex-col gap-0.5">
          <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
          {NEXT_HINT[p.status] && (
            <span className="text-[11px] text-zinc-400">→ {NEXT_HINT[p.status]}</span>
          )}
        </div>
      ),
    },
    {
      key: 'expected',
      header: 'Hẹn giao',
      sortValue: (p) => p.expected_at ?? '9999',
      width: '150px',
      cell: (p) => {
        if (!p.expected_at) return <span className="text-zinc-400">—</span>
        const late = lateOf(p)
        const exp = p.expected_at.slice(0, 10)
        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={
                late === 'overdue' ? 'font-medium text-red-600 dark:text-red-400' : ''
              }
            >
              {new Date(p.expected_at).toLocaleDateString('vi-VN')}
            </span>
            {late === 'overdue' && (
              <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
                ⚠ Quá hẹn {daysBetween(exp, today)} ngày
              </span>
            )}
            {late === 'due_soon' &&
              (() => {
                const n = daysBetween(today, exp)
                return (
                  <span className="text-[11px] text-amber-600 dark:text-amber-500">
                    {n === 0 ? 'Đến hẹn hôm nay' : `Sát hẹn · còn ${n} ngày`}
                  </span>
                )
              })()}
          </div>
        )
      },
    },
    {
      key: 'assignee',
      header: 'Phụ trách',
      width: '140px',
      sortValue: (p) => p.assignee_name ?? '',
      cell: (p) =>
        p.assignee_name ? (
          <span className={'truncate' + (p.assigned_to === meId ? ' font-medium' : '')}>
            {p.assigned_to === meId ? '★ ' : ''}
            {p.assignee_name}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'created',
      header: 'Ngày tạo',
      sortValue: (p) => p.created_at,
      width: '110px',
      cell: (p) => new Date(p.created_at).toLocaleDateString('vi-VN'),
    },
    // Cột đệm co giãn: hút hết khoảng trống thừa về đây (giữa Ngày tạo và ⋯)
    // nên các cột nội dung bám trái gọn, nút ⋯ bám phải — không phình cột mã.
    { key: '_spacer', header: '', cell: () => null },
    { key: 'actions', header: '', width: '56px', align: 'right', cell: rowMenuFor },
  ]

  const btnPrimary =
    'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Quản lý đơn đặt hàng' },
        ]}
        title="Quản lý đơn đặt hàng"
        description="Xếp theo lệnh sản xuất: mỗi lệnh gom đủ đơn của nó, kèm lệnh chưa đặt gì. Mỗi đơn = 1 NCC; GĐ duyệt xong mới gửi NCC (BR-05), về hàng do Kho ghi nhận."
        actions={
          canEdit && (
            <Link href="/planning/pos/new" className={btnPrimary}>
              + Tạo đơn đặt
            </Link>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng PO', value: pos.length, tone: 'default' },
          { label: 'Nháp', value: stats.draft, tone: stats.draft ? 'default' : 'gray' },
          {
            label: 'Chờ duyệt',
            value: stats.pending,
            tone: stats.pending ? 'amber' : 'gray',
          },
          { label: 'Đang mở', value: stats.open, tone: 'blue' },
          {
            label: 'Quá hẹn giao',
            value: stats.late,
            tone: stats.late ? 'red' : 'gray',
          },
          { label: 'Về đủ', value: stats.done, tone: 'green' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số PO, NCC, LSX…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi trạng thái' },
                  { value: 'late' as const, label: '⚠ Quá hẹn giao' },
                  ...(Object.keys(STATUS_LABEL) as PoStatus[]).map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s],
                  })),
                ]}
              />
              <ToolbarSelect
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={[
                  { value: 'all', label: 'Mọi NCC' },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <ToolbarSelect
                value={typeFilter}
                onChange={(v) => setTypeFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi loại đơn' },
                  { value: 'lsx' as const, label: 'Theo lệnh SX' },
                  { value: 'standalone' as const, label: 'Ngoài LSX' },
                ]}
              />
              {canEdit && meId && (
                <ToolbarSelect
                  value={ownerFilter}
                  onChange={(v) => setOwnerFilter(v)}
                  options={[
                    { value: 'all' as const, label: 'Mọi người phụ trách' },
                    { value: 'mine' as const, label: '★ Đơn của tôi' },
                  ]}
                />
              )}
            </>
          }
          right={
            <>
              {busy && (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <Spinner size={12} /> Đang xử lý…
                </span>
              )}
              {/* Chuyển kiểu xem — "theo lệnh" để nắm việc, "danh sách" để soi
                  một đơn hoặc sắp xếp theo cột. */}
              <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 text-[12px] dark:border-zinc-700">
                {(
                  [
                    ['lsx', 'Theo lệnh SX'],
                    ['flat', 'Danh sách'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={
                      'rounded-md px-2.5 py-1 font-medium transition-colors ' +
                      (view === v
                        ? 'bg-sky-600 text-white'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          }
        />

        {view === 'lsx' ? (
          <PosByLsx
            groups={grouped.groups}
            standalone={grouped.standalone}
            emptyLsxs={grouped.emptyLsxs}
            today={today}
            canEdit={canEdit}
            statusLabel={(p) => STATUS_LABEL[p.status]}
            statusTone={(p) => STATUS_TONE[p.status]}
            onView={(p) => void openView(p)}
            renderActions={rowMenuFor}
            onSetDue={(lsxId, date) => void setMaterialsDue(lsxId, date)}
          />
        ) : (
          <DataTable<Po>
            rows={filtered}
            columns={columns}
            storageKey="supply-pos"
            rowClassName={(p) => (p.status === 'cancelled' ? 'opacity-60' : '')}
            emptyState={
              <EmptyState
                icon="▩"
                title={pos.length === 0 ? 'Chưa có đơn đặt nào' : 'Không khớp bộ lọc'}
                description="Chọn LSX + NCC, tìm vật tư cần mua — hệ thống tự hiện tồn kho, bạn chỉ điền số lượng."
                action={
                  canEdit && pos.length === 0 ? (
                    <Link href="/planning/pos/new" className={btnPrimary}>
                      + Tạo đơn đặt
                    </Link>
                  ) : undefined
                }
              />
            }
          />
        )}
      </div>

      {/* Chi tiết */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.po.code} — ${viewing.po.supplier_name}` : ''}
        maxWidth="sm:max-w-4xl"
      >
        {viewing && (
          <PoDetail
            po={viewing.po}
            lines={viewing.lines}
            statusLines={viewing.statusLines}
            canEdit={rowCanEdit(viewing.po)}
            canUpload={canEdit}
            canApprove={canApprove}
            onDecide={(d) => void decide(viewing.po, d)}
            onAdvance={(to) => void advance(viewing.po, to)}
            onCancel={() => void cancelPo(viewing.po)}
            onEdit={() => void openEdit(viewing.po, 'edit')}
            onSubmit={() => void submitPo(viewing.po)}
            onDelete={() => void deleteDraft(viewing.po)}
            onWithdraw={() => void withdrawPo(viewing.po)}
            onReschedule={() =>
              setRescheduling({
                po: viewing.po,
                date: viewing.po.expected_at?.slice(0, 10) ?? '',
                reason: '',
              })
            }
          />
        )}
      </Modal>

      {/* Bàn giao người phụ trách (0128) — trưởng phòng CƯ / GĐ / admin. */}
      <Modal
        open={!!reassigning}
        onClose={() => setReassigning(null)}
        title={reassigning ? `Bàn giao — ${reassigning.po.code}` : ''}
        maxWidth="sm:max-w-md"
      >
        {reassigning && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Người nhận sẽ <b>phụ trách</b> đơn này (sửa nháp, gửi duyệt, theo dõi giao
              hàng). Dùng khi người phụ trách cũ nghỉ phép / nghỉ việc. Việc bàn giao được
              ghi vào lịch sử phê duyệt.
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Đang phụ trách
              </span>
              <span className="text-zinc-500">
                {reassigning.po.assignee_name ?? 'chưa có'}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Bàn giao cho <span className="text-red-500">*</span>
              </span>
              <select
                value={reassigning.toId}
                onChange={(e) =>
                  setReassigning((s) => s && { ...s, toId: e.target.value })
                }
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">— Chọn nhân viên cung ứng —</option>
                {staff
                  .filter((s) => s.id !== reassigning.po.assigned_to)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReassigning(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Huỷ
              </button>
              <button
                disabled={busy || !reassigning.toId}
                onClick={() => void submitReassign()}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Bàn giao
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!rescheduling}
        onClose={() => setRescheduling(null)}
        title={rescheduling ? `Đổi hẹn giao — ${rescheduling.po.code}` : ''}
        maxWidth="sm:max-w-md"
      >
        {rescheduling && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Chỉ đổi <b>ngày giao</b>. Nhà cung cấp, dòng hàng và tiền giữ nguyên — đơn
              đã duyệt nên chữ ký của Giám đốc vẫn còn giá trị. Lý do được ghi vào ghi chú
              của đơn.
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Hẹn giao hiện tại
              </span>
              <span className="text-zinc-500">
                {rescheduling.po.expected_at
                  ? new Date(rescheduling.po.expected_at).toLocaleDateString('vi-VN')
                  : 'chưa hẹn'}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Ngày giao mới <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                value={rescheduling.date}
                onChange={(e) =>
                  setRescheduling((s) => s && { ...s, date: e.target.value })
                }
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Lý do <span className="text-red-500">*</span>
              </span>
              <textarea
                rows={2}
                maxLength={1000}
                value={rescheduling.reason}
                onChange={(e) =>
                  setRescheduling((s) => s && { ...s, reason: e.target.value })
                }
                placeholder="NCC báo trễ tàu · xưởng giục sớm · đổi lịch giao…"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRescheduling(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Huỷ
              </button>
              <button
                disabled={busy || !rescheduling.date || !rescheduling.reason.trim()}
                onClick={() => void submitReschedule()}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Lưu hẹn giao mới
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Chi tiết PO ─────────────────────────────────────────────────────────────

export function PoDetail({
  po,
  lines,
  statusLines,
  canEdit,
  canUpload,
  canApprove,
  onDecide,
  onAdvance,
  onCancel,
  onEdit,
  onReschedule,
  onSubmit,
  onDelete,
  onWithdraw,
}: {
  po: Po
  lines: PoLine[]
  statusLines: StatusLine[]
  /** Quyền thao tác trên ĐƠN NÀY (0128 — người phụ trách/trưởng phòng/admin). */
  canEdit: boolean
  /** Đính kèm hồ sơ mua hàng — mở cho mọi NV cung ứng (không khoá theo đơn). */
  canUpload?: boolean
  canApprove: boolean
  onDecide: (d: 'approve' | 'reject') => void
  onAdvance: (to: 'ordered' | 'confirmed' | 'in_transit') => void
  onCancel: () => void
  /** Mở form sửa (chỉ đơn NHÁP — 0128) — không truyền = ẩn nút (màn GĐ read-only). */
  onEdit?: () => void
  /** Đổi hẹn giao của đơn đã duyệt — không truyền = ẩn nút. */
  onReschedule?: () => void
  /** Gửi GĐ duyệt — chỉ đơn NHÁP (0116); không truyền = ẩn nút. */
  onSubmit?: () => void
  /** Xoá hẳn đơn NHÁP — không truyền = ẩn nút. */
  onDelete?: () => void
  /** Rút đơn CHỜ DUYỆT về nháp để sửa (0128) — không truyền = ẩn nút. */
  onWithdraw?: () => void
}) {
  const receivedById = new Map(statusLines.map((s) => [s.id, s]))
  // Giá đv kép (0053): dòng unit2 tính qty2 × giá — cùng công thức server.
  const total = lines.reduce((s, l) => s + poLineAmount(l), 0)
  const showReceived = !['draft', 'pending_approval', 'approved', 'cancelled'].includes(
    po.status,
  )

  // Chuỗi liên kết: Đơn hàng → LSX → PO này (bỏ node không có; PO ngoài LSX chỉ còn chính nó).
  const chainNodes: ChainNode[] = [
    ...(po.order_code ? [{ label: 'Đơn hàng', value: po.order_code }] : []),
    ...(po.lsx_code ? [{ label: 'Lệnh SX', value: po.lsx_code }] : []),
    { label: 'Đơn đặt vật tư', value: po.code, current: true },
  ]

  return (
    <div className="flex flex-col gap-3 text-sm">
      <RefChain nodes={chainNodes} />

      <PoStatusStepper
        status={po.status}
        dates={{
          draft: po.created_at,
          // Đơn cũ (trước 0116) tạo là vào thẳng chờ duyệt nên created_at chính
          // là mốc gửi; đơn nháp thì chưa gửi — không có mốc.
          pending_approval: po.status === 'draft' ? null : po.created_at,
          approved: po.approved_at,
          ordered: po.ordered_at,
        }}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {po.assignee_name && <Badge>Phụ trách: {po.assignee_name}</Badge>}
        {po.vat_rate != null && (
          <Badge>
            VAT {po.vat_rate}% ({po.price_includes_vat ? 'đã gồm' : 'chưa gồm'})
          </Badge>
        )}
        {po.expected_at && (
          <span
            className={
              assessPoLate(po, new Date().toISOString().slice(0, 10)) === 'overdue'
                ? 'font-medium text-red-600 dark:text-red-400'
                : 'text-zinc-500'
            }
          >
            Hẹn giao: {new Date(po.expected_at).toLocaleDateString('vi-VN')}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              <th className="w-24 py-2 pr-2">Quy cách</th>
              <th className="w-20 py-2 pr-2 text-right">SL đặt</th>
              {showReceived && (
                <>
                  <th className="w-20 py-2 pr-2 text-right">Đã về</th>
                  <th className="w-20 py-2 pr-2 text-right">Còn thiếu</th>
                </>
              )}
              <th className="w-24 py-2 pr-2 text-right">Đơn giá</th>
              <th className="w-28 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const st = receivedById.get(l.id)
              return (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    <div className="flex flex-col">
                      <span>
                        <span className="font-mono text-xs text-zinc-400">
                          {l.material_code}
                        </span>{' '}
                        {l.material_name}
                      </span>
                      {(l.qty2 != null || l.note) && (
                        <span className="text-xs text-zinc-500">
                          {l.qty2 != null && `${l.qty2} ${l.unit2 ?? ''}`}
                          {l.qty2 != null && l.note && ' · '}
                          {l.note}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 text-xs">{l.spec ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {l.qty_ordered.toLocaleString('vi-VN')} {l.material_unit}
                  </td>
                  {showReceived && (
                    <>
                      <td className="py-1.5 pr-2 text-right">
                        {(st?.qty_received ?? 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {st && st.qty_missing > 0 ? (
                          <span className="font-medium text-amber-600">
                            {st.qty_missing.toLocaleString('vi-VN')}
                          </span>
                        ) : (
                          <Badge tone="green">Đủ</Badge>
                        )}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                    {l.unit_price != null ? (
                      <>
                        {l.unit_price.toLocaleString('vi-VN')}
                        {l.price_basis === 'unit2' && l.unit2 && (
                          <span className="text-xs text-violet-600 dark:text-violet-400">
                            /{l.unit2}
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-1.5 text-right font-medium">
                    {l.unit_price != null ? poLineAmount(l).toLocaleString('vi-VN') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={showReceived ? 6 : 4}
                className="py-2 pr-2 text-right font-semibold"
              >
                Tổng cộng
              </td>
              <td className="py-2 text-right font-bold">
                {total.toLocaleString('vi-VN')} {po.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {po.terms && <p className="text-xs text-zinc-500">Điều kiện: {po.terms}</p>}
      {po.note && <p className="text-xs text-zinc-500">{po.note}</p>}

      {/* Hồ sơ mua hàng (FR-SUP-07): báo giá NCC, hợp đồng, chứng từ giao nhận */}
      <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <DocumentFiles
          kind="purchase_order"
          id={po.id}
          canEdit={canEdit || canUpload || canApprove}
          title="Hồ sơ mua hàng (báo giá NCC, hợp đồng, chứng từ)"
        />
      </div>

      <div className="flex justify-end gap-2">
        <a
          href={`/print/supply/${po.id}`}
          target="_blank"
          rel="noopener"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          🖨 In đơn đặt hàng
        </a>
        {/* NHÁP (0116): xoá hẳn · sửa · gửi GĐ duyệt — đơn chưa tới bàn sếp,
            người soạn toàn quyền. */}
        {canEdit && onDelete && po.status === 'draft' && (
          <button
            onClick={onDelete}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Xoá nháp
          </button>
        )}
        {canEdit && onEdit && po.status === 'draft' && (
          <button
            onClick={onEdit}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sửa đơn
          </button>
        )}
        {/* Chờ duyệt (0128): không sửa trực tiếp — rút về nháp rồi sửa. */}
        {canEdit && onWithdraw && po.status === 'pending_approval' && (
          <button
            onClick={onWithdraw}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Rút về nháp để sửa
          </button>
        )}
        {canEdit && onSubmit && po.status === 'draft' && (
          <button
            onClick={onSubmit}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Gửi GĐ duyệt
          </button>
        )}
        {canEdit && onReschedule && canReschedule(po.status).ok && (
          <button
            onClick={onReschedule}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Đổi hẹn giao
          </button>
        )}
        {canApprove && po.status === 'pending_approval' && (
          <>
            <button
              onClick={() => onDecide('reject')}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              Từ chối
            </button>
            <button
              onClick={() => onDecide('approve')}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Duyệt đơn đặt
            </button>
          </>
        )}
        {canEdit && po.status === 'approved' && (
          <button
            onClick={() => onAdvance('ordered')}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Gửi NCC
          </button>
        )}
        {canEdit && po.status === 'ordered' && (
          <button
            onClick={() => onAdvance('confirmed')}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            NCC xác nhận
          </button>
        )}
        {canEdit && ['ordered', 'confirmed'].includes(po.status) && (
          <button
            onClick={() => onAdvance('in_transit')}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Đang giao
          </button>
        )}
        {canEdit && !['draft', 'received', 'cancelled'].includes(po.status) && (
          <button
            onClick={onCancel}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Huỷ
          </button>
        )}
      </div>
    </div>
  )
}
