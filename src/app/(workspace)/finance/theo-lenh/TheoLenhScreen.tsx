'use client'

import { useState } from 'react'

import {
  Btn,
  Empty,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridBtn,
  GridRow,
  Metric,
  MetricStrip,
  ScreenFrame,
  ScreenHeader,
  Td,
  Th,
  WhyBox,
} from '@/components/kit'
import type {
  CrossScreenRow,
  LsxFinanceScreenRow,
} from '@/modules/dept/accounting/lsx-finance.service'

/**
 * VND không có phần lẻ; USD thì CÓ — 174.369,48 USD làm tròn thành 174.369 là
 * bốc hơi 48 cent mỗi dòng, và tổng lệch dần mà không ai truy được từ đâu.
 */
const digits = (cur: string) => (cur === 'VND' ? 0 : 2)
const money = (n: number, cur: string) =>
  `${n.toLocaleString('vi-VN', { maximumFractionDigits: digits(cur), minimumFractionDigits: 0 })} ${cur}`
/** Tỉ lệ kèm mẫu số ngầm — 0/0 trả "—" chứ không trả NaN% hay 0%. */
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
/** Tiền trong ô bảng: KHÔNG đuôi tiền tệ — đơn vị đã nói ở tiêu đề cột. */
const cell = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', {
    maximumFractionDigits: digits(cur),
    minimumFractionDigits: 0,
  })

