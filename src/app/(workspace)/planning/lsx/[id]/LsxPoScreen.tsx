'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CalendarClock,
  CalendarDays,
  FileText,
  ClipboardList,
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
import { DateField } from '@/components/erp/DateField'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent } from '@/components/shadcn/card'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
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
export function LsxPoScreen({
  lsx,
  today,
  canEdit,
}: {
  lsx: LsxSupplyDetail
  today: string
  canEdit: boolean
}) {
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
  const cov = lsx.coverage
  /*
   * TIỀN CỦA LỆNH — CỘNG THEO TỪNG LOẠI TIỀN (04/09/2026).
   *
   * Bản cũ `filter(p => p.currency === 'VND')` rồi cộng: đơn ngoại tệ bị LOẠI
   * IM LẶNG khỏi ô "Giá trị đã đặt" trong khi vẫn được đếm ở dòng "N đơn" ngay
   * dưới. Lệnh 08/26-27 thật có `16.830,9 USD · 32.225.000 VND` — trang này chỉ
   * bày con VND, người đọc hiểu đó là toàn bộ tiền của lệnh. Chú thích cũ bảo
   * "đơn ngoại tệ đứng riêng ở cột Giá trị của nó", nhưng cột ấy nằm trong bảng
   * bên dưới và không ai cộng nhẩm 12 dòng.
   *
   * Không quy đổi về VND: tỉ giá không nằm trên đơn, và một con số quy đổi bịa
   * ra còn tệ hơn hai con số thật đứng cạnh nhau.
   */
  const totals = new Map<string, number>()
  for (const p of live) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.amount)
  // VND đứng đầu vì đa số đơn là VND; còn lại xếp theo giá trị giảm dần.
  const totalsList = [...totals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => (a[0] === 'VND' ? -1 : b[0] === 'VND' ? 1 : b[1] - a[1]))
  const mainTotal = totalsList[0] ?? (['VND', 0] as const)
  const otherTotals = totalsList.slice(1)
  const totalLines = live.reduce((s, p) => s + p.line_count, 0)

  /*
   * HẠN VẬT TƯ PHẢI VỀ (0126) — mốc của LỆNH, không phải của đơn.
   *
   * Đèn "Kịp SX?" của từng đơn so ngày hẹn về với đúng mốc này, nên trước đây
   * người mua phải sang `/planning/pos` (thẻ gộp theo lệnh) mới đặt được nó —
   * tức mốc của lệnh lại nằm ở màn danh sách đơn. Nay về đúng trang lệnh, và có
   * thêm phần đếm ngược mà ô cũ không có.
   */
  const dueLeft = lsx.materials_due_at
    ? Math.round(
        (Date.parse(lsx.materials_due_at.slice(0, 10)) - Date.parse(today)) / 86_400_000,
      )
    : null
  /** Nháp mà thiếu giá hoặc chưa có dòng nào — gửi duyệt bây giờ là gửi đơn hụt. */
  const notReady = live.filter(
    (p) =>
      (p.status === 'draft' || p.status === 'pending_approval') &&
      (p.line_count === 0 || p.unpriced_lines > 0),
  ).length
  /** Đã gửi NCC mà chưa có ngày hẹn về — không trễ được, nhưng cũng không biết đường chờ. */
  const noEta = live.filter(
    (p) => !p.expected_at && p.status !== 'draft' && p.status !== 'pending_approval',
  ).length

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
          {/* Số ĐH trên tờ giấy: người mua gọi NCC thì đọc số này, không ai bên
              kia biết PO-2026-0038 là gì. Chỉ hiện khi khác mã hệ thống. */}
          {p.supplier_doc_no && p.supplier_doc_no !== p.code && (
            <span className="text-muted-foreground t-data text-[11px]">
              ĐH {p.supplier_doc_no}
            </span>
          )}
          <span className="text-muted-foreground text-[11px]">
            {p.line_count} dòng
            {p.unpriced_lines > 0 && (
              <span style={{ color: 'var(--warn)' }}>
                {' '}
                · {p.unpriced_lines} chưa có giá
              </span>
            )}
            {p.line_count === 0 && (
              <span style={{ color: 'var(--stop)' }}> · đơn rỗng</span>
            )}
          </span>
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
      /*
       * Hai ngày xếp chồng, KHÔNG có mũi tên "→" dẫn giữa chúng (04/09/2026).
       * Tiêu đề cột đã nói "Đặt / Hẹn về" nên vị trí dòng tự phân vai; thêm một
       * ký tự mũi tên vào mỗi ô là 30 mũi tên trên một bảng 30 dòng, đọc thành
       * nhiễu chứ không thành nghĩa. Cùng lý do đã bỏ "⚠" ở thẻ nhóm bên
       * `/planning/pos`: ký tự không phải icon.
       */
      cell: (p) => (
        <div className="t-data flex flex-col leading-[17px]">
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
            {p.expected_at ? dmy(p.expected_at) : 'chưa hẹn'}
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
      {/*
        Bốn con số của lệnh, xếp theo THỨ TỰ NGƯỜI MUA HỎI:
          1. đã mua đủ chưa (độ phủ nhu cầu) — câu hỏi số một, trước đây phải
             bấm sang màn soạn đơn mới biết;
          2. đã đặt bao nhiêu tiền — con số GĐ hỏi khi duyệt;
          3. còn kẹt ở đâu (chưa gửi NCC);
          4. hàng về tới đâu.
        Ô "NCC trễ hẹn" cũ bị bỏ: khi chưa đơn nào có ngày hẹn, nó luôn hiện 0 và
        trấn an sai — nay việc "chưa hẹn ngày" nói thẳng trong ô Hàng về.
      */}
      <StatTiles>
        <StatTile
          label="Vật tư đã có đơn"
          value={cov.needed > 0 ? `${cov.covered}/${cov.needed}` : String(live.length)}
          icon={ClipboardList}
          tone={cov.missing > 0 ? 'warn' : cov.needed > 0 ? 'done' : 'default'}
          hint={
            cov.needed === 0
              ? 'lệnh chưa có định mức để đối chiếu'
              : cov.missing > 0
                ? `còn ${cov.missing} mã chưa đủ — xem bên dưới`
                : 'đủ cho toàn lệnh'
          }
        />
        <StatTile
          label="Giá trị đã đặt"
          value={money(mainTotal[1], mainTotal[0])}
          icon={ShoppingCart}
          hint={
            otherTotals.length > 0
              ? // Ngoại tệ đứng TRƯỚC số đơn: nó là phần dễ bị đọc sót nhất.
                `+ ${otherTotals.map(([c, v]) => money(v, c)).join(' · ')} · ${live.length} đơn`
              : `${live.length} đơn · ${totalLines} dòng`
          }
        />
        <StatTile
          label="Chưa gửi NCC"
          value={unsent}
          icon={Send}
          tone={unsent > 0 ? 'warn' : 'default'}
          hint={
            notReady > 0
              ? `${notReady} đơn còn thiếu giá / thiếu dòng`
              : unsentLate > 0
                ? `${unsentLate} đơn đã quá hẹn giao`
                : undefined
          }
        />
        <StatTile
          label="Hàng về"
          value={`${done}/${live.length}`}
          icon={PackageCheck}
          tone={sentLate > 0 ? 'stop' : done > 0 ? 'done' : 'default'}
          hint={
            sentLate > 0
              ? `${sentLate} đơn NCC trễ hẹn`
              : noEta > 0
                ? `${noEta} đơn chưa hẹn ngày về`
                : undefined
          }
        />
      </StatTiles>

      {/*
        DANH SÁCH CÒN THIẾU — thứ khiến người mua phát hiện mình quên một loại
        vật tư TRƯỚC khi xưởng dừng máy. Chỉ hiện khi thật sự thiếu.
      */}
      {cov.missing > 0 && (
        // `py-0` — xem ghi chú ở thẻ dữ kiện bên dưới.
        <Card className="py-0" style={{ borderColor: 'var(--warn)' }}>
          <CardContent className="px-4 py-3.5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TriangleAlert
                size={16}
                strokeWidth={1.8}
                style={{ color: 'var(--warn)' }}
              />
              <span className="text-[13px] font-semibold">
                Còn {cov.missing} mã vật tư chưa đủ cho lệnh
              </span>
              <Button asChild size="sm" variant="ghost" className="ml-auto">
                <Link href={`/planning/pos/new?lsx=${lsx.id}`}>
                  <Plus /> Lên đơn cho phần thiếu
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cov.missing_top.map((m) => (
                <span
                  key={m.code}
                  className="bg-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px]"
                  title={m.name}
                >
                  <DocChip className="text-[11px]">{m.code}</DocChip>
                  <span className="max-w-[190px] truncate">{m.name}</span>
                  <span className="t-data font-medium" style={{ color: 'var(--warn)' }}>
                    thiếu {m.qty.toLocaleString('vi-VN')} {m.unit}
                  </span>
                </span>
              ))}
              {cov.missing > cov.missing_top.length && (
                <span className="text-muted-foreground self-center text-[12px]">
                  … và {cov.missing - cov.missing_top.length} mã nữa
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/*
        `py-0` TRÊN CARD — không thừa. `shadcn/card` gắn sẵn `py-6` cho thẻ, còn
        `CardContent` chỉ có `px-6`. Viết `py-3.5` ở CardContent (như bản cũ) là
        CỘNG THÊM chứ không phải thay: đo được 48px + 28px = 76px đệm bọc quanh
        93px nội dung — thẻ cao 142px cho một dải bốn dòng chữ. Đây chính là chỗ
        "khoảng trống dư thừa" nhìn thấy trên trang.
      */}
      <Card className="py-0">
        <CardContent className="grid grid-cols-2 gap-4 px-4 py-3.5 md:grid-cols-4">
          {/*
            "Hạn vật tư phải về" từng là một DẢI RIÊNG ngay dưới tiêu đề. Gộp về
            đây 04/09/2026: nó cùng loại với ba ô bên cạnh — đều là dữ kiện của
            LỆNH — nên tách ra thành khối thứ tư chỉ để nhét một ô nhập là ăn
            thêm một thẻ, một đường viền và hai lần khoảng cách, đẩy bảng đơn
            xuống quá nửa màn hình. Ô sửa được nằm lẫn giữa ô đọc vẫn phân biệt
            đượcvì nó có viền input rõ ràng.
          */}
          <MaterialsDueFact
            lsxId={lsx.id}
            value={lsx.materials_due_at}
            daysLeft={dueLeft}
            canEdit={canEdit}
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

      {/*
        PHÂN TRANG BẬT KHI LỆNH NHIỀU ĐƠN (04/09/2026).

        Trước đây cứng `pagination={false}` với lý do "bảng ngắn". Lý do đó chỉ
        đúng cho lệnh nhỏ: lệnh 06/26-27 thật có 12 đơn, và một lệnh gom nhiều
        đơn hàng khách thì còn dài hơn — lúc ấy trang đổ hết một lượt, không đầu
        bảng dính, không biết mình đang ở đâu. Ngưỡng 20 vì dưới đó thanh phân
        trang chỉ tổ thêm một hàng chrome cho ba dòng dữ liệu.
      */}
      <DataTable
        rows={lsx.pos}
        columns={columns}
        keyFn={(p) => p.id}
        pagination={lsx.pos.length > 20}
        pageSize={20}
        storageKey="lsx-po-page-size"
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

/**
 * Ô "HẠN VẬT TƯ PHẢI VỀ" — mốc của lệnh, ô DUY NHẤT sửa được trong dải dữ kiện.
 *
 * Cùng khuôn `Fact` bên cạnh (icon vuông + nhãn + giá trị + dòng phụ) để dải
 * đọc thành một hàng liền mạch, chỉ khác chỗ giá trị là `DateField` thay vì chữ
 * chết. Không tách thành khối riêng: nó cùng loại với ba ô kia — đều là dữ kiện
 * của lệnh — và tách ra chỉ tổ đẩy bảng đơn xuống quá nửa màn hình.
 *
 * Đổi ngày là ghi ngay (không có nút Lưu): ô chỉ có một giá trị, và `DateField`
 * chỉ gọi `onChange` khi gõ đủ một ngày có thật.
 */
function MaterialsDueFact({
  lsxId,
  value,
  daysLeft,
  canEdit,
}: {
  lsxId: string
  value: string | null
  daysLeft: number | null
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function save(iso: string) {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/materials-due`, {
        method: 'PATCH',
        body: { materials_due_at: iso || null },
      })
      router.refresh()
      toast.success(iso ? 'Đã đặt hạn vật tư phải về' : 'Đã xoá hạn vật tư')
    } catch (e) {
      toast.error(
        'Không đặt được hạn vật tư',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    } finally {
      setBusy(false)
    }
  }

  // Quá hạn thì đỏ, còn dưới một tuần thì hổ phách — vòng đời, không phải hành động.
  const tone =
    daysLeft == null ? null : daysLeft < 0 ? 'stop' : daysLeft <= 7 ? 'warn' : 'done'
  const note =
    daysLeft == null
      ? 'chưa đặt — không có mốc để chấm đơn nào kịp, đơn nào không'
      : daysLeft < 0
        ? `đã quá ${Math.abs(daysLeft)} ngày`
        : daysLeft === 0
          ? 'đúng hôm nay'
          : `còn ${daysLeft} ngày`

  return (
    <div className="flex gap-2.5">
      <TopProgressBar active={busy} />
      <span
        className="bg-muted mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg [&>svg]:size-3.5"
        style={{ color: tone ? `var(--${tone})` : 'var(--muted-foreground)' }}
      >
        <CalendarClock aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="t-label text-muted-foreground">Hạn vật tư phải về</div>
        {canEdit ? (
          <div className="mt-0.5 flex items-center gap-1.5">
            <DateField
              value={value ?? ''}
              onChange={(iso) => void save(iso)}
              disabled={busy}
              className="h-7 w-[124px] text-[12px]"
              aria-label="Hạn vật tư phải về của lệnh"
            />
            {busy && <Spinner size={13} />}
          </div>
        ) : (
          <div className="t-data">{dmy(value)}</div>
        )}
        <div
          className="mt-0.5 truncate text-[11px]"
          style={tone ? { color: `var(--${tone})` } : undefined}
          title="Đèn “Kịp SX?” của từng đơn so ngày hẹn về với mốc này"
        >
          {note}
        </div>
      </div>
    </div>
  )
}
