import { poLineAmount } from '@/lib/po-line'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import {
  PO_PRINT_ORDER,
  PO_PRINT_QTY_LABEL,
  poField,
  type PoField,
} from '@/lib/po-fields'
import {
  PrintLetterhead,
  PrintMeta,
  PrintPage,
  PrintSignatures,
  PrintTerms,
  PrintTitle,
  type PrintCompany,
} from '../PrintSheet'

/**
 * TỜ ĐƠN ĐẶT HÀNG — phần thân, THUẦN HIỂN THỊ, không đụng DB.
 *
 * Tách khỏi trang in để dùng được ở HAI chỗ:
 *   · `/print/supply/[id]` — đơn đã lưu, dữ liệu từ DB
 *   · nút "Xem trước phiếu in" trên form soạn đơn — dựng từ BẢN NHÁP đang gõ
 *
 * Một component cho cả hai là điều kiện để xem trước có giá trị: hai bản dựng
 * riêng thì bản xem trước sẽ trôi khỏi bản in thật, và người dùng tin vào thứ
 * không phải cái sẽ gửi NCC.
 */

/** Dòng hàng ở dạng phiếu in cần — khớp `PoLine` của repo, và dựng được từ nháp. */
export type PoPrintLine = {
  id: string
  material_code: string
  material_name: string
  material_unit: string
  qty_ordered: number
  unit_price: number | null
  price_basis: 'unit' | 'unit2'
  qty2: number | null
  spec: string | null
  note: string | null
  material_grade: string | null
  dm_per_sp: number | null
  qty_demand: number | null
  qty_on_hand: number | null
  die_code: string | null
  weight_per_m: number | null
  bar_length_m: number | null
  dimension_text: string | null
  finish: string | null
  weight_per_unit: number | null
  open_style: string | null
  pcs_per_ctn: number | null
  inner_l_mm: number | null
  inner_w_mm: number | null
  inner_h_mm: number | null
  area_m2: number | null
  carton_basis: 'ctn' | 'm2' | null
}

/** Đầu đơn ở dạng phiếu in cần. */
export type PoPrintHeader = {
  code: string
  template: PoTemplate
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  discount_amount: number | null
  contract_no: string | null
  expected_at: string | null
  note: string | null
  terms: string | null
  terms_quality: string | null
  terms_delivery_place: string | null
  terms_payment: string | null
  terms_invoice: string | null
  terms_lead_time: string | null
  signer_role: string | null
  lsx_code: string | null
  order_code: string | null
  supplier_name: string
  created_at: string
}

export type PoPrintSupplier = {
  name: string
  address?: string | null
  tax_no?: string | null
  phone?: string | null
} | null

const fmt = (n: number | null | undefined) =>
  n == null ? '' : Number(n).toLocaleString('vi-VN')

type Col = {
  label: string
  /** Nội dung ô — trả '' cho ô trống, KHÔNG trả '0' (phiếu gửi NCC đọc rối). */
  cell: (l: PoPrintLine, i: number) => React.ReactNode
  align?: 'left' | 'right'
  /** Cột này là nơi in dòng tổng cộng ở cuối bảng. */
  isAmount?: boolean
}

const colStt: Col = { label: 'STT', cell: (_l, i) => i + 1 }
/*
 * NHÃN CỘT LẤY ĐÚNG CHỮ CỦA "FORM ĐẶT HÀNG MỚI".
 *
 * Đối chiếu 45 sheet đơn thật trong sổ Cung ứng: mọi sheet theo form mới đều gọi
 * cột này là "Tên sản phẩm / vật tư", và hai cột tiền luôn kèm đơn vị tiền trong
 * ngoặc — "Đơn giá (VND)", "Thành tiền (VND)". Trước đây phiếu app gọi "Tên vật
 * tư" / "Đơn giá" / "Thành tiền", lại thêm "Đơn giá / kg" riêng cho hai mẫu tính
 * theo khối lượng, nên năm mẫu in ra đọc như năm biểu mẫu khác nhau.
 */
