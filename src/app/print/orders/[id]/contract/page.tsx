import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { usdAmountInWords } from '@/lib/money-words'
import { PrintToolbar } from '../../../PrintToolbar'

/**
 * Khung SALE CONTRACT theo mẫu Hoàng Gia (Article 1 bảng hàng hoá, deposit,
 * amount-in-words, chữ ký 2 bên). Điều khoản cảng/giao nhận in khung sẵn để
 * điền — dữ liệu chưa có cột riêng (OI-06: mẫu hợp đồng DN cung cấp sau).
 */
export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const order = await ordersRepo.findById(id)
  if (!order) redirect('/sales/orders')
  const [lines, customer, company] = await Promise.all([
    ordersRepo.listLines(id),
    customersRepo.findById(order.customer_id),
    settingsService.getAll(),
  ])

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const deposit =
    order.deposit_percent != null ? (total * order.deposit_percent) / 100 : null
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 })
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-[13px] text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <PrintToolbar />

      <h1 className="text-center text-2xl font-bold text-red-700">SALES CONTRACT</h1>
      <div className="mb-3 text-right text-[12px]">
        <div>
          <i>No: {order.code}</i>
        </div>
        <div>
          <i>Date: {new Date(order.created_at).toLocaleDateString('en-GB')}</i>
        </div>
      </div>

      {/* Hai bên */}
      <table className="mb-3 w-full text-[12px]">
        <tbody>
          <tr>
            <td className="w-20 align-top font-semibold">Seller</td>
            <td>
              <b>{company.company_name?.toUpperCase()}</b>
              {company.company_address && <div>{company.company_address}</div>}
              {company.company_phone && <div>Tel: {company.company_phone}</div>}
              {company.company_tax_code && (
                <div>Tax code: {company.company_tax_code}</div>
              )}
            </td>
          </tr>
          <tr>
            <td className="pt-2 align-top font-semibold">Buyer</td>
            <td className="pt-2">
              <b>{order.customer_name.toUpperCase()}</b>
              {customer?.address && <div>{customer.address}</div>}
              {customer?.phone && <div>Tel: {customer.phone}</div>}
              {customer?.email && <div>Email: {customer.email}</div>}
              {order.customer_po_no && (
                <div>
                  Buyer PO#: <b>{order.customer_po_no}</b>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mb-2 text-[12px]">
        The both parties have unanimously agreed to sign this purchase order in accordance
        with following terms and conditions:
      </p>

      <div className="font-bold underline">
        ARTICLE 1 : COMMODITY - QUANTITY - UNIT PRICE
      </div>
      <table className="my-2 w-full border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr className="font-semibold">
            <td className="border border-black px-1">No.</td>
            <td className="border border-black px-1">Customer Item</td>
            <td className="border border-black px-2">Description of goods</td>
            <td className="border border-black px-1">Quantity</td>
            <td className="border border-black px-1">
              Unit price ({order.currency})
              {order.price_term && (
                <div className="text-[10px] font-normal">{order.price_term}</div>
              )}
            </td>
            <td className="border border-black px-1">Amount ({order.currency})</td>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="border border-black px-1">{i + 1}</td>
              <td className="border border-black px-1 font-mono">
                {l.customer_item_code ?? l.product_code}
              </td>
              <td className="border border-black px-2 text-left">
                {l.product_name}
                {l.note && <div className="text-[11px] italic">{l.note}</div>}
              </td>
              <td className="border border-black px-1">
                {l.qty.toLocaleString('en-US')}
              </td>
              <td className="border border-black px-1">${fmt(l.unit_price)}</td>
              <td className="border border-black px-1">${fmt(l.qty * l.unit_price)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={3} className="border border-black px-2 text-center">
              TOTAL{order.container_summary ? `: ${order.container_summary}` : ''}
            </td>
            <td className="border border-black px-1">
              {totalQty.toLocaleString('en-US')}
            </td>
            <td className="border border-black px-1"></td>
            <td className="border border-black px-1">${fmt(total)}</td>
          </tr>
          {deposit != null && (
            <tr className="font-bold">
              <td colSpan={5} className="border border-black px-2 text-right italic">
                Deposit {order.deposit_percent}%
              </td>
              <td className="border border-black px-1 italic">${fmt(deposit)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {order.currency === 'USD' && (
        <p className="mb-3 font-bold text-red-700 underline">
          SAY: {usdAmountInWords(total)}.
        </p>
      )}

      <div className="flex flex-col gap-2 text-[12px]">
        <div>
          <span className="font-bold underline">ARTICLE 2 : SHIPPING DATE</span>
          <div>
            {order.due_date ? new Date(order.due_date).toLocaleDateString('en-GB') : '—'}
          </div>
        </div>
        <div>
          <span className="font-bold underline">ARTICLE 3 : PAYMENT</span>
          <div>{order.payment_terms ?? '—'}</div>
        </div>
        <div>
          <span className="font-bold underline">ARTICLE 4 : GENERAL CONDITION</span>
          <div>
            The two parties engage to respect and follow all terms and conditions above to
            ensure shipment date and quality. Any changes should be agreed and confirmed
            by two parties by writings. This contract is made into 02 originals in English
            having the same value.
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-between text-center font-semibold">
        <div className="w-1/2">On behalf of The Buyer</div>
        <div className="w-1/2">On behalf of The Seller</div>
      </div>
    </div>
  )
}
