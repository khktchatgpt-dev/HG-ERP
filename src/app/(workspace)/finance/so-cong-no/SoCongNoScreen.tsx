'use client'

import { useRouter } from 'next/navigation'
import {
  Btn,
  Empty,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  NoticeBar,
  Pick,
  ScreenFrame,
  ScreenHeader,
  Td,
  Th,
  WhyBox,
} from '@/components/kit'
import type { ApLedgerResult } from '@/modules/dept/accounting/ap-ledger.service'

const digits = (cur: string) => (cur === 'VND' ? 0 : 2)
const money = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: digits(cur) })
const dmy = (d: string) => d.split('-').reverse().join('/')
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-')
  return `Tháng ${Number(mm)}/${y}`
}

/**
 * SỔ CÔNG NỢ PHẢI TRẢ NGƯỜI BÁN (TK 331) — khuôn C, có tầng soi chi tiết.
 *
 * Ba câu hỏi của kế toán, ba tầng trên cùng một màn, theo đúng thứ tự họ hỏi:
 *
 *   1. Tổng công nợ bao nhiêu?     → dải phương trình kỳ (dư đầu → dư cuối)
 *   2. Từng NCC bao nhiêu?         → lưới chính, mỗi dòng một NCC × tiền tệ
 *   3. Gồm những khoản nào?        → sổ chi tiết bên dưới, có số dư luỹ kế
 *
 * Không tách ba màn: ba câu này người ta hỏi liền một mạch, tách ra là mỗi lần
 * soi một khoản phải quay lại chọn kỳ từ đầu. Nhưng cũng KHÔNG gộp tầng 3 vào
 * lưới chính — mở sẵn chi tiết mọi NCC là bảng vài nghìn dòng không đọc được.
 */
