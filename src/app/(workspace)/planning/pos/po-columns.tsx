'use client'

import { Badge } from '@/components/Badge'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { RowMenu } from '@/components/erp/RowMenu'
import { RefChain } from '@/components/erp/RefChain'
import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import { assessPoFit } from '@/lib/po-fit'
import {
  PO_NEXT_HINT,
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  poSpineColor,
} from '@/lib/po-status'
import type { Po } from './po-types'
import type { usePoActions } from './usePoActions'

/**
 * MỘT BỘ CỘT DUY NHẤT cho cả hai kiểu xem.
 *
 * Trước đây bảng phẳng và thẻ theo lệnh vẽ hai bảng riêng, và thiếu chéo nhau:
 * bảng phẳng có Chuỗi liên kết / Phụ trách / Ngày tạo mà thẻ không có; thẻ có
 * Về kho và đèn "Kịp SX?" mà bảng phẳng không có. Người dùng đổi kiểu xem để
 * nhìn cùng một việc theo trục khác, không phải để đổi lấy một bộ thông tin
 * khác — đổi xong lại mất thứ vừa đọc được là lỗi, không phải tính năng.
 *
 * Khác nhau giữa hai biến thể còn đúng MỘT cột: trong thẻ của một lệnh thì cột
 *"Chuỗi liên kết " chỉ lặp lại cái tiêu đề thẻ vừa nói, nên bỏ.
 */

const money = (n: number) => n.toLocaleString('vi-VN')
/** Số ngày giữa 2 chuỗi yyyy-mm-dd (b − a). */
const daysBetween = (aIso: string, bIso: string) =>
  Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000)

/**
 * Những thứ một dòng PO cần để tự vẽ và tự biết được phép làm gì.
 *
 * `rowCanEdit` là quyền theo TỪNG ĐƠN (0128 — người phụ trách / trưởng phòng /
 * admin), khác `canEdit` (là NV cung ứng, điều kiện nền).
 */
export type PoRowDeps = {
  canEdit: boolean
  canApprove: boolean
  rowCanEdit: (p: Po) => boolean
  act: ReturnType<typeof usePoActions>
  onView: (p: Po) => void
  onEdit: (p: Po, mode: 'edit' | 'duplicate') => void
  /** Mở hộp thoại thu lý do (từ chối / huỷ) — thay cho window.prompt. */
  onReason: (p: Po, kind: 'reject' | 'cancel') => void
}

/**
 * Menu ⋯ — CHỈ những thao tác "liếc là bấm ".
 *
 * Trước Đợt 2, menu này ôm cả vòng đời (10 mục) vì không còn chỗ nào khác để
 * đặt. Nay chi tiết đơn là trang thật và ôm trọn phần đó, nên ở danh sách chỉ
 * giữ thứ quyết được mà không cần đọc gì thêm. Những bước cần cân nhắc — đổi
 * hẹn giao, bàn giao, huỷ, rút về nháp, NCC xác nhận, đang giao — nằm ở trang
 * chi tiết, nơi có dòng hàng, tiền và lịch sử ngay trước mắt để mà quyết.
 */
export function poRowMenu(p: Po, d: PoRowDeps) {
  const mine = d.rowCanEdit(p)
  const items: { label: string; onClick: () => void; danger?: boolean }[] = [
    { label: 'Xem chi tiết', onClick: () => d.onView(p) },
  ]
  if (mine && p.status === 'draft') {
    items.push(
      { label: 'Sửa', onClick: () => d.onEdit(p, 'edit') },
      { label: 'Gửi GĐ duyệt', onClick: () => void d.act.submitPo(p) },
    )
  }
  if (d.canApprove && p.status === 'pending_approval') {
    items.push(
      { label: 'Duyệt', onClick: () => void d.act.approve(p) },
      { label: 'Từ chối', onClick: () => d.onReason(p, 'reject'), danger: true },
    )
  }
  // Đơn đã duyệt nằm im là lỗi hay gặp nhất — giữ nút gửi ngay tại dòng.
  if (mine && p.status === 'approved') {
    items.push({ label: 'Gửi NCC', onClick: () => void d.act.advance(p, 'ordered') })
  }
  return <RowMenu items={items} />
}

