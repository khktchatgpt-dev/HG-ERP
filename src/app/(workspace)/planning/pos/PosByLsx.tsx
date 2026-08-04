'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/erp/EmptyState'
import { assessPoLate } from '@/lib/late-risk'
import type { Po } from './PosManager'
import type { LsxRef, PoGroup } from './pos-groups'

/**
 * KHU ĐƠN ĐẶT HÀNG XẾP THEO LỆNH SẢN XUẤT.
 *
 * Mỗi lệnh là một thẻ: đầu thẻ cộng sẵn (mấy đơn, bao nhiêu tiền, mấy đơn chờ
 * duyệt / quá hẹn), thân thẻ liệt kê đơn của chính lệnh đó. Bảng phẳng cũ trả
 * lời được "đơn này tới đâu"; thẻ này trả lời câu ngược lại mà người làm kế
 * hoạch hỏi mỗi ngày — "lệnh này đã đặt những gì, còn thiếu gì".
 *
 * Khối cuối là LSX ĐANG CHẠY MÀ CHƯA CÓ ĐƠN NÀO — thứ bảng phẳng không bao giờ
 * hiện ra được, vì nó chỉ vẽ cái đã tồn tại.
 */

const fmtMoney = (n: number) => n.toLocaleString('vi-VN')

export function PosByLsx({
  groups,
  standalone,
  emptyLsxs,
  today,
  canEdit,
  statusLabel,
  statusTone,
  onView,
  renderActions,
}: {
  groups: PoGroup[]
  standalone: PoGroup
  emptyLsxs: LsxRef[]
  today: string
  canEdit: boolean
  statusLabel: (p: Po) => string
  statusTone: (p: Po) => 'gray' | 'amber' | 'blue' | 'green' | 'red'
  onView: (p: Po) => void
  renderActions: (p: Po) => React.ReactNode
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
      {groups.map((g) => (
        <GroupCard
          key={g.key}
          g={g}
          today={today}
          canEdit={canEdit}
          statusLabel={statusLabel}
          statusTone={statusTone}
          onView={onView}
          renderActions={renderActions}
        />
      ))}

      {standalone.pos.length > 0 && (
        <GroupCard
          g={standalone}
          today={today}
          canEdit={canEdit}
          standalone
          statusLabel={statusLabel}
          statusTone={statusTone}
          onView={onView}
          renderActions={renderActions}
        />
      )}

      {emptyLsxs.length > 0 && <EmptyLsxPanel lsxs={emptyLsxs} canEdit={canEdit} />}
    </div>
  )
}

function GroupCard({
  g,
  today,
  canEdit,
  standalone,
  statusLabel,
  statusTone,
  onView,
  renderActions,
}: {
  g: PoGroup
  today: string
  canEdit: boolean
  standalone?: boolean
  statusLabel: (p: Po) => string
  statusTone: (p: Po) => 'gray' | 'amber' | 'blue' | 'green' | 'red'
  onView: (p: Po) => void
  renderActions: (p: Po) => React.ReactNode
}) {
  // Nhóm đã xong hết thì gập sẵn — chỗ trên màn hình để dành cho lệnh đang chạy.
  const settled = g.pending === 0 && g.open === 0 && g.late === 0
  const [open, setOpen] = useState(!settled)

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
          {g.open > 0 && <Badge tone="blue">{g.open} đang mở</Badge>}
          {g.late > 0 && <Badge tone="red">⚠ {g.late} quá hẹn</Badge>}
          {g.received > 0 && <Badge tone="green">{g.received} về đủ</Badge>}
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

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left text-[10px] text-zinc-500 uppercase">
                <th className="py-1.5 pr-2 pl-3.5">Số đơn / NCC</th>
                <th className="w-[130px] py-1.5 pr-2 text-right">Giá trị</th>
                <th className="w-[150px] py-1.5 pr-2">Trạng thái</th>
                <th className="w-[160px] py-1.5 pr-2">Hẹn giao</th>
                <th className="w-[56px] py-1.5 pr-2" />
              </tr>
            </thead>
            <tbody>
              {g.pos.map((p) => {
                const late = assessPoLate(p, today)
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-zinc-100 dark:border-zinc-800/60 ${
                      p.status === 'cancelled' ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-2 pr-2 pl-3.5">
                      <button
                        onClick={() => onView(p)}
                        className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
                      >
                        <span className="font-mono text-[11px] text-zinc-400">
                          {p.code}
                        </span>
                        <span className="truncate font-medium">{p.supplier_name}</span>
                      </button>
                    </td>
                    <td className="py-2 pr-2 text-right font-medium tabular-nums">
                      {fmtMoney(p.total ?? 0)}{' '}
                      <span className="text-[11px] text-zinc-400">{p.currency}</span>
                    </td>
                    <td className="py-2 pr-2">
                      <Badge tone={statusTone(p)}>{statusLabel(p)}</Badge>
                    </td>
                    <td className="py-2 pr-2">
                      {p.expected_at ? (
                        <span
                          className={
                            late === 'overdue'
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : late === 'due_soon'
                                ? 'text-amber-600 dark:text-amber-500'
                                : ''
                          }
                        >
                          {new Date(p.expected_at).toLocaleDateString('vi-VN')}
                          {late === 'overdue' && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right">{renderActions(p)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/**
 * LỆNH ĐANG CHẠY MÀ CHƯA ĐẶT GÌ.
 *
 * Đây là lý do chính để đổi sang khung theo lệnh: một lệnh không có đơn nào thì
 * ở bảng phẳng nó đơn giản là KHÔNG XUẤT HIỆN, nên không ai nhận ra là đã quên.
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
