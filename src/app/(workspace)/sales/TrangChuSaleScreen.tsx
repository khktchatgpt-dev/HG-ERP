'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  ChevronRight,
  CircleCheck,
  Container,
  ExternalLink,
  Plus,
} from 'lucide-react'
import type { LanViec, MucViec } from '@/lib/viec-sale'
import type { SalesHome } from '@/modules/dept/sales/sales-home.service'

/**
 * TRANG CHỦ SALE — "hôm nay tôi phải làm gì?" (06/10/2026).
 *
 * Thiên hướng ERP (chủ dự án 06/10: "thiên hướng UI/UX ERP") — chép cách
 * Dynamics 365 workspace / SAP Fiori worklist bày, KHÔNG dùng thẻ bo tròn nổi:
 *   · thanh đầu trang: tên màn + thanh công cụ góc phải;
 *   · dải Ô ĐẾM vuông, ngăn bằng vạch mảnh — bấm để chọn loại việc;
 *   · LƯỚI của loại việc đang chọn: tiêu đề cột, STT, số căn phải mono, chân tổng;
 *   · lưới lịch xuất 45 ngày; thanh trạng thái đáy.
 * Không dùng bộ kit, không qua bản vẽ design-lab — Tailwind + token theme v3 của
 * shell khu Bán hàng. Số trên ô = số dòng của lưới (nguồn `salesHomeService.home`).
 */

const usd = (v: number | null | undefined) =>
  v == null ? '' : Math.round(v).toLocaleString('vi-VN')
const ngay = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''
const THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

type Tone = 'stop' | 'warn' | 'done' | 'neutral'
const SO_MAU: Record<LanViec['tone'], string> = {
  stop: 'text-[var(--stop)]',
  warn: 'text-[var(--warn)]',
  neutral: 'text-foreground',
}

