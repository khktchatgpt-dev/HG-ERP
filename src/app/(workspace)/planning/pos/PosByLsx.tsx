'use client'

import { useState } from 'react'
import Link from 'next/link'
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
 * đó. Bảng phẳng trả lời được "đơn này tới đâu"; thẻ này trả lời câu ngược lại
 * mà người làm kế hoạch hỏi mỗi ngày — "lệnh này đã đặt những gì, còn thiếu gì".
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
  /** Đặt "Hạn VT phải về" của lệnh (0126) — ô của sổ Tổng hợp ĐH. */
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
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="w-3 shrink-0 text-[10px] text-zinc-400">
            {open ? '▾' : '▸'}
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[13px] font-semibold">
              {g.lsx_code}
            </span>
            <span className="block truncate text-[11px] text-zinc-500">
              {standalone
                ? 'Mua bù tồn · vật tư tiêu hao · dùng chung'
                : [g.customer_name, g.order_code && `Đơn hàng ${g.order_code}`]
                    .filter(Boolean)
                    .join(' · ') || '—'}
            </span>
          </span>
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {g.pos.length} đơn
          </span>
          {g.pending > 0 && <Badge tone="amber">{g.pending} chờ duyệt</Badge>}
          {g.late > 0 && <Badge tone="red">⚠ {g.late} quá hẹn</Badge>}
          {/* Hàng về tới đâu — câu hỏi thật của người kế hoạch, không phải "mấy đơn". */}
          {g.linesTotal > 0 && (
            <Badge tone={allIn ? 'green' : g.linesDone > 0 ? 'amber' : 'gray'}>
              Về kho {g.linesDone}/{g.linesTotal} dòng
            </Badge>
          )}
          {/*
            HẠN VT PHẢI VỀ (0126) — ô của sổ "Tổng hợp ĐH". Đèn "Kịp SX?" từng
            đơn bên dưới so với mốc này. Chỉ lệnh còn trong danh sách đang chạy
            (có lsx_id) mới đặt được.
          */}
          {!standalone && g.lsx_id && (
            <label className="flex items-center gap-1 rounded-md border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-700">
              <span className="text-zinc-500">Hạn VT về</span>
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
          <span className="ml-1 font-semibold tabular-nums">
            {fmtMoney(g.total)} <span className="text-zinc-400">{g.currency}</span>
          </span>
          {canEdit && !standalone && (
            <Link
              href="/planning/pos/new"
              className="ml-1 rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
            >
              ＋ Đặt thêm
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
    <section className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="w-3 text-[10px] text-amber-700 dark:text-amber-500">
          {open ? '▾' : '▸'}
        </span>
        <b className="text-[13px] text-amber-800 dark:text-amber-300">
          {lsxs.length} lệnh sản xuất chưa có đơn đặt nào
        </b>
        <span className="text-[11px] text-amber-700/80 dark:text-amber-500/80">
          lệnh đã duyệt hoặc đang chạy — kiểm lại xem có phải quên đặt
        </span>
      </button>
      {open && (
        <div className="grid gap-2 px-3.5 pb-3 sm:grid-cols-2 lg:grid-cols-3">
          {lsxs.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 dark:border-amber-900/60 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[12px] font-semibold">{l.code}</div>
                <div className="truncate text-[11px] text-zinc-500">
                  {[l.customer_name, l.order_codes.join(', ')]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {canEdit && (
                <Link
                  href="/planning/pos/new"
                  className="shrink-0 rounded-md border border-amber-300 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
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
