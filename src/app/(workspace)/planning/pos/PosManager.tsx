'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { PosByLsx } from './PosByLsx'
import { buildPoColumns, PoFlatTable, type PoRowDeps } from './po-columns'
import { groupPosByLsx, type LsxRef } from './pos-groups'
import { usePoActions } from './usePoActions'
 import { ReasonDialog, type ReasonState } from './PoDialogs'
import { PoFilters, type PoView } from './PoFilters'
import { PoBulkBar } from './PoBulkBar'
import { countPos, poMatches, EMPTY_FILTER, type PoFilterState } from './po-filter'
import type { Po, SupplierOption } from './po-types'

/*
 * Kiểu dữ liệu ở `po-types.ts`. Re-export tại đây vì `exec/approval-types.ts`
 * và `exec/approval-parts.tsx` đang lấy `PoLine` qua đường này — đổi luôn cả
 * hai tệp bên khu Giám đốc là việc của Đợt sau, không nhét vào cùng lượt dọn.
 */
export type { Po, PoLine, StatusLine } from './po-types'

export function PosManager({
  pos,
  suppliers,
  lsxs,
  canEdit,
  canApprove,
  canManageAny = false,
  meId = null,
  truncatedAt = null,
  openId = null,
}: {
  pos: Po[]
  suppliers: SupplierOption[]
  /** LSX đang chạy (đã duyệt / đang SX) — để nêu cả lệnh CHƯA có đơn nào. */
  lsxs: LsxRef[]
  canEdit: boolean
  canApprove: boolean
  /** Trưởng phòng CƯ / admin (0128) — thao tác MỌI đơn. */
  canManageAny?: boolean
  /** id người xem (0128) — để khoá thao tác theo người phụ trách từng đơn. */
  meId?: string | null
  /** Có số = server đã chạm trần khi nạp, còn đơn cũ hơn chưa lên màn. */
  truncatedAt?: number | null
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
  const router = useRouter()
  // Mọi lời gọi API của màn này nằm ở `usePoActions`.
  const act = usePoActions()
  const busy = act.busy

  /** Toàn bộ bộ lọc trong MỘT state — quy tắc thuần nằm ở `po-filter.ts`. */
  const [filter, setFilter] = useState<PoFilterState>(EMPTY_FILTER)
  /** Đơn đang tích để làm hàng loạt — giữ theo id, không giữ cả dòng. */
  const [picked, setPicked] = useState<Set<string>>(new Set())
  /** Đơn đang chờ nhập lý do (từ chối) — thay cho `window.prompt` cũ. */
  const [reasoning, setReasoning] = useState<ReasonState | null>(null)
  /*
   * KIỂU XEM. Mặc định XẾP THEO LỆNH: câu hỏi thường trực của người làm kế hoạch
   * là "lệnh này đã đặt những gì, còn thiếu gì", mà bảng phẳng chỉ trả lời được
   * câu ngược lại. Bảng phẳng vẫn giữ nguyên cho lúc cần soi một đơn cụ thể hoặc
   * sắp xếp theo cột — không bỏ đi, chỉ thôi làm mặc định.
   */
  const [view, setView] = useState<PoView>('lsx')

  /**
   * `?view=<id>` (0116): form soạn đơn quay về đây sau khi LƯU NHÁP để người
   * soạn kiểm lại rồi bấm "Gửi GĐ duyệt". Trước đây nó bật một modal; nay chi
   * tiết là TRANG THẬT nên chuyển thẳng sang đó — `replace` để nút Back đưa về
   * danh sách chứ không quay lại form soạn đơn vừa lưu xong.
   */
  const openedRef = useRef(false)
  useEffect(() => {
    if (!openId || openedRef.current) return
    openedRef.current = true
    router.replace(`/planning/pos/${openId}`)
  }, [openId, router])

  // PO quá hẹn giao NCC — chỉ hiển thị (notification đẩy để GĐ2, xem late-risk.ts).
  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(
    () => pos.filter((p) => poMatches(p, filter, { meId, today })),
    [pos, filter, meId, today],
  )

  // Gom theo lệnh — chạy trên KẾT QUẢ ĐÃ LỌC để bộ lọc trên thanh công cụ có tác
  // dụng ở cả hai kiểu xem.
  const grouped = useMemo(
    () => groupPosByLsx(filtered, lsxs, today),
    [filtered, lsxs, today],
  )

  // Số trên chip đếm trên TOÀN BỘ đơn, không phải kết quả đã lọc — xem po-filter.
  const counts = useMemo(() => countPos(pos, meId, today), [pos, meId, today])

  /**
   * Mở chi tiết = ĐI SANG TRANG, không bật modal nữa.
   *
   * Modal cũ nhồi stepper + bảng dòng hàng + hồ sơ + tám nút vào khung 4xl, và
   * không có URL nên không gửi được cho ai, F5 là mất. Chi tiết nay là trang
   * thật `/planning/pos/[id]`.
   */
  function openView(po: Po) {
    router.push(`/planning/pos/${po.id}`)
  }

  /**
   * Sửa / nhân bản → sang trang soạn đơn, KHÔNG mở form riêng trong modal.
   *
   * Form cũ ở đây không biết mẫu đơn (0106): lưu lại là hạ mẫu về 'simple', xoá
   * kg/m + dài cây, thành tiền đơn nhôm tụt từ (tổng kg × giá/kg) xuống
   * (số cây × giá/kg). Một form duy nhất thì không có đường nào để lệch.
   */
  function openEdit(po: Po, mode: 'edit' | 'duplicate') {
    router.push(
      mode === 'duplicate'
        ? `/planning/pos/${po.id}/edit?duplicate=1`
        : `/planning/pos/${po.id}/edit`,
    )
  }

  /**
   * Mọi thứ một dòng PO cần để tự vẽ và tự biết được phép làm gì — gói một lần,
   * dùng cho cả bảng phẳng lẫn thẻ theo lệnh.
   */
  const rowDeps: PoRowDeps = {
    canEdit,
    canApprove,
    rowCanEdit,
    act,
    onView: openView,
    onEdit: openEdit,
    onReason: (p, kind) => setReasoning({ po: p, kind, reason: '' }),
  }
  /** Hạn VT phải về theo lệnh — nuôi đèn "Kịp SX?" ở CẢ HAI kiểu xem. */
  const dueByLsx = useMemo(
    () => new Map(lsxs.map((l) => [l.id, l.materials_due_at])),
    [lsxs],
  )
  /*
   * CHỌN NHIỀU. Tích theo id nhưng chỉ giữ lại những id CÒN nằm trong kết quả
   * lọc: đổi bộ lọc xong mà thanh vẫn khoe "đã chọn 5 đơn" trong khi trên màn
   * chỉ còn 2 dòng là một cách chắc chắn để ai đó duyệt nhầm đơn không nhìn thấy.
   */
  const selected = useMemo(
    () => filtered.filter((p) => picked.has(p.id)),
    [filtered, picked],
  )
  function togglePick(p: Po) {
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(p.id)) next.delete(p.id)
      else next.add(p.id)
      return next
    })
  }

  const colCtx = {
    ...rowDeps,
    today,
    meId,
    dueByLsx,
    selection: { isSelected: (p: Po) => picked.has(p.id), onToggle: togglePick },
  }
  const flatColumns = buildPoColumns({ ...colCtx, variant: 'flat' })

  /* Nút hàng loạt chỉ hiện khi TOÀN BỘ phần đang tích hợp lệ cho bước đó. */
  const every = (fn: (p: Po) => boolean) => selected.length > 0 && selected.every(fn)
  const bulkSubmit = every((p) => p.status === 'draft' && rowCanEdit(p))
    ? () =>
        void act
          .bulk(selected, {
            path: 'submit',
            title: 'Gửi Giám đốc duyệt',
            confirmLabel: 'Gửi duyệt',
          })
          .then(() => setPicked(new Set()))
    : null
  const bulkApprove = every((p) => p.status === 'pending_approval')
    ? () =>
        void act
          .bulk(selected, {
            path: 'decide',
            body: { decision: 'approve' },
            title: 'Duyệt',
            confirmLabel: 'Duyệt',
          })
          .then(() => setPicked(new Set()))
    : null
  const bulkOrder = every((p) => p.status === 'approved' && rowCanEdit(p))
    ? () =>
        void act
          .bulk(selected, {
            path: 'advance',
            body: { to: 'ordered' },
            title: 'Gửi NCC',
            confirmLabel: 'Gửi NCC',
          })
          .then(() => setPicked(new Set()))
    : null

  const btnPrimary =
    'bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90'

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

      {/* Chạm trần khi nạp — nói ra, đừng cắt im lặng như bản cũ. */}
      {truncatedAt != null && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Đang hiển thị <b>{truncatedAt}</b> đơn mới nhất — còn đơn cũ hơn chưa nạp. Thu
          hẹp bằng ô tìm hoặc lọc theo nhà cung cấp để chắc chắn không sót.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <PoFilters
          filter={filter}
          onFilter={setFilter}
          counts={counts}
          suppliers={suppliers}
          showMine={!!(canEdit && meId)}
          view={view}
          onView={setView}
          busy={busy}
        />

        {view === 'lsx' ? (
          <PosByLsx
            groups={grouped.groups}
            standalone={grouped.standalone}
            emptyLsxs={grouped.emptyLsxs}
            canEdit={canEdit}
            // Dựng theo TỪNG nhóm: cột "Số PO" phải biết đơn nào là đơn mượn
            // của lệnh khác, mà điều đó chỉ đúng trong phạm vi một thẻ (0125).
            makeColumns={(g) =>
              buildPoColumns({ ...colCtx, variant: 'group', borrowed: g.borrowed })
            }
            onSetDue={(lsxId, date) => void act.setMaterialsDue(lsxId, date)}
          />
        ) : (
          <PoFlatTable
            rows={filtered}
            columns={flatColumns}
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

      <PoBulkBar
        selected={selected}
        onClear={() => setPicked(new Set())}
        onSubmitAll={bulkSubmit}
        onApproveAll={bulkApprove}
        onOrderAll={bulkOrder}
        canApprove={canApprove}
        busy={busy}
      />

      <ReasonDialog
        state={reasoning}
        onChange={setReasoning}
        onSubmit={async (s) => {
          const ok =
            s.kind === 'reject'
              ? await act.reject(s.po, s.reason)
              : await act.cancelPo(s.po, s.reason)
          if (ok) setReasoning(null)
        }}
        busy={busy}
      />
    </div>
  )
}
