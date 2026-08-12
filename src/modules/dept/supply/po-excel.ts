import ExcelJS from 'exceljs'
import {
  currencyDecimals,
  packCount,
  poLineAmount,
  poMoney,
  qtyTotals,
  roundMoney,
} from '@/lib/po-line'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import {
  PO_PRICE_SUFFIX_TEMPLATES,
  PO_PRINT_ORDER,
  PO_PRINT_QTY_LABEL,
  poField,
  poPriceSuffix,
} from '@/lib/po-fields'
import type {
  PoPrintHeader,
  PoPrintLine,
  PoPrintSupplier,
} from '@/app/print/supply/PoPrintSheet'

/**
 * XUẤT EXCEL đơn đặt hàng — file .xlsx bày GIỐNG HỆT phiếu in (PoPrintSheet),
 * theo đơn ĐH chuẩn 08/2026 của phòng Cung ứng: đầu phiếu công ty + quốc hiệu,
 * khung Số ĐH/LSX, bảng hàng nền tiêu đề VÀNG với cột Đơn giá + Thời gian giao
 * hàng chữ ĐỎ, khối tổng (Tổng số KG → TỔNG THANH TOÁN tô vàng), điều khoản,
 * câu đề nghị fax và ba cột chữ ký.
 *
 * Bộ cột đọc từ CÙNG khai báo `PO_PRINT_ORDER`/`PO_FIELDS` với phiếu in — thêm
 * mẫu đơn hay đổi nhãn là hai bản cùng đổi. SL/đơn giá/thành tiền ghi dạng SỐ
 * thật để phòng còn SUM/sửa tiếp trên file.
 */

const RED = 'FFDC2626' // text-red-600
const HEAD_FILL = 'FFFEF08A' // bg-yellow-200 — hàng tiêu đề + ô tổng
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

type XCol = {
  label: string
  width: number
  /** Nhãn đỏ trên hàng tiêu đề (Đơn giá, Thời gian giao hàng). */
  red?: boolean
  align: 'left' | 'right' | 'center'
  /** Ô số thật — gắn numFmt ngăn cách nghìn. */
  num?: boolean
  /**
   * Đè numFmt theo từng dòng. Dùng cho quy đổi đóng gói: ô VẪN là số thật (phòng
   * còn SUM/sửa) nhưng hiện thêm phần đuôi `13.596 (= 28 bì)` — nhét chuỗi vào
   * `value` thì mất luôn khả năng cộng.
   */
  numFmtFor?: (l: PoPrintLine) => string | undefined
  isAmount?: boolean
  value: (l: PoPrintLine, i: number) => ExcelJS.CellValue
}

const nOrNull = (v: number | null | undefined) => (v == null ? '' : v)

/**
 * Định dạng số cho ô SL đặt khi dòng có chụp ĐÓNG GÓI MUA (0128): giữ ô là số
 * thật, phần quy đổi đi vào phần literal của numFmt — `13.596 (= 28 bì)`.
 *
 * Dấu ngoặc kép trong tên đơn vị sẽ làm hỏng chuỗi định dạng nên bỏ hẳn; đơn vị
 * đóng gói thực tế chỉ là bì/bó/bao/thùng.
 */
