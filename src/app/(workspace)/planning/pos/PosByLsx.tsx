'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Plus } from 'lucide-react'
import type { Column } from '@/components/erp/DataTable'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/erp/EmptyState'
import { PoRowsTable } from './po-columns'
import type { Po } from './po-types'
import type { LsxRef, PoGroup } from './pos-groups'

/**
 * KHU ĐƠN ĐẶT HÀNG XẾP THEO LỆNH SẢN XUẤT.
 *
 * Một lệnh có NHIỀU đơn đặt vật tư (mỗi NCC một đơn), nên đây là trục chính:
 * đầu thẻ cộng sẵn cho cả lệnh — mấy đơn, bao nhiêu tiền, mấy đơn chờ duyệt /
 * quá hẹn, VÀ hàng đã về bao nhiêu dòng — thân thẻ liệt kê đơn của chính lệnh
 * đó. Bảng phẳng trả lời được "đơn này tới đâu "; thẻ này trả lời câu ngược lại
 * mà người làm kế hoạch hỏi mỗi ngày —"lệnh này đã đặt những gì, còn thiếu gì ".
 *
 * Thân thẻ dùng CHÍNH bộ cột của bảng phẳng (biến thể `group`) — đổi kiểu xem
 * là đổi trục nhìn, không phải đổi lấy một bộ thông tin khác.
 */

const fmtMoney = (n: number) => n.toLocaleString('vi-VN')

export function PosByLsx({
  groups,
  standalone,
  emptyLsxs,
  canEdit,
  makeColumns,
  onSetDue,
}: {
  groups: PoGroup[]
  standalone: PoGroup
  emptyLsxs: LsxRef[]
  canEdit: boolean
  makeColumns: (g: PoGroup) => Column<Po>[]
  /** Đặt"Hạn VT phải về" của lệnh (0126) — ô của sổ Tổng hợp ĐH. */
  onSetDue: (lsxId: string, date: string | null) => void
}) {
  if (groups.length === 0 && standalone.pos.length === 0 && emptyLsxs.length === 0) {
    return (
      <EmptyState
        icon="▩"
        title="Chưa có đơn đặt nào"
        description="Chọn LSX + NCC, tìm vật tư cần mua — hệ thống tự hiện tồn kho, bạn chỉ điền số lượng."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {emptyLsxs.length > 0 && <EmptyLsxPanel lsxs={emptyLsxs} canEdit={canEdit} />}

      {groups.map((g) => (
        <GroupCard
          key={g.key}
          g={g}
          canEdit={canEdit}
          makeColumns={makeColumns}
          onSetDue={onSetDue}
        />
      ))}

      {standalone.pos.length > 0 && (
        <GroupCard
          g={standalone}
          canEdit={canEdit}
          standalone
          makeColumns={makeColumns}
          onSetDue={onSetDue}
        />
      )}
    </div>
  )
}

function GroupCard({
  g,
  canEdit,
  standalone,
  makeColumns,
  onSetDue,
}: {
  g: PoGroup
  canEdit: boolean
  standalone?: boolean
  makeColumns: (g: PoGroup) => Column<Po>[]
  onSetDue: (lsxId: string, date: string | null) => void
}) {
  // Nhóm đã xong hết thì gập sẵn — chỗ trên màn hình để dành cho lệnh đang chạy.
  const settled = g.pending === 0 && g.open === 0 && g.late === 0
  const [open, setOpen] = useState(!settled)
  const allIn = g.linesTotal > 0 && g.linesDone >= g.linesTotal

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border/70 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="text-muted-foreground w-3 shrink-0">
            <ChevronDown className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="t-data block font-semibold">
              {g.lsx_code}
            </span>
            <span className="text-muted-foreground block truncate text-[11px]">
              {standalone
                ? 'Mua bù tồn · vật tư tiêu hao · dùng chung'
                : [g.customer_name, g.order_code && `Đơn hàng ${g.order_code}`]
                    .filter(Boolean)
                    .join(' · ') || '—'}
            </span>
          </span>
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="bg-muted text-foreground/75 rounded-full px-2 py-0.5 font-medium">
            {g.pos.length} đơn
          </span>
          {g.pending > 0 && <Badge tone="amber">{g.pending} chờ duyệt</Badge>}
          {g.late > 0 && <Badge tone="red">⚠ {g.late} quá hẹn</Badge>}
          {/* Hàng về tới đâu — câu hỏi thật của người kế hoạch, không phải"mấy đơn". */}
          {g.linesTotal > 0 && (
            <Badge tone={allIn ? 'green' : g.linesDone > 0 ? 'amber' : 'gray'}>
              Về kho {g.linesDone}/{g.linesTotal} dòng
            </Badge>
          )}
          {/*
            HẠN VT PHẢI VỀ (0126) — ô của sổ"Tổng hợp ĐH". Đèn"Kịp SX?" từng
            đơn bên dưới so với mốc này. Chỉ lệnh còn trong danh sách đang chạy
            (có lsx_id) mới đặt được.
          */}
          {!standalone && g.lsx_id && (
            <label className="border-border flex items-center gap-1 rounded-md border px-1.5 py-0.5">
              <span className="text-muted-foreground">Hạn VT về</span>
              {canEdit ? (
                <input
                  type="date"
                  value={g.materials_due_at ?? ''}
                  onChange={(e) => onSetDue(g.lsx_id!, e.target.value || null)}
                  className="bg-transparent text-[11px] outline-none"
                  aria-label={`Hạn vật tư phải về của ${g.lsx_code}`}
                />
              ) : (
                <b>
                  {g.materials_due_at
                    ? new Date(g.materials_due_at).toLocaleDateString('vi-VN')
                    : '—'}
                </b>
              )}
            </label>
          )}
          <span className="t-data ml-1 font-semibold">
            {fmtMoney(g.total)} <span className="text-muted-foreground">{g.currency}</span>
          </span>
          {canEdit && !standalone && (
            <Link
              href="/planning/pos/new"
              className="border-input text-muted-foreground hover:border-primary hover:text-primary ml-1 inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5"
            >
              <Plus className="size-3" aria-hidden /> Đặt thêm
            </Link>
          )}
        </div>
      </div>

      {open && <PoRowsTable rows={g.pos} columns={makeColumns(g)} />}
    </section>
  )
}

