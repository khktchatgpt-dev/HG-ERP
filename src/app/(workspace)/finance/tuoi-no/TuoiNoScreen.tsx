'use client'

import {
  Btn,
  Empty,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  Td,
  Th,
  WhyBox,
} from '@/components/kit'
import { BUCKETS, BUCKET_LABEL, type AgingBucket } from '@/lib/ap-aging'
import type { ApAgingResult } from '@/modules/dept/accounting/ap-aging.service'

const digits = (cur: string) => (cur === 'VND' ? 0 : 2)
const money = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: digits(cur) })

/** Rổ càng quá hạn càng đỏ — ba màu vòng đời, không dùng cho nút. */
const TONE: Partial<Record<AgingBucket, 'warn' | 'stop'>> = {
  qua_1_30: 'warn',
  qua_31_60: 'warn',
  qua_61_90: 'stop',
  qua_90: 'stop',
  chua_co_han: 'warn',
}

export function TuoiNoScreen({
  rows,
  totals,
  missing_due,
  missing_fx,
  today,
}: ApAgingResult) {
  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          eyebrow="Tài chính"
          title="Tuổi nợ nhà cung cấp"
          actions={
            <>
              <Btn href="/finance/cong-no-ncc">Sổ công nợ</Btn>
              <Btn primary href="/api/dept/accounting/bao-cao/export">
                Xuất Excel
              </Btn>
            </>
          }
        />

        {/*
          Hoá đơn thiếu HẠN là lỗi dữ liệu, không phải khoản nợ an toàn — nói
          ngay ở đầu, vì nó làm cả bảng đọc sai (rổ "chưa khai hạn" phình to thì
          mọi rổ quá hạn trông nhỏ đi).
        */}
        {missing_due > 0 && (
          <NoticeBar tone="warn" tag="Thiếu hạn" action={{ label: 'Mở sổ hoá đơn' }}>
            <b>{missing_due}</b> hoá đơn chưa khai hạn thanh toán — chúng nằm ở rổ riêng
            “Chưa khai hạn”, <b>không</b> được coi là chưa đến hạn.
          </NoticeBar>
        )}
        {missing_fx.length > 0 && (
          <NoticeBar tone="stop" tag="Thiếu tỷ giá" action={{ label: 'Khai tỷ giá' }}>
            {missing_fx.map((m) => `${m.count} hoá đơn ${m.currency}`).join(' · ')} chưa
            quy đổi được sang VND. Cột “Quy VND” của các dòng đó để trống —{' '}
            <b>không thay bằng 0</b>.
          </NoticeBar>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              headline="Chưa có khoản nợ nào còn mở"
              reason="Bảng tuổi nợ dựng từ HOÁ ĐƠN nhà cung cấp đã vào sổ — tuổi nợ cần hạn thanh toán, mà hạn chỉ có trên tờ hoá đơn. Hiện chưa hoá đơn nào vào sổ."
              next={
                <>
                  <Btn primary href="/finance/cong-no-ncc">
                    Xem công nợ theo phiếu nhập
                  </Btn>
                  <Btn href="/finance/bao-cao">Xem báo cáo mua hàng</Btn>
                </>
              }
            />
          ) : (
            <Grid minWidth={1120}>
              <GridHead>
                <Th>Nhà cung cấp</Th>
                <Th>Tiền tệ</Th>
                <Th num>HĐ</Th>
                {BUCKETS.map((b) => (
                  <Th key={b} num>
                    {BUCKET_LABEL[b]}
                  </Th>
                ))}
                <Th num>Cộng</Th>
                <Th num>Quy VND</Th>
              </GridHead>
              <GridBody>
                {rows.map((r) => (
                  <GridRow key={`${r.supplier_id}-${r.currency}`}>
                    <Td>
                      {r.supplier_name}
                      {r.worst_days > 0 && (
                        <span className="k-t-stop ml-1 text-[11px]">
                          quá {r.worst_days}n
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="num">{r.currency}</span>
                    </Td>
                    <Td num>{r.invoice_count}</Td>
                    {BUCKETS.map((b) => (
                      <Td key={b} num tone={r.buckets[b] > 0 ? TONE[b] : undefined}>
                        {r.buckets[b] ? money(r.buckets[b], r.currency) : '—'}
                      </Td>
                    ))}
                    <Td num>
                      <b>{money(r.total, r.currency)}</b>
                    </Td>
                    {/*
                      null = thiếu tỷ giá. Bày "chưa quy đổi" chứ KHÔNG bày 0:
                      một khoản 10.000 USD hiện thành 0 đ đọc ra là "không nợ gì".
                    */}
                    <Td num>
                      {r.total_base == null ? (
                        <span className="k-t-stop">chưa quy đổi</span>
                      ) : (
                        money(r.total_base, 'VND')
                      )}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
              <GridFoot>
                <Td>Cộng theo tiền tệ</Td>
                <Td />
                <Td num />
                {BUCKETS.map((b) => (
                  <Td key={b} num>
                    {totals.map((t) => t.buckets[b]).some((v) => v > 0)
                      ? totals
                          .filter((t) => t.buckets[b] > 0)
                          .map((t) => `${money(t.buckets[b], t.currency)} ${t.currency}`)
                          .join(' · ')
                      : '—'}
                  </Td>
                ))}
                <Td num>
                  {totals
                    .map((t) => `${money(t.total, t.currency)} ${t.currency}`)
                    .join(' · ')}{' '}
                  {/* prettier-ignore */}
                </Td>
                <Td num />
              </GridFoot>
            </Grid>
          )}
        </div>

        <div className="px-[var(--gutter)] py-3">
          <WhyBox
            lines={[
              `Tuổi tính theo HẠN THANH TOÁN so với hôm nay (${today}), KHÔNG theo ngày hoá đơn`,
              'Hoá đơn 60 ngày tuổi mà điều khoản 90 ngày thì CHƯA đến hạn — xếp vào "quá hạn" là giục nhầm NCC',
              'Số dư mỗi hoá đơn = tổng hoá đơn − đã trả cho CHÍNH hoá đơn đó; trả đủ thì rơi khỏi bảng',
              'Nguồn: hoá đơn NCC ĐÃ VÀO SỔ. Khoản "đã nhận hàng chưa có hoá đơn" chưa có hạn nên chưa có tuổi — xem ở sổ công nợ',
              'Tiền tệ KHÔNG cộng lẫn; cột "Quy VND" dùng tỷ giá lưu trên chứng từ, thiếu thì để trống',
              'CHƯA trừ được thanh toán theo từng hoá đơn: sổ chi (0167) mới gắn đơn mua, chưa gắn hoá đơn — việc của Đợt B',
            ]}
            result={totals
              .map((t) => `${money(t.total, t.currency)} ${t.currency}`)
              .join(' · ')}
          />
        </div>
      </ScreenFrame>
    </div>
  )
}
