'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  MoreHorizontal,
  PauseCircle,
  PenLine,
  PlayCircle,
  ShoppingCart,
  Trash2,
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
  NUM,
  Panel,
  TD,
  TH,
  ToolBtn,
} from '../../_erp/ui'
import { Nhom, Truong } from '../../orders/[id]/don-hang.shared'
import { QUOTE_LABEL, quoteTone } from '../../quotes/so-bao-gia.shared'
import { KhachForm } from '../KhachForm'
import { fmtD, fmtDT, fmtMoney, fmtN } from '../khach.shared'
import { useHoSoKhach, type HoSoKhachCtx, type HoSoKhachProps } from './useHoSoKhach'

const BOM_LABEL = { none: 'chưa BOM', drawing: 'đang vẽ', done: 'đã BOM' } as const

/**
 * HỒ SƠ KHÁCH HÀNG — khuôn E · Hồ sơ danh mục, kiểu ERP (07/10/2026): "khách
 * này là ai, làm ăn ra sao, dùng ở đâu?" KHÔNG có vòng đời duyệt — chỗ của ba
 * trục trạng thái là DẢI HIỆU SUẤT, mỗi ô kèm mẫu số. Sửa hồ sơ mở ngăn tại chỗ.
 * Trái: đơn · báo giá · sản phẩm · giá đã chào. Phải: hồ sơ · hoạt động.
 */
