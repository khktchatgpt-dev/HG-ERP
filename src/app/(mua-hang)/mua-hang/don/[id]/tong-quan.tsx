'use client'

import { Metric, MetricStrip } from '@/components/kit'
import { poVeThieu, veThieuChuaVat } from '@/lib/po-finance'
import { money, type MucId, type Props } from './don-chung-tu.shared'
import type { DonCtx } from './useDonChungTu'

type KhoDoc = Props['warehouseDocs'][number]

/**
 * Phiếu nhập ĐÃ ĐẢO ĐỂ SỬA mà chưa lập lại (A bỏ ngang) — số đã nhận của đơn đang
 * thiếu đúng phần phiếu đó. Dùng chung cho "Vướng gì" và bảng Chứng từ kho.
 */
export function choLapLai(docs: KhoDoc[]): KhoDoc[] {
  return docs.filter((d) => {
    if (d.kind !== 'receipt' || !d.reversed_by) return false
    const dao = docs.find((x) => x.code === d.reversed_by)
    return !!dao?.for_fix && !docs.some((x) => x.fix_of === d.code)
  })
}

/** Mục "Vướng gì" từ sổ kho của đơn — ghép vào danh sách của `useDonChungTu`. */
export function vuongPhieuKho(docs: KhoDoc[]) {
  return choLapLai(docs).map((d) => ({
    tag: 'Chờ lập lại',
    tone: 'stop' as const,
    text: `${d.code} đã đảo để sửa nhưng chưa lập lại phiếu — số đã nhận của đơn đang thiếu đúng phần đó.`,
    muc: 'giao-nhan' as MucId,
    goLabel: 'Giao & nhận',
  }))
}

/**
 * DẢI SỐ MỤC TỔNG QUAN (02/10/2026): Đặt · Đã về · Còn thiếu · Hoá đơn · Đã trả.
 *
 * Ba ô đầu cùng một gốc CHƯA VAT và cùng các dòng đối chiếu mục Tài chính dùng
 * (`poVeThieu`), nên kiểm tay được: Đặt ≈ Đã về + Còn thiếu (+ phần đã chốt thiếu).
 * Tổng thanh toán gồm VAT vẫn nằm ở đầu đơn — không nhắc lại ở đây. Đọc tài chính
 * lỗi thì lùi về số theo dòng như bản trước, không bịa 0.
 */
export function TongQuanSo({ d }: { d: DonCtx }) {
  const { p, header, totals, lines, veKho, sentToSupplier: daGui } = d
  const cur = header.currency
  const f = p.finance
  const vatPct = header.vat === '' ? 0 : Number(header.vat)
  // Ba ô đầu LUÔN chưa VAT (05/10/2026, báo lỗi đơn của Thi): đơn giá gồm VAT thì
  // tách thuế ra như đầu đơn tách — số gồm thuế là "Tổng thanh toán" ở đầu đơn.
  const vt = f
    ? veThieuChuaVat(poVeThieu(f.rows), { priceIncludesVat: header.inclVat, vatRate: vatPct }) // prettier-ignore
    : null
  const chuaCo = !daGui ? 'đơn chưa gửi NCC' : 'đơn không có dòng vật tư kho'
  const thueNgan = vatPct === 0 ? 'không VAT' : 'chưa VAT'
  const thue =
    vatPct === 0
      ? 'không VAT'
      : header.inclVat
        ? `chưa VAT · đã tách ${vatPct}%`
        : 'chưa VAT'
  return (
    <MetricStrip>
      <Metric
        label="Giá trị đặt"
        value={vt ? money(vt.ordered_net, cur) : money(totals.grandTotal, cur)}
        basis={
          vt
            ? `${lines.length} dòng · ${thue}`
            : `${lines.length} dòng · gồm VAT ${header.vat === '' ? 0 : header.vat}%`
        }
      />
      <Metric
        label="Đã về"
        value={!veKho ? null : vt ? money(vt.received_net, cur) : `${Math.round(veKho.ratio * 100)}%`} // prettier-ignore
        tone={veKho && veKho.ratio >= 1 ? 'done' : undefined}
        basis={
          !veKho
            ? chuaCo
            : `${veKho.du}/${veKho.tong} dòng vật tư kho về đủ${vt ? ` · ${thueNgan}` : ''}`
        }
      />
      <Metric
        label="Còn thiếu"
        value={!veKho || !vt ? null : money(vt.missing_net, cur)}
        basis={
          !veKho
            ? chuaCo
            : !vt
              ? 'chưa tải được số tài chính'
              : `${vt.missing_lines} dòng chưa về đủ · ${thueNgan}${vt.closed_lines ? ` · không gồm ${vt.closed_lines} dòng đã chốt thiếu` : ''}`
        }
      />
      <Metric
        label="Đã có hoá đơn"
        value={f ? money(f.invoiced_gross, cur) : null}
        basis={f ? `${f.invoices.length} hoá đơn · gồm VAT` : 'chưa tải được'}
      />
      <Metric
        label="Đã trả"
        value={f ? money(f.paid, cur) : null}
        basis={f ? `${f.payments.length} phiếu chi gắn đơn` : 'chưa tải được'}
      />
    </MetricStrip>
  )
}

/** Phiếu nhập gần nhất CÒN HIỆU LỰC (không tính phiếu đã đảo) — chip "Về đủ · PNK-…". */
export function phieuNhapCuoi(docs: KhoDoc[]): KhoDoc | undefined {
  return docs.findLast((x) => x.kind === 'receipt' && !x.reversed_by)
}
