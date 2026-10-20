'use client'

import type { ReactNode } from 'react'
import {
  Btn,
  Empty,
  FactKv,
  FastTab,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  Metric,
  MetricStrip,
  NoticeBar,
  Tag,
  Td,
  Th,
} from '@/components/kit'
import { fmtMoney, roundMoney } from '@/lib/po-line'
import { poFinanceView } from '@/lib/po-finance'
import { VERDICT_LABEL, type MatchRow, type MatchVerdict } from '@/lib/three-way-match'
import type { poFinanceForPo } from '@/modules/dept/accounting/supplier-invoices.service'

/**
 * MỤC "TÀI CHÍNH" CỦA MÀN ĐƠN MUA (27/09/2026 — canvas "Đơn mua", artboard
 * Menu ngang · Tài chính). Chỉ ĐỌC: ghi hoá đơn / phiếu chi vẫn ở màn Kế toán.
 * Mọi số đến từ `poFinanceForPo` — cùng đối chiếu ba chiều màn Kế toán dùng.
 */
export type PoFinance = Awaited<ReturnType<typeof poFinanceForPo>>

const VERDICT_TONE: Record<MatchVerdict, 'done' | 'warn' | 'stop' | 'neutral'> = {
  khop: 'done',
  cho_hoa_don: 'warn',
  doi_truoc: 'stop',
  lech_gia: 'stop',
  chua_phat_sinh: 'neutral',
}

const dmy = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'