const colName: Col = {
  label: 'Tên sản phẩm / vật tư',
  align: 'left',
  cell: (l) => (
    <>
      {l.material_name}
      <div className="font-mono text-[10px] text-zinc-600">{l.material_code}</div>
    </>
  ),
}
const colUnit: Col = { label: 'ĐVT', cell: (l) => l.material_unit }
const colNote: Col = { label: 'Ghi chú', cell: (l) => l.note ?? '', align: 'left' }
const amountCol = (currency: string): Col => ({
  label: `Thành tiền (${currency})`,
  align: 'right',
  isAmount: true,
  cell: (l) => (l.unit_price != null ? fmt(Math.round(poLineAmount(l))) : ''),
})
const priceCol = (currency: string, unit: string | null): Col => ({
  // Giữ "/kg" trong ngoặc chứ không bỏ hẳn: mẫu nhôm và inox tính tiền bằng
  // (tổng kg × đơn giá), NCC phải thấy giá là giá theo kg mới đối chiếu được
  // báo giá của chính họ. Dạng ngoặc giữ cho nhãn cùng khuôn với các mẫu khác.
  label: unit ? `Đơn giá (${currency}/${unit})` : `Đơn giá (${currency})`,
  align: 'right',
  cell: (l) => fmt(l.unit_price),
})
/** Giá trị in của một cột khai báo — chuyển `kind` thành chữ trên giấy. */
function printCell(f: PoField): (l: PoPrintLine) => React.ReactNode {
  const get = (l: PoPrintLine) =>
    f.field ? (l as unknown as Record<string, unknown>)[f.field] : null
  switch (f.kind) {
    case 'text':
    case 'die':
    case 'openStyle':
      return (l) => (get(l) as string | null) ?? ''
    case 'number':
    case 'area':
      return (l) => fmt(get(l) as number | null)
    case 'calc':
      return (l) => fmt(l.qty2)
    case 'inner':
      return (l) =>
        l.inner_l_mm && l.inner_w_mm && l.inner_h_mm
          ? `${fmt(l.inner_l_mm)}×${fmt(l.inner_w_mm)}×${fmt(l.inner_h_mm)}`
          : ''
    default:
      return () => ''
  }
}

/**
 * Bộ cột của phiếu in theo MẪU ĐƠN — thứ tự và nhãn đọc từ `PO_PRINT_ORDER`
 * (`@/lib/po-fields`), chung một khai báo với form nhập. Bộ cột này là mẫu NCC
 * đang ký nên `po-fields.test.ts` khoá lại từng nhãn, đổi là test đỏ.
 *
 * Phiếu nhôm phải có kg/m + tổng kg thì NCC mới đối chiếu barem; phiếu phụ kiện
 * phải có SL đơn hàng + tồn kho thì kho NCC mới hiểu vì sao đặt con số đó.
 */
function columnsFor(t: PoTemplate, currency: string): Col[] {
  const meta = poTemplateMeta(t)
  const fixed: Record<string, Col> = {
    '@stt': colStt,
    '@name': colName,
    '@unit': colUnit,
    '@qty': {
      label: PO_PRINT_QTY_LABEL[t],
      align: 'right',
      cell: (l) => fmt(l.qty_ordered),
    },
    '@price':
      t === 'carton'
        ? {
            // Bao bì chốt cơ sở tính tiền TỪNG DÒNG nên đơn giá phải nói rõ kèm đơn vị.
            label: `Đơn giá (${currency})`,
            align: 'right',
            cell: (l) =>
              l.unit_price != null
                ? `${fmt(l.unit_price)}${l.carton_basis === 'm2' ? '/m²' : '/thùng'}`
                : '',
          }
        : priceCol(currency, meta.priceUnit),
    '@amount': amountCol(currency),
    '@note': colNote,
  }

  return PO_PRINT_ORDER[t].map((key) => {
    const hit = fixed[key]
    if (hit) return hit
    const f = poField(t, key)!
    return {
      label: f.printLabel ?? f.label,
      align: f.align === 'right' ? 'right' : 'left',
      // "Kích thước" của mẫu inox/sắt: chưa nhập thì lấy tạm quy cách chung.
      cell:
        f.key === 'dim' ? (l: PoPrintLine) => l.dimension_text ?? l.spec ?? '' : printCell(f),
    } satisfies Col
  })
}

