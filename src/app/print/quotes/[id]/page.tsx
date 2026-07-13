import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { quotesRepo, listQuoteLinesForPrint } from '@/modules/dept/sales/quotes.repo'
import { filesService } from '@/modules/core/files/files.service'
import { PrintToolbar } from '../../PrintToolbar'

/**
 * In báo giá theo mẫu Quotation Hoàng Gia (bảng dims / carton / loading 40HC /
 * giá FOB). HTML + print CSS — khổ ngang.
 */
export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const quote = await quotesRepo.findById(id)
  if (!quote) redirect('/sales/quotes')
  const [lines, company] = await Promise.all([
    listQuoteLinesForPrint(id),
    settingsService.getAll(),
  ])

  // Ảnh đại diện SP (cột Picture của mẫu in) — signed URL ngắn hạn, lỗi thì bỏ ảnh.
  const imageUrls = new Map<string, string>()
  await Promise.all(
    [...new Set(lines.map((l) => l.image_file_id).filter(Boolean))].map(async (fid) => {
      try {
        imageUrls.set(
          fid as string,
          await filesService.getDownloadUrl(user, fid as string),
        )
      } catch {
        /* thiếu ảnh không chặn in */
      }
    }),
  )

  const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '…')
  const dim = (l: (typeof lines)[number]) =>
    [l.packing.l_cm, l.packing.w_cm, l.packing.h_cm] as const
  const carton = (l: (typeof lines)[number]) =>
    [l.packing.carton_l_cm, l.packing.carton_w_cm, l.packing.carton_h_cm] as const
  const cmToInch = (v?: number) => (v != null ? (v / 2.54).toFixed(1) : '')
  // Giá in = giá SAU chiết khấu dòng (giá chào thực gửi khách).
  const effPrice = (l: (typeof lines)[number]) =>
    l.unit_price * (1 - (l.discount_pct ?? 0) / 100)
  const total = lines.reduce((s, l) => s + l.qty * effPrice(l), 0)

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-[13px] text-black print:p-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PrintToolbar />

      {/* Header công ty */}
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-xl font-bold">{company.company_name?.toUpperCase()}</div>
          {company.company_address && <div>{company.company_address}</div>}
          <div className="text-xs">
            {company.company_phone && <>Tel: {company.company_phone} · </>}
            {company.company_tax_code && <>MST: {company.company_tax_code}</>}
          </div>
        </div>
      </div>

      <h1 className="my-3 bg-sky-100 py-1 text-center text-xl font-bold text-red-700 print:bg-sky-100">
        QUOTATION — {quote.code}
      </h1>

      <table className="mb-3 text-[13px]">
        <tbody>
          <tr>
            <td className="pr-4 font-semibold text-sky-700">To:</td>
            <td>{quote.customer_name}</td>
          </tr>
          <tr>
            <td className="pr-4 font-semibold text-sky-700">Valid date:</td>
            <td>
              From {fmtD(quote.valid_from)} to {fmtD(quote.valid_to)}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr className="bg-yellow-100 font-semibold print:bg-yellow-100">
            <td rowSpan={2} className="border border-black px-1">
              #
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Picture
            </td>
            <td rowSpan={2} className="border border-black px-2">
              Description
            </td>
            <td colSpan={3} className="border border-black px-1">
              Dimension (cm)
            </td>
            <td colSpan={3} className="border border-black px-1">
              Carton size (cm)
            </td>
            <td colSpan={3} className="border border-black px-1">
              Carton size (inch)
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Q&apos;ty/ctn
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Loading
              <br />
              40HC
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Q&apos;ty
            </td>
            <td rowSpan={2} className="border border-black px-1 font-bold text-red-700">
              {quote.price_term ?? 'Price'} ({quote.currency})
            </td>
          </tr>
          <tr className="bg-yellow-100 font-semibold print:bg-yellow-100">
            {['L', 'W', 'H', 'L', 'W', 'H', 'L', 'W', 'H'].map((h, i) => (
              <td key={i} className="border border-black px-1">
                {h}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const [dl, dw, dh] = dim(l)
            const [cl, cw, ch] = carton(l)
            return (
              <tr key={i}>
                <td className="border border-black px-1">{i + 1}</td>
                <td className="border border-black p-1">
                  {l.image_file_id && imageUrls.get(l.image_file_id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrls.get(l.image_file_id)}
                      alt={l.product_name}
                      className="mx-auto h-16 w-20 object-contain"
                    />
                  ) : null}
                </td>
                <td className="border border-black px-2 text-left">
                  <div className="font-semibold text-red-700">
                    {l.product_name}
                    {l.customer_item_code && ` (${l.customer_item_code})`}
                  </div>
                  {l.description_en && (
                    <div className="text-[11px]">{l.description_en}</div>
                  )}
                  {l.note && <div className="text-[11px] italic">{l.note}</div>}
                </td>
                <td className="border border-black px-1">{dl ?? ''}</td>
                <td className="border border-black px-1">{dw ?? ''}</td>
                <td className="border border-black px-1">{dh ?? ''}</td>
                <td className="border border-black px-1">{cl ?? ''}</td>
                <td className="border border-black px-1">{cw ?? ''}</td>
                <td className="border border-black px-1">{ch ?? ''}</td>
                <td className="border border-black px-1">{cmToInch(cl)}</td>
                <td className="border border-black px-1">{cmToInch(cw)}</td>
                <td className="border border-black px-1">{cmToInch(ch)}</td>
                <td className="border border-black px-1">
                  {l.packing.qty_per_carton ?? ''}
                </td>
                <td className="border border-black px-1">
                  {l.packing.loading_40hc ?? ''}
                </td>
                <td className="border border-black px-1">
                  {l.qty.toLocaleString('en-US')}
                </td>
                <td className="border border-black px-1 font-bold text-red-700">
                  ${effPrice(l).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )
          })}
          <tr className="font-bold">
            <td colSpan={14} className="border border-black px-2 text-right">
              TOTAL
            </td>
            <td className="border border-black px-1">
              {lines.reduce((s, l) => s + l.qty, 0).toLocaleString('en-US')}
            </td>
            <td className="border border-black px-1 text-red-700">
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 text-[13px]">
        <div className="font-bold text-red-700">Note:</div>
        <table>
          <tbody>
            {quote.price_term && (
              <tr>
                <td className="pr-6 font-semibold">Terms:</td>
                <td className="font-semibold">{quote.price_term}</td>
              </tr>
            )}
            {quote.payment_terms && (
              <tr>
                <td className="pr-6 font-semibold">Payment Terms:</td>
                <td className="font-semibold">{quote.payment_terms}</td>
              </tr>
            )}
            {quote.note && (
              <tr>
                <td className="pr-6 align-top font-semibold">Remark:</td>
                <td>{quote.note}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