export function HoSoKhachScreen(props: HoSoKhachProps) {
  const d = useHoSoKhach(props)
  const c = d.c
  const [menu, setMenu] = useState(false)
  const s = d.stats
  const money = (m: Map<string, number>) =>
    m.size === 0
      ? null
      : [...m.entries()].map(([cur, v]) => `${fmtMoney(v)} ${cur}`).join(' · ')
  const goto = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Khách hàng', href: '/sales/customers' },
          { label: c.name },
        ]}
        title={c.name}
        sub={
          <>
            {c.code && <span className="mr-2 font-mono text-xs">{c.code}</span>}
            {c.country && <span className="mr-2">{c.country}</span>}
            <Nhan tone={c.is_active ? 'done' : 'neutral'}>
              {c.is_active ? 'Đang giao dịch' : 'Ngừng giao dịch'}
            </Nhan>
            <span className="ml-2">
              {c.owner_name ? (
                <>
                  <span className="text-muted-foreground">Phụ trách </span>
                  {c.owner_name}
                </>
              ) : (
                <Nhan tone="warn">chưa gán phụ trách</Nhan>
              )}
            </span>
          </>
        }
        actions={
          <>
            {c.is_active && (
              <ToolBtn
                href={`/sales/quotes/new?customer=${c.id}`}
                icon={FileText}
                primary
              >
                Lập báo giá
              </ToolBtn>
            )}
            {c.is_active && (
              <ToolBtn href={`/sales/orders/new?customer=${c.id}`} icon={ShoppingCart}>
                Tạo đơn
              </ToolBtn>
            )}
            {d.canEdit && (
              <ToolBtn onClick={() => d.setEditing(!d.editing)} icon={PenLine}>
                Sửa hồ sơ
              </ToolBtn>
            )}
            {d.canEdit && (
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
                    className="border-border bg-card absolute right-0 z-20 mt-1 min-w-[200px] rounded-sm border py-1 shadow-sm"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false)
                        void d.toggleActive()
                      }}
                      className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
                    >
                      {c.is_active ? (
                        <PauseCircle className="h-4 w-4" strokeWidth={1.8} />
                      ) : (
                        <PlayCircle className="h-4 w-4" strokeWidth={1.8} />
                      )}
                      {c.is_active ? 'Ngừng giao dịch…' : 'Mở lại giao dịch…'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!d.canDelete}
                      title={
                        d.canDelete
                          ? undefined
                          : 'Khách đã có báo giá / đơn / SP — dùng Ngừng giao dịch'
                      }
                      onClick={() => {
                        setMenu(false)
                        void d.remove()
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--stop)] hover:bg-[var(--stop)]/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                      Xoá khách…
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        }
      />

      {/* Dải hiệu suất — mỗi ô kèm mẫu số (khuôn E, không phải vòng đời). */}
      <CountStrip>
        <CountCell
          label={`Doanh số ${d.thisYear}`}
          value={
            money(s.yearByCur) ? (
              <span className="text-[15px] whitespace-nowrap">{money(s.yearByCur)}</span>
            ) : null
          }
          sub={
            s.yearOrders
              ? `${fmtN(s.yearOrders)} đơn trong năm${s.noPrice ? ` · ${s.noPrice} đơn giá 0` : ''}`
              : 'chưa có đơn trong năm'
          }
        />
        <CountCell
          label="Đơn đang mở"
          value={fmtN(s.open)}
          sub={`trên ${fmtN(s.live)} đơn (không tính huỷ)`}
          onClick={goto('khoi-don')}
        />
        <CountCell
          label="Trễ hạn"
          value={fmtN(s.late)}
          sub={`trên ${fmtN(s.open)} đơn đang mở`}
          tone={s.late ? 'stop' : 'neutral'}
          onClick={goto('khoi-don')}
        />
        <CountCell
          label="Báo giá"
          value={`${fmtN(s.sentQuotes)} / ${fmtN(d.quotes.length)}`}
          sub={`đã gửi / tổng${s.wonQuotes ? ` · ${s.wonQuotes} thành đơn` : ''}`}
          onClick={goto('khoi-bao-gia')}
        />
        <CountCell
          label="Sản phẩm"
          value={fmtN(d.productTotal)}
          sub={`${fmtN(d.lastPrices.length)} SP đã có giá chào`}
          onClick={goto('khoi-sp')}
        />
        <CountCell
          label="Đơn gần nhất"
          value={<span className="whitespace-nowrap">{fmtD(s.lastOrder)}</span>}
          sub={
            s.lastDelivered
              ? `giao gần nhất ${fmtD(s.lastDelivered)}`
              : 'chưa giao đơn nào'
          }
        />
      </CountStrip>

      {(d.termsMissing.length > 0 || d.profileMissing.length > 0) && (
        <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-[var(--warn)]/5 px-6 py-1.5 text-[13px] text-[var(--warn)]">
          {d.termsMissing.length > 0 && (
            <span>
              Điều khoản mặc định thiếu {d.termsMissing.join(' · ')} — báo giá / đơn mới
              sẽ không tự điền.
            </span>
          )}
          {d.profileMissing.length > 0 && (
            <span>Hợp đồng in sẽ thiếu {d.profileMissing.join(' · ')}.</span>
          )}
          {d.canEdit && (
            <button
              type="button"
              className="underline decoration-dotted underline-offset-2"
              onClick={() => d.setEditing(true)}
            >
              Bổ sung
            </button>
          )}
        </div>
      )}

      {d.editing && (
        <div className="border-border border-b bg-[var(--accent)]/40 px-6 py-3">
          <h3 className="text-foreground mb-2 text-[14px] font-semibold">
            Sửa hồ sơ — {c.name}
          </h3>
          <KhachForm
            members={d.members}
            currentUserId={d.currentUserId}
            initial={c}
            submitLabel="Lưu hồ sơ"
            saving={d.saving}
            withActive
            onCancel={() => d.setEditing(false)}
            onSubmit={d.save}
          />
        </div>
      )}

      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div id="khoi-don">
              <KhoiDon d={d} />
            </div>
            <div id="khoi-bao-gia">
              <KhoiBaoGia d={d} />
            </div>
            <div id="khoi-sp">
              <KhoiSanPham d={d} />
            </div>
            <KhoiGiaDaChao d={d} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <KhoiHoSo d={d} />
            <KhoiHoatDong d={d} />
          </div>
        </div>
      </div>

      <ErpStatusBar
        left={`Khách từ ${fmtD(c.created_at)}${c.owner_name ? ` · phụ trách ${c.owner_name}` : ''}`}
        right={
          <Link
            href="/sales/customers"
            className="hover:text-[var(--primary)] hover:underline"
          >
            ← Sổ khách hàng
          </Link>
        }
      />
    </ErpPage>
  )
}

