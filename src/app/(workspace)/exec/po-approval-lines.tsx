'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { Ico } from '@/components/kit'
import { cn } from '@/lib/utils'
import { poLineAmount, roundMoney } from '@/lib/po-line'
import { isPoTemplate, poTemplateMeta } from '@/lib/po-template'
import {
  PO_PRICE_SUFFIX_TEMPLATES,
  PO_PRINT_QTY_LABEL,
  poPriceSuffix,
  poPriceUnitPerLine,
} from '@/lib/po-fields'
import { approvalLineCols, type ApprovalCol } from '@/lib/po-approval-cols'
import { HAI_GIA, poHaiGia } from '@/lib/po-hai-gia'
import { qtyForLsx } from '@/lib/po-lsx-split'
import { lenhNgan } from '@/app/(mua-hang)/mua-hang/don/_lib/po-lsx-chia'
import { money } from './approval-helpers'
import { comparePrice, fmtVnd, type LastPriceOf } from './approval-parts'
import type { ApprovalPoLine, PendingPo } from './approval-types'

/**
 * LƯỚI DÒNG VẬT TƯ CỦA MÀN KÝ — cột theo PHIẾU IN gửi NCC (viết lại 07/10/2026).
 *
 * Bản 17/09 có 7 cột cố định; chủ dự án báo "không hiển đủ thông tin các dòng
 * hàng". Đo: 266/528 dòng có Vật liệu / SL đơn hàng, 329 dòng có ghi chú, 135
 * dòng có mã SP — đều có trong dữ liệu đã nạp, chỉ là lưới không vẽ. Nay bộ
 * cột đọc chung khai báo với phiếu in (`approvalLineCols`), cộng hai thứ chỉ
 * người ký cần:
 *  · "Giá lần trước" sau đơn giá — người ký 28.885 USD cần có gì để so; mũi
 *    tên hổ phách khi tăng ≥ 5%, lục khi giảm, mã đơn cũ trong `title`;
 *  · ghi chú dòng nằm DƯỚI TÊN chứ không làm cột cuối: cột phải cùng là thứ
 *    đầu tiên trôi ra ngoài mép khi laptop phóng 125% (user duyệt 07/10).
 */