export type PoColumnCtx = PoRowDeps & {
  today: string
  meId: string | null
  /** Hạn VT phải về theo lệnh (0126) — nuôi đèn"Kịp SX?" ở cả hai kiểu xem. */
  dueByLsx: Map<string, string | null>
  /** `group` = nằm trong thẻ của một lệnh, bỏ cột Chuỗi liên kết cho khỏi lặp. */
  variant: 'flat' | 'group'
  /**
   * Id các đơn đang nằm trong thẻ này với tư cách LỆNH PHỤ (0125) — đơn của
   * lệnh khác, có mua hộ. Đánh dấu để không ai tưởng là đơn riêng của lệnh.
   */
  borrowed?: Set<string>
  /** Có = hiện ô tích chọn ở đầu dòng. */
  selection?: {
    isSelected: (p: Po) => boolean
    onToggle: (p: Po) => void
  }
}

export function buildPoColumns(c: PoColumnCtx): Column<Po>[] {
  const { today, meId } = c
  const cols: Column<Po>[] = []

  if (c.selection) {
    cols.push({
      key: '_pick',
      header: '',
      width: '36px',
      cell: (p) => (
        <input
          type="checkbox"
          checked={c.selection!.isSelected(p)}
          onChange={() => c.selection!.onToggle(p)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Chọn ${p.code}`}
          className="accent-primary size-4 cursor-pointer"
        />
      ),
    })
  }

  cols.push({
    key: 'code',
    header: 'Số PO / NCC',
    width: '235px',
    sortValue: (p) => p.code,
    cell: (p) => {
      const extra = p.extra_lsx ?? []
      const isBorrowed = c.borrowed?.has(p.id) ?? false
      return (
        <div className="flex min-w-0 flex-col">
          <button
            onClick={() => c.onView(p)}
            className="hover:text-primary flex min-w-0 flex-col text-left"
          >
            <span className="t-data text-muted-foreground text-[11px]">{p.code}</span>
            <span className="truncate font-medium">{p.supplier_name}</span>
          </button>
          {/*
            ĐƠN GỘP NHIỀU LỆNH (0125). Ở thẻ lệnh PHỤ phải nói rõ đơn này thuộc
            về lệnh nào — nếu không, người xem tưởng lệnh mình có đơn riêng, rồi
            đi tìm tiền của nó ở đầu thẻ mà không thấy (tiền cộng ở lệnh chính).
          */}
          {isBorrowed ? (
            <span className="mt-0.5 w-fit rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
              mua chung — đơn của lệnh {p.lsx_code}
            </span>
          ) : (
            extra.length > 0 && (
              <span
                className="mt-0.5 w-fit rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium"
                title={`Mua chung cho: ${[p.lsx_code, ...extra.map((e) => e.code)].join(', ')}`}
              >
                gộp {extra.length + 1} lệnh
              </span>
            )
          )}
        </div>
      )
    },
  })

  if (c.variant === 'flat') {
    cols.push({
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
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
            Ngoài LSX
          </span>
        ),
    })
  }

  cols.push(
    {
      key: 'total',
      header: 'Giá trị',
      align: 'right',
      width: '130px',
      sortValue: (p) => p.total ?? 0,
      cell: (p) => (
        <span className="t-data font-medium">
          {money(p.total ?? 0)}{' '}
          <span className="text-muted-foreground text-[11px]">{p.currency}</span>
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
          <Badge tone={PO_STATUS_TONE[p.status]}>{PO_STATUS_LABEL[p.status]}</Badge>
          {PO_NEXT_HINT[p.status] && (
            <span className="text-muted-foreground text-[11px]">
              → {PO_NEXT_HINT[p.status]}
            </span>
          )}
        </div>
      ),
    },
    {
      // Đếm theo DÒNG (cộng số lượng chéo đơn vị là vô nghĩa — xem po-fit).
      key: 'received',
      header: 'Về kho',
      width: '95px',
      sortValue: (p) => (p.lines_total ? (p.lines_done ?? 0) / p.lines_total : -1),
      cell: (p) =>
        p.lines_total ? (
          <span
            className={
              't-data ' +
              ((p.lines_done ?? 0) >= p.lines_total
                ? 'font-medium text-[var(--done)]'
                : (p.lines_done ?? 0) > 0
                  ? 'text-[var(--warn)]'
                  : 'text-muted-foreground')
            }
          >
            {p.lines_done ?? 0}/{p.lines_total} dòng
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'expected',
      header: 'Hẹn giao · Kịp SX?',
      sortValue: (p) => p.expected_at ?? '9999',
      width: '175px',
      cell: (p) => {
        const fit = assessPoFit(
          p,
          p.production_order_id ? c.dueByLsx.get(p.production_order_id) : null,
        )
        // Đơn đang mở mà trống ngày: đừng vẽ một dấu "—" vô hại — mọi cảnh báo
        // trễ đều bỏ qua nó, nên đây mới là ô cần gọi tên.
        if (!p.expected_at) {
          return isMissingEta(p) ? (
            <span className="text-[11px] font-medium text-[var(--warn)]">
              Chưa hẹn giao
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        }
        const late = assessPoLate(p, today)
        const exp = p.expected_at.slice(0, 10)
        return (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className={late === 'overdue' ? 'font-medium text-[var(--stop)]' : ''}
              >
                {new Date(p.expected_at).toLocaleDateString('vi-VN')}
              </span>
              {/* Đèn Kịp SX? — chỉ lên tiếng khi có chuyện. */}
              {fit === 'late' && <Badge tone="red">Trễ SX</Badge>}
              {fit === 'tight' && <Badge tone="amber">Sát hạn SX</Badge>}
            </span>
            {late === 'overdue' && (
              <span className="text-[11px] font-medium text-[var(--stop)]">
                Quá hẹn {daysBetween(exp, today)} ngày
              </span>
            )}
            {late === 'due_soon' &&
              (() => {
                const n = daysBetween(today, exp)
                return (
                  <span className="text-muted-foreground text-[11px]">
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
      width: '130px',
      sortValue: (p) => p.assignee_name ?? '',
      cell: (p) =>
        p.assignee_name ? (
          <span className={'truncate' + (p.assigned_to === meId ? ' font-medium' : '')}>
            {p.assigned_to === meId ? '★ ' : ''}
            {p.assignee_name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  )

  if (c.variant === 'flat') {
    cols.push({
      key: 'created',
      header: 'Ngày tạo',
      sortValue: (p) => p.created_at,
      width: '105px',
      cell: (p) => new Date(p.created_at).toLocaleDateString('vi-VN'),
    })
  }

  cols.push(
    // Cột đệm co giãn: hút hết khoảng trống thừa về đây nên các cột nội dung bám
    // trái gọn, nút ⋯ bám phải — không phình cột mã.
    { key: '_spacer', header: '', cell: () => null },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (p) => poRowMenu(p, c),
    },
  )
  return cols
}

/** Bảng phẳng — sắp xếp theo cột + phân trang do `DataTable` lo. */
export function PoFlatTable({
  rows,
  columns,
  emptyState,
}: {
  rows: Po[]
  columns: Column<Po>[]
  emptyState: React.ReactNode
}) {
  return (
    <DataTable<Po>
      rows={rows}
      columns={columns}
      storageKey="supply-pos"
      rowClassName={(p) => (p.status === 'cancelled' ? 'opacity-60' : '')}
      emptyState={emptyState}
    />
  )
}

/**
 * Bảng gọn trong thẻ của một lệnh — cùng bộ `Column<Po>` với bảng phẳng, nhưng
 * không sắp xếp / không phân trang: một lệnh có vài đơn, thêm bộ máy đó vào chỉ
 * tổ nặng mắt.
 */
export function PoRowsTable({ rows, columns }: { rows: Po[]; columns: Column<Po>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="t-body w-full min-w-[720px] table-fixed">
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="t-label text-muted-foreground text-left">
            {columns.map((col, i) => (
              <th
                key={col.key}
                className={`py-1.5 pr-2 font-medium ${i === 0 ? 'pl-4' : ''} ${
                  col.align === 'right' ? 'text-right' : ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            /*
             * VẠCH TRẠNG THÁI ở mép trái (xem `.spine` trong globals.css).
             * Dòng đầu tiên của thẻ không kẻ trên — đã có viền đầu thẻ rồi, kẻ
             * thêm là hai đường sát nhau.
             */
            <tr
              key={p.id}
              className={`spine border-border/70 [&:not(:first-child)]:border-t ${
                p.status === 'cancelled' ? 'opacity-55' : ''
              }`}
              style={{ '--spine': poSpineColor(p.status) } as React.CSSProperties}
            >
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={`py-2 pr-2 align-middle ${i === 0 ? 'pl-3.5' : ''} ${
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {col.cell?.(p, 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
