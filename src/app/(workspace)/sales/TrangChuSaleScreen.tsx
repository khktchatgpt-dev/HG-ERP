'use client'

import { useState, type ComponentType } from 'react'
import {
  ArrowRight,
  Calculator,
  CalendarClock,
  CalendarX,
  ChartColumn,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Container,
  Factory,
  FileText,
  ShoppingCart,
  TriangleAlert,
  Users,
} from 'lucide-react'
import type { LanViec } from '@/lib/viec-sale'
import type { SalesHome } from '@/modules/dept/sales/sales-home.service'

/**
 * TRANG CHỦ SALE — "hôm nay tôi phải làm gì?" (06/10/2026, dựng thẳng màn thật
 * theo yêu cầu chủ dự án — KHÔNG qua bản vẽ design-lab, KHÔNG dùng bộ kit: chỉ
 * Tailwind + token của theme v3 mà shell khu Bán hàng đang phủ).
 *
 * Bố cục master–detail (chép SAP Fiori "My Inbox" / Dynamics workspace):
 *   · hàng Ô VIỆC — mỗi loại việc một ô (số · tên), bấm để chọn;
 *   · khung trái — các mục của ô đang chọn, mỗi mục bấm thẳng tới chỗ xử lý;
 *   · cột phải — đợt xuất 45 ngày tới + lối tắt.
 * Số trên ô = số mục trong khung (luật "con số là lời hứa"); nguồn số ở
 * `salesHomeService.home`, dùng CHUNG hàm với trang đích.
 */

const usd = (v: number) => Math.round(v).toLocaleString('vi-VN')
const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

type Tone = 'stop' | 'warn' | 'done' | 'neutral'

const ICON: Record<
  LanViec['key'],
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  'de-y': TriangleAlert,
  'chua-ngay': CalendarX,
  'gia-0': CircleDollarSign,
  'gia-thanh': Calculator,
  'bao-gia': FileText,
  'han-giao': CalendarClock,
}

/** Màu theo nghĩa vòng đời (theme v3): đỏ = hỏng/quá hạn, cam = cần để ý. */
const SO: Record<LanViec['tone'], string> = {
  stop: 'text-[var(--stop)]',
  warn: 'text-[var(--warn)]',
  neutral: 'text-foreground',
}
const NEN_ICON: Record<LanViec['tone'], string> = {
  stop: 'bg-[var(--stop)]/10 text-[var(--stop)]',
  warn: 'bg-[var(--warn)]/12 text-[var(--warn)]',
  neutral: 'bg-muted text-muted-foreground',
}

