'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, Plus, TriangleAlert } from 'lucide-react'
import type { Column } from '@/components/erp/DataTable'
import { Badge } from '@/components/Badge'
import { DateField } from '@/components/erp/DateField'
import { EmptyState } from '@/components/erp/EmptyState'
import { Button } from '@/components/shadcn/button'
import { PoRowsTable } from './po-columns'
import type { Po } from './po-types'
import type { LsxRef, PoGroup } from './pos-groups'

/**
 * KHU ĐƠN ĐẶT HÀNG XẾP THEO LỆNH SẢN XUẤT.
 *
 * Một lệnh có NHIỀU đơn đặt vật tư (mỗi NCC một đơn), nên đây là trục chính:
 * đầu thẻ cộng sẵn cho cả lệnh, thân thẻ liệt kê đơn của chính lệnh đó. Bảng
 * phẳng trả lời "đơn này tới đâu"; thẻ này trả lời câu ngược lại mà người làm
 * kế hoạch hỏi mỗi ngày — "lệnh này đã đặt những gì, còn thiếu gì".
 *
 * Thân thẻ dùng CHÍNH bộ cột của bảng phẳng (biến thể `group`) — đổi kiểu xem
 * là đổi trục nhìn, không phải đổi lấy một bộ thông tin khác.
 *
 * ── 04/09/2026 — CHỮA "MỘT LỆNH NHIỀU ĐƠN THÌ KHÔNG DÙNG ĐƯỢC" ───────────────
 *
 * Đo được lúc sửa: 14 nhóm / 66 đơn trên một trang, nhóm to nhất 12 đơn. Điều
 * kiện gập sẵn của bản cũ là `pending === 0 && open === 0 && late === 0`, mà
 * 64/66 đơn đang là Nháp nên gần như KHÔNG nhóm nào thoả — tức 14 bảng lồng mở
 * cùng lúc, 14 sticky header chồng nhau, cuộn mãi không hết.
 *
 * Ba đổi:
 *
 *  1. GẬP HẾT, MỞ MỘT NHÓM MỘT LÚC. Trang nghỉ = 14 dòng tóm tắt quét mắt được;
 *     thấy lệnh nào có "2 chờ duyệt" hay "1 quá hẹn" thì mở đúng lệnh đó. Nhóm
 *     đang mở được nguyên chiều cao màn hình cho bảng 12 dòng của nó.
 *  2. TIÊU ĐỀ CHỈ CÒN TÓM TẮT + LỐI ĐI. Bản cũ nhồi 7 thứ vào một hàng
 *     `flex-wrap`, trong đó có cả một Ô NHẬP NGÀY — form control sống trong
 *     thanh tiêu đề accordion, bấm hụt là gập mất nhóm. Ô ngày dời xuống thân,
 *     nơi có nhãn tử tế cho nó.
 *  3. Thứ tự huy hiệu đảo theo VIỆC: cảnh báo (chờ duyệt / quá hẹn) đứng trước,
 *     rồi tiến độ về kho, rồi mới tới số đếm và tiền. Bản cũ để "n đơn" — thông
 *     tin chết — đứng đầu.
 *
 * Mỗi nhóm nay có lối sang `/planning/lsx/[id]`: đó là trang thật của "đơn mua
 * của một lệnh" (rộng hơn, có thêm cột ai đang giữ đơn). Thẻ gập này là bản tóm
 * tắt, không phải chỗ làm việc sâu.
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
  const cards = standalone.pos.length > 0 ? [...groups, standalone] : groups

  // Mở MỘT nhóm một lúc. Chỉ tự mở sẵn khi cả trang có đúng một nhóm — lúc đó
  // bắt người dùng bấm thêm một nhát để thấy thứ duy nhất trên trang là vô lý.
  const [openKey, setOpenKey] = useState<string | null>(
    cards.length === 1 ? cards[0].key : null,
  )

  if (cards.length === 0 && emptyLsxs.length === 0) {
    return (
      <EmptyState
        icon="▩"
        title="Chưa có đơn đặt nào"
        description="Chọn LSX + NCC, tìm vật tư cần mua — hệ thống tự hiện tồn kho, bạn chỉ điền số lượng."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {emptyLsxs.length > 0 && <EmptyLsxPanel lsxs={emptyLsxs} canEdit={canEdit} />}

      {cards.map((g) => (
        <GroupCard
          key={g.key}
          g={g}
          canEdit={canEdit}
          standalone={g.key === standalone.key}
          open={openKey === g.key}
          onToggle={() => setOpenKey((k) => (k === g.key ? null : g.key))}
          makeColumns={makeColumns}
          onSetDue={onSetDue}
        />
      ))}
    </div>
  )
}

function GroupCard({
  g,
  canEdit,
  standalone,
  open,
  onToggle,
  makeColumns,
  onSetDue,
}: {
  g: PoGroup
  canEdit: boolean
  standalone?: boolean
  open: boolean
  onToggle: () => void
  makeColumns: (g: PoGroup) => Column<Po>[]
  onSetDue: (lsxId: string, date: string | null) => void
}) {
  const allIn = g.linesTotal > 0 && g.linesDone >= g.linesTotal

  return (
    <section
      className={`bg-card overflow-hidden rounded-xl border transition-colors ${
        open ? 'border-[var(--primary)]/45' : 'border-border'
      }`}
    >
      {/*
        Thẻ mở/gập là một nút CHIẾM CẢ HÀNG: vùng bấm phải to bằng thứ nó điều
        khiển, không phải chỉ mũi tên bé bằng hạt gạo như bản cũ.

        eslint-disable-next-line vì đây là nút accordion hai dòng có truncate —
        `Button` của kit cố định chiều cao và căn giữa một dòng, khoác vào là
        phải ghi đè gần hết. Cùng lý do `erp/SectionToggle` cũng không dùng
        `Button`.
      */}
      {/* eslint-disable-next-line hg/no-raw-control */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="hover:bg-muted/50 flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 text-left transition-colors"
      >
        <ChevronDown
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="t-data block font-semibold">{g.lsx_code}</span>
          <span className="text-muted-foreground block truncate text-[11px]">
            {standalone
              ? 'Mua bù tồn · vật tư tiêu hao · dùng chung'
              : [g.customer_name, g.order_code && `Đơn hàng ${g.order_code}`]
                  .filter(Boolean)
                  .join(' · ') || '—'}
          </span>
        </span>

        {/* Cần động tay đứng trước, số để đọc đứng sau. */}
        <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5 text-[11px]">
          {g.pending > 0 && <Badge tone="amber">{g.pending} chờ duyệt</Badge>}
          {g.late > 0 && (
            <Badge tone="red">
              <TriangleAlert className="size-3" aria-hidden /> {g.late} quá hẹn
            </Badge>
          )}
          {g.linesTotal > 0 && (
            <Badge tone={allIn ? 'green' : g.linesDone > 0 ? 'amber' : 'gray'}>
              Về kho {g.linesDone}/{g.linesTotal} dòng
            </Badge>
          )}
          <span className="bg-muted text-foreground/75 rounded-full px-2 py-0.5 font-medium">
            {g.pos.length} đơn
          </span>
          {/* Kể ĐỦ mọi loại tiền: nhóm có cả VND lẫn USD mà chỉ in một con số
              thì người xem đọc thành tổng của cả nhóm (28/08). */}
          <span className="t-data ml-1 font-semibold">
            {fmtMoney(g.total)}{' '}
            <span className="text-muted-foreground">{g.currency}</span>
            {g.otherTotals.map((t) => (
              <span key={t.currency}>
                <span className="text-muted-foreground font-normal"> · </span>
                {fmtMoney(t.total)}{' '}
                <span className="text-muted-foreground">{t.currency}</span>
              </span>
            ))}
          </span>
        </span>
      </button>

      {open && (
        <>
          {/*
            THANH ĐIỀU KHIỂN CỦA NHÓM — nằm trong thân, không nằm trên tiêu đề.
            "Hạn VT phải về" (0126) là mốc của LỆNH, đèn "Kịp SX?" từng đơn bên
            dưới so với nó; nó xứng đáng một nhãn nhìn thấy được chứ không phải
            một ô ngày trần nhét giữa đám huy hiệu.
          */}
          <div className="border-border/70 bg-muted/30 flex flex-wrap items-center gap-x-4 gap-y-2 border-y px-3.5 py-2">
            {!standalone && g.lsx_id && (
              <label className="flex items-center gap-2">
                <span className="t-label text-muted-foreground shrink-0">
                  Hạn vật tư phải về
                </span>
                {canEdit ? (
                  <DateField
                    value={g.materials_due_at ?? ''}
                    onChange={(iso) => onSetDue(g.lsx_id!, iso || null)}
                    className="h-7 w-[132px] text-[12px]"
                    aria-label={`Hạn vật tư phải về của ${g.lsx_code}`}
                  />
                ) : (
                  <b className="t-data text-[12px]">
                    {g.materials_due_at
                      ? new Date(g.materials_due_at).toLocaleDateString('vi-VN')
                      : '—'}
                  </b>
                )}
              </label>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canEdit && !standalone && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/planning/pos/new">
                    <Plus aria-hidden /> Đặt thêm đơn
                  </Link>
                </Button>
              )}
              {/* Lối sang trang thật của "đơn mua một lệnh" — rộng hơn thẻ này,
                  có thêm cột ai đang giữ đơn. */}
              {!standalone && g.lsx_id && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/planning/lsx/${g.lsx_id}`}>
                    Mở trang lệnh <ArrowRight aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <PoRowsTable rows={g.pos} columns={makeColumns(g)} />
        </>
      )}
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
      {/* eslint-disable-next-line hg/no-raw-control -- nút accordion, xem ghi chú ở GroupCard */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          className={`size-4 shrink-0 text-[var(--warn)] transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden
        />
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
              className="bg-card flex items-center gap-2 rounded-lg border border-[var(--warn)]/30 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[12px] font-semibold">{l.code}</div>
                <div className="text-muted-foreground truncate text-[11px]">
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
