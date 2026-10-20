'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check,
  FileSpreadsheet,
  ListChecks,
  MoreHorizontal,
  PenLine,
  Printer,
  RefreshCw,
  SendHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { lsxTone } from '../so-lenh.shared'
import {
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  Nhan,
  ToolBtn,
} from '../../_erp/ui'
import { fmtD, fmtN, LSX_LABEL } from './lenh.shared'
import { KhoiLenhDong } from './khoi-lenh-dong'
import { KhoiLenhHanhDong } from './khoi-lenh-hanh-dong'
import {
  KhoiLenhDon,
  KhoiLenhLichSu,
  KhoiLenhLo,
  KhoiLenhTaiLieu,
  KhoiLenhTongQuan,
  KhoiLenhVatTu,
} from './khoi-lenh-phu'
import { useLenh, type LenhProps } from './useLenh'

/**
 * CHI TIẾT LỆNH SẢN XUẤT phía Sale — khuôn D · Chứng từ, kiểu ERP. Thanh đầu
 * (số lệnh · khách · trạng thái · bản N) + công cụ góc phải → 7 ô đếm cuộn tới
 * khối → hành động TẠI CHỖ → lưới dòng theo nhóm là nhân vật chính → Tổng quan
 * · Đơn · Đợt xuất · Lịch sử | Vật tư · Tài liệu. Màn của xưởng vẫn là
 * LsxDetailView ở khu Sản xuất.
 */
export function LenhScreen(props: LenhProps) {
  const d = useLenh(props)
  const l = d.lsx
  const [menu, setMenu] = useState(false)
  const goto = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Lệnh sản xuất', href: '/sales/lsx' },
          { label: l.code },
        ]}
        title={l.code}
        sub={
          <>
            {l.customer_name}
            <span className="ml-2">
              <Nhan tone={lsxTone(l.status)}>{LSX_LABEL[l.status] ?? l.status}</Nhan>
            </span>
            {l.revision > 1 && (
              <span className="ml-1">
                <Nhan tone="warn">bản {l.revision}</Nhan>
              </span>
            )}
          </>
        }
        actions={
          <>
            {d.can.decide && (
              <>
                <ToolBtn primary icon={Check} onClick={() => void d.approve()}>
                  Duyệt lệnh
                </ToolBtn>
                <ToolBtn icon={X} onClick={() => d.open('reject')}>
                  Từ chối…
                </ToolBtn>
              </>
            )}
            {d.can.submit && (
              <ToolBtn primary icon={SendHorizontal} onClick={() => d.open('submit')}>
                Gửi GĐ duyệt
              </ToolBtn>
            )}
            {d.can.resubmit && (
              <ToolBtn primary icon={SendHorizontal} onClick={() => d.open('resubmit')}>
                Trình duyệt lại
              </ToolBtn>
            )}
            {d.can.lines && (
              <ToolBtn
                href={`/sales/lsx/${l.id}/dong`}
                icon={ListChecks}
                primary={
                  !d.can.submit && !d.can.resubmit && !d.can.decide && d.tong.lines === 0
                }
              >
                Soạn dòng lệnh
              </ToolBtn>
            )}
            {d.can.header && (
              <ToolBtn icon={PenLine} onClick={() => d.open('header')}>
                Sửa đầu lệnh
              </ToolBtn>
            )}
            <ToolBtn href={`/print/lsx/${l.id}`} icon={Printer}>
              In phiếu
            </ToolBtn>
            <a
              href={`/api/dept/production/lsx/${l.id}/export`}
              className="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[13px] whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4" strokeWidth={1.8} />
              Excel
            </a>
            {(d.can.sync || d.can.cancel || d.can.delete) && (
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
                    className="border-border bg-card absolute right-0 z-20 mt-1 min-w-[220px] rounded-sm border py-1 shadow-sm"
                  >
                    {d.can.sync && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false)
                          d.open('sync')
                        }}
                        className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
                      >
                        <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
                        So với đơn hàng…
                      </button>
                    )}
                    {d.can.cancel && (
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
                        Huỷ lệnh…
                      </button>
                    )}
                    {d.can.delete && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false)
                          d.open('delete')
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--stop)] hover:bg-[var(--stop)]/10"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                        Xoá lệnh {l.status === 'draft' ? 'nháp' : 'bị từ chối'}…
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        }
      />

      <CountStrip>
        <CountCell
          label="Đơn"
          value={fmtN(d.orders.length)}
          sub={`${fmtN(d.tong.orderQty)} SP đặt`}
          onClick={goto('khoi-don')}
        />
        <CountCell
          label="Dòng lệnh"
          value={fmtN(d.tong.lines)}
          sub={`${fmtN(d.tong.qty)} SP`}
          tone={d.tong.orderQty !== d.tong.qty && d.tong.lines > 0 ? 'warn' : 'neutral'}
          onClick={goto('khoi-dong')}
        />
        <CountCell
          label="Công đoạn"
          value={d.jobs.total ? `${d.jobs.done}/${d.jobs.total}` : '—'}
          sub={d.jobs.total ? undefined : 'chưa lên kế hoạch'}
          tone={d.jobs.total && d.jobs.done === d.jobs.total ? 'done' : 'neutral'}
        />
        <CountCell
          label="Vật tư"
          value={
            <span className="text-[15px]">
              {l.materials_received_at
                ? 'đã nhận'
                : d.pos.length
                  ? `${d.pos.length} đơn mua`
                  : 'chưa có'}
            </span>
          }
          sub={l.materials_due_at ? `hạn ${fmtD(l.materials_due_at)}` : undefined}
          onClick={goto('khoi-vat-tu')}
        />
        <CountCell
          label="Đợt xuất"
          value={fmtN(d.lots.length)}
          sub={
            d.lots.length ? `${fmtN(d.tong.lotQty)}/${fmtN(d.tong.qty)} SP` : 'chưa chia'
          }
          tone={
            d.lotIssues.length
              ? 'stop'
              : d.lots.length && d.tong.lotQty < d.tong.qty
                ? 'warn'
                : 'neutral'
          }
          onClick={goto('khoi-lo')}
        />
        <CountCell
          label="Hạn xuất"
          value={
            <span className="text-[15px]">
              {l.ship_date ? fmtD(l.ship_date) : 'chưa khai'}
            </span>
          }
        />
        <CountCell
          label="Việc kế tiếp"
          value={<span className="text-[15px]">{d.nextStep}</span>}
          tone={l.status === 'rejected' || l.status === 'cancelled' ? 'stop' : 'neutral'}
        />
      </CountStrip>

      <KhoiLenhHanhDong d={d} />

      <div className="flex flex-col gap-4 px-6 py-4">
        <div id="khoi-dong">
          <KhoiLenhDong d={d} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <KhoiLenhTongQuan d={d} />
            <div id="khoi-don">
              <KhoiLenhDon d={d} />
            </div>
            <div id="khoi-lo">
              <KhoiLenhLo d={d} />
            </div>
            <KhoiLenhLichSu d={d} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div id="khoi-vat-tu">
              <KhoiLenhVatTu d={d} />
            </div>
            <KhoiLenhTaiLieu d={d} />
          </div>
        </div>
      </div>

      <ErpStatusBar
        left={
          <>
            Lập {fmtD(l.created_at)}
            {l.created_by_name && ` · ${l.created_by_name}`} · cập nhật{' '}
            {fmtD(l.updated_at)}
          </>
        }
        right={
          <Link href="/sales/lsx" className="hover:text-[var(--primary)] hover:underline">
            ← Sổ lệnh
          </Link>
        }
      />
    </ErpPage>
  )
}