export function SoCongNoScreen(p: ApLedgerResult) {
  const router = useRouter()
  const go = (q: Record<string, string | undefined>) => {
    const sp = new URLSearchParams({ ky: p.month })
    for (const [k, v] of Object.entries(q)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    router.push(`/finance/so-cong-no?${sp}`)
  }

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Tài chính · Kế toán"
          title="Sổ công nợ phải trả người bán · TK 331"
          actions={
            <>
              <Pick
                label="Kỳ kế toán"
                value={p.month}
                width={168}
                onChange={(v) => router.push(`/finance/so-cong-no?ky=${v}`)}
                options={
                  p.months.length
                    ? p.months.map((m) => ({
                        value: m.month,
                        label: `${monthLabel(m.month)} · ${m.entry_count} CT`,
                      }))
                    : [{ value: p.month, label: monthLabel(p.month) }]
                }
              />
              <Btn href={`/api/dept/accounting/so-cong-no/export?ky=${p.month}`}>
                Xuất Excel
              </Btn>
              <Btn href="/finance/cong-no-ncc">Ghi thanh toán</Btn>
              <Btn href="/finance/tuoi-no">Tuổi nợ</Btn>
            </>
          }
        />

        {/*
          PHƯƠNG TRÌNH SỔ đứng trước cả bảng, có chủ ý: đây là thứ duy nhất trên
          màn mà kế toán phải đưa lên báo cáo, và nó phải KIỂM ĐƯỢC bằng mắt —
          bốn số nằm cạnh nhau với dấu +, −, = ở giữa thì sai lệch lộ ra ngay.
          Bày bốn thẻ KPI rời rạc là giấu mất quan hệ giữa chúng.
        */}
        <div className="flex flex-wrap items-stretch gap-x-6 gap-y-2 border-b border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[10px]">
          {p.totals.length === 0 ? (
            <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
              Kỳ {monthLabel(p.month)} không có phát sinh và không có số dư.
            </span>
          ) : (
            p.totals.map((t) => (
              <div key={t.currency} className="flex items-center gap-3">
                <span className="num rounded-[var(--radius)] border border-[var(--line)] px-[7px] py-[1px] text-[11px] font-bold text-[var(--ink-2)]">
                  {t.currency}
                </span>
                <Eq label="Dư đầu kỳ" value={money(t.opening, t.currency)} />
                <Op>+</Op>
                <Eq label="Phát sinh tăng" value={money(t.increase, t.currency)} />
                <Op>−</Op>
                <Eq label="Phát sinh giảm" value={money(t.decrease, t.currency)} />
                <Op>=</Op>
                {/*
                  Cảnh báo thiếu tỷ giá nằm NGAY DƯỚI con số nó ảnh hưởng, không
                  phải ở một dải riêng trên đầu: dải riêng bắt buộc có nút hành
                  động, mà việc "khai tỷ giá" hiện chưa có màn nào làm được — một
                  cái nút không dẫn đi đâu còn tệ hơn không có nút.
                */}
                <Eq
                  label="Dư cuối kỳ"
                  value={money(t.closing, t.currency)}
                  strong
                  sub={`${t.supplier_count} NCC`}
                  warn={
                    t.currency === 'VND'
                      ? undefined
                      : t.closing_base == null
                        ? `chưa quy đổi — thiếu tỷ giá ${t.currency} ngày ${dmy(p.to)}`
                        : undefined
                  }
                  note={
                    t.currency !== 'VND' && t.closing_base != null
                      ? `≈ ${money(t.closing_base, 'VND')} đ theo tỷ giá cuối kỳ`
                      : undefined
                  }
                />
              </div>
            ))
          )}
          {p.closing_base_total != null && p.totals.length > 1 && (
            <div className="flex items-center gap-3 border-l border-[var(--hair)] pl-6">
              <Eq
                label="Cộng quy VND"
                value={money(p.closing_base_total, 'VND')}
                strong
                sub="số lên bảng cân đối"
              />
            </div>
          )}
          {p.closing_base_total == null && p.missing_fx.length > 0 && (
            <div className="flex items-center gap-3 border-l border-[var(--hair)] pl-6">
              <Eq
                label="Cộng quy VND"
                value="—"
                strong
                warn={`thiếu tỷ giá ${p.missing_fx.join(', ')}: cộng thiếu một khoản thì tổng sai mà không ai biết`}
              />
            </div>
          )}
        </div>

        {p.off_book.length > 0 && (
          <NoticeBar
            tone="warn"
            tag="Ngoài sổ"
            action={{
              label: 'Xem đối chiếu',
              onClick: () => router.push('/finance/hoa-don-ncc'),
            }}
          >
            {p.off_book
              .map((o) => `${money(o.amount, o.currency)} ${o.currency}`)
              .join(' · ')}{' '}
            hàng đã về nhưng NCC chưa xuất hoá đơn ({p.off_book_suppliers} NCC) —{' '}
            <b>chưa</b> nằm trong số dư trên. Nghĩa vụ có thật nhưng chưa đủ chứng từ ghi
            TK 331; việc phải làm là đi đòi hoá đơn.
          </NoticeBar>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {p.rows.length === 0 ? (
            <Empty
              headline={`Kỳ ${monthLabel(p.month)} chưa có số dư và chưa có phát sinh`}
              reason="Sổ TK 331 ghi theo HOÁ ĐƠN nhà cung cấp đã vào sổ và phiếu chi — không phải theo phiếu nhập kho hay đơn đặt hàng. Chưa có hoá đơn nào vào sổ thì công nợ chưa phát sinh, dù đã cam kết mua."
              next={
                <>
                  <Btn primary href="/finance/hoa-don-ncc">
                    Lập hoá đơn từ đơn mua
                  </Btn>
                  <Btn href="/finance/hoa-don-ncc/so">Sổ hoá đơn NCC</Btn>
                  <Btn href="/finance/bao-cao">Xem cam kết mua hàng</Btn>
                </>
              }
            />
          ) : (
            <Grid minWidth={1000}>
              <GridHead>
                <Th>Nhà cung cấp</Th>
                <Th width={62}>TT</Th>
                <Th num>Dư đầu kỳ</Th>
                <Th num>Phát sinh tăng</Th>
                <Th num>Phát sinh giảm</Th>
                <Th num>Dư cuối kỳ</Th>
                <Th num width={72}>
                  CT
                </Th>
                <Th num>Quy VND</Th>
                <Th width={78} />
              </GridHead>
              <GridBody>
                {p.rows.map((r) => {
                  const on =
                    p.detail?.supplier_id === r.supplier_id &&
                    p.detail?.currency === r.currency
                  return (
                    <GridRow key={`${r.supplier_id}-${r.currency}`} selected={on}>
                      <Td>{r.supplier_name}</Td>
                      <Td>
                        <span className="num">{r.currency}</span>
                      </Td>
                      <Td num>{r.opening ? money(r.opening, r.currency) : '—'}</Td>
                      <Td num>{r.increase ? money(r.increase, r.currency) : '—'}</Td>
                      <Td num tone={r.decrease > 0 ? 'done' : undefined}>
                        {r.decrease ? money(r.decrease, r.currency) : '—'}
                      </Td>
                      <Td num tone={r.closing > 0 ? 'warn' : undefined}>
                        <b>{money(r.closing, r.currency)}</b>
                      </Td>
                      <Td num>{r.entry_count || '—'}</Td>
                      {/*
                        null = thiếu tỷ giá, KHÔNG phải 0: một khoản 10.000 USD
                        hiện thành 0 đ đọc ra là "không nợ gì".
                      */}
                      <Td num>
                        {r.closing_base == null ? (
                          <span className="k-t-stop">chưa quy đổi</span>
                        ) : (
                          money(r.closing_base, 'VND')
                        )}
                      </Td>
                      <Td>
                        <GridBtn
                          onClick={() =>
                            go(
                              on
                                ? { ncc: undefined, tt: undefined }
                                : { ncc: r.supplier_id, tt: r.currency },
                            )
                          }
                        >
                          {on ? 'Đóng' : 'Chi tiết'}
                        </GridBtn>
                      </Td>
                    </GridRow>
                  )
                })}
              </GridBody>
              <GridFoot>
                <Td>Cộng toàn sổ</Td>
                <Td />
                <Td num>{sumLine(p.totals, 'opening')}</Td>
                <Td num>{sumLine(p.totals, 'increase')}</Td>
                <Td num>{sumLine(p.totals, 'decrease')}</Td>
                <Td num>
                  <b>{sumLine(p.totals, 'closing')}</b>
                </Td>
                <Td num />
                <Td num>
                  {p.closing_base_total == null
                    ? '—'
                    : money(p.closing_base_total, 'VND')}
                </Td>
                <Td />
              </GridFoot>
            </Grid>
          )}

          {p.detail && (
            <>
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[9px]">
                <h3 className="k-fgrp-h">
                  Sổ chi tiết · {p.detail.supplier_name} ·{' '}
                  <span className="num">{p.detail.currency}</span>
                </h3>
                <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                  {dmy(p.from)} → {dmy(p.to)}
                </span>
                <GridBtn onClick={() => go({ ncc: undefined, tt: undefined })}>
                  Đóng
                </GridBtn>
              </div>
              <Grid minWidth={900}>
                <GridHead>
                  <Th width={92}>Ngày</Th>
                  <Th width={120}>Số chứng từ</Th>
                  <Th>Diễn giải</Th>
                  <Th num>Phát sinh tăng</Th>
                  <Th num>Phát sinh giảm</Th>
                  <Th num>Số dư luỹ kế</Th>
                </GridHead>
                <GridBody>
                  <GridRow>
                    <Td colSpan={5}>
                      <i>Số dư đầu kỳ</i>
                    </Td>
                    <Td num>
                      <b>{money(p.detail.opening, p.detail.currency)}</b>
                    </Td>
                  </GridRow>
                  {p.detail.lines.map((l, i) => (
                    <GridRow key={`${l.kind}-${l.doc_no}-${l.date}-${i}`}>
                      <Td>
                        <span className="num">{dmy(l.date)}</span>
                      </Td>
                      <Td>
                        <span className="num">{l.doc_no}</span>
                      </Td>
                      <Td>
                        {l.kind === 'invoice' ? 'Hoá đơn NCC' : 'Thanh toán'}
                        {l.note ? (
                          <span className="ml-1 text-[var(--ink-3)]">· {l.note}</span>
                        ) : null}
                      </Td>
                      <Td num>
                        {l.kind === 'invoice' ? money(l.amount, p.detail!.currency) : '—'}
                      </Td>
                      <Td num tone={l.kind === 'payment' ? 'done' : undefined}>
                        {l.kind === 'payment' ? money(l.amount, p.detail!.currency) : '—'}
                      </Td>
                      <Td num>{money(l.running, p.detail!.currency)}</Td>
                    </GridRow>
                  ))}
                </GridBody>
                <GridFoot>
                  <Td colSpan={5}>Số dư cuối kỳ</Td>
                  <Td num>
                    <b>
                      {money(
                        p.detail.lines.at(-1)?.running ?? p.detail.opening,
                        p.detail.currency,
                      )}
                    </b>
                  </Td>
                </GridFoot>
              </Grid>
              {p.detail.lines.length === 0 && (
                <div className="px-[var(--gutter)] py-2 text-[var(--fs-sm)] text-[var(--ink-3)]">
                  Kỳ này không có giao dịch — số dư giữ nguyên từ kỳ trước.
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-[var(--gutter)] py-3">
          <WhyBox
            lines={[
              `Kỳ ${dmy(p.from)} → ${dmy(p.to)} · Dư đầu kỳ + Phát sinh tăng − Phát sinh giảm = Dư cuối kỳ`,
              'Dư đầu kỳ CỘNG DỒN mọi giao dịch trước kỳ — không có ô khai tay, nên không bao giờ lệch khỏi tổng giao dịch',
              'Phát sinh TĂNG = hoá đơn NCC đã vào sổ (gồm VAT). KHÔNG phải phiếu nhập kho: nợ phải trả ra đời khi NCC xuất hoá đơn',
              'Phát sinh GIẢM = phiếu chi trả NCC trong kỳ',
              'Tiền tệ KHÔNG cộng lẫn; dư cuối ngoại tệ quy VND theo tỷ giá CUỐI KỲ, thiếu tỷ giá thì để trống',
              // Bỏ gap đã có dải cảnh báo riêng — nói hai lần là hết trọng lượng.
              ...p.gaps.filter((g) => !g.banner).map((g) => `${g.label}: ${g.detail}`),
            ]}
            result={
              p.totals.length === 0
                ? 'không có số dư'
                : p.totals
                    .map((t) => `${money(t.closing, t.currency)} ${t.currency}`)
                    .join(' · ')
            }
          />
        </div>
      </ScreenFrame>
    </div>
  )
}

/**
 * Một vế của phương trình sổ: nhãn nhỏ trên, số to dưới.
 *
 * `warn` là chỗ nói CON SỐ NÀY KHÔNG TIN ĐƯỢC và vì sao — nằm ngay dưới nó chứ
 * không đẩy lên một dải cảnh báo chung, để người đọc không phải ghép hai đầu
 * màn lại mới biết cảnh báo đang nói về số nào.
 */
function Eq({
  label,
  value,
  sub,
  note,
  warn,
  strong,
}: {
  label: string
  value: string
  sub?: string
  note?: string
  warn?: string
  strong?: boolean
}) {
  return (
    <div className="leading-tight">
      <div className="text-[10.5px] tracking-[.04em] text-[var(--ink-3)] uppercase">
        {label}
      </div>
      <div
        className={
          strong
            ? 'num text-[15px] font-bold text-[var(--ink)]'
            : 'num text-[14px] text-[var(--ink-2)]'
        }
      >
        {value}
      </div>
      {sub && <div className="num text-[10.5px] text-[var(--ink-3)]">{sub}</div>}
      {note && <div className="num text-[10.5px] text-[var(--ink-3)]">{note}</div>}
      {warn && <div className="k-t-stop num text-[10.5px]">{warn}</div>}
    </div>
  )
}

function Op({ children }: { children: string }) {
  return <span className="num text-[15px] font-bold text-[var(--ink-3)]">{children}</span>
}

/** Chân bảng: mỗi tiền tệ một cụm, không bao giờ cộng lẫn. */
function sumLine(
  totals: ApLedgerResult['totals'],
  key: 'opening' | 'increase' | 'decrease' | 'closing',
): string {
  const parts = totals
    .filter((t) => t[key] !== 0)
    .map((t) => `${money(t[key], t.currency)} ${t.currency}`)
  return parts.length ? parts.join(' · ') : '—'
}