function Nhan({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === 'stop'
      ? 'bg-[var(--stop)]/10 text-[var(--stop)] border-[var(--stop)]/30'
      : tone === 'warn'
        ? 'bg-[var(--warn)]/10 text-[var(--warn)] border-[var(--warn)]/30'
        : tone === 'done'
          ? 'bg-[var(--done)]/10 text-[var(--done)] border-[var(--done)]/30'
          : 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 text-[11px] leading-[18px] font-medium whitespace-nowrap ${cls}`}
    >
      {children}
    </span>
  )
}

const TH =
  'h-8 border-b border-border bg-muted px-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap'
const TD = 'h-9 border-b border-border px-3 text-[13px] align-middle'

export function TrangChuSaleScreen({
  home,
  userName,
}: {
  home: SalesHome
  userName: string
}) {
  const router = useRouter()
  const [chon, setChon] = useState<LanViec['key'] | null>(home.lans[0]?.key ?? null)
  const lan = home.lans.find((l) => l.key === chon) ?? home.lans[0] ?? null
  const tongMuc = home.lans.reduce((s, l) => s + l.count, 0)
  const d = new Date(`${home.today}T00:00:00`)

  return (
    <div className="bg-background -m-6 flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {/* ── Thanh đầu trang + thanh công cụ góc phải ─────────────────────── */}
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div>
          <div className="text-muted-foreground text-xs">
            Bán hàng <span className="mx-1">›</span> Việc hôm nay
          </div>
          <h1 className="text-foreground text-[17px] leading-6 font-semibold">
            Việc hôm nay
            <span className="text-muted-foreground ml-2 text-[13px] font-normal">
              {THU[d.getDay()]}, {ngay(home.today)} · {userName}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sales/ke-hoach-xuat"
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[13px]"
          >
            <Container className="h-4 w-4" strokeWidth={1.8} />
            Kế hoạch xuất hàng
          </Link>
          <Link
            href="/sales/phan-tich"
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[13px]"
          >
            <BarChart3 className="h-4 w-4" strokeWidth={1.8} />
            Phân tích doanh số
          </Link>
          <Link
            href="/sales/orders/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Tạo đơn hàng
          </Link>
        </div>
      </div>

      {/* ── Dải ô đếm: vuông, ngăn bằng vạch mảnh; bấm để chọn loại việc ─── */}
      <div className="border-border bg-card flex flex-wrap border-b">
        <div
          role="tablist"
          aria-label="Loại việc"
          className="flex min-w-0 flex-1 overflow-x-auto"
        >
          {home.lans.map((l) => {
            const on = lan?.key === l.key
            return (
              <button
                key={l.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setChon(l.key)}
                title={l.title}
                className={`border-r-border min-w-[110px] flex-1 basis-0 border-t-2 border-r px-4 py-2.5 text-left transition-colors ${
                  on
                    ? 'border-t-[var(--primary)] bg-[var(--accent)]'
                    : 'hover:bg-muted border-t-transparent'
                }`}
              >
                <span className="text-muted-foreground block h-8 text-xs leading-4">
                  {l.short}
                </span>
                <span
                  className={`font-mono text-[22px] leading-7 font-semibold tabular-nums ${SO_MAU[l.tone]}`}
                >
                  {l.count}
                </span>
              </button>
            )
          })}
          {home.lans.length === 0 && (
            <div className="flex items-center gap-2 px-6 py-4 text-[13px] text-[var(--done)]">
              <CircleCheck className="h-4 w-4" /> Không có việc nào đang chờ
            </div>
          )}
        </div>
        <div className="border-border flex border-l">
          <Link
            href="/sales/phan-tich"
            className="border-border hover:bg-muted w-[150px] border-r px-4 py-2.5"
          >
            <span className="text-muted-foreground block h-8 text-xs leading-4">
              Nhận đơn tháng này
            </span>
            <span className="text-foreground font-mono text-[15px] font-semibold tabular-nums">
              {usd(home.thangNay.nhan.value)}
            </span>
            <span className="text-muted-foreground ml-1 text-xs">
              USD · {home.thangNay.nhan.n} đơn
            </span>
          </Link>
          <Link
            href="/sales/ke-hoach-xuat"
            className="hover:bg-muted w-[150px] px-4 py-2.5"
          >
            <span className="text-muted-foreground block h-8 text-xs leading-4">
              Xuất tháng này
            </span>
            <span className="text-foreground font-mono text-[15px] font-semibold tabular-nums">
              {usd(home.thangNay.xuat.value)}
            </span>
            <span className="text-muted-foreground ml-1 text-xs">
              USD · {home.thangNay.xuat.n} đợt
            </span>
          </Link>
        </div>
      </div>

      <div className="grid flex-1 content-start gap-4 px-6 py-4 2xl:grid-cols-[minmax(0,1fr)_480px]">
        {/* ── Lưới của loại việc đang chọn ─────────────────────────────── */}
        <section
          role="tabpanel"
          aria-label={lan?.title ?? 'Việc'}
          className="border-border bg-card min-w-0 self-start rounded-sm border"
        >
          {lan ? (
            <>
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <div className="min-w-0">
                  <h2 className="text-foreground text-[14px] font-semibold">
                    {lan.title}
                    <span className={`ml-2 font-mono tabular-nums ${SO_MAU[lan.tone]}`}>
                      {lan.count}
                    </span>
                    {lan.count_note && (
                      <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                        ({lan.count_note})
                      </span>
                    )}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    <span className="text-foreground font-medium">{lan.action}</span> —{' '}
                    {lan.why}
                  </p>
                </div>
                {lan.more && (
                  <Link
                    href={lan.more.href}
                    className="border-border inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-xs text-[var(--primary)] hover:bg-[var(--accent)]"
                  >
                    {lan.more.label.replace(/^Mở /, '')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              <div className="overflow-x-auto">
                <LuoiViec lan={lan} onOpen={(h) => router.push(h)} />
              </div>
            </>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-8 text-[13px]">
              <CircleCheck className="h-5 w-5 text-[var(--done)]" />
              Không có việc nào đang chờ — đợt xuất đúng nhịp, đơn đủ giá và hạn giao.
            </div>
          )}
        </section>

        {/* ── Lịch xuất 45 ngày tới ────────────────────────────────────── */}
        <section
          aria-label="Xuất 45 ngày tới"
          className="border-border bg-card min-w-0 self-start rounded-sm border"
        >
          <div className="border-border flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-foreground text-[14px] font-semibold">
              Xuất 45 ngày tới
              <span className="text-muted-foreground ml-2 font-mono tabular-nums">
                {home.sapXuat.length}
              </span>
            </h2>
            <Link
              href="/sales/ke-hoach-xuat"
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Kế hoạch xuất hàng
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Ngày xuất</th>
                  <th className={TH}>Khách</th>
                  <th className={TH}>PO / đợt</th>
                  <th className={`${TH} text-right`}>USD</th>
                  <th className={TH}>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {home.sapXuat.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${TD} text-muted-foreground text-center`}>
                      Không đợt nào xuất trong 45 ngày tới.
                    </td>
                  </tr>
                ) : (
                  home.sapXuat.map((x) => (
                    <tr
                      key={x.id}
                      onClick={() => router.push(`/sales/lsx/${x.lsx_id}`)}
                      className="cursor-pointer hover:bg-[var(--accent)]"
                    >
                      <td className={`${TD} font-mono whitespace-nowrap tabular-nums`}>
                        {ngay(x.ship_date)}
                        {x.date_src === 'lenh' && (
                          <span
                            className="ml-0.5 text-[var(--warn)]"
                            title="Đợt chưa có ngày riêng — đang mượn ngày xuất cuối của lệnh"
                          >
                            *
                          </span>
                        )}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{x.customer}</td>
                      <td
                        className={`${TD} text-muted-foreground max-w-[150px] truncate`}
                        title={`${x.label} · ${x.lsx_code}`}
                      >
                        {x.label}
                      </td>
                      <td className={`${TD} text-right font-mono tabular-nums`}>
                        {usd(x.value)}
                      </td>
                      <td className={TD}>
                        <Nhan tone={x.tt.tone}>
                          {x.tt.conNgay != null ? `còn ${x.tt.conNgay} ngày` : x.tt.text}
                          {x.tt.canDeY && x.tt.conNgay != null ? ' · VT chưa đủ' : ''}
                        </Nhan>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Thanh trạng thái đáy ─────────────────────────────────────────── */}
      <div className="border-border bg-card text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-6 py-1.5 text-xs">
        <span>
          Việc của cả phòng · {home.lans.length} loại · {tongMuc} mục · số trên ô = số
          dòng của lưới
        </span>
        <span>* đợt chưa có ngày xuất riêng, đang mượn ngày cuối của lệnh</span>
      </div>
    </div>
  )
}