export function TaiChinhPanel({
  finance,
  poId,
  orderedGross,
  lineCount,
  vatLabel,
  termsPayment,
  termsInvoice,
  canInvoice,
  onAskInvoice,
  extra,
}: {
  finance: PoFinance | null
  poId: string
  /** Tổng thanh toán của đơn (gồm VAT) — cùng số trên hàng dữ kiện đầu trang. */
  orderedGross: number
  lineCount: number
  vatLabel: string
  termsPayment: string | null
  termsInvoice: string | null
  canInvoice: boolean
  /** Ghi vào Trao đổi rằng đã đòi hoá đơn NCC. */
  onAskInvoice: () => void
  /** Khối có sẵn của đơn: phát sinh sau duyệt + chi phí mua. */
  extra: ReactNode
}) {
  if (!finance) {
    return (
      <div className="p-4">
        <Empty
          headline="Chưa tải được số tài chính của đơn"
          reason="Đọc đối chiếu hoá đơn / phiếu chi bị lỗi — phần còn lại của đơn vẫn dùng được."
          next="Tải lại trang; vẫn lỗi thì báo quản trị."
        />
      </div>
    )
  }
  const cur = finance.currency
  const m = (v: number) => fmtMoney(roundMoney(v, cur), cur)
  const v = poFinanceView({
    ordered_gross: orderedGross,
    received_net: finance.received_net,
    invoiced_net: finance.invoiced_net,
    invoiced_gross: finance.invoiced_gross,
    paid: finance.paid,
    missing_price_lines: finance.missing_price_lines,
  })
  const rows: MatchRow[] = finance.rows
  const lastDue =
    finance.invoices
      .map((i) => i.due_date)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

  return (
    <>
      <MetricStrip>
        <Metric
          label="Giá trị đặt"
          value={m(orderedGross)}
          basis={`${lineCount} dòng · gồm ${vatLabel}`}
        />
        <Metric
          label="Đã nhận"
          value={m(v.received_net)}
          basis={
            finance.missing_price_lines > 0
              ? `${finance.missing_price_lines} dòng về chưa có giá nhập`
              : 'theo giá phiếu nhập kho'
          }
        />
        <Metric
          label="Đã có hoá đơn"
          value={m(v.invoiced_gross)}
          basis={`${finance.invoices.length} hoá đơn vào sổ · gồm VAT`}
        />
        <Metric
          label="Đã trả"
          value={m(v.paid)}
          basis={`${finance.payments.length} phiếu chi gắn đơn`}
        />
        {v.stage === 'thieu_gia' ? (
          <Metric
            label="Chờ hoá đơn"
            value={null}
            basis="phiếu nhập thiếu giá — chưa tính được"
          />
        ) : v.stage === 'cho_hoa_don' ? (
          <Metric
            label="Chờ hoá đơn"
            value={m(v.waiting_invoice_net)}
            tone="warn"
            basis="chưa VAT · đã nhận − đã có HĐ"
          />
        ) : (
          <Metric
            label="Còn phải trả"
            value={m(v.owed)}
            tone={v.owed > 0.005 ? 'warn' : v.stage === 'da_tra' ? 'done' : undefined}
            basis={lastDue ? `hạn ${dmy(lastDue)}` : 'hoá đơn gồm VAT − đã trả'}
          />
        )}
      </MetricStrip>

      {finance.missing_price_lines > 0 && (
        <NoticeBar tag="Thiếu giá nhập" tone="warn">
          {finance.missing_price_lines} dòng đã về kho nhưng phiếu nhập không ghi đơn giá
          — cột “Tiền nhận” của các dòng đó đang là 0, nên tổng đã nhận và phần chờ hoá
          đơn đang tính thiếu. Kho bổ sung giá ở phiếu nhập (hoặc Kế toán nhập hoá đơn
          NCC) thì số tự đúng.
        </NoticeBar>
      )}
      {v.stage === 'cho_hoa_don' && (
        <NoticeBar
          tag="Ngoài sổ"
          tone="warn"
          action={{ label: 'Ghi việc đã đòi hoá đơn', onClick: onAskInvoice }}
        >
          Hàng đã về {m(v.waiting_invoice_net)} {cur} (chưa VAT) nhưng NCC chưa xuất hoá
          đơn — khoản này chưa vào sổ công nợ 331, Kế toán chưa trả được.
        </NoticeBar>
      )}

      <FastTab
        fixed
        flush
        title="Đối chiếu đặt · nhận · hoá đơn"
        summary={[['Dòng', rows.length]]}
      >
        {/* CHƯA CÓ GÌ ĐỂ ĐỐI CHIẾU (29/09/2026) — đơn chưa về, chưa hoá đơn thì
            bảng này lặp NGUYÊN VẸN cột "Tiền đặt" của tab Dòng hàng (đổi mỗi
            tên cột), 3 cột còn lại toàn "—", nhãn "Chưa phát sinh" lặp mọi
            dòng — đo trên PO-2026-0087/0097. Đối chiếu chỉ có việc từ khi có
            gì để so; trước đó bày sẵn 8 dòng trùng là nội dung thừa. */}
        {v.stage === 'chua_phat_sinh' ? (
          <Empty
            headline="Chưa có gì để đối chiếu"
            reason="Chưa nhận, chưa có hoá đơn nào gắn đơn — số Đặt xem đủ ở tab Dòng hàng."
            next={
              <span className="text-k-sm text-[var(--ink-3)]">
                Bảng này tự hiện khi có hàng về hoặc hoá đơn đầu tiên.
              </span>
            }
          />
        ) : (
          <Grid minWidth={820}>
            <GridHead>
              <Th width={30}>#</Th>
              <Th>Mã · tên vật tư</Th>
              <Th num width={130}>
                Tiền đặt
              </Th>
              <Th num width={130}>
                Tiền nhận
              </Th>
              <Th num width={130}>
                Tiền hoá đơn
              </Th>
              <Th num width={120}>
                Nhận − hoá đơn
              </Th>
              <Th width={120}>Tình trạng</Th>
            </GridHead>
            <GridBody>
              {rows.map((r, i) => (
                <GridRow key={r.po_line_id}>
                  <Td num>{i + 1}</Td>
                  <Td>
                    {r.material_code && (
                      <span className="num k-strong">{r.material_code}</span>
                    )}
                    {r.material_code ? ' · ' : ''}
                    {r.material_name}
                  </Td>
                  <Td num>{m(r.amount_ordered)}</Td>
                  <Td num>{r.amount_received ? m(r.amount_received) : '—'}</Td>
                  <Td num>{r.amount_invoiced ? m(r.amount_invoiced) : '—'}</Td>
                  <Td
                    num
                    tone={
                      Math.abs(r.amount_gap) > 0.005
                        ? VERDICT_TONE[r.verdict] === 'stop'
                          ? 'stop'
                          : 'warn'
                        : undefined
                    }
                  >
                    {Math.abs(r.amount_gap) > 0.005 ? m(r.amount_gap) : '—'}
                  </Td>
                  <Td>
                    <Tag tone={VERDICT_TONE[r.verdict]}>{VERDICT_LABEL[r.verdict]}</Tag>
                  </Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td colSpan={2}>Cộng · theo đơn giá trên đơn, chưa gồm phí mua</Td>
              <Td num>{m(rows.reduce((t, r) => t + r.amount_ordered, 0))}</Td>
              <Td num>{m(v.received_net)}</Td>
              <Td num>{m(v.invoiced_net)}</Td>
              <Td num>{m(v.received_net - v.invoiced_net)}</Td>
              <Td />
            </GridFoot>
          </Grid>
        )}
      </FastTab>

      <div className="grid grid-cols-1 border-b border-[var(--line)] md:grid-cols-2">
        <div className="md:border-r md:border-[var(--line)]">
          <FastTab fixed title="Điều khoản & hạn trả">
            <FactKv
              rows={[
                ['Thanh toán (ghi trên đơn)', termsPayment || '—'],
                ['Hoá đơn', termsInvoice || '—'],
                [
                  'Hạn trả',
                  lastDue ? dmy(lastDue) : 'tính khi có hoá đơn — theo hạn trên hoá đơn',
                ],
              ]}
            />
          </FastTab>
        </div>
        <FastTab
          fixed
          flush
          title="Hoá đơn & phiếu chi"
          summary={[
            ['Hoá đơn', finance.invoices.length],
            ['Phiếu chi', finance.payments.length],
          ]}
          actions={
            <>
              <Btn
                icon="hoaDon"
                href={`/finance/hoa-don-ncc/moi?don=${poId}`}
                blockedBy={canInvoice ? undefined : 'Kế toán'}
              >
                Nhập hoá đơn NCC
              </Btn>
            </>
          }
        >
          {finance.invoices.length + finance.payments.length === 0 ? (
            <div className="p-4">
              <Empty
                headline="Chưa có hoá đơn hay phiếu chi nào gắn đơn này"
                reason={
                  v.received_net > 0
                    ? 'Hàng đã về nhưng NCC chưa xuất hoá đơn, và chưa có phiếu chi nào gắn đơn.'
                    : 'Hàng chưa về nên chưa phát sinh công nợ.'
                }
                next="Kế toán nhập hoá đơn ở Tài chính › Hoá đơn NCC; phiếu chi ở Công nợ NCC."
              />
            </div>
          ) : (
            <Grid minWidth={420}>
              <GridHead>
                <Th>Chứng từ</Th>
                <Th num width={80}>
                  Ngày
                </Th>
                <Th num width={130}>
                  Tiền
                </Th>
                <Th width={90}>Hạn</Th>
              </GridHead>
              <GridBody>
                {finance.invoices.map((i) => (
                  <GridRow key={i.id}>
                    <Td>
                      <span className="num k-strong">{i.invoice_no}</span> · Hoá đơn NCC
                    </Td>
                    <Td num>{dmy(i.invoice_date)}</Td>
                    <Td num>{m(i.for_po_gross)}</Td>
                    <Td>{dmy(i.due_date)}</Td>
                  </GridRow>
                ))}
                {finance.payments.map((p) => (
                  <GridRow key={p.id}>
                    <Td>
                      <span className="num k-strong">
                        {p.ref_no || p.method || 'Phiếu chi'}
                      </span>{' '}
                      · Phiếu chi
                    </Td>
                    <Td num>{dmy(p.paid_on)}</Td>
                    <Td num>{m(p.amount)}</Td>
                    <Td>
                      <Tag tone="done">Đã chi</Tag>
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
            </Grid>
          )}
        </FastTab>
      </div>
      {extra}
    </>
  )
}