/**
 * In ĐƠN ĐẶT HÀNG gửi NCC — bộ cột, điều khoản và khối chữ ký ĐỔI THEO MẪU ĐƠN
 * (0106). Phòng Cung ứng dùng 5 mẫu khác nhau; in tất cả bằng một bảng chung thì
 * phiếu nhôm mất cột kg/m, phiếu bao bì mất quy cách lọt lòng, và NCC không đối
 * chiếu được với báo giá của chính họ.
 */

export function PoPrintSheet({
  company,
  po,
  supplier,
  lines,
}: {
  company: PrintCompany & { company_name?: string | null }
  po: PoPrintHeader
  supplier: PoPrintSupplier
  lines: PoPrintLine[]
}) {
  const template = po.template ?? 'simple'
  const meta = poTemplateMeta(template)
  const cols = columnsFor(template, po.currency)
  const amountIdx = cols.findIndex((c) => c.isAmount)

  // Đầu phiếu (khối công ty, quốc hiệu, dòng ngày kèm địa danh) do `PrintSheet`
  // dựng — dùng chung với báo giá, lệnh SX và phiếu kho.
  const d = new Date(po.created_at)
  // Cùng thứ tự với phiếu thật: cộng tiền hàng → chiết khấu → thuế GTGT → tổng.
  // Làm tròn về đồng ngay ở tiền hàng — phiếu gửi NCC không in số lẻ đồng.
  const subtotal = Math.round(lines.reduce((s, l) => s + poLineAmount(l), 0))
  const discount = Number(po.discount_amount ?? 0)
  const base = Math.max(0, subtotal - discount)
  const rate = Number(po.vat_rate ?? 0)
  const vatAmount = po.price_includes_vat
    ? Math.round((base * rate) / (100 + rate))
    : Math.round((base * rate) / 100)
  const grandTotal = po.price_includes_vat ? base : base + vatAmount

  const terms: [string, string | null][] = [
    ['Tiêu chuẩn chất lượng', po.terms_quality],
    ['Địa điểm giao hàng', po.terms_delivery_place],
    ['Hình thức thanh toán', po.terms_payment],
    ['Chứng từ thanh toán', po.terms_invoice],
    ['Thời gian giao hàng', po.terms_lead_time],
  ]
  const hasTerms = terms.some(([, v]) => v)
  return (
    <PrintPage>
      <PrintLetterhead company={company} date={d} />
      <PrintTitle vi="ĐƠN ĐẶT HÀNG" en="PURCHASE ORDER" />

      <PrintMeta
        rows={[
          ['Kính gửi:', <b key="n">{supplier?.name ?? po.supplier_name}</b>],
          ['Địa chỉ:', supplier?.address],
          ['MST:', supplier?.tax_no],
          ['Người liên hệ:', supplier?.phone],
        ]}
        refs={[
          ['Số ĐH :', <b key="c">{po.code}</b>],
          ['Theo HD số:', po.contract_no ?? ''],
          ...(po.lsx_code ? ([['LSX', po.lsx_code]] as [string, string][]) : []),
          ...(po.order_code
            ? ([['Đơn hàng:', po.order_code]] as [string, string][])
            : []),
        ]}
      />

      <p className="mt-2 text-[12px]">
        {company.company_name} cần đặt hàng sản phẩm sau:
      </p>

      <table className="mt-1 w-full border-collapse border border-black text-center text-[11px]">
        <thead>
          <tr className="font-semibold">
            {cols.map((c) => (
              <td key={c.label} className="border border-black px-1 py-0.5">
                {c.label}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              {cols.map((c) => (
                <td
                  key={c.label}
                  className={`border border-black px-1 ${
                    c.align === 'left'
                      ? 'text-left'
                      : c.align === 'right'
                        ? 'text-right'
                        : ''
                  }`}
                >
                  {c.cell(l, i)}
                </td>
              ))}
            </tr>
          ))}

          {/*
            KHỐI TỔNG — bốn dòng, thứ tự và cách gọi tên đúng phiếu đang ký:
            Cộng tiền hàng → Chiết khấu → Thuế GTGT → TỔNG THANH TOÁN, nhãn có
            dấu hai chấm.

            Dòng CHIẾT KHẤU luôn in, kể cả bằng 0. Bản cũ chỉ in ở mẫu có chiết
            khấu nên khối tổng của năm mẫu cao thấp khác nhau — đúng thứ người
            dùng nhìn ra là "mấy mẫu in không đồng nhất". Phiếu thật in cả dòng 0.

            Tỉ lệ VAT nằm ở ô NGAY TRƯỚC cột thành tiền (cột đơn giá), không nhét
            vào nhãn — giống hệt ô `L19 = 0.1` trên phiếu Excel.
          */}
          {(
            [
              ['Cộng tiền hàng:', null, subtotal, 'font-semibold'],
              ['Chiết khấu:', null, discount, ''],
              [
                'Thuế GTGT:',
                rate ? `${rate}%${po.price_includes_vat ? ' (đã gồm)' : ''}` : null,
                vatAmount,
                '',
              ],
              ['TỔNG THANH TOÁN:', null, grandTotal, 'font-bold'],
            ] as [string, string | null, number, string][]
          ).map(([label, rateText, value, cls]) => (
            <tr key={label} className={cls}>
              <td colSpan={amountIdx - 1} className="border border-black px-2 text-right">
                {label}
              </td>
              <td className="border border-black px-1 text-right whitespace-nowrap">
                {rateText ?? ''}
              </td>
              <td className="border border-black px-1 text-right">{fmt(value)}</td>
              <td colSpan={cols.length - amountIdx - 1} className="border border-black" />
            </tr>
          ))}
        </tbody>
      </table>

      <PrintTerms items={terms} />

      <div className="mt-1 flex flex-col gap-0.5 text-[12px]">
        <div>
          <b>
            Đơn giá trên {po.price_includes_vat ? 'ĐÃ bao gồm' : 'CHƯA bao gồm'} thuế VAT
            {po.vat_rate != null ? ` ${po.vat_rate}%` : ''}.
          </b>
        </div>
        {po.expected_at && (
          <div>
            Hẹn giao: <b>{new Date(po.expected_at).toLocaleDateString('vi-VN')}</b>
          </div>
        )}
        {/* Cột `terms` cũ — đơn tạo trước 0106 chỉ có một dòng điều khoản gộp. */}
        {po.terms && !hasTerms && <div>{po.terms}</div>}
        {po.note && <div className="italic">{po.note}</div>}
        <div className="italic">
          (Sau khi nhận đơn hàng xin vui lòng xác nhận lại cho công ty chúng tôi.)
        </div>
      </div>

      <PrintSignatures
        cols={[
          { role: 'ĐƠN VỊ CUNG CẤP', hint: 'Ký, ghi rõ họ tên, đóng dấu' },
          { role: po.signer_role ?? meta.signerRole, hint: 'Ký, ghi rõ họ tên' },
          { role: 'GIÁM ĐỐC', hint: 'Ký, ghi rõ họ tên, đóng dấu' },
        ]}
      />
    </PrintPage>
  )
}