export function PoLineGrid({
  lines,
  template,
  total,
  currency,
  lastPrices,
  money: m,
  lsxSet,
}: {
  lines: ApprovalPoLine[]
  template: string | null | undefined
  total: number
  currency: string
  lastPrices?: LastPriceOf
  /**
   * Tiền của đơn (`poMoneyOf`). Có thì chân bảng bày đủ tiền hàng → chiết khấu
   * → VAT → TỔNG THANH TOÁN như phiếu in; không có thì chỉ một dòng tổng.
   */
  money?: PendingPo['money']
  /** Bộ lệnh của đơn gộp (lệnh chính đầu) — ≥ 2 lệnh thì bày cột "Chia lệnh". */
  lsxSet?: { id: string; code: string }[]
}) {
  if (!lines.length) return null
  const t = isPoTemplate(template) ? template : 'simple'
  const meta = poTemplateMeta(t)
  const cols = approvalLineCols(t, lines)
  const missingPrice = lines.filter((ln) => ln.unit_price == null).length
  // Quy cách đã có cột riêng thì thôi nhắc lại dưới tên vật tư.
  const specHasCol = cols.some((c) => c.kind === 'field' && c.field === 'spec')
  // Mẫu có cột tính (Tổng kg / Tổng m³) đã bày qty2; mẫu khác quy đổi thì thêm cột.
  const hasCalc = cols.some((c) => c.kind === 'field' && c.calc)
  const showQty2 = !hasCalc && lines.some((ln) => ln.qty2 != null)
  const hasProduct = lines.some((ln) => !!ln.product_code?.trim())
  const perLine = poPriceUnitPerLine(meta.priceUnit, lines)
  const priceSuffix = (ln: ApprovalPoLine): string =>
    PO_PRICE_SUFFIX_TEMPLATES.includes(t)
      ? poPriceSuffix(t, ln.carton_basis)
      : perLine
        ? perLine(ln)
        : !meta.priceUnit && ln.price_basis === 'unit2' && ln.unit2
          ? `/${ln.unit2}`
          : ''
  /*
    HAI CỘT GIÁ (10/10/2026 — "bên giám đốc cũng cần hiển thị để biết"): nhôm, sắt,
    gỗ, kính, xốp bày cả giá theo ĐVT lẫn giá /kg · /m³ · /m² như lưới soạn đơn.
    Số tính tiền đậm, số quy đổi nhạt — người ký biết dòng đang trả theo cái nào.
  */
  const hai = HAI_GIA[t]
  /*
    CHIA LỆNH (10/10/2026): đơn gộp nhiều lệnh thì người ký phải thấy lệnh nào
    lấy bao nhiêu. Dòng chưa chia = trọn lệnh chính (quy ước 0185) — nói rõ ra.
  */
  const gop = (lsxSet?.length ?? 0) > 1 ? lsxSet! : null
  const priceLabel = hai
    ? `Đơn giá (${currency})`
    : meta.priceUnit && !perLine && !PO_PRICE_SUFFIX_TEMPLATES.includes(t)
      ? `Đơn giá (${currency}/${meta.priceUnit})`
      : `Đơn giá (${currency})`

  /** Cột hiển thị theo thứ tự — `@…` mở rộng ra ô của màn ký. */
  type Shown =
    | { k: 'stt' | 'name' | 'product' | 'unit' | 'qty' | 'qty2' | 'price' | 'price2' | 'prev' | 'amount' | 'lenh' } // prettier-ignore
    | { k: 'field'; c: Extract<ApprovalCol, { kind: 'field' }> }
  const shown: Shown[] = [{ k: 'stt' }]
  for (const c of cols) {
    if (c.kind === 'field') shown.push({ k: 'field', c })
    else if (c.key === '@name') {
      shown.push({ k: 'name' })
      if (hasProduct) shown.push({ k: 'product' })
    } else if (c.key === '@unit') shown.push({ k: 'unit' })
    else if (c.key === '@qty') {
      shown.push({ k: 'qty' })
      if (showQty2) shown.push({ k: 'qty2' })
    } else if (c.key === '@price')
      shown.push({ k: 'price' }, ...(hai ? [{ k: 'price2' } as const] : []), {
        k: 'prev',
      })
    else if (c.key === '@amount')
      shown.push({ k: 'amount' }, ...(gop ? [{ k: 'lenh' } as const] : []))
  }
  const amountIdx = shown.findIndex((s) => s.k === 'amount')
  const after = shown.length - amountIdx - 1
  /*
    Thành tiền là cột CUỐI (mọi mẫu trừ gỗ, phụ tùng) thì ghim mép phải: mẫu
    carton cần tối thiểu ~1.150px, laptop phóng 125% phải cuộn ngang — cuộn
    thì tên vật tư trôi đi được, tiền thì không.
  */
  const stick = after === 0 ? 'sticky right-0 z-[1] shadow-[-1px_0_0_var(--hair)]' : ''

  const head = (s: Shown): { t: string; w?: number; num?: boolean } => {
    switch (s.k) {
      case 'stt': return { t: '', w: 30, num: true }
      case 'name': return { t: 'Tên vật tư' }
      case 'product': return { t: 'Mã SP', w: 88 }
      case 'unit': return { t: 'ĐVT', w: 60 }
      case 'qty': return { t: PO_PRINT_QTY_LABEL[t], w: 92, num: true }
      case 'qty2': return { t: 'Quy đổi', w: 104, num: true }
      case 'price': return { t: priceLabel, w: 120, num: true }
      case 'price2': return { t: `Đơn giá /${hai?.dv}`, w: 112, num: true }
      case 'prev': return { t: 'Giá lần trước', w: 118, num: true }
      case 'amount': return { t: `Thành tiền (${currency})`, w: 124, num: true }
      case 'lenh': return { t: 'Chia lệnh', w: 150 }
      case 'field': return { t: s.c.label, num: s.c.right }
    }
  } // prettier-ignore

  const footRow = (label: React.ReactNode, value: number, strong: 'b' | 's' | 'n') => (
    <tr className="bg-[var(--surface-raised)]">
      <td
        colSpan={amountIdx}
        className={cn(
          'border-t px-2 text-right',
          strong === 'n'
            ? 'h-[26px] border-[var(--hair)]'
            : 'h-[30px] border-[var(--line)]',
          strong === 'b' ? 'font-bold' : strong === 's' && 'font-semibold',
        )}
      >
        {label}
      </td>
      <td
        className={cn(
          'num border-t bg-[var(--surface-raised)] px-2 text-right whitespace-nowrap',
          stick,
          strong === 'n' ? 'border-[var(--hair)]' : 'border-[var(--line)]',
          strong === 'b' ? 'font-bold' : strong === 's' && 'font-semibold',
        )}
      >
        {money(value, currency)}
      </td>
      {after > 0 && <td colSpan={after} className="border-t border-[var(--hair)]" />}
    </tr>
  )

  return (
    <div className="overflow-x-auto">
      <table className="text-k-body w-full border-collapse">
        <thead>
          <tr>
            {shown.map((s, i) => {
              const h = head(s)
              return (
                <th
                  key={i}
                  style={{
                    width: h.w,
                    textAlign: h.num ? 'right' : 'left',
                    whiteSpace: 'normal',
                  }}
                  className={cn(
                    s.k === 'amount' && stick,
                    'text-k-label min-h-[26px] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 align-bottom leading-tight font-bold tracking-[.04em] text-[var(--ink-label)] uppercase',
                  )}
                >
                  {h.t}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {lines.map((ln, i) => {
            const cmp = comparePrice(ln, lastPrices, currency)
            /* Ngưỡng 5%: dưới mức đó là dao động thường ngày của thị trường,
               tô màu mọi chênh lệch thì cột này thành một dải màu vô nghĩa. */
            const tang = cmp != null && cmp.pct >= 5
            const giam = cmp != null && cmp.pct <= -5
            const note = ln.note?.trim()
            return (
              <tr
                key={ln.id}
                className={cn(
                  'border-b border-[var(--hair)] align-top',
                  tang && 'bg-[var(--warn-wash)]',
                )}
              >
                {shown.map((s, j) => {
                  switch (s.k) {
                    case 'stt':
                      return <td key={j} className="num px-2 py-[6px] text-right text-[var(--ink-3)]">{i + 1}</td> // prettier-ignore
                    case 'name':
                      return (
                        <td key={j} className="min-w-[200px] px-2 py-[6px]">
                          <div>{ln.material_name}</div>
                          <div className="num text-k-label text-[var(--ink-3)]" style={{ textAlign: 'left' }}>
                            {ln.material_code}
                            {!specHasCol && ln.spec ? ' · ' + ln.spec : ''}
                          </div>
                          {note && (
                            <div className="text-k-sm mt-1 flex items-start gap-1.5 border-l-2 border-[var(--line)] bg-[var(--surface-raised)] px-1.5 py-0.5 whitespace-pre-wrap text-[var(--ink)]">
                              <Ico name="ghiChu" size={12} className="mt-[3px] shrink-0 text-[var(--ink-3)]" aria-label="Ghi chú dòng" />
                              <span className="min-w-0">{note}</span>
                            </div>
                          )}
                        </td>
                      ) // prettier-ignore
                    case 'product':
                      return <td key={j} className="num px-2 py-[6px]" style={{ textAlign: 'left' }}>{ln.product_code ?? ''}</td> // prettier-ignore
                    case 'unit':
                      return <td key={j} className="px-2 py-[6px] whitespace-nowrap">{ln.material_unit}</td> // prettier-ignore
                    case 'qty':
                      return <td key={j} className="num px-2 py-[6px] text-right">{Number(ln.qty_ordered).toLocaleString('vi-VN')}</td> // prettier-ignore
                    case 'qty2':
                      return (
                        <td key={j} className="num px-2 py-[6px] text-right whitespace-nowrap text-[var(--act)]">
                          {ln.qty2 != null ? Number(ln.qty2).toLocaleString('vi-VN') + ' ' + (ln.unit2 ?? '') : '—'}
                        </td>
                      ) // prettier-ignore
                    case 'price':
                      if (hai) return <td key={j} className="num px-2 py-[6px] text-right whitespace-nowrap"><HaiGiaKy t={t} ln={ln} cot="dvt" currency={currency} /></td> // prettier-ignore
                      return (
                        <td key={j} className="num px-2 py-[6px] text-right whitespace-nowrap">
                          {ln.unit_price != null ? (
                            <>
                              {fmtVnd(ln.unit_price)}
                              <span className="text-k-label text-[var(--ink-3)]">{priceSuffix(ln)}</span>
                            </>
                          ) : (
                            <span className="text-[var(--warn)]">chưa có</span>
                          )}
                        </td>
                      ) // prettier-ignore
                    case 'price2':
                      return <td key={j} className="num px-2 py-[6px] text-right whitespace-nowrap"><HaiGiaKy t={t} ln={ln} cot="dv2" currency={currency} /></td> // prettier-ignore
                    case 'prev':
                      return (
                        <td key={j} className="px-2 py-[6px] text-right whitespace-nowrap">
                          <PrevPrice ln={ln} cmp={cmp} tang={tang} giam={giam} currency={currency} />
                        </td>
                      ) // prettier-ignore
                    case 'amount':
                      return <td key={j} className={cn('num px-2 py-[6px] text-right font-semibold whitespace-nowrap', stick, tang ? 'bg-[var(--warn-wash)]' : 'bg-[var(--surface-card)]')}>{ln.unit_price != null ? fmtVnd(poLineAmount(ln)) : '—'}</td> // prettier-ignore
                    case 'lenh':
                      return <td key={j} className="px-2 py-[6px]"><ChiaLenhKy ln={ln} lsx={gop!} /></td> // prettier-ignore
                    case 'field': {
                      const v = s.c.text(ln)
                      return (
                        <td
                          key={j}
                          className={cn(
                            'px-2 py-[6px]',
                            s.c.right
                              ? 'num text-right whitespace-nowrap'
                              : 'max-w-[200px] min-w-[72px]',
                          )}
                        >
                          {v || <span className="text-[var(--ink-3)]">—</span>}
                        </td>
                      )
                    }
                  }
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          {footRow(
            m ? `Tiền hàng · ${lines.length} dòng` : `Tổng cộng ${lines.length} dòng`,
            m ? m.subtotal : total,
            m ? 's' : 'b',
          )}
          {m && m.discount > 0 && footRow('Chiết khấu', -m.discount, 'n')}
          {m &&
            footRow(
              m.includes_vat
                ? `VAT ${m.vat_rate}% (đã gồm trong giá)`
                : `VAT ${m.vat_rate}%`,
              m.vat_amount,
              'n',
            )}
          {m && footRow('Tổng thanh toán', m.grand, 'b')}
          {/*
            CHÂN BẢNG NÓI PHẦN KHÔNG BAO GỒM — luật "số nào không kiểm được thì
            không ai tin". Dòng thiếu giá không vào tổng, mà người ký nhìn tổng
            rồi quyết chi; không nói ra thì họ ký một con số nhỏ hơn sự thật.
          */}
          {missingPrice > 0 && (
            <tr>
              <td
                colSpan={shown.length}
                className="text-k-label px-2 py-[5px] text-[var(--warn)]"
              >
                Tổng CHƯA gồm {missingPrice} dòng chưa có đơn giá.
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  )
}

function PrevPrice({
  ln,
  cmp,
  tang,
  giam,
  currency,
}: {
  ln: ApprovalPoLine
  cmp: ReturnType<typeof comparePrice>
  tang: boolean
  giam: boolean
  currency: string
}) {
  if (cmp == null) {
    return (
      <span className="text-k-label text-[var(--ink-3)]">
        {ln.unit_price == null ? '—' : !ln.material_id ? 'dòng tự do' : 'chưa từng mua'}
      </span>
    )
  }
  return (
    <span
      title={`Lần trước ${fmtVnd(cmp.prev)} ${currency} — đơn ${cmp.poCode}`}
      className={cn(
        'num text-k-sm inline-flex items-center justify-end gap-1',
        tang
          ? 'font-semibold text-[var(--warn)]'
          : giam
            ? 'text-[var(--done)]'
            : 'text-[var(--ink-3)]',
      )}
    >
      {tang && <ArrowUp className="size-[12px]" aria-hidden />}
      {giam && <ArrowDown className="size-[12px]" aria-hidden />}
      {fmtVnd(cmp.prev)}
      <span>
        {' · '}
        {Math.abs(cmp.pct) < 0.1 ? 'không đổi' : (cmp.pct > 0 ? '+' : '') + cmp.pct + '%'}
      </span>
    </span>
  )
}

/** Một ô của HAI CỘT GIÁ ở màn ký — số tính tiền đậm, số quy đổi nhạt kèm đơn vị. */
function HaiGiaKy({
  t,
  ln,
  cot,
  currency,
}: {
  t: Parameters<typeof poHaiGia>[0]
  ln: ApprovalPoLine
  cot: 'dvt' | 'dv2'
  currency: string
}) {
  if (ln.unit_price == null) return <span className="text-[var(--warn)]">chưa có</span>
  const g = poHaiGia(t, ln)
  if (!g) return null
  const v = cot === 'dvt' ? g.donGia : g.gia2
  const dv = cot === 'dvt' ? ln.material_unit.trim().toLowerCase() : g.dv
  if (v == null) {
    return (
      <span
        className="text-k-label text-[var(--ink-3)]"
        title="Dòng thiếu số quy đổi (kg/m, m³/SP, m²/tấm…)"
      >
        —
      </span>
    )
  }
  const tinh = g.theo === cot
  return (
    <span
      className={tinh ? undefined : 'text-[var(--ink-3)]'}
      title={tinh ? 'Tiền dòng tính theo giá này' : 'Số quy đổi — tiền tính theo cột kia'}
    >
      {fmtVnd(roundMoney(v, currency))}
      <span className="text-k-label text-[var(--ink-3)]">/{dv}</span>
    </span>
  )
}

/** Ô "Chia lệnh" ở màn ký — mỗi lệnh một dòng; chưa chia thì nói đang tính cho lệnh chính. */
function ChiaLenhKy({
  ln,
  lsx,
}: {
  ln: ApprovalPoLine
  lsx: { id: string; code: string }[]
}) {
  const sp = (ln.lsx_split ?? []).filter((s) => Number(s.qty) > 0)
  if (sp.length === 0) {
    return (
      <span className="text-k-label text-[var(--warn)]" title="Dòng chưa chia nên tính TRỌN cho lệnh chính — lệnh phụ thấy như chưa đặt">
        chưa chia · cả dòng → {lenhNgan(lsx[0].code)}
      </span>
    ) // prettier-ignore
  }
  return (
    <div className="num text-k-sm leading-tight" style={{ textAlign: 'left' }}>
      {lsx.map((x) => {
        const q = qtyForLsx(x.id, { qty_ordered: Number(ln.qty_ordered), main_lsx_id: lsx[0].id, allocations: sp }) // prettier-ignore
        return q > 0 ? (
          <div key={x.id} className="whitespace-nowrap">
            <span className="text-[var(--ink-3)]">{lenhNgan(x.code)}</span>{' '}
            {q.toLocaleString('vi-VN')}
          </div>
        ) : null
      })}
    </div>
  )
}
