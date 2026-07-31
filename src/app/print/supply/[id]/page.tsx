import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { posRepo, type PoLine } from '@/modules/dept/supply/pos.repo'
import { poLineAmount } from '@/lib/po-line'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { PrintToolbar } from '../../PrintToolbar'

const fmt = (n: number | null | undefined) =>
  n == null ? '' : Number(n).toLocaleString('vi-VN')

type Col = {
  label: string
  /** Nội dung ô — trả '' cho ô trống, KHÔNG trả '0' (phiếu gửi NCC đọc rối). */
  cell: (l: PoLine, i: number) => React.ReactNode
  align?: 'left' | 'right'
  /** Cột này là nơi in dòng tổng cộng ở cuối bảng. */
  isAmount?: boolean
}

const colStt: Col = { label: 'STT', cell: (_l, i) => i + 1 }
const colName: Col = {
  label: 'Tên vật tư',
  align: 'left',
  cell: (l) => (
    <>
      {l.material_name}
      <div className="font-mono text-[10px] text-zinc-600">{l.material_code}</div>
    </>
  ),
}
const colUnit: Col = { label: 'ĐVT', cell: (l) => l.material_unit }
const colQty: Col = { label: 'Số lượng', cell: (l) => fmt(l.qty_ordered), align: 'right' }
const colNote: Col = { label: 'Ghi chú', cell: (l) => l.note ?? '', align: 'left' }
const colAmount: Col = {
  label: 'Thành tiền',
  align: 'right',
  isAmount: true,
  cell: (l) => (l.unit_price != null ? fmt(Math.round(poLineAmount(l))) : ''),
}
const priceCol = (unit: string | null): Col => ({
  label: unit ? `Đơn giá / ${unit}` : 'Đơn giá',
  align: 'right',
  cell: (l) => fmt(l.unit_price),
})
const colKgTotal: Col = {
  label: 'Tổng kg',
  align: 'right',
  cell: (l) => fmt(l.qty2),
}

/**
 * Bộ cột của phiếu in theo MẪU ĐƠN — lấy đúng từ đơn thật của phòng Cung ứng.
 * Phiếu nhôm phải có kg/m và tổng kg thì NCC mới đối chiếu barem được; phiếu phụ
 * kiện phải có SL đơn hàng/tồn kho thì kho NCC mới hiểu vì sao đặt con số đó.
 */