function packSuffixFormat(l: PoPrintLine): string | undefined {
  const packs = packCount(l.qty_ordered, l.pack_size ?? null)
  const unit = (l.pack_unit ?? '').replace(/"/g, '').trim()
  if (packs == null || !unit) return undefined
  const eq = Number.isInteger(packs) ? '=' : '≈'
  return `#,##0" (${eq} ${packs.toLocaleString('vi-VN')} ${unit})"`
}

/**
 * Bộ cột GIÁ TRỊ THUẦN cho Excel — cùng thứ tự/nhãn với `columnsFor` của phiếu
 * in (đọc chung PO_PRINT_ORDER), chỉ khác là trả số/chuỗi thay vì ReactNode.
 */
function excelColumns(
  t: PoTemplate,
  currency: string,
  ctx: { lsxCode: string | null; orderDate: Date; expectedAt: string | null },
): XCol[] {
  const meta = poTemplateMeta(t)
  const dmy = (d: Date) => d.toLocaleDateString('vi-VN')
  // Ô TIỀN theo tiền tệ của đơn: VND "#,##0", USD/EUR/CNY thêm 2 số lẻ cent.
  const moneyFmt = currencyDecimals(currency) > 0 ? '#,##0.00' : '#,##0'
  const fixed: Record<string, XCol> = {
    '@stt': { label: 'STT', width: 5, align: 'center', value: (_l, i) => i + 1 },
    '@lsx': {
      label: 'LSX',
      width: 13,
      align: 'center',
      value: () => ctx.lsxCode ?? '',
    },
    '@code': {
      label: 'Mã sản phẩm',
      width: 12,
      align: 'center',
      value: (l) => l.material_code,
    },
    '@name': {
      label: 'Tên sản phẩm / vật tư',
      width: 24,
      align: 'left',
      value: (l) => l.material_name,
    },
    '@unit': { label: 'ĐVT', width: 7, align: 'center', value: (l) => l.material_unit },
    '@orderdate': {
      label: 'Ngày đặt hàng',
      width: 12,
      align: 'center',
      value: () => dmy(ctx.orderDate),
    },
    '@delivery': {
      label: 'Thời gian giao hàng',
      width: 12,
      red: true,
      align: 'center',
      value: () => (ctx.expectedAt ? dmy(new Date(ctx.expectedAt)) : ''),
    },
    '@qty': {
      label: PO_PRINT_QTY_LABEL[t],
      width: 10,
      align: 'right',
      num: true,
      value: (l) => l.qty_ordered,
      numFmtFor: (l) => packSuffixFormat(l),
    },
    '@price': PO_PRICE_SUFFIX_TEMPLATES.includes(t)
      ? {
          // Mẫu chốt cơ sở tính tiền TỪNG DÒNG — đơn giá kèm /thùng·/m²·/m³·/kg.
          label: `Đơn giá (${currency})`,
          width: 13,
          red: true,
          align: 'right',
          value: (l) =>
            l.unit_price != null
              ? `${Number(l.unit_price).toLocaleString('vi-VN')}${poPriceSuffix(t, l.carton_basis)}`
              : '',
        }
      : {
          label: meta.priceUnit
            ? `Đơn giá (${currency}/${meta.priceUnit})`
            : `Đơn giá (${currency})`,
          width: 12,
          red: true,
          align: 'right',
          num: true,
          numFmtFor: () => moneyFmt,
          value: (l) => nOrNull(l.unit_price),
        },
    '@amount': {
      label: `Thành tiền (${currency})`,
      width: 14,
      align: 'right',
      num: true,
      numFmtFor: () => moneyFmt,
      isAmount: true,
      // Tròn theo tiền tệ — VND về đồng, USD giữ cent ($700.21 phải ra .21).
      value: (l) => (l.unit_price != null ? roundMoney(poLineAmount(l), currency) : ''),
    },
    '@note': { label: 'Ghi chú', width: 22, align: 'left', value: (l) => l.note ?? '' },
  }

  return PO_PRINT_ORDER[t].map((key) => {
    const hit = fixed[key]
    if (hit) return hit
    const f = poField(t, key)!
    const get = (l: PoPrintLine) =>
      f.field ? (l as unknown as Record<string, unknown>)[f.field] : null
    const base = {
      label: f.printLabel ?? f.label,
      width: f.kind === 'text' ? 14 : 10,
      align: (f.align === 'right' ? 'right' : f.kind === 'text' ? 'left' : 'center') as
        'left' | 'right' | 'center',
    }
    switch (f.kind) {
      case 'number':
      case 'area':
        return { ...base, num: true, value: (l) => nOrNull(get(l) as number | null) }
      case 'calc':
        return { ...base, num: true, align: 'right', value: (l) => nOrNull(l.qty2) }
      case 'inner':
        return {
          ...base,
          width: 14,
          value: (l) =>
            l.inner_l_mm && l.inner_w_mm && l.inner_h_mm
              ? `${l.inner_l_mm}×${l.inner_w_mm}×${l.inner_h_mm}`
              : '',
        }
      default:
        // 'dim' của mẫu inox/sắt: chưa nhập thì lấy tạm quy cách chung — như in.
        if (f.key === 'dim')
          return { ...base, value: (l) => l.dimension_text ?? l.spec ?? '' }
        return { ...base, value: (l) => (get(l) as string | null) ?? '' }
    }
  })
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export async function buildPoExcel(input: {
  company: Record<string, string | null>
  po: PoPrintHeader
  supplier: PoPrintSupplier
  lines: PoPrintLine[]
}): Promise<Buffer> {
  const { company, po, supplier, lines } = input
  const template = po.template ?? 'simple'
  const d = new Date(po.created_at)
  // Đơn NGOÀI LSX: bỏ cột LSX như phiếu in.
  const cols = excelColumns(template, po.currency, {
    lsxCode: po.lsx_code,
    orderDate: d,
    expectedAt: po.expected_at,
  }).filter((c) => c.label !== 'LSX' || po.lsx_code)
  const n = cols.length
  const amountIdx = cols.findIndex((c) => c.isAmount) // 0-based

  /* Tổng SL — cùng quy tắc với phiếu in: mẫu kg cộng tổng kg (một dòng), còn
     lại cộng SL đặt TÁCH THEO ĐVT (`qtyTotals`). */
  const kgBased = template === 'aluminium' || template === 'metal_kg'
  const qtyTotalRows = qtyTotals(kgBased, lines)
  const qtyTotalIdx = kgBased
    ? cols.findIndex((c) => c.label === 'Tổng kg')
    : cols.findIndex((c) => c.label === PO_PRINT_QTY_LABEL[template])

  // Khối tiền dùng CHUNG `poMoney` với form/chi tiết/phiếu in — tròn theo
  // tiền tệ của đơn (VND về đồng, USD về cent).
  const rate = Number(po.vat_rate ?? 0)
  const {
    subtotal,
    discountAmount: discount,
    vatAmount,
    grandTotal,
  } = poMoney({
    subtotalRaw: lines.reduce((s, l) => s + poLineAmount(l), 0),
    discount: po.discount_amount,
    vatRate: po.vat_rate,
    priceIncludesVat: po.price_includes_vat,
    currency: po.currency,
  })
  const moneyTotalFmt = currencyDecimals(po.currency) > 0 ? '#,##0.00' : '#,##0'

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Đơn đặt hàng', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  })
  ws.columns = cols.map((c) => ({ width: c.width }))

  const set = (
    row: number,
    col: number,
    value: ExcelJS.CellValue,
    style?: Partial<ExcelJS.Style>,
  ) => {
    const cell = ws.getCell(row, col)
    cell.value = value
    if (style) Object.assign(cell, style)
    return cell
  }

  /* ── Đầu phiếu: công ty trái, quốc hiệu + ngày phải ─────────────────────── */
  const rightStart = Math.max(2, n - 3)
  let r = 1
  ws.mergeCells(r, 1, r, rightStart - 1)
  set(r, 1, (company.company_name ?? '').toUpperCase(), {
    font: { bold: true, size: 11 },
  })
  ws.mergeCells(r, rightStart, r, n)
  set(r, rightStart, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', {
    font: { bold: true, size: 11 },
    alignment: { horizontal: 'center' },
  })
  r++
  ws.mergeCells(r, 1, r, rightStart - 1)
  set(r, 1, company.company_address ? `Địa chỉ: ${company.company_address}` : '', {
    font: { size: 10 },
  })
  ws.mergeCells(r, rightStart, r, n)
  set(r, rightStart, 'Độc lập – Tự do – Hạnh phúc', {
    font: { bold: true, size: 10, underline: true },
    alignment: { horizontal: 'center' },
  })
  r++
  ws.mergeCells(r, 1, r, rightStart - 1)
  set(
    r,
    1,
    [
      company.company_tax_code && `MST: ${company.company_tax_code}`,
      company.company_phone && `SĐT: ${company.company_phone}`,
      company.company_fax && `Fax: ${company.company_fax}`,
    ]
      .filter(Boolean)
      .join('      '),
    { font: { size: 10 } },
  )
  ws.mergeCells(r, rightStart, r, n)
  const locality = company.company_locality?.trim()
  set(
    r,
    rightStart,
    `${locality ? `${locality}, ` : ''}ngày ${pad2(d.getDate())} tháng ${pad2(d.getMonth() + 1)} năm ${d.getFullYear()}`,
    { font: { italic: true, size: 10 }, alignment: { horizontal: 'center' } },
  )

  /* ── Tiêu đề + khung số hiệu ────────────────────────────────────────────── */
  r += 2
  ws.mergeCells(r, 1, r, n)
  set(r, 1, 'ĐƠN ĐẶT HÀNG', {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'center' },
  })
  r++
  ws.mergeCells(r, 1, r, n)
  set(r, 1, 'PURCHASE ORDER', {
    font: { italic: true, size: 10 },
    alignment: { horizontal: 'center' },
  })

  // Khung Số ĐH / LSX bên phải — mỗi dòng một ngăn, kẻ viền như mẫu.
  const refs: string[] = [
    `Số ĐH : ${po.code}`,
    ...(po.contract_no ? [`Theo HD số: ${po.contract_no}`] : []),
    ...(po.lsx_code ? [`LSX ${po.lsx_code}`] : []),
    ...(po.order_code ? [`Đơn hàng: ${po.order_code}`] : []),
  ]
  let refRow = r + 1
  for (const text of refs) {
    ws.mergeCells(refRow, rightStart, refRow, n)
    set(refRow, rightStart, text, {
      font: { bold: text.startsWith('Số ĐH'), size: 10 },
      alignment: { horizontal: 'center' },
      border: BORDER,
    })
    refRow++
  }

  /* ── Kính gửi NCC (trái, cùng dải dòng với khung số hiệu) ───────────────── */
  const meta: [string, string | null | undefined, boolean?][] = [
    ['Kính gửi:', supplier?.name ?? po.supplier_name, true],
    ['Địa chỉ:', supplier?.address],
    ['MST:', supplier?.tax_no],
    ['Người liên hệ:', supplier?.phone],
  ]
  r++
  for (const [label, value, bold] of meta) {
    if (!value) continue
    set(r, 1, label, { font: { size: 10 } })
    ws.mergeCells(r, 2, r, rightStart - 1)
    set(r, 2, value, { font: { bold: !!bold, size: 10 } })
    r++
  }
  r = Math.max(r, refRow)
  ws.mergeCells(r, 1, r, n)
  set(r, 1, `${company.company_name ?? ''} cần đặt hàng sản phẩm sau:`, {
    font: { size: 10 },
  })

  /* ── Bảng hàng: tiêu đề vàng, Đơn giá + Thời gian giao chữ đỏ ───────────── */
  r++
  const headRow = r
  cols.forEach((c, ci) => {
    set(r, ci + 1, c.label, {
      font: { bold: true, size: 9, color: c.red ? { argb: RED } : undefined },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } },
      border: BORDER,
    })
  })
  ws.getRow(headRow).height = 26

  lines.forEach((l, i) => {
    r++
    cols.forEach((c, ci) => {
      set(r, ci + 1, c.value(l, i), {
        font: { size: 9 },
        alignment: { horizontal: c.align, vertical: 'middle', wrapText: true },
        border: BORDER,
        ...(c.num ? { numFmt: c.numFmtFor?.(l) ?? '#,##0' } : null),
      })
    })
  })

  /* ── Tổng số KG / khối tiền — như phiếu in ──────────────────────────────── */
  if (qtyTotalIdx > 0) {
    for (const t of qtyTotalRows) {
      r++
      ws.mergeCells(r, 1, r, qtyTotalIdx)
      set(r, 1, t.label, {
        font: { bold: true, size: 9 },
        alignment: { horizontal: 'right' },
        border: BORDER,
      })
      set(r, qtyTotalIdx + 1, t.value, {
        font: { bold: true, size: 9 },
        alignment: { horizontal: 'right' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } },
        border: BORDER,
        numFmt: '#,##0',
      })
      if (qtyTotalIdx + 2 <= n) {
        ws.mergeCells(r, qtyTotalIdx + 2, r, n)
        set(r, qtyTotalIdx + 2, '', { border: BORDER })
      }
    }
  }

  const totals: [string, string | null, number, boolean][] = [
    ['Cộng tiền hàng:', null, subtotal, false],
    ['Chiết khấu:', null, discount, false],
    [
      'Thuế GTGT:',
      rate ? `${rate}%${po.price_includes_vat ? ' (đã gồm)' : ''}` : null,
      vatAmount,
      false,
    ],
    ['TỔNG THANH TOÁN:', null, grandTotal, true],
  ]
  for (const [label, rateText, value, isGrand] of totals) {
    r++
    ws.mergeCells(r, 1, r, amountIdx - 1)
    set(r, 1, label, {
      font: { bold: true, size: 9 },
      alignment: { horizontal: 'right' },
      border: BORDER,
    })
    set(r, amountIdx, rateText ?? '', {
      font: { size: 9 },
      alignment: { horizontal: 'right' },
      border: BORDER,
    })
    set(r, amountIdx + 1, label === 'Chiết khấu:' && value === 0 ? '-' : value, {
      font: { bold: true, size: 9 },
      alignment: { horizontal: 'right' },
      border: BORDER,
      numFmt: moneyTotalFmt,
      ...(isGrand
        ? {
            fill: {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              fgColor: { argb: HEAD_FILL },
            },
          }
        : null),
    })
    if (amountIdx + 2 <= n) {
      ws.mergeCells(r, amountIdx + 2, r, n)
      set(r, amountIdx + 2, '', { border: BORDER })
    }
  }

  /* ── Điều khoản + ghi chú + câu đề nghị fax ─────────────────────────────── */
  const terms: [string, string | null][] = [
    ['Tiêu chuẩn chất lượng', po.terms_quality],
    ['Địa điểm giao hàng', po.terms_delivery_place],
    ['Hình thức thanh toán', po.terms_payment],
    ['Chứng từ thanh toán', po.terms_invoice],
    ['Thời gian giao hàng', po.terms_lead_time],
  ].filter(([, v]) => v && v.trim()) as [string, string][]
  if (terms.length > 0) {
    r += 2
    ws.mergeCells(r, 1, r, n)
    set(r, 1, 'ĐIỀU KHOẢN & YÊU CẦU', { font: { bold: true, size: 10 } })
    for (const [label, value] of terms) {
      r++
      ws.mergeCells(r, 1, r, n)
      set(r, 1, `${label}: ${value}`, { font: { size: 10 } })
    }
  }
  r++
  ws.mergeCells(r, 1, r, n)
  set(
    r,
    1,
    `Đơn giá trên ${po.price_includes_vat ? 'ĐÃ bao gồm' : 'CHƯA bao gồm'} thuế VAT${po.vat_rate != null ? ` ${po.vat_rate}%` : ''}.`,
    { font: { bold: true, size: 10 } },
  )
  if (po.note) {
    r++
    ws.mergeCells(r, 1, r, n)
    set(r, 1, po.note, { font: { italic: true, size: 10 } })
  }
  r++
  ws.mergeCells(r, 1, r, n)
  set(
    r,
    1,
    'Đề nghị Quý công ty fax lại xác nhận thông tin cho công ty chúng tôi. Xin cảm ơn!',
    {
      font: { italic: true, size: 10 },
    },
  )

  /* ── Ba cột chữ ký ──────────────────────────────────────────────────────── */
  r += 2
  const third = Math.max(1, Math.floor(n / 3))
  const signs: [string, string, number, number][] = [
    ['XÁC NHẬN CỦA NHÀ CUNG CẤP', '(Ký, ghi rõ họ tên, đóng dấu)', 1, third],
    [
      po.signer_role ?? poTemplateMeta(template).signerRole,
      '(Ký, ghi rõ họ tên)',
      third + 1,
      third * 2,
    ],
    [
      (company.company_name ?? 'GIÁM ĐỐC').toUpperCase(),
      '(Ký tên, đóng dấu)',
      third * 2 + 1,
      n,
    ],
  ]
  for (const [role, , a, b] of signs) {
    ws.mergeCells(r, a, r, b)
    set(r, a, role, {
      font: { bold: true, size: 10 },
      alignment: { horizontal: 'center' },
    })
  }
  r++
  for (const [, hint, a, b] of signs) {
    ws.mergeCells(r, a, r, b)
    set(r, a, hint, {
      font: { italic: true, size: 9 },
      alignment: { horizontal: 'center' },
    })
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}

/** Tên file tải về — mã đơn chứa "/" nên phải làm sạch ký tự cấm. */
export const poExcelFilename = (code: string) =>
  `DH ${code.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`