function Nhan({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === 'stop'
      ? 'bg-[var(--stop)]/10 text-[var(--stop)]'
      : tone === 'warn'
        ? 'bg-[var(--warn)]/12 text-[var(--warn)]'
        : tone === 'done'
          ? 'bg-[var(--done)]/12 text-[var(--done)]'
          : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ${cls}`}
    >
      {children}
    </span>
  )
}

export function TrangChuSaleScreen({
  home,
  userName,
}: {
  home: SalesHome
  userName: string
}) {
  const [chon, setChon] = useState<LanViec['key'] | null>(home.lans[0]?.key ?? null)
  const lan = home.lans.find((l) => l.key === chon) ?? home.lans[0] ?? null
  const tongMuc = home.lans.reduce((s, l) => s + l.count, 0)
  const d = new Date(`${home.today}T00:00:00`)

  return (
    <div className="space-y-5">
      {/* ── Đầu trang: chào + hai số của tháng ─────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Bán hàng · {THU[d.getDay()]}, {ngay(home.today)}
          </p>
          <h1 className="t-display text-foreground mt-0.5">Chào {userName}</h1>
          <p className="t-body text-muted-foreground">
            {home.lans.length
              ? `${home.lans.length} loại việc · ${tongMuc} mục đang chờ`
              : 'Không có việc nào đang chờ'}
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/sales/phan-tich"
            className="group bg-card rounded-lg border px-4 py-2.5 transition-colors hover:border-[var(--primary)]/50"
          >
            <span className="text-muted-foreground block text-xs">
              Nhận đơn tháng này
            </span>
            <span className="t-data text-foreground block font-semibold">
              {usd(home.thangNay.nhan.value)} USD
            </span>
            <span className="text-muted-foreground block text-xs">
              {home.thangNay.nhan.n} đơn
            </span>
          </a>
          <a
            href="/sales/ke-hoach-xuat"
            className="group bg-card rounded-lg border px-4 py-2.5 transition-colors hover:border-[var(--primary)]/50"
          >
            <span className="text-muted-foreground block text-xs">Xuất tháng này</span>
            <span className="t-data text-foreground block font-semibold">
              {usd(home.thangNay.xuat.value)} USD
            </span>
            <span className="text-muted-foreground block text-xs">
              {home.thangNay.xuat.n} đợt
            </span>
          </a>
        </div>
      </header>

      {/* ── Ô việc: mỗi loại một ô, bấm để xem mục ─────────────────────── */}
      {home.lans.length > 0 && (
        <div
          role="tablist"
          aria-label="Loại việc"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          {home.lans.map((l) => {
            const Icon = ICON[l.key]
            const on = lan?.key === l.key
            return (
              <button
                key={l.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setChon(l.key)}
                className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-all ${
                  on
                    ? 'border-[var(--primary)] bg-[var(--accent)] shadow-sm ring-1 ring-[var(--primary)]'
                    : 'bg-card hover:border-[var(--primary)]/50 hover:shadow-sm'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-md ${NEN_ICON[l.tone]}`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <span
                    className={`text-[26px] leading-none font-semibold tabular-nums ${SO[l.tone]}`}
                  >
                    {l.count}
                  </span>
                </span>
                <span className="t-body text-foreground leading-snug font-medium">
                  {l.title}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Khung trái: các mục của loại việc đang chọn ────────────────── */}
        <section
          role="tabpanel"
          aria-label={lan?.title ?? 'Việc'}
          className="bg-card min-w-0 rounded-lg border"
        >
          {lan ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                  <h2 className="t-title text-foreground">
                    {lan.title}
                    <span className={`ml-2 tabular-nums ${SO[lan.tone]}`}>
                      {lan.count}
                    </span>
                    {lan.count_note && (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        ({lan.count_note})
                      </span>
                    )}
                  </h2>
                  <p className="t-body text-foreground mt-0.5">
                    <span className="font-medium">{lan.action}</span>
                  </p>
                  <p className="t-body text-muted-foreground">{lan.why}</p>
                </div>
                {lan.more && (
                  <a
                    href={lan.more.href}
                    className="t-body inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--primary)]/40 px-3 py-1.5 font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)]"
                  >
                    {lan.more.label}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
              <ul className="divide-y">
                {lan.items.map((it) => (
                  <li key={it.id}>
                    <a
                      href={it.href}
                      className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--accent)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="t-body text-foreground block truncate font-medium">
                          {it.title}
                        </span>
                        {it.detail && (
                          <span className="text-muted-foreground block truncate text-xs font-normal">
                            {it.detail}
                          </span>
                        )}
                      </span>
                      {it.tag && <Nhan tone={it.tag.tone}>{it.tag.text}</Nhan>}
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <CircleCheck className="h-10 w-10 text-[var(--done)]" strokeWidth={1.6} />
              <p className="t-title text-foreground">Không có việc nào đang chờ</p>
              <p className="t-body text-muted-foreground max-w-md">
                Đợt xuất đúng nhịp, đơn đủ giá và hạn giao, báo giá không treo. Xem các
                tháng tới ở{' '}
                <a
                  href="/sales/ke-hoach-xuat"
                  className="text-[var(--primary)] hover:underline"
                >
                  Kế hoạch xuất hàng
                </a>
                .
              </p>
            </div>
          )}
        </section>

        {/* ── Cột phải: lịch xuất 45 ngày + lối tắt ─────────────────────── */}
        <aside className="space-y-5">
          <section aria-label="Xuất 45 ngày tới" className="bg-card rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="t-title text-foreground flex items-center gap-2">
                <Container
                  className="text-muted-foreground h-[18px] w-[18px]"
                  strokeWidth={1.9}
                />
                Xuất 45 ngày tới
              </h2>
              <a
                href="/sales/ke-hoach-xuat"
                className="t-body text-[var(--primary)] hover:underline"
              >
                Kế hoạch xuất
              </a>
            </div>
            {home.sapXuat.length === 0 ? (
              <p className="t-body text-muted-foreground px-4 py-6 text-center">
                Không đợt nào xuất trong 45 ngày tới.
              </p>
            ) : (
              <ol className="divide-y">
                {home.sapXuat.map((x) => (
                  <li key={x.id}>
                    <a
                      href={`/sales/lsx/${x.lsx_id}`}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--accent)]"
                    >
                      <span className="bg-background flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border">
                        <span className="text-foreground text-[17px] leading-none font-semibold tabular-nums">
                          {x.ship_date!.slice(8, 10)}
                        </span>
                        <span className="text-muted-foreground text-xs leading-none">
                          th{x.ship_date!.slice(5, 7)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="t-body text-foreground block truncate font-medium">
                          {x.customer}
                          {x.date_src === 'lenh' && (
                            <span
                              className="ml-1 text-[var(--warn)]"
                              title="Đợt chưa có ngày riêng — đang mượn ngày xuất cuối của lệnh"
                            >
                              *
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs font-normal">
                          {x.label} · {x.lsx_code}
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <Nhan tone={x.tt.tone}>{x.tt.text}</Nhan>
                          <span className="t-data text-foreground shrink-0 text-[12px]">
                            {x.value != null ? `${usd(x.value)} $` : '—'}
                          </span>
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <nav aria-label="Lối tắt" className="grid grid-cols-2 gap-3">
            {(
              [
                ['/sales/orders', 'Đơn hàng', ShoppingCart],
                ['/sales/lsx', 'Lệnh sản xuất', Factory],
                ['/sales/phan-tich', 'Phân tích doanh số', ChartColumn],
                ['/sales/customers', 'Khách hàng', Users],
              ] as const
            ).map(([href, label, Icon]) => (
              <a
                key={href}
                href={href}
                className="t-body bg-card text-foreground flex items-center gap-2 rounded-lg border px-3 py-2.5 font-medium transition-colors hover:border-[var(--primary)]/50 hover:text-[var(--primary)]"
              >
                <Icon className="text-muted-foreground h-4 w-4" strokeWidth={1.9} />
                {label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  )
}