export function TheoLenhScreen({
  rows,
  total,
  unassigned,
  currency,
  currencies,
  cross,
  activeOnly,
}: {
  rows: LsxFinanceScreenRow[]
  total: {
    committed: number
    confirmed: number
    draft: number
    received: number
    invoiced: number
    not_received: number
    awaiting_invoice: number
    line_count: number
    issue_count: number
    lsx_count: number
  }
  unassigned: number
  currency: string
  currencies: { code: string; lsx_count: number }[]
  cross: CrossScreenRow[]
  activeOnly: boolean
}) {
  const coSo = rows.filter((r) => r.committed > 0)
  /**
   * LỌC HAI CHIỀU trên cùng một bảng chéo: bấm một lệnh → còn các NCC của lệnh
   * đó; bấm một NCC → còn các lệnh của NCC đó. Một bảng, hai câu hỏi — dựng hai
   * bảng riêng thì hai bên sớm muộn lệch số.
   */
  const [pick, setPick] = useState<{ kind: 'lsx' | 'ncc'; id: string; label: string } | null>(null) // prettier-ignore
  const crossShown = pick
    ? cross.filter((c) => (pick.kind === 'lsx' ? c.lsx_id === pick.id : c.supplier_id === pick.id)) // prettier-ignore
    : cross

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          eyebrow="Tài chính"
          title="Tiền theo lệnh sản xuất"
          actions={
            <>
              <Btn
                href={activeOnly ? '/finance/theo-lenh?tatca=1' : '/finance/theo-lenh'}
              >
                {activeOnly ? 'Xem cả lệnh đã đóng' : 'Chỉ lệnh đang chạy'}
              </Btn>
              <Btn
                primary
                href={`/api/dept/accounting/bao-cao/export${activeOnly ? '' : '?tatca=1'}`}
              >
                Xuất Excel
              </Btn>
            </>
          }
        />

        {/*
        CHỌN TIỀN TỆ, không gộp. Một lệnh có thể mang cả đơn VND lẫn đơn USD
        (đo 11/09/2026: 6 lệnh như vậy) — cộng chung là ngầm khai 1 USD = 1 VND.
        Mỗi lần xem đúng MỘT tiền tệ thì mọi con số trên màn đều cộng được.
      */}
        {currencies.length > 1 && (
          <div className="flex items-center gap-2 border-b border-[var(--hair)] px-[var(--gutter)] py-2 text-[var(--fs-sm)]">
            <span className="text-[var(--ink-3)]">Tiền tệ</span>
            {currencies.map((c) => (
              <Btn
                key={c.code}
                primary={c.code === currency}
                href={`/finance/theo-lenh?tt=${c.code}${activeOnly ? '' : '&tatca=1'}`}
              >
                {c.code} · {c.lsx_count} lệnh
              </Btn>
            ))}
            <span className="text-[var(--ink-3)]">
              — số trên màn chỉ gồm đơn {currency}, KHÔNG quy đổi tiền tệ khác
            </span>
          </div>
        )}

        {/*
        Dải hiệu suất, không phải ba trục trạng thái — bảng tiền không có vòng
        đời duyệt. Mỗi ô kèm mẫu số để con số kiểm được.
      */}
        <MetricStrip>
          <Metric
            label="Đã cam kết mua"
            value={money(total.committed, currency)}
            basis={`${coSo.length}/${total.lsx_count} lệnh · trong đó ${cell(total.draft, currency)} còn ở đơn NHÁP`}
          />
          {/*
          NCC ĐÃ XÁC NHẬN đứng trước "đã về kho" vì nó là con số CÓ THẬT hôm nay:
          kho chưa ghi nhận gì, nên để "đã về" ở vị trí thứ hai là bày một ô 0
          đồng ở chỗ dễ đọc nhất. Đây KHÔNG phải công nợ — nợ phát sinh khi hàng
          về hoặc khi có hoá đơn, không phải khi NCC gật đầu.
        */}
          <Metric
            label="NCC đã xác nhận"
            value={money(total.confirmed, currency)}
            basis={`${pct(total.confirmed, total.committed)} của cam kết · đã về ${cell(total.received, currency)}`}
            tone={total.confirmed > 0 ? 'done' : 'warn'}
          />
          <Metric
            label="Chờ hoá đơn"
            value={money(total.awaiting_invoice, currency)}
            basis="đã về, chưa có hoá đơn"
            tone={total.awaiting_invoice > 0 ? 'warn' : undefined}
          />
          <Metric
            label="Dòng lệch"
            value={String(total.issue_count)}
            basis={`trên ${total.line_count} dòng`}
            tone={total.issue_count > 0 ? 'stop' : 'done'}
          />
        </MetricStrip>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              headline="Chưa có lệnh sản xuất nào"
              reason="Bảng này gộp tiền theo lệnh, nên cần ít nhất một lệnh đã duyệt."
              next={
                <Btn primary href="/kehoach-sx">
                  Mở kế hoạch sản xuất
                </Btn>
              }
            />
          ) : (
            <Grid minWidth={1300}>
              <GridHead>
                <Th>Lệnh sản xuất</Th>
                <Th>Khách</Th>
                <Th num>Đơn mua</Th>
                <Th num>Đã cam kết ({currency})</Th>
                <Th num>NCC đã xác nhận</Th>
                <Th num>Đã về</Th>
                <Th num>Chưa về</Th>
                <Th num>NCC đã đòi</Th>
                <Th num>Chờ hoá đơn</Th>
                <Th num>Doanh thu</Th>
                <Th width={92}>Lệch</Th>
              </GridHead>
              <GridBody>
                {rows.map((r) => (
                  <GridRow key={r.lsx_id}>
                    <Td>
                      <span className="num k-strong">{r.code}</span>
                    </Td>
                    <Td>{r.customer_name ?? '—'}</Td>
                    <Td num>{r.po_count || '—'}</Td>
                    <Td num>{r.committed ? cell(r.committed, currency) : '—'}</Td>
                    <Td num tone={r.confirmed > 0 ? 'done' : undefined}>
                      {r.confirmed ? cell(r.confirmed, currency) : '—'}
                    </Td>
                    <Td num>{r.received ? cell(r.received, currency) : '—'}</Td>
                    <Td num tone={r.not_received > 0 ? 'warn' : undefined}>
                      {r.not_received ? cell(r.not_received, currency) : '—'}
                    </Td>
                    <Td num>{r.invoiced ? cell(r.invoiced, currency) : '—'}</Td>
                    <Td num tone={r.awaiting_invoice > 0 ? 'warn' : undefined}>
                      {r.awaiting_invoice ? cell(r.awaiting_invoice, currency) : '—'}
                    </Td>
                    {/*
                    Doanh thu null = CHƯA CÓ NGUỒN. Bày "—", tuyệt đối không bày
                    "0": số 0 ở cột doanh thu đọc ra là "bán không thu được đồng
                    nào", và cạnh cột cam kết tiền tỷ thì đó là lời nói dối.
                  */}
                    <Td num>
                      {r.revenue == null ? (
                        <span className="text-[var(--ink-3)]">chưa có</span>
                      ) : (
                        cell(r.revenue, currency)
                      )}
                    </Td>
                    <Td>
                      {r.issue_count > 0 ? (
                        <span className="k-t-stop">{r.issue_count} dòng</span>
                      ) : (
                        <span className="text-[var(--ink-3)]">—</span>
                      )}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
              <GridFoot>
                <Td>Cộng {rows.length} lệnh</Td>
                <Td />
                <Td num />
                <Td num>{cell(total.committed, currency)}</Td>
                <Td num>{cell(total.confirmed, currency)}</Td>
                <Td num>{cell(total.received, currency)}</Td>
                <Td num>{cell(total.not_received, currency)}</Td>
                <Td num>{cell(total.invoiced, currency)}</Td>
                <Td num>{cell(total.awaiting_invoice, currency)}</Td>
                <Td num>—</Td>
                <Td />
              </GridFoot>
            </Grid>
          )}
        </div>

        {cross.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hair)] px-[var(--gutter)] pt-3 pb-2">
              <h3 className="k-fgrp-h">Lệnh × Nhà cung cấp</h3>
              <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                nợ thuộc về NCC, chi phí thuộc về lệnh — bảng này đọc được cả hai chiều
              </span>
              {pick && (
                <Btn onClick={() => setPick(null)}>
                  Bỏ lọc: {pick.label} ({crossShown.length}/{cross.length})
                </Btn>
              )}
            </div>
            <div className="max-h-[340px] overflow-auto">
              <Grid minWidth={1080}>
                <GridHead>
                  <Th>Lệnh SX</Th>
                  <Th>Nhà cung cấp</Th>
                  <Th>TT</Th>
                  <Th num>Đã cam kết</Th>
                  <Th num>NCC xác nhận</Th>
                  <Th num>Đã về</Th>
                  <Th num>NCC đã đòi</Th>
                  <Th num>Chờ hoá đơn</Th>
                </GridHead>
                <GridBody>
                  {crossShown.map((c) => (
                    <GridRow key={`${c.lsx_id}-${c.supplier_id}-${c.currency}`}>
                      <Td>
                        <GridBtn
                          title={`Chỉ xem nhà cung cấp của lệnh ${c.lsx_code}`}
                          onClick={() => setPick({ kind: 'lsx', id: c.lsx_id, label: c.lsx_code })} // prettier-ignore
                        >
                          {c.lsx_code}
                        </GridBtn>
                      </Td>
                      <Td>
                        <GridBtn
                          title={`Chỉ xem lệnh của ${c.supplier_name}`}
                          onClick={() => setPick({ kind: 'ncc', id: c.supplier_id, label: c.supplier_name })} // prettier-ignore
                        >
                          {c.supplier_name}
                        </GridBtn>
                      </Td>
                      <Td>
                        <span className="num">{c.currency}</span>
                      </Td>
                      <Td num>{cell(c.committed, c.currency)}</Td>
                      <Td num tone={c.confirmed > 0 ? 'done' : undefined}>
                        {c.confirmed ? cell(c.confirmed, c.currency) : '—'}
                      </Td>
                      <Td num>{c.received ? cell(c.received, c.currency) : '—'}</Td>
                      <Td num>{c.invoiced ? cell(c.invoiced, c.currency) : '—'}</Td>
                      <Td num tone={c.awaiting_invoice > 0 ? 'warn' : undefined}>
                        {c.awaiting_invoice ? cell(c.awaiting_invoice, c.currency) : '—'}
                      </Td>
                    </GridRow>
                  ))}
                </GridBody>
              </Grid>
            </div>
          </>
        )}

        <div className="px-[var(--gutter)] py-3">
          <WhyBox
            lines={[
              `Toàn bộ bảng CHỈ gồm đơn mua bằng ${currency} — không quy đổi, không cộng tiền tệ khác`,
              'Đã cam kết = Σ dòng đơn mua gắn lệnh, KỂ CẢ đơn còn nháp (đơn đã huỷ không tính)',
              'NCC đã xác nhận = phần cam kết mà NCC đã gật đầu (đơn từ "NCC xác nhận" trở đi) — cam kết hai chiều, khác hẳn đơn nháp',
              'NCC đã xác nhận KHÔNG PHẢI công nợ: nợ phát sinh khi hàng về hoặc khi có hoá đơn',
              'Đã về      = Σ (số lượng × đơn giá trên phiếu nhập kho), phiếu đảo trừ lại',
              'NCC đã đòi = Σ dòng hoá đơn NCC ĐÃ VÀO SỔ',
              'Chưa về = cam kết − đã về · Chờ hoá đơn = đã về − NCC đã đòi',
              unassigned > 0
                ? `KHÔNG gồm ${money(unassigned, currency)} tiền đơn mua không gắn lệnh nào (mua bù tồn)`
                : 'Mọi đơn mua đều đã gắn lệnh — không có khoản nào nằm ngoài bảng',
              'ĐÂY KHÔNG PHẢI GIÁ THÀNH: chưa tính vật tư xuất kho và nhân công (sổ đang có 0 dòng cả hai)',
              'Doanh thu để trống vì giá bán chưa có trong hệ thống — 120/120 dòng đơn bán đang là 0',
            ]}
            result={`đã cam kết ${money(total.committed, currency)} · còn phải về ${money(total.not_received, currency)}`}
          />
        </div>
      </ScreenFrame>
    </div>
  )
}
