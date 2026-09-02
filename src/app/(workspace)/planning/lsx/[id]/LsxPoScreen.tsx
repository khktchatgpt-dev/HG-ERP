'use client'

import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  FileText,
  Package,
  PackageCheck,
  Plus,
  Send,
  ShoppingCart,
  TriangleAlert,
  User,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent } from '@/components/shadcn/card'
import {
  PO_NEXT_HINT,
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  isPoStatus,
} from '@/lib/po-status'
import type { LsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'

type Po = LsxSupplyDetail['pos'][number]

const dmy = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const money = (n: number, currency: string) =>
  `${n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}${currency === 'VND' ? '' : ` ${currency}`}`

/**
 * ĐƠN MUA CỦA MỘT LỆNH — trang người mua bấm vào từ danh sách lệnh (03/09/2026).
 *
 * Vì sao tách khỏi hồ sơ lệnh dùng chung: hồ sơ lệnh là màn của xưởng (bảng chi
 * tiết sản phẩm, tiến độ công đoạn) và panel PO ở đó chỉ có mã/NCC/ngày về.
 * Người mua cần thêm hai cột mà panel kia không có và không nên có: AI ĐANG GIỮ
 * đơn (0128) và ĐÃ VỀ tới đâu. Hồ sơ lệnh đầy đủ vẫn mở được bằng nút ở đầu
 * trang.
 *
 * Mỗi dòng đơn bấm được sang `/planning/pos/[id]` — đó là chỗ duy nhất sửa đơn,
 * trang này chỉ đọc.
 */
export function LsxPoScreen({ lsx, today }: { lsx: LsxSupplyDetail; today: string }) {
  const live = lsx.pos.filter((p) => p.status !== 'cancelled')
  const unsent = live.filter(
    (p) => p.status === 'draft' || p.status === 'pending_approval',
  ).length
  const done = live.filter((p) => p.status === 'received').length
  /*
   * "NCC TRỄ HẸN" chỉ đếm đơn ĐÃ RA KHỎI NHÀ. `late` (assessPoLate) trả lời câu
   * rộng hơn — "ngày hẹn đã trôi qua chưa" — và cố ý tính cả đơn còn chờ ký, vì
   * đơn nằm chờ duyệt quá hẹn cũng là việc phải thấy. Nhưng gọi thẳng con số đó
   * là "NCC trễ" thì trang báo "8 đơn chưa gửi NCC" mà vẫn kết tội nhà cung cấp
   * một lỗi họ không gây ra: họ còn chưa cầm đơn.
   */
  const sentLate = live.filter(
    (p) => p.late && p.status !== 'draft' && p.status !== 'pending_approval',
  ).length
  /** Quá hẹn khi đơn còn nằm trên bàn mình — việc của Cung ứng, không của NCC. */
  const unsentLate = live.filter(
    (p) => p.late && (p.status === 'draft' || p.status === 'pending_approval'),
  ).length
  const owners = [
    ...new Set(live.map((p) => p.assignee_name).filter((v): v is string => !!v)),
  ]

  const columns: Column<Po>[] = [
    {
      key: 'code',
      header: 'Đơn mua',
      width: '180px',
      cell: (p) => (
        <div className="flex flex-col gap-1">
          <Link href={`/planning/pos/${p.id}`} className="hover:underline">
            <DocChip>{p.code}</DocChip>
          </Link>
          {p.shared && (
            <span className="text-muted-foreground text-[11px]">
              mua chung{p.shared_with.length > 0 && ` · ${p.shared_with.join(', ')}`}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Nhà cung cấp',
      width: '190px',
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{p.supplier_name}</div>
          {p.material_group && (
            <div className="text-muted-foreground truncate text-[11px]">
              {p.material_group}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Tình trạng',
      width: '150px',
      cell: (p) => {
        const st = isPoStatus(p.status) ? p.status : null
        return (
          <div className="flex flex-col gap-1">
            <span>
              <Badge tone={st ? PO_STATUS_TONE[st] : 'gray'}>
                {st ? PO_STATUS_LABEL[st] : p.status}
              </Badge>
            </span>
            {p.late ? (
              <span className="text-[11px]" style={{ color: 'var(--stop)' }}>
                {/* Nói rõ trễ này của AI: đơn chưa gửi thì lỗi nằm ở nhà mình. */}
                {p.status === 'draft' || p.status === 'pending_approval'
                  ? `quá hẹn ${dmy(p.expected_at)} — đơn chưa gửi`
                  : `NCC trễ ${dmy(p.expected_at)}`}
              </span>
            ) : (
              st &&
              PO_NEXT_HINT[st] && (
                <span className="text-muted-foreground text-[11px]">
                  {PO_NEXT_HINT[st]}
                </span>
              )
            )}
          </div>
        )
      },
    },
    {
      key: 'assignee',
      header: 'Người đảm nhận',
      width: '140px',
      cell: (p) =>
        p.assignee_name ? (
          <span className="truncate">{p.assignee_name}</span>
        ) : (
          <span style={{ color: 'var(--warn)' }}>chưa giao ai</span>
        ),
    },
    {
      key: 'dates',
      header: 'Đặt / Hẹn về',
      width: '132px',
      sortValue: (p) => p.expected_at ?? '9999',
      cell: (p) => (
        <div className="t-data flex flex-col">
          <span>{dmy(p.ordered_at)}</span>
          <span
            style={
              p.expected_at &&
              p.expected_at.slice(0, 10) < today &&
              p.status !== 'received'
                ? { color: 'var(--stop)' }
                : { color: 'var(--muted-foreground)' }
            }
          >
            {p.expected_at ? `→ ${dmy(p.expected_at)}` : '→ chưa hẹn'}
          </span>
        </div>
      ),
    },
    {
      key: 'received',
      header: 'Đã về',
      width: '120px',
      align: 'right',
      sortValue: (p) => (p.qty_ordered > 0 ? p.qty_received / p.qty_ordered : -1),
      cell: (p) => {
        /*
         * Đơn CHƯA RA KHỎI NHÀ thì không có gì để nói về "đã về": hiện "0% ·
         * thiếu 2 mã" cho một đơn còn nháp đọc thành "NCC giao thiếu", đổ lỗi
         * sai người. Chưa gửi thì việc đang nằm ở bàn người mua.
         */
        if (p.status === 'draft' || p.status === 'pending_approval') {
          return <span className="text-muted-foreground">chưa gửi</span>
        }
        if (p.qty_ordered <= 0) return <span className="text-muted-foreground">—</span>
        const pct = Math.round((p.qty_received / p.qty_ordered) * 100)
        return (
          <div className="flex flex-col items-end">
            <span className="t-data">{pct}%</span>
            {p.lines_missing > 0 && (
              <span className="text-[11px]" style={{ color: 'var(--warn)' }}>
                thiếu {p.lines_missing} mã
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'amount',
      header: 'Giá trị',
      width: '132px',
      align: 'right',
      sortValue: (p) => p.amount,
      cell: (p) => (
        <div className="flex flex-col items-end">
          <span className="t-data">{money(p.amount, p.currency)}</span>
          {p.paid > 0 && (
            <span className="text-muted-foreground text-[11px]">
              trả {money(p.paid, p.currency)}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư theo lệnh', href: '/planning/lsx' },
          { label: `LSX ${lsx.code}` },
        ]}
        title={`LSX ${lsx.code}`}
        description={`${lsx.customer_name}${lsx.order_codes.length > 0 ? ` · ĐH ${lsx.order_codes.join(', ')}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/planning/lsx/${lsx.id}/ho-so`}>
                <FileText /> Hồ sơ lệnh
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/planning/pos/new?lsx=${lsx.id}`}>
                <Plus /> Soạn đơn cho lệnh này
              </Link>
            </Button>
          </div>
        }
      />

      {/* Bốn con số của lệnh — đọc, không lọc: bảng dưới chỉ có mấy dòng, lọc
          thêm một tầng nữa là thừa. Nên dùng thẻ ĐỌC chứ không phải thẻ bấm. */}
      <StatTiles>
        <StatTile label="Đơn mua" value={live.length} icon={ShoppingCart} />
        <StatTile
          label="Chưa gửi NCC"
          value={unsent}
          icon={Send}
          tone={unsent > 0 ? 'warn' : 'default'}
          hint={unsentLate > 0 ? `${unsentLate} đơn đã quá hẹn giao` : undefined}
        />
        <StatTile
          label="NCC trễ hẹn"
          value={sentLate}
          icon={TriangleAlert}
          tone={sentLate > 0 ? 'stop' : 'default'}
        />
        <StatTile
          label="Về đủ"
          value={done}
          icon={PackageCheck}
          tone={done > 0 ? 'done' : 'default'}
        />
      </StatTiles>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 px-4 py-3.5 md:grid-cols-4">
          <Fact
            icon={<CalendarDays />}
            label="Hạn vật tư"
            value={dmy(lsx.materials_due_at)}
            tone={lsx.materials_due_at ? undefined : 'var(--warn)'}
            hint={lsx.materials_due_at ? undefined : 'chưa ai đặt hạn'}
          />
          <Fact
            icon={<CalendarDays />}
            label="Ngày giao khách"
            value={dmy(lsx.ship_date)}
          />
          <Fact
            icon={<Package />}
            label="Sản phẩm"
            value={
              lsx.products.length > 0 ? `${lsx.products.length} mã` : 'chưa có dòng SP'
            }
            hint={lsx.products
              .slice(0, 3)
              .map((p) => `${p.code}×${p.qty}`)
              .join(' · ')}
          />
          <Fact
            icon={<User />}
            label="Người đảm nhận"
            value={owners.length > 0 ? owners.join(', ') : 'chưa giao ai'}
            tone={owners.length > 0 ? undefined : 'var(--warn)'}
            hint={owners.length > 1 ? 'nhiều người cùng lo lệnh này' : undefined}
          />
        </CardContent>
      </Card>

      <DataTable
        rows={lsx.pos}
        columns={columns}
        keyFn={(p) => p.id}
        pagination={false}
        rowClassName={(p) => (p.status === 'cancelled' ? 'opacity-50' : undefined)}
        emptyState={
          <EmptyState
            icon={<Building2 />}
            title="Lệnh này chưa có đơn mua nào"
            description="Vật tư của lệnh chưa được đặt — sản xuất sẽ chờ."
            action={
              <Button size="sm" asChild>
                <Link href={`/planning/pos/new?lsx=${lsx.id}`}>
                  <Plus /> Soạn đơn đầu tiên
                </Link>
              </Button>
            }
          />
        }
      />
    </div>
  )
}

/** Một dữ kiện của lệnh: nhãn nhỏ, giá trị, dòng phụ. `tone` cho ô còn trống. */
function Fact({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: string
}) {
  return (
    <div className="flex gap-2.5">
      <span className="bg-muted text-muted-foreground mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg [&>svg]:size-3.5">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="t-label text-muted-foreground">{label}</div>
        <div className="t-data truncate" style={tone ? { color: tone } : undefined}>
          {value}
        </div>
        {hint && <div className="text-muted-foreground truncate text-[11px]">{hint}</div>}
      </div>
    </div>
  )
}