function columnsFor(t: PoTemplate): Col[] {
  const meta = poTemplateMeta(t)
  switch (t) {
    case 'accessory':
      return [
        colStt,
        colName,
        { label: 'Vật liệu', cell: (l) => l.material_grade ?? '' },
        { label: 'Quy cách', cell: (l) => l.spec ?? '' },
        { label: 'SL đơn hàng', cell: (l) => fmt(l.qty_demand), align: 'right' },
        { label: 'Tồn kho', cell: (l) => fmt(l.qty_on_hand), align: 'right' },
        { label: 'SL đặt', cell: (l) => fmt(l.qty_ordered), align: 'right' },
        colUnit,
        priceCol(null),
        colAmount,
        colNote,
      ]
    case 'aluminium':
      return [
        colStt,
        colName,
        { label: 'Mã khuôn', cell: (l) => l.die_code ?? '' },
        { label: 'kg/m', cell: (l) => fmt(l.weight_per_m), align: 'right' },
        { label: 'Dài cây (m)', cell: (l) => fmt(l.bar_length_m), align: 'right' },
        { label: 'Số cây', cell: (l) => fmt(l.qty_ordered), align: 'right' },
        { label: 'Cây dư', cell: (l) => fmt(l.bar_surplus), align: 'right' },
        colKgTotal,
        priceCol(meta.priceUnit),
        colAmount,
        colNote,
      ]
    case 'metal_kg':
      return [
        colStt,
        colName,
        { label: 'Vật liệu', cell: (l) => l.material_grade ?? '' },
        { label: 'Kích thước', cell: (l) => l.dimension_text ?? l.spec ?? '' },
        { label: 'Màu / bề mặt', cell: (l) => l.finish ?? '' },
        colUnit,
        colQty,
        {
          label: 'kg / đơn vị',
          cell: (l) => fmt(l.weight_per_unit),
          align: 'right',
        },
        colKgTotal,
        priceCol(meta.priceUnit),
        colAmount,
      ]
    case 'carton':
      return [
        colStt,
        { label: 'Mã SP', cell: (l) => l.product_code ?? '' },
        colName,
        { label: 'Cách mở', cell: (l) => l.open_style ?? '' },
        { label: 'Pcs/thùng', cell: (l) => fmt(l.pcs_per_ctn), align: 'right' },
        { label: 'Số thùng', cell: (l) => fmt(l.qty_ordered), align: 'right' },
        {
          label: 'Lọt lòng D×R×C (mm)',
          cell: (l) =>
            l.inner_l_mm && l.inner_w_mm && l.inner_h_mm
              ? `${fmt(l.inner_l_mm)}×${fmt(l.inner_w_mm)}×${fmt(l.inner_h_mm)}`
              : '',
        },
        { label: 'm²/thùng', cell: (l) => fmt(l.area_m2), align: 'right' },
        {
          label: 'Đơn giá',
          align: 'right',
          cell: (l) =>
            l.unit_price != null
              ? `${fmt(l.unit_price)}${l.carton_basis === 'm2' ? '/m²' : '/thùng'}`
              : '',
        },
        colAmount,
        colNote,
      ]
    default:
      return [
        colStt,
        colName,
        { label: 'Quy cách', cell: (l) => l.spec ?? '' },
        colUnit,
        colQty,
        priceCol(null),
        colAmount,
        colNote,
      ]
  }
}

/**
 * In ĐƠN ĐẶT HÀNG gửi NCC — bộ cột, điều khoản và khối chữ ký ĐỔI THEO MẪU ĐƠN
 * (0106). Phòng Cung ứng dùng 5 mẫu khác nhau; in tất cả bằng một bảng chung thì
 * phiếu nhôm mất cột kg/m, phiếu bao bì mất quy cách lọt lòng, và NCC không đối
 * chiếu được với báo giá của chính họ.
 */
