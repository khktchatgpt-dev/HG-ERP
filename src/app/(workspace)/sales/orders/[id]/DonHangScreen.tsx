'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Factory,
  MoreHorizontal,
  PenLine,
  Printer,
  Truck,
  XCircle,
} from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status-ui'
import {
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  Nhan,
  ToolBtn,
} from '../../_erp/ui'
import { fmtD, fmtMoney, fmtN } from './don-hang.shared'
import { KhoiDong } from './khoi-dong'
import { KhoiHanhDong } from './khoi-hanh-dong'
import {
  KhoiDotXuat,
  KhoiLenh,
  KhoiLichSu,
  KhoiTaiLieu,
  KhoiTongQuan,
} from './khoi-tong-quan'
import { useDonHang, type DonHangProps } from './useDonHang'

/**
 * CHI TIẾT ĐƠN BÁN — khuôn D · Chứng từ, kiểu ERP (Dynamics / SAP object page):
 * thanh đầu trang (mã · khách · trạng thái) + công cụ góc phải → dải ô đếm là
 * "nút thông minh" cuộn tới khối → khối hành động mở TẠI CHỖ → lưới dòng là
 * nhân vật chính → Tổng quan 3 nhóm · Đợt xuất · Lịch sử | Lệnh · Tài liệu.
 */
export function DonHangScreen(props: DonHangProps) {
  const d = useDonHang(props)
  const o = d.order
  const [menu, setMenu] = useState(false)
  const goto = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Đơn hàng', href: '/sales/orders' },
          { label: o.code },
        ]}
        title={o.code}
        sub={
          <>
            {o.customer_name}
            {o.customer_po_no && (
              <span className="ml-2 font-mono text-xs">PO {o.customer_po_no}</span>
            )}
            <span className="ml-2">
              <Nhan tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Nhan>
            </span>
          </>
        }
        actions={
          <>
            {d.canIssueNow && (
              <ToolBtn primary icon={Factory} onClick={() => d.open('issue')}>
                Phát lệnh SX
              </ToolBtn>
            )}
            {d.canShipNow && (
              <ToolBtn
                primary={!d.canIssueNow}
                icon={Truck}
                onClick={() => d.open('ship')}
              >
                Ghi xuất hàng
              </ToolBtn>
            )}
            {d.canDeliverNow && (
              <ToolBtn
                primary={!d.canShipNow && !d.canIssueNow}
                icon={CheckCircle2}
                onClick={() => d.open('deliver')}
              >
                Xác nhận đã giao
              </ToolBtn>
            )}
            {d.canEdit && d.editable && (
              <ToolBtn href={`/sales/orders/${o.id}/edit`} icon={PenLine}>
                Sửa
              </ToolBtn>
            )}
            <ToolBtn href={`/print/orders/${o.id}`} icon={Printer}>
              In hợp đồng
            </ToolBtn>
            {d.canCancelNow && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Thao tác khác"
                  aria-expanded={menu}
                  onClick={() => setMenu((v) => !v)}
                  className="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-sm border"
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} />
                </button>
                {menu && (
                  <div
                    role="menu"
                    className="border-border bg-card absolute right-0 z-20 mt-1 min-w-[180px] rounded-sm border py-1 shadow-sm"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false)
                        d.open('cancel')
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--stop)] hover:bg-[var(--stop)]/10"
                    >
                      <XCircle className="h-4 w-4" strokeWidth={1.8} />
                      Huỷ đơn…
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        }
      />

      <CountStrip>
        <CountCell
          label="Dòng SP"
          value={fmtN(d.lines.length)}
          onClick={goto('khoi-dong')}
        />
        <CountCell
          label="Đã xuất / SL"
          value={`${fmtN(d.tong.shipped)} / ${fmtN(d.tong.qty)}`}
          sub={d.tong.left > 0 ? `còn ${fmtN(d.tong.left)}` : 'đã xuất đủ'}
          tone={d.tong.left === 0 && d.tong.qty > 0 ? 'done' : 'neutral'}
          onClick={goto('khoi-xuat')}
        />
        <CountCell
          label="Đợt xuất"
          value={fmtN(d.shipments.length)}
          onClick={goto('khoi-xuat')}
        />
        <CountCell
          label="Lệnh sản xuất"
          value={<span className="text-[15px]">{d.lsx ? d.lsx.code : 'chưa phát'}</span>}
          sub={d.lsx ? `${d.lsx.jobs_done}/${d.lsx.jobs_total} công đoạn` : undefined}
          tone={d.lsx?.status === 'rejected' ? 'stop' : 'neutral'}
          onClick={goto('khoi-lenh')}
        />
        <CountCell
          label="Giá trị đơn"
          value={d.tong.value > 0 ? fmtMoney(d.tong.value) : null}
          sub={
            d.tong.value > 0 ? o.currency : `${d.lines.length - d.tong.priced} dòng giá 0`
          }
        />
        <CountCell
          label="Hạn giao"
          value={
            <span className="text-[15px]">
              {o.due_date ? fmtD(o.due_date) : 'chưa khai'}
            </span>
          }
          sub={d.lsx?.ship_date ? `lệnh xuất ${fmtD(d.lsx.ship_date)}` : undefined}
        />
        <CountCell
          label="Việc kế tiếp"
          value={<span className="text-[15px]">{d.nextStep}</span>}
          tone={o.status === 'cancelled' ? 'stop' : 'neutral'}
        />
      </CountStrip>

      <KhoiHanhDong d={d} />

      <div className="flex flex-col gap-4 px-6 py-4">
        <div id="khoi-dong">
          <KhoiDong d={d} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <KhoiTongQuan d={d} />
            <div id="khoi-xuat">
              <KhoiDotXuat d={d} />
            </div>
            <KhoiLichSu d={d} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div id="khoi-lenh">
              <KhoiLenh d={d} />
            </div>
            <KhoiTaiLieu d={d} />
          </div>
        </div>
      </div>

      <ErpStatusBar
        left={
          <>
            Tạo {fmtD(o.created_at)}
            {o.owner_name && ` · ${o.owner_name}`} · tiền tệ {o.currency}
            {o.fx_rate ? ` · tỷ giá ${fmtN(o.fx_rate)}` : ' · chưa có tỷ giá'}
          </>
        }
        right={
          <Link
            href="/sales/orders"
            className="hover:text-[var(--primary)] hover:underline"
          >
            ← Sổ đơn hàng
          </Link>
        }
      />
    </ErpPage>
  )
}
