'use client'

import {
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  LineStatus,
  Metric,
  MetricStrip,
  Td,
  Th,
  WhyBox,
} from '@/components/kit'
import { VERDICT_LABEL, type MatchRow, type MatchVerdict } from '@/lib/three-way-match'

/**
 * BẢNG ĐỐI CHIẾU BA CHIỀU của một đơn mua — ĐẶT / VỀ / NCC ĐÒI, theo từng dòng.
 *
 * Câu hỏi màn này trả lời: "NCC đòi có đúng không, và nếu lệch thì lệch ở ĐÂU".
 * Không phải "tổng có khớp không" — tổng khớp mà hai dòng lệch ngược chiều nhau
 * vẫn là sai, và đó chính là kiểu sai không ai bắt được bằng mắt.
 */

const VERDICT_KIND: Record<MatchVerdict, 'idle' | 'part' | 'done' | 'short'> = {
  khop: 'done',
  cho_hoa_don: 'part',
  doi_truoc: 'short',
  lech_gia: 'short',
  chua_phat_sinh: 'idle',
}

const money = (n: number, cur: string) =>
  `${n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${cur}`
const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

export function DoiChieuTable({
  rows,
  summary,
  unlinkedAmount,
  currency,
}: {
  rows: MatchRow[]
  summary: {
    total: number
    byVerdict: Record<MatchVerdict, number>
    amount_cho_hoa_don: number
    amount_doi_truoc: number
    amount_lech_gia: number
  }
  unlinkedAmount: number
  currency: string
}) {
  const tOrdered = rows.reduce((s, r) => s + r.amount_ordered, 0)
  const tRecv = rows.reduce((s, r) => s + r.amount_received, 0)
  const tInv = rows.reduce((s, r) => s + r.amount_invoiced, 0)

  return (
    <>
      {/*
        Dải hiệu suất, KHÔNG phải ba trục trạng thái: đối chiếu không có vòng
        đời duyệt. Mỗi ô kèm mẫu số (x/y dòng) — con số trần không kiểm được
        thì không ai tin (nguyên tắc 3 và 6 của sổ thiết kế).
      */}
      <MetricStrip>
        <Metric
          label="Chờ hoá đơn"
          value={money(summary.amount_cho_hoa_don, currency)}
          basis={`${summary.byVerdict.cho_hoa_don}/${summary.total} dòng đã về, NCC chưa xuất hoá đơn`}
          tone={summary.byVerdict.cho_hoa_don > 0 ? 'warn' : undefined}
        />
        <Metric
          label="NCC đòi trước"
          value={money(summary.amount_doi_truoc, currency)}
          basis={`${summary.byVerdict.doi_truoc}/${summary.total} dòng có hoá đơn mà hàng chưa vào kho`}
          tone={summary.byVerdict.doi_truoc > 0 ? 'stop' : undefined}
        />
        <Metric
          label="Lệch giá"
          value={money(summary.amount_lech_gia, currency)}
          basis={`${summary.byVerdict.lech_gia}/${summary.total} dòng đúng số lượng, sai tiền`}
          tone={summary.byVerdict.lech_gia !== 0 ? 'stop' : undefined}
        />
        <Metric
          label="Khớp"
          value={`${summary.byVerdict.khop}/${summary.total}`}
          basis="dòng ba vế bằng nhau"
          tone={summary.byVerdict.khop === summary.total ? 'done' : undefined}
        />
      </MetricStrip>

      <Grid minWidth={1080}>
        <GridHead>
          <Th>Vật tư</Th>
          <Th num>Đặt</Th>
          <Th num>Tiền đặt</Th>
          <Th num>Đã về</Th>
          <Th num>Tiền về</Th>
          <Th num>NCC đòi</Th>
          <Th num>Tiền đòi</Th>
          <Th num>Lệch</Th>
          <Th width={128}>Kết luận</Th>
          <Th width={140}>Hoá đơn</Th>
        </GridHead>
        <GridBody>
          {rows.map((r) => (
            <GridRow key={r.po_line_id}>
              <Td>
                <span className="num k-strong">{r.material_code ?? '—'}</span> ·{' '}
                {r.material_name}
                {r.closed_short && (
                  <span className="k-t-warn block text-[11px]">đã chốt thiếu</span>
                )}
              </Td>
              <Td num>
                {num(r.qty_ordered)} {r.unit ?? ''}
              </Td>
              <Td num>{money(r.amount_ordered, currency)}</Td>
              <Td num>{num(r.qty_received)}</Td>
              <Td num>{money(r.amount_received, currency)}</Td>
              <Td num>{num(r.qty_invoiced)}</Td>
              <Td num>{money(r.amount_invoiced, currency)}</Td>
              <Td num tone={Math.abs(r.amount_gap) >= 1 ? 'stop' : undefined}>
                {r.amount_gap === 0 ? '—' : money(r.amount_gap, currency)}
              </Td>
              <Td>
                <LineStatus kind={VERDICT_KIND[r.verdict]}>
                  {VERDICT_LABEL[r.verdict]}
                </LineStatus>
              </Td>
              <Td>
                {r.invoices.length === 0 ? (
                  <span className="text-[var(--ink-3)]">—</span>
                ) : (
                  r.invoices.map((i) => (
                    <span key={i.invoice_id} className="num block">
                      {i.invoice_no}
                    </span>
                  ))
                )}
              </Td>
            </GridRow>
          ))}
        </GridBody>
        {/*
          Chân bảng nói TỔNG KHÔNG GỒM GÌ — nguyên tắc 6. Tiền ngoài dòng đơn
          (vận chuyển, làm tròn) nằm ngoài ba cột này, giấu đi thì tổng hoá đơn
          không bao giờ khớp tổng bảng và người đối chiếu đi tìm cả buổi.
        */}
        <GridFoot>
          <Td>Cộng {rows.length} dòng</Td>
          <Td num />
          <Td num>{money(tOrdered, currency)}</Td>
          <Td num />
          <Td num>{money(tRecv, currency)}</Td>
          <Td num />
          <Td num>{money(tInv, currency)}</Td>
          <Td num>{money(tRecv - tInv, currency)}</Td>
          <Td />
          <Td />
        </GridFoot>
      </Grid>

      <div className="px-[var(--gutter)] pt-3">
        <WhyBox
          lines={[
            'Tiền đặt  = dòng đơn mua, tính đúng hàm đơn đang dùng (dòng nhôm theo tổng kg, không phải số cây × giá)',
            'Tiền về   = Σ (số lượng × đơn giá trên phiếu nhập kho), phiếu đảo trừ lại',
            'Tiền đòi  = Σ dòng hoá đơn NCC ĐÃ VÀO SỔ (hoá đơn còn nháp không tính)',
            'Phiếu nhập KHÔNG có đơn giá đóng góp 0 đồng → dòng đó hiện "lệch giá" dù số lượng khớp. Đó là thật, không phải lỗi hiển thị.',
            unlinkedAmount > 0
              ? `Ba cột KHÔNG gồm ${money(unlinkedAmount, currency)} tiền hoá đơn không gắn dòng đơn mua (vận chuyển, bao bì, làm tròn)`
              : 'Ba cột KHÔNG gồm tiền hoá đơn không gắn dòng đơn mua — đơn này chưa có khoản nào như vậy',
          ]}
          result={`về ${money(tRecv, currency)} − NCC đòi ${money(tInv, currency)} = lệch ${money(tRecv - tInv, currency)}`}
        />
      </div>
    </>
  )
}