/**
 * LỆNH ĐANG CHẠY MÀ CHƯA ĐẶT GÌ — ĐỨNG ĐẦU TRANG.
 *
 * Đây là lý do chính để đổi sang khung theo lệnh: một lệnh không có đơn nào thì
 * ở bảng phẳng nó đơn giản là KHÔNG XUẤT HIỆN, nên không ai nhận ra là đã quên.
 * Trước đây khối này nằm CUỐI trang — tức thứ đáng lo nhất lại nằm đúng chỗ ít
 * người cuộn tới nhất.
 */
function EmptyLsxPanel({ lsxs, canEdit }: { lsxs: LsxRef[]; canEdit: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="w-3 text-[10px] text-[var(--warn)]">
          <ChevronDown className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
        </span>
        <b className="text-[13px] text-[var(--warn)]">
          {lsxs.length} lệnh sản xuất chưa có đơn đặt nào
        </b>
        <span className="text-[11px] text-[var(--warn)]/80">
          lệnh đã duyệt hoặc đang chạy — kiểm lại xem có phải quên đặt
        </span>
      </button>
      {open && (
        <div className="grid gap-2 px-3.5 pb-3 sm:grid-cols-2 lg:grid-cols-3">
          {lsxs.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--warn)]/30 bg-card px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[12px] font-semibold">{l.code}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {[l.customer_name, l.order_codes.join(', ')]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {canEdit && (
                <Link
                  href="/planning/pos/new"
                  className="shrink-0 rounded-md border border-[var(--warn)]/40 px-2 py-0.5 text-[11px] font-medium text-[var(--warn)] hover:bg-[var(--warn)]/10"
                >
                  Đặt hàng
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