function KhoiHoSo({ d }: { d: HoSoKhachCtx }) {
  const c = d.c
  return (
    <Panel
      title="Hồ sơ"
      label="Hồ sơ"
      actions={
        d.canEdit ? (
          <button
            type="button"
            className="text-xs text-[var(--primary)] hover:underline"
            onClick={() => d.setEditing(true)}
          >
            Sửa
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 px-3 py-2">
        <Nhom title="Liên hệ">
          <Truong label="Người liên hệ">{c.contact_person}</Truong>
          <Truong label="Chức danh">{c.representative_title}</Truong>
          <Truong label="Email">{c.email}</Truong>
          <Truong label="Điện thoại" mono>
            {c.phone}
          </Truong>
          <Truong label="Fax" mono>
            {c.fax}
          </Truong>
          <Truong label="Địa chỉ">{c.address}</Truong>
          <Truong label="Quốc gia">{c.country}</Truong>
          <Truong label="Mã số thuế" mono>
            {c.tax_code}
          </Truong>
          <Truong label="FSC Cert" mono>
            {c.fsc_cert}
          </Truong>
        </Nhom>
        <Nhom title="Điều khoản mặc định">
          <Truong label="Tiền tệ" mono>
            {c.default_currency}
          </Truong>
          <Truong label="Incoterm">{c.default_price_term}</Truong>
          <Truong label="Thanh toán">{c.default_payment_terms}</Truong>
          <Truong label="Cảng đích">{c.port_of_discharge}</Truong>
        </Nhom>
        {c.notes && (
          <div className="text-foreground border-border border-t pt-2 text-[13px] whitespace-pre-wrap">
            <span className="text-muted-foreground mr-2 text-xs">Ghi chú:</span>
            {c.notes}
          </div>
        )}
      </div>
    </Panel>
  )
}

function KhoiDon({ d }: { d: HoSoKhachCtx }) {
  const rows = [...d.orders].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <Panel
      title="Đơn hàng"
      count={rows.length}
      label="Đơn hàng"
      note={
        d.stats.late ? (
          <span className="text-[var(--stop)]">{d.stats.late} đơn trễ hạn</span>
        ) : undefined
      }
      actions={
        d.c.is_active ? (
          <Link
            href={`/sales/orders/new?customer=${d.c.id}`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            + Tạo đơn
          </Link>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">Chưa có đơn nào.</p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col />
            <col className="w-[128px]" />
            <col className="w-[88px]" />
            <col className="w-[124px]" />
            <col className="w-[80px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>Số đơn · PO · từ báo giá</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Hạn giao</th>
              <th className={`${TH} text-right`}>Giá trị</th>
              <th className={TH}>Tạo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const late =
                o.due_date &&
                o.due_date < d.today &&
                !['delivered', 'cancelled', 'shipped'].includes(o.status)
              return (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className={`${TD} min-w-0`}>
                    <Link
                      href={`/sales/orders/${o.id}`}
                      className="block truncate font-mono text-xs text-[var(--primary)] hover:underline"
                    >
                      {o.code}
                    </Link>
                    <span className="text-muted-foreground block truncate font-mono text-[11px] leading-4">
                      {o.customer_po_no ? (
                        `PO ${o.customer_po_no}`
                      ) : (
                        <span className="text-[var(--warn)]">thiếu PO</span>
                      )}
                      {o.quote_code && ` · từ ${o.quote_code}`}
                    </span>
                  </td>
                  <td className={TD}>
                    <Nhan tone={orderStatusTone(o.status)}>
                      {orderStatusLabel(o.status)}
                    </Nhan>
                  </td>
                  <td
                    className={`${TD} font-mono text-xs whitespace-nowrap ${late ? 'text-[var(--stop)]' : ''}`}
                  >
                    {fmtD(o.due_date)}
                  </td>
                  <td className={`${TD} ${NUM}`}>
                    {o.total > 0 ? (
                      <>
                        {fmtMoney(o.total)}{' '}
                        <span className="text-muted-foreground text-xs">
                          {o.currency}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${TD} font-mono text-xs`}>{fmtD(o.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function KhoiBaoGia({ d }: { d: HoSoKhachCtx }) {
  const rows = [...d.quotes].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <Panel
      title="Báo giá"
      count={rows.length}
      label="Báo giá"
      actions={
        d.c.is_active ? (
          <Link
            href={`/sales/quotes/new?customer=${d.c.id}`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            + Lập báo giá
          </Link>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa có báo giá nào.
        </p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[150px]" />
            <col className="w-[130px]" />
            <col />
            <col className="w-[80px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>Số BG · bản</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Hiệu lực</th>
              <th className={TH}>Lập</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} className="hover:bg-muted/40">
                <td className={`${TD} min-w-0`}>
                  <Link
                    href={`/sales/quotes/${q.id}`}
                    className="block truncate font-mono text-xs text-[var(--primary)] hover:underline"
                  >
                    {q.code}
                  </Link>
                  <span className="text-muted-foreground block text-[11px] leading-4">
                    bản {q.revision_no} · {q.currency}
                  </span>
                </td>
                <td className={TD}>
                  <Nhan tone={quoteTone(q.status)}>
                    {QUOTE_LABEL[q.status] ?? q.status}
                  </Nhan>
                </td>
                <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                  {q.valid_to ? (
                    `${fmtD(q.valid_from)} → ${fmtD(q.valid_to)}`
                  ) : (
                    <span className="text-muted-foreground font-sans">chưa khai</span>
                  )}
                </td>
                <td className={`${TD} font-mono text-xs`}>{fmtD(q.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

/** "Dùng ở đâu": SP trong thư viện gắn khách này — ảnh · mã · tên · mã khách · BOM. */
function KhoiSanPham({ d }: { d: HoSoKhachCtx }) {
  const rows = d.products
  return (
    <Panel
      title="Sản phẩm của khách"
      count={d.productTotal}
      label="Sản phẩm"
      note={
        d.productTotal > rows.length
          ? `hiện ${rows.length} / ${d.productTotal} — xem đủ ở Thư viện SP`
          : 'hồ sơ SP gắn khách này (Thư viện SP)'
      }
      actions={
        <Link
          href={`/products?customer=${encodeURIComponent(d.c.name)}`}
          className="text-xs text-[var(--primary)] hover:underline"
        >
          Thư viện SP
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa có SP nào gắn khách này. Tạo nhanh từ form báo giá, hoặc gán ở hồ sơ SP.
        </p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-11" />
            <col className="w-[130px]" />
            <col />
            <col className="w-[120px]" />
            <col className="w-11" />
            <col className="w-[84px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${TH} text-center`}>Ảnh</th>
              <th className={TH}>Mã SP</th>
              <th className={TH}>Tên</th>
              <th className={TH}>Mã khách</th>
              <th className={TH}>ĐVT</th>
              <th className={TH}>BOM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={`hover:bg-muted/40 ${p.is_active ? '' : 'text-muted-foreground'}`}
              >
                <td className={`${TD} px-1 text-center`}>
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh ký sẵn, không qua next/image
                    <img
                      src={p.image_url}
                      alt={p.name}
                      width={32}
                      height={32}
                      className="border-border bg-card inline-block h-8 w-8 rounded-sm border object-contain align-middle"
                    />
                  ) : (
                    <span
                      className="border-border bg-muted inline-block h-8 w-8 rounded-sm border align-middle"
                      title="Chưa có ảnh"
                    />
                  )}
                </td>
                <td className={`${TD} min-w-0`}>
                  <Link
                    href={`/products/${p.id}`}
                    className="block truncate font-mono text-xs text-[var(--primary)] hover:underline"
                  >
                    {p.code}
                  </Link>
                  {!p.is_active && (
                    <span className="block text-[11px] leading-4">ngừng dùng</span>
                  )}
                </td>
                <td className={`${TD} truncate`} title={p.name}>
                  {p.name}
                </td>
                <td className={`${TD} truncate font-mono text-xs`}>
                  {p.customer_item_code ?? ''}
                </td>
                <td className={`${TD} text-muted-foreground text-xs`}>{p.unit}</td>
                <td className={`${TD} text-xs`}>
                  <span
                    className={
                      p.bom_status === 'done'
                        ? 'text-[var(--done)]'
                        : p.bom_status === 'drawing'
                          ? 'text-[var(--warn)]'
                          : 'text-muted-foreground'
                    }
                  >
                    {BOM_LABEL[p.bom_status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

/** Giá ĐÃ CHÀO gần nhất theo SP — thứ Sale tra trước khi chào lại. */
function KhoiGiaDaChao({ d }: { d: HoSoKhachCtx }) {
  const rows = [...d.lastPrices].sort((a, b) => b.quoted_at.localeCompare(a.quoted_at))
  return (
    <Panel
      title="Giá đã chào"
      count={rows.length}
      label="Giá đã chào"
      note="giá gần nhất trên báo giá đã gửi / duyệt / thắng — form báo giá tự điền từ đây"
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa chào giá SP nào cho khách này (báo giá nháp chưa tính).
        </p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[130px]" />
            <col />
            <col className="w-[110px]" />
            <col className="w-[130px]" />
            <col className="w-[80px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={TH}>Mã SP</th>
              <th className={TH}>Tên</th>
              <th className={`${TH} text-right`}>Giá chào</th>
              <th className={TH}>Báo giá</th>
              <th className={TH}>Ngày</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} className="hover:bg-muted/40">
                <td className={`${TD} truncate`}>
                  <Link
                    href={`/products/${r.product_id}`}
                    className="font-mono text-xs text-[var(--primary)] hover:underline"
                  >
                    {r.code}
                  </Link>
                </td>
                <td className={`${TD} truncate`} title={r.name}>
                  {r.name}
                </td>
                <td className={`${TD} ${NUM} font-medium`}>{fmtMoney(r.unit_price)}</td>
                <td className={`${TD} truncate font-mono text-xs`}>{r.quote_code}</td>
                <td className={`${TD} font-mono text-xs`}>{fmtD(r.quoted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function KhoiHoatDong({ d }: { d: HoSoKhachCtx }) {
  const tone = {
    stop: 'text-[var(--stop)]',
    done: 'text-[var(--done)]',
    warn: 'text-[var(--warn)]',
    neutral: 'text-muted-foreground',
  }
  return (
    <Panel
      title="Hoạt động"
      count={d.activity.length}
      label="Hoạt động"
      note="báo giá lập · đơn tạo · sửa · huỷ · giao — mới nhất trước"
    >
      {d.activity.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa có hoạt động nào với khách này.
        </p>
      ) : (
        <ul className="divide-border max-h-[420px] divide-y overflow-auto">
          {d.activity.slice(0, 50).map((ev, i) => (
            <li key={i} className="px-3 py-1.5 text-[13px]">
              {ev.href ? (
                <Link href={ev.href} className="block hover:text-[var(--primary)]">
                  <span className={`mr-1 ${tone[ev.tone]}`}>●</span>
                  {ev.text}
                </Link>
              ) : (
                <span>
                  <span className={`mr-1 ${tone[ev.tone]}`}>●</span>
                  {ev.text}
                </span>
              )}
              <span className="text-muted-foreground block pl-4 font-mono text-[11px] leading-4">
                {fmtDT(ev.at)}
                {ev.who && <span className="font-sans"> · {ev.who}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