export default async function PoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const po = await posRepo.findById(id)
  if (!po) redirect('/planning/pos')
  const [lines, supplier, company] = await Promise.all([
    posRepo.listLines(id),
    suppliersRepo.findById(po.supplier_id),
    settingsService.getAll(),
  ])

  const template = po.template ?? 'simple'
  const meta = poTemplateMeta(template)
  const cols = columnsFor(template)
  const amountIdx = cols.findIndex((c) => c.isAmount)

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
    <div className="mx-auto max-w-4xl bg-white p-6 text-[13px] text-black print:p-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PrintToolbar />

      <div className="flex justify-between text-[12px]">
        <div className="max-w-[55%]">
          <div className="font-bold">{company.company_name}</div>
          {company.company_address && <div>{company.company_address}</div>}
          {company.company_tax_code && <div>MST: {company.company_tax_code}</div>}
          {company.company_phone && <div>ĐT: {company.company_phone}</div>}
        </div>
        <div className="text-center">
          <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="font-semibold">Độc lập - Tự do - Hạnh phúc</div>
          <div className="mt-2 text-right italic">
            Ngày {d.getDate()} tháng {d.getMonth() + 1} năm {d.getFullYear()}
          </div>
        </div>
      </div>

      <h1 className="mt-4 text-center text-2xl font-bold">ĐƠN ĐẶT HÀNG</h1>
      <div className="text-center text-[12px] tracking-wide">PURCHASE ORDER</div>

      <div className="mt-2 flex items-start justify-between gap-4">
        <table className="text-[12px]">
          <tbody>
            <tr>
              <td className="pr-2 align-top font-bold">Kính gửi:</td>
              <td>
                <b>{supplier?.name ?? po.supplier_name}</b>
              </td>
            </tr>
            {supplier?.address && (
              <tr>
                <td className="pr-2 align-top">Địa chỉ:</td>
                <td>{supplier.address}</td>
              </tr>
            )}
            {supplier?.tax_no && (
              <tr>
                <td className="pr-2 align-top">MST:</td>
                <td>{supplier.tax_no}</td>
              </tr>
            )}
            {supplier?.phone && (
              <tr>
                <td className="pr-2 align-top">Người liên hệ:</td>
                <td>{supplier.phone}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="shrink-0 border border-black px-3 py-1 text-[12px]">
          <div className="font-bold">Số ĐH: {po.code}</div>
          {po.contract_no && <div>Theo HĐ số: {po.contract_no}</div>}
          {po.lsx_code && (
            <div>
              LSX: <b>{po.lsx_code}</b>
            </div>
          )}
          {po.order_code && <div>Đơn hàng: {po.order_code}</div>}
        </div>
      </div>

      <p className="mt-2 text-[12px]">
        {company.company_name} cần đặt một số vật tư như sau:
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

          {/* Khối tổng — đúng thứ tự và cách gọi tên của phiếu đang ký. */}
          <tr className="font-semibold">
            <td colSpan={amountIdx} className="border border-black px-2 text-right">
              Cộng tiền hàng
            </td>
            <td className="border border-black px-1 text-right">{fmt(subtotal)}</td>
            <td colSpan={cols.length - amountIdx - 1} className="border border-black" />
          </tr>
          {meta.hasDiscount && (
            <tr>
              <td colSpan={amountIdx} className="border border-black px-2 text-right">
                Chiết khấu
              </td>
              <td className="border border-black px-1 text-right">{fmt(discount)}</td>
              <td colSpan={cols.length - amountIdx - 1} className="border border-black" />
            </tr>
          )}
          <tr>
            <td colSpan={amountIdx} className="border border-black px-2 text-right">
              Thuế GTGT {rate ? `${rate}%` : ''}
              {po.price_includes_vat ? ' (đã gồm trong đơn giá)' : ''}
            </td>
            <td className="border border-black px-1 text-right">{fmt(vatAmount)}</td>
            <td colSpan={cols.length - amountIdx - 1} className="border border-black" />
          </tr>
          <tr className="font-bold">
            <td colSpan={amountIdx} className="border border-black px-2 text-right">
              TỔNG THANH TOÁN
            </td>
            <td className="border border-black px-1 text-right">{fmt(grandTotal)}</td>
            <td colSpan={cols.length - amountIdx - 1} className="border border-black" />
          </tr>
        </tbody>
      </table>

      {hasTerms && (
        <div className="mt-3 text-[12px]">
          <div className="font-bold">ĐIỀU KHOẢN &amp; YÊU CẦU</div>
          <table className="mt-1">
            <tbody>
              {terms.map(([label, value]) =>
                value ? (
                  <tr key={label}>
                    <td className="pr-3 align-top whitespace-nowrap">{label}:</td>
                    <td>{value}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      )}

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

      <div className="mt-10 flex justify-between text-center text-[12px]">
        <div className="w-1/3">
          <div className="font-bold">ĐƠN VỊ CUNG CẤP</div>
          <div className="text-[11px] italic">(Ký, ghi rõ họ tên, đóng dấu)</div>
        </div>
        <div className="w-1/3">
          <div className="font-bold">{po.signer_role ?? meta.signerRole}</div>
          <div className="text-[11px] italic">(Ký, ghi rõ họ tên)</div>
        </div>
        <div className="w-1/3">
          <div className="font-bold">GIÁM ĐỐC</div>
          <div className="text-[11px] italic">(Ký, ghi rõ họ tên, đóng dấu)</div>
        </div>
      </div>
    </div>
  )
}
