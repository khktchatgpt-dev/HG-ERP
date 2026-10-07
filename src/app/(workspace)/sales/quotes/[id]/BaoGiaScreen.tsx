'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check,
  Copy,
  FilePlus2,
  MoreHorizontal,
  PenLine,
  Printer,
  Send,
  ShoppingCart,
  Stamp,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import {
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  Nhan,
  ToolBtn,
} from '../../_erp/ui'
import { QUOTE_LABEL, quoteTone } from '../so-bao-gia.shared'
import { fmtD, fmtMoney, fmtN } from './bao-gia.shared'
import {
  KhoiBaoGiaDong,
  KhoiBaoGiaHanhDong,
  KhoiBaoGiaPhu,
  KhoiBaoGiaTongQuan,
} from './khoi-bao-gia'
import { useBaoGia, type BaoGiaProps } from './useBaoGia'

/**
 * CHI TIẾT BÁO GIÁ — khuôn D · Chứng từ, kiểu ERP. Công cụ góc phải theo bước
 * vòng đời (0225): nháp → gửi / trình GĐ; đã gửi → tạo đơn · thua · bản sửa đổi;
 * GĐ: duyệt / từ chối. Ô đếm: dòng · trị giá tham chiếu · lãi KH (có quyền) ·
 * đơn · bản · hiệu lực · việc kế. Lưới dòng có giá thành / net / lãi.
 */
export function BaoGiaScreen(props: BaoGiaProps) {
  const d = useBaoGia(props)
  const q = d.quote
  const [menu, setMenu] = useState(false)
  const goto = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Báo giá', href: '/sales/quotes' },
          { label: q.code },
        ]}
        title={q.code}
        sub={
          <>
            {q.customer_name}
            <span className="ml-2">
              <Nhan tone={d.expired ? 'stop' : quoteTone(q.status)}>
                {d.expired ? 'Hết hiệu lực' : (QUOTE_LABEL[q.status] ?? q.status)}
              </Nhan>
            </span>
            {q.revision_no > 1 && (
              <span className="ml-1">
                <Nhan tone="warn">bản {q.revision_no}</Nhan>
              </span>
            )}
          </>
        }
        actions={
          <>
            {d.can.decide && (
              <>
                <ToolBtn primary icon={Check} onClick={() => void d.approve()}>
                  Duyệt
                </ToolBtn>
                <ToolBtn icon={X} onClick={() => d.open('reject')}>
                  Từ chối…
                </ToolBtn>
              </>
            )}
            {d.can.order && (
              <ToolBtn
                primary
                href={`/sales/orders/new?quote=${q.id}`}
                icon={ShoppingCart}
              >
                Tạo đơn hàng
              </ToolBtn>
            )}
            {d.can.send && (
              <ToolBtn primary={!d.can.order} icon={Send} onClick={() => void d.send()}>
                Chốt & gửi khách
              </ToolBtn>
            )}
            {d.can.submit && (
              <ToolBtn icon={Stamp} onClick={() => void d.submit()}>
                {q.status === 'rejected' ? 'Trình duyệt lại' : 'Trình GĐ duyệt'}
              </ToolBtn>
            )}
            {d.can.revise && (
              <ToolBtn icon={FilePlus2} onClick={() => void d.revise()}>
                Bản sửa đổi
              </ToolBtn>
            )}
            {d.can.edit && (
              <ToolBtn href={`/sales/quotes/${q.id}/edit`} icon={PenLine}>
                Sửa
              </ToolBtn>
            )}
            <ToolBtn href={`/print/quotes/${q.id}`} icon={Printer}>
              In báo giá
            </ToolBtn>
            {(d.can.copy || d.can.lost || d.can.cancel || d.can.remove) && (
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
                    {d.can.copy && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false)
                          d.open('copy')
                        }}
                        className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
                      >
                        <Copy className="h-4 w-4" strokeWidth={1.8} />
                        Nhân bản…
                      </button>
                    )}
                    {d.can.lost && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false)
                          d.open('lost')
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--stop)] hover:bg-[var(--stop)]/10"
                      >
                        <XCircle className="h-4 w-4" strokeWidth={1.8} />
                        Khách không chọn (thua)…
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
                        Huỷ báo giá…
                      </button>
                    )}
                    {d.can.remove && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false)
                          void d.remove()
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--stop)] hover:bg-[var(--stop)]/10"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                        Xoá nháp…
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
          label="Dòng SP"
          value={fmtN(d.lines.length)}
          sub={d.tong.zero ? `${d.tong.zero} chưa có giá` : undefined}
          tone={d.tong.zero ? 'warn' : 'neutral'}
          onClick={goto('khoi-dong')}
        />
        <CountCell
          label="Trị giá tham chiếu"
          value={d.tong.ref > 0 ? fmtMoney(d.tong.ref) : null}
          sub={
            d.tong.ref > 0
              ? `${q.currency}${d.tong.noQty ? ` · thiếu SL ${d.tong.noQty} dòng` : ''}`
              : 'chưa có SL dòng nào'
          }
        />
        {d.canSeeCost && (
          <CountCell
            label="Lãi kế hoạch"
            value={d.tong.avgMargin != null ? `${d.tong.avgMargin.toFixed(1)}%` : null}
            sub={
              d.tong.withCost
                ? `${d.tong.withCost}/${d.lines.length} dòng có giá thành${d.tong.below ? ` · ${d.tong.below} dưới giá thành` : ''}`
                : 'chưa có giá thành KH'
            }
            tone={
              d.tong.below
                ? 'stop'
                : d.tong.avgMargin != null && d.tong.avgMargin < 10
                  ? 'warn'
                  : 'neutral'
            }
          />
        )}
        <CountCell
          label="Đơn hàng"
          value={fmtN(d.orders.length)}
          tone={d.orders.length ? 'done' : 'neutral'}
          onClick={goto('khoi-phu')}
        />
        <CountCell
          label="Bản"
          value={
            <span className="text-[15px]">
              {q.revision_no}
              {d.revisions.length > 1 ? ` / ${d.revisions.length}` : ''}
            </span>
          }
          onClick={goto('khoi-phu')}
        />
        <CountCell
          label="Hiệu lực đến"
          value={
            <span className="text-[15px]">
              {q.valid_to ? fmtD(q.valid_to) : 'chưa khai'}
            </span>
          }
          tone={d.expired ? 'stop' : 'neutral'}
        />
        <CountCell
          label="Việc kế tiếp"
          value={<span className="text-[15px]">{d.nextStep}</span>}
          tone={
            ['lost', 'cancelled', 'rejected'].includes(q.status) || d.expired
              ? 'stop'
              : 'neutral'
          }
        />
      </CountStrip>

      <KhoiBaoGiaHanhDong d={d} />

      <div className="flex flex-col gap-4 px-6 py-4">
        <div id="khoi-dong">
          <KhoiBaoGiaDong d={d} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <KhoiBaoGiaTongQuan d={d} />
          </div>
          <div id="khoi-phu" className="flex min-w-0 flex-col gap-4">
            <KhoiBaoGiaPhu d={d} />
          </div>
        </div>
      </div>

      <ErpStatusBar
        left={
          <>
            Lập {fmtD(q.created_at)}
            {q.owner_name && ` · ${q.owner_name}`} · cập nhật {fmtD(q.updated_at)}
            {d.sendBlocked && d.can.send ? ` · chưa gửi được: ${d.sendBlocked}` : ''}
          </>
        }
        right={
          <Link
            href="/sales/quotes"
            className="hover:text-[var(--primary)] hover:underline"
          >
            ← Sổ báo giá
          </Link>
        }
      />
    </ErpPage>
  )
}
