import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { amountInWords } from '@/lib/amount-words'
import { shipWeekLabel } from '@/lib/ship-week'
import { PrintPage } from '../../PrintSheet'

/**
 * SALES CONTRACT — mẫu in theo đúng hợp đồng thật của công ty (17891HG-MX):
 * block Seller/Buyer (địa chỉ, tel/fax, TK ngân hàng + swift, đại diện, FSC),
 * Art 1 bảng hàng (ART.No · description · qty · price · amount · shipment),
 * SAY bằng chữ, Art 3 giao hàng, Art 4 gỗ FSC, Art 5 thanh toán + chứng từ.
 *
 * Tiếng Anh toàn phần, KHÔNG quốc hiệu (gửi khách nước ngoài — cùng lý do với
 * mẫu báo giá). Khổ đứng như bản gốc.
 */
export default async function OrderContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const order = await ordersRepo.findById(id)
  if (!order) redirect('/sales/orders')
  const [lines, customer, s] = await Promise.all([
    ordersRepo.listLines(id),
    customersRepo.findById(order.customer_id),
    settingsService.getAll(),
  ])

  const total = lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0)
  const fmtMoney = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2 })
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

  /** Dòng "nhãn: giá trị" — bỏ hẳn khi thiếu (hợp đồng không in nhãn trống). */
  const row = (label: string, v: string | null | undefined) =>
    v?.trim() ? (
      <div>
        <span className="font-semibold">{label}: </span>
        {v}
      </div>
    ) : null

  const yesNo = (v: boolean | null) => (v == null ? null : v ? 'Allowed' : 'Not allowed')

  // Article 4 (gỗ FSC) chỉ in khi cấu hình có ít nhất một trường — đơn không
  // dính gỗ (thuần sắt/nhôm) khỏi mang điều khoản thừa.
  const fscRows: [string, string | undefined][] = [
    ['4.1 - Scientific name of wood', s.fsc_scientific_name],
    ['4.2 - Country of origin', s.fsc_country_origin],
    ['4.3 - Area of origin', s.fsc_area_origin],
    ['4.4 - Owner of forest', s.fsc_forest_owner],
    ['4.5 - Exporter in Vietnam', s.fsc_exporter],
    ['4.6 - Importer in Vietnam', s.fsc_importer],
    ['4.7 - Seller', s.fsc_seller],
    ['4.8 - Coordinates', s.fsc_coordinates],
  ]
  const hasFsc = fscRows.some(([, v]) => v?.trim())

  const requiredDocs = (order.required_docs ?? '')
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean)

  const cell = 'border border-black px-1.5 py-0.5'

  return (
    <PrintPage orientation="portrait" maxWidth="max-w-3xl">
      <h1 className="text-center text-2xl font-bold tracking-wide">SALES CONTRACT</h1>
      <div className="mt-1 flex justify-between text-[12px]">
        <div>
          <span className="font-semibold">No: </span>
          {order.code}
        </div>
        <div>
          <span className="font-semibold">Date: </span>
          {fmtDate(order.created_at)}
        </div>
      </div>

      {/* ── Seller / Buyer ─────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col gap-3 text-[12px]">
        <div>
          <div className="font-bold">
            The Seller: <span className="uppercase">{s.company_name}</span>
          </div>
          {row('Address', s.company_address)}
          <div className="flex gap-6">
            {row('Tel', s.company_phone)}
            {row('Fax', s.company_fax)}
          </div>
          {row('A/C No', s.company_bank_account)}
          {row('Swift code', s.company_swift)}
          {row(
            'Represented by',
            s.company_representative
              ? `${s.company_representative}${s.company_representative_title ? ` — ${s.company_representative_title}` : ''}`
              : null,
          )}
          {row('FSC Cert.', s.company_fsc_cert)}
        </div>
        <div>
          <div className="font-bold">
            The Buyer: <span className="uppercase">{customer?.name ?? '?'}</span>
          </div>
          {row('Address', customer?.address)}
          <div className="flex gap-6">
            {row('Tel', customer?.phone)}
            {row('Fax', customer?.fax)}
          </div>
          {row(
            'Represented by',
            customer?.contact_person
              ? `${customer.contact_person}${customer.representative_title ? ` — ${customer.representative_title}` : ''}`
              : null,
          )}
          {row('FSC Cert.', customer?.fsc_cert)}
        </div>
      </div>

      <p className="mt-2 text-[12px]">
        The both parties have unanimously agreed to sign this contract in accordance with
        the following terms and conditions:
      </p>

      {/* ── Article 1: hàng hoá ────────────────────────────────────────────── */}
      <div className="mt-2 text-[12px] font-bold">
        ARTICLE 1 : COMMODITY — QUANTITY — UNIT PRICE
      </div>
      <table className="mt-1 w-full border-collapse border border-black text-center text-[11px]">
        <thead>
          <tr className="font-semibold">
            <td className={cell}>ART. No.</td>
            <td className={cell}>DESCRIPTION OF GOODS</td>
            <td className={cell}>EAN CODE</td>
            <td className={cell}>
              QUANTITY
              <br />
              (PCS)
            </td>
            <td className={cell}>
              UNIT PRICE ({order.currency})
              {order.price_term && (
                <>
                  <br />
                  {order.price_term.toUpperCase()}
                </>
              )}
            </td>
            <td className={cell}>AMOUNT ({order.currency})</td>
            <td className={cell}>SHIPMENT</td>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className={`${cell} font-mono`}>
                {l.customer_item_code ?? l.product_code}
              </td>
              <td className={`${cell} text-left`}>
                {l.description_en ?? l.product_name}
                {l.note && l.note.trim() !== l.product_name.trim() && (
                  <div className="text-[10px] italic">{l.note}</div>
                )}
              </td>
              <td className={`${cell} font-mono text-[10px]`}>{l.barcode ?? ''}</td>
              <td className={`${cell} tabular-nums`}>{l.qty.toLocaleString('en-US')}</td>
              <td className={`${cell} text-right tabular-nums`}>
                {fmtMoney(l.unit_price)}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {fmtMoney(l.qty * l.unit_price)}
              </td>
              <td className={`${cell} font-mono`}>{shipWeekLabel(l.ship_date) ?? ''}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={3} className={`${cell} text-right`}>
              Total
            </td>
            <td className={`${cell} tabular-nums`}>
              {lines.reduce((sum, l) => sum + l.qty, 0).toLocaleString('en-US')}
            </td>
            <td className={cell} />
            <td className={`${cell} text-right tabular-nums`}>{fmtMoney(total)}</td>
            <td className={cell} />
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[12px]">
        <span className="font-bold">SAY :</span> {amountInWords(total, order.currency)}
      </p>

      {/* ── Article 2–3 ────────────────────────────────────────────────────── */}
      <div className="mt-2 text-[12px]">
        <div className="font-bold">ARTICLE 2 : QUALITY</div>
        <div>Quality of goods must follow the Sample.</div>
      </div>
      <div className="mt-2 text-[12px]">
        <div className="font-bold">ARTICLE 3 : DELIVERY TERM</div>
        {order.qty_tolerance_pct != null && (
          <div>3.1 - Quantity and amount allowed +/- {order.qty_tolerance_pct}%</div>
        )}
        {order.partial_shipment != null && (
          <div>3.2 - Partial shipments: {yesNo(order.partial_shipment)}</div>
        )}
        {order.transhipment != null && (
          <div>3.3 - Transhipment: {yesNo(order.transhipment)}</div>
        )}
        {order.port_of_loading && (
          <div>3.4 - Port of Loading: {order.port_of_loading}</div>
        )}
        {order.port_of_discharge && (
          <div>3.5 - Port of Discharging: {order.port_of_discharge}</div>
        )}
        {order.due_date && (
          <div>3.6 - Latest date of shipment: {fmtDate(order.due_date)}</div>
        )}
      </div>

      {/* ── Article 4: gỗ FSC (theo cấu hình) ──────────────────────────────── */}
      {hasFsc && (
        <div className="mt-2 text-[12px]">
          <div className="font-bold">ARTICLE 4 : WOOD</div>
          {fscRows.map(([label, v]) =>
            v?.trim() ? (
              <div key={label} className="whitespace-pre-line">
                {label}: {v}
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* ── Article 5: thanh toán + chứng từ ───────────────────────────────── */}
      <div className="mt-2 text-[12px]">
        <div className="font-bold">ARTICLE {hasFsc ? 5 : 4} : PAYMENT</div>
        {order.payment_method && <div>{order.payment_method}</div>}
        {order.payment_terms && <div>{order.payment_terms}</div>}
        {order.deposit_percent != null && (
          <div>Deposit: {order.deposit_percent}% of contract value</div>
        )}
        {requiredDocs.length > 0 && (
          <>
            <div className="mt-0.5">Documents required:</div>
            {requiredDocs.map((d, i) => (
              <div key={i}>
                {i + 1}- {d}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Điều khoản chung + chữ ký ──────────────────────────────────────── */}
      <div className="mt-2 text-[12px]">
        <div className="font-bold">ARTICLE {hasFsc ? 6 : 5} : GENERAL CONDITION</div>
        <div>
          - The two parties engage to respect and follow all terms and conditions above to
          ensure shipment date and quality. Any changes should be agreed and confirmed by
          two parties in writing.
        </div>
        <div>
          - This contract is made into 02 originals in English having the same value and
          comes into force from the signing day.
        </div>
      </div>

      <div className="mt-8 mb-16 flex justify-between text-center text-[12px] font-bold">
        <div className="flex-1">On behalf of The Buyer</div>
        <div className="flex-1">On behalf of The Seller</div>
      </div>
    </PrintPage>
  )
}