/** Lưới một loại việc — cột ẩn khi cả làn không có dữ liệu cột đó. */
function LuoiViec({ lan, onOpen }: { lan: LanViec; onOpen: (href: string) => void }) {
  const co = (k: keyof MucViec) => lan.items.some((it) => it[k] != null && it[k] !== '')
  const cMa = co('ma')
  const cNgay = !!lan.cot_ngay && co('ngay')
  const cTien = co('tri_gia')
  const cTag = co('tag')
  const tong = lan.items.reduce((s, it) => s + (it.tri_gia ?? 0), 0)
  // Cột trước "Trị giá": # · Mã? · Khách · Nội dung · Ngày?
  const truocTien = 3 + (cMa ? 1 : 0) + (cNgay ? 1 : 0)
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={`${TH} w-10 text-right`}>#</th>
          {cMa && <th className={TH}>Mã</th>}
          <th className={TH}>Khách</th>
          <th className={TH}>Nội dung</th>
          {cNgay && <th className={TH}>{lan.cot_ngay}</th>}
          {cTien && <th className={`${TH} text-right`}>Trị giá USD</th>}
          {cTag && <th className={TH}>Tình trạng</th>}
          <th className={`${TH} w-8`} />
        </tr>
      </thead>
      <tbody>
        {lan.items.map((it, i) => (
          <tr
            key={it.id}
            onClick={() => onOpen(it.href)}
            className="group cursor-pointer hover:bg-[var(--accent)]"
          >
            <td
              className={`${TD} text-muted-foreground text-right font-mono text-xs tabular-nums`}
            >
              {i + 1}
            </td>
            {cMa && (
              <td className={`${TD} font-mono whitespace-nowrap`}>
                <Link
                  href={it.href}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--primary)] hover:underline"
                >
                  {it.ma}
                </Link>
              </td>
            )}
            <td className={`${TD} whitespace-nowrap`}>{it.khach ?? it.title}</td>
            <td
              className={`${TD} text-muted-foreground max-w-[320px] truncate`}
              title={it.noi_dung ?? it.detail}
            >
              {it.noi_dung ?? it.detail}
            </td>
            {cNgay && (
              <td className={`${TD} font-mono whitespace-nowrap tabular-nums`}>
                {ngay(it.ngay)}
              </td>
            )}
            {cTien && (
              <td className={`${TD} text-right font-mono tabular-nums`}>
                {usd(it.tri_gia)}
              </td>
            )}
            {cTag && (
              <td className={TD}>
                {it.tag && <Nhan tone={it.tag.tone}>{it.tag.text}</Nhan>}
              </td>
            )}
            <td className={`${TD} text-muted-foreground`}>
              <ChevronRight className="h-4 w-4 group-hover:text-[var(--primary)]" />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-muted/60">
          <td
            colSpan={truocTien}
            className="text-foreground h-8 px-3 text-xs font-semibold"
          >
            Cộng {lan.items.length} dòng
          </td>
          {cTien && (
            <td className="h-8 px-3 text-right font-mono text-[13px] font-semibold tabular-nums">
              {usd(tong)}
            </td>
          )}
          {cTag && <td />}
          <td />
        </tr>
      </tfoot>
    </table>
  )
}
