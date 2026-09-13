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
import { STAGE_META, type FunnelRow, type FunnelStage } from '@/lib/finance-funnel'
import type { SpendRow } from '@/lib/spend-analysis'
import type { FinanceReport } from '@/modules/dept/accounting/finance-report.service'

const STAGES: FunnelStage[] = ['committed', 'confirmed', 'received', 'invoiced', 'paid']

const digits = (cur: string) => (cur === 'VND' ? 0 : 2)
const money = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: digits(cur) })
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

export function BaoCaoScreen({
  funnel,
  suppliers,
  by_month,
  by_group,
  by_supplier_spend,
  single_source,
  bought_material_count,
  pareto_group,
  pareto_supplier,
  gaps,
}: FinanceReport) {
  if (funnel.length === 0) {
    return (
      <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
        <ScreenFrame>
          <ScreenHeader eyebrow="Tài chính" title="Báo cáo mua hàng" />
          <Empty
            headline="Chưa có đơn mua nào"
            reason="Báo cáo dựng từ dòng đơn mua; chưa có đơn thì không có gì để cộng."
            next={
              <Btn primary href="/mua-hang/don">
                Mở danh sách đơn mua
              </Btn>
            }
          />
        </ScreenFrame>
      </div>
    )
  }

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          eyebrow="Tài chính"
          title="Báo cáo mua hàng — tiền đang nằm ở đâu"
          actions={
            <>
              <Btn href="/finance/theo-lenh">Xem theo lệnh</Btn>
              <Btn primary href="/api/dept/accounting/bao-cao/export">
                Xuất Excel
              </Btn>
            </>
          }
        />

        {/*
          CẢNH BÁO ĐỨNG ĐẦU, không giấu dưới chân trang. Hai mốc đầu của phễu là
          ƯỚC TÍNH; ai chép chúng vào sổ là ghi nhận một khoản nợ chưa tồn tại.
        */}
        <NoticeBar
          tone="warn"
          tag="Ước tính"
          action={{ label: 'Mở sổ công nợ chính thức' }}
        >
          Hai mốc đầu (<b>Đã cam kết</b>, <b>NCC đã xác nhận</b>) dùng để lập kế hoạch
          chi, <b>không ghi sổ được</b>. Nợ phải trả chỉ phát sinh từ mốc “Đã về kho” trở
          đi.
        </NoticeBar>

        {/*
          Nói ra thứ ĐANG CHẶN phân tích, thay vì lặng lẽ không có bảng. Người
          đọc không thấy bảng "giao đúng hạn" sẽ nghĩ chắc không ai trễ — trong
          khi sự thật là chưa ai khai hạn giao.
        */}
        {gaps.length > 0 && (
          <div className="border-b border-[var(--hair)] px-[var(--gutter)] py-2 text-[var(--fs-sm)]">
            <span className="text-[var(--ink-3)]">Chưa phân tích được:</span>{' '}
            {gaps.map((g, i) => (
              <span key={g.label}>
                {i > 0 && ' · '}
                <b>{g.label}</b> — {g.detail}
              </span>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {funnel.map((f) => (
            <FunnelBlock key={f.currency} f={f} />
          ))}

          <div className="px-[var(--gutter)] pt-4">
            <h3 className="k-fgrp-h">
              Ước tính phải trả theo nhà cung cấp · nguồn: đơn đã xác nhận
            </h3>
          </div>
          {suppliers.length === 0 ? (
            <Empty
              headline="Chưa nhà cung cấp nào có đơn được xác nhận"
              reason="Bảng này lấy theo đơn ở bước “NCC xác nhận” trở đi. Hiện chưa đơn nào tới bước đó."
              next={<Btn href="/mua-hang/don">Mở danh sách đơn mua</Btn>}
            />
          ) : (
            <Grid minWidth={840}>
              <GridHead>
                <Th>Nhà cung cấp</Th>
                <Th>Điều khoản TT</Th>
                <Th num>Ước tính phát sinh</Th>
                <Th num>Đã trả</Th>
                <Th num>Ước tính còn phải trả</Th>
              </GridHead>
              <GridBody>
                {suppliers.map((s) =>
                  s.totals.map((t, i) => (
                    <GridRow key={`${s.supplier_id}-${t.currency}`}>
                      <Td>
                        {i === 0 ? s.supplier_name : ''}
                        <span className="num ml-1 text-[var(--ink-3)]">{t.currency}</span>
                      </Td>
                      <Td>{i === 0 ? (s.payment_terms ?? '—') : ''}</Td>
                      <Td num>{money(t.incurred, t.currency)}</Td>
                      <Td num>{t.paid ? money(t.paid, t.currency) : '—'}</Td>
                      <Td num tone={t.balance > 0 ? 'warn' : undefined}>
                        {money(t.balance, t.currency)}
                      </Td>
                    </GridRow>
                  )),
                )}
              </GridBody>
            </Grid>
          )}

          <SpendTable
            title="Chi theo nhóm vật tư"
            sub={
              pareto_group
                ? `${pareto_group.count}/${pareto_group.of} nhóm đầu đã chiếm 80% tiền mua — đó là chỗ đáng bỏ công đàm phán`
                : 'chưa dòng nào khai giá'
            }
            firstCol="Nhóm vật tư"
            rows={by_group}
          />
          <SpendTable
            title="Chi theo nhà cung cấp"
            sub={
              pareto_supplier
                ? `${pareto_supplier.count}/${pareto_supplier.of} nhà cung cấp đầu đã chiếm 80% tiền mua`
                : 'chưa dòng nào khai giá'
            }
            firstCol="Nhà cung cấp"
            rows={by_supplier_spend}
          />

          {single_source.length > 0 && (
            <>
              <div className="px-[var(--gutter)] pt-4">
                <h3 className="k-fgrp-h">Rủi ro một nguồn cung</h3>
                <p className="pt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
                  <b className="k-t-stop">
                    {single_source.length}/{bought_material_count}
                  </b>{' '}
                  mã đã mua chỉ có ĐÚNG MỘT nhà cung cấp. Xếp theo tiền — một mã ốc vít
                  một nguồn thì không sao, một mã nhôm tiền tỷ một nguồn là chuyện khác.
                </p>
              </div>
              <Grid minWidth={760}>
                <GridHead>
                  <Th>Mã · tên vật tư</Th>
                  <Th>Nhà cung cấp duy nhất</Th>
                  <Th num>Đã mua</Th>
                </GridHead>
                <GridBody>
                  {single_source.slice(0, 12).map((r) => (
                    <GridRow key={r.material_id}>
                      <Td>
                        <span className="num k-strong">{r.code}</span> · {r.name}
                      </Td>
                      <Td>{r.supplier_names[0]}</Td>
                      <Td num>
                        {money(r.amount, r.currency)}{' '}
                        <span className="text-[var(--ink-3)]">{r.currency}</span>
                      </Td>
                    </GridRow>
                  ))}
                </GridBody>
              </Grid>
            </>
          )}

          {by_month.length > 0 && (
            <>
              <div className="px-[var(--gutter)] pt-4">
                <h3 className="k-fgrp-h">Cam kết mua phát sinh theo tháng</h3>
              </div>
              <Grid minWidth={620}>
                <GridHead>
                  <Th>Tháng</Th>
                  <Th>Tiền tệ</Th>
                  <Th num>Đã cam kết</Th>
                  <Th num>NCC đã xác nhận</Th>
                  <Th num>Tỉ lệ xác nhận</Th>
                </GridHead>
                <GridBody>
                  {by_month.map((m) => (
                    <GridRow key={`${m.month}-${m.currency}`}>
                      <Td>
                        <span className="num">{m.month}</span>
                      </Td>
                      <Td>{m.currency}</Td>
                      <Td num>{money(m.committed, m.currency)}</Td>
                      <Td num>{m.confirmed ? money(m.confirmed, m.currency) : '—'}</Td>
                      <Td num>{pct(m.confirmed, m.committed)}%</Td>
                    </GridRow>
                  ))}
                </GridBody>
              </Grid>
            </>
          )}
        </div>

        <div className="px-[var(--gutter)] py-3">
          <WhyBox
            lines={[
              'Đã cam kết      = Σ dòng đơn mua chưa huỷ, KỂ CẢ đơn còn nháp',
              'NCC đã xác nhận = phần cam kết mà NCC đã gật đầu (đơn từ "NCC xác nhận" trở đi)',
              'Đã về kho       = Σ (số lượng × đơn giá phiếu nhập), phiếu đảo trừ lại',
              'NCC đã xuất HĐ  = Σ DÒNG hoá đơn đã vào sổ — tiền hàng, CHƯA gồm VAT',
              'Cả năm mốc cùng gốc TIỀN HÀNG để so được với nhau; số thực trả NCC (có VAT) lớn hơn',
              'Đã trả          = Σ phiếu chi cho NCC',
              'Tiền tệ KHÔNG quy đổi — mỗi loại một phễu riêng, vì tỷ giá là quyết định kế toán',
              'KHÔNG có phía THU: 120/120 dòng đơn bán đang có đơn giá 0, chưa dựng được doanh thu',
            ]}
            result="hai mốc đầu để lập kế hoạch · ba mốc sau mới ghi sổ được"
          />
        </div>
      </ScreenFrame>
    </div>
  )
}

/**
 * BẢNG PARETO — cột LUỸ KẾ là thứ làm nó khác một bảng tổng thường: nhìn cột đó
 * là biết ngay "sáu nhóm đầu đã chiếm 80% tiền", tức biết chỗ đáng đàm phán.
 * Thiếu nó thì người đọc phải tự cộng dồn bằng mắt.
 */
function SpendTable({
  title,
  sub,
  firstCol,
  rows,
}: {
  title: string
  sub: string
  firstCol: string
  rows: SpendRow[]
}) {
  if (rows.length === 0) return null
  return (
    <>
      <div className="px-[var(--gutter)] pt-4">
        <h3 className="k-fgrp-h">{title}</h3>
        <p className="pt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">{sub}</p>
      </div>
      <Grid minWidth={820}>
        <GridHead>
          <Th>{firstCol}</Th>
          <Th>Tiền tệ</Th>
          <Th num>Số tiền</Th>
          <Th num>Tỉ lệ</Th>
          <Th num>Luỹ kế</Th>
          <Th num>Số mã</Th>
        </GridHead>
        <GridBody>
          {rows.slice(0, 15).map((r) => (
            <GridRow key={`${r.currency}-${r.key}`}>
              <Td>{r.label}</Td>
              <Td>
                <span className="num">{r.currency}</span>
              </Td>
              <Td num>{money(r.amount, r.currency)}</Td>
              <Td num>{r.share.toFixed(1)}%</Td>
              <Td num tone={r.cumulative <= 80 ? 'warn' : undefined}>
                {r.cumulative.toFixed(1)}%
              </Td>
              <Td num>{r.material_count || '—'}</Td>
            </GridRow>
          ))}
        </GridBody>
      </Grid>
    </>
  )
}

/** Một phễu cho một tiền tệ — thanh dài theo tỉ lệ so với mốc lớn nhất. */
function FunnelBlock({ f }: { f: FunnelRow }) {
  const max = Math.max(...STAGES.map((s) => f[s]), 1)
  return (
    <div className="border-b border-[var(--hair)] px-[var(--gutter)] py-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-bold tracking-[.07em] text-[var(--fs-label)] uppercase">
          Dòng tiền mua hàng
        </span>
        <span className="num k-strong">{f.currency}</span>
      </div>
      {STAGES.map((s) => {
        const meta = STAGE_META[s]
        const uoc = meta.kind === 'uoc_tinh'
        return (
          <div key={s} className="flex items-center gap-3 py-[3px]">
            <span className="w-[168px] shrink-0 text-[var(--fs-sm)]">
              {meta.label}
              {uoc && (
                <span className="k-t-warn ml-1 text-[10px] font-bold">ƯỚC TÍNH</span>
              )}
            </span>
            <span
              className="h-[14px] min-w-[2px] shrink-0 rounded-[2px]"
              style={{
                width: `${Math.max((f[s] / max) * 340, 2)}px`,
                background: uoc ? 'var(--warn)' : 'var(--act)',
                opacity: uoc ? 0.55 : 1,
              }}
            />
            <span className="num w-[150px] shrink-0 text-right text-[var(--fs-sm)]">
              {money(f[s], f.currency)}
            </span>
            <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">{meta.hint}</span>
          </div>
        )
      })}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
        <span>
          Chưa được xác nhận <b className="num">{money(f.unconfirmed, f.currency)}</b>
        </span>
        <span>
          Đã xác nhận, chưa về <b className="num">{money(f.in_flight, f.currency)}</b>
        </span>
        <span>
          Đã về, chưa có hoá đơn{' '}
          <b className="num">{money(f.awaiting_invoice, f.currency)}</b>
        </span>
        <span>
          Có hoá đơn, chưa trả <b className="num">{money(f.unpaid, f.currency)}</b>
        </span>
      </div>
    </div>
  )
}
