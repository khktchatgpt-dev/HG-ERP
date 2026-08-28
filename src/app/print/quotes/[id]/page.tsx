import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { resolveSignatures } from '@/lib/doc-templates'
import { quotesRepo, listQuoteLinesForPrint } from '@/modules/dept/sales/quotes.repo'
import { filesService } from '@/modules/core/files/files.service'
import {
  PrintLetterhead,
  PrintMeta,
  PrintPage,
  PrintSignatures,
  PrintTitle,
} from '../../PrintSheet'

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
  const [lines, company, tpl] = await Promise.all([
    listQuoteLinesForPrint(id),
    settingsService.getAll(),
    // Mẫu in (0164): tiêu đề, quốc hiệu, cột ký — /admin/doc-templates.
    docTemplatesService.get('BG'),
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
  // Báo giá không có số lượng → không tính thành tiền/tổng, chỉ chào đơn giá.
  const effPrice = (l: (typeof lines)[number]) =>
    l.unit_price * (1 - (l.discount_pct ?? 0) / 100)

  // Tiền in theo đúng loại tiền của báo giá (USD/EUR/VND…). ISO hợp lệ thì ra
  // ký hiệu chuẩn ($/€/₫); mã lạ thì rơi về "1.234,00 <mã>".
  const fmtMoney = (v: number) => {
    try {
      return v.toLocaleString('en-US', {
        style: 'currency',
        currency: quote.currency,
      })
    } catch {
      return `${v.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${quote.currency}`
    }
  }

  return (
    <PrintPage maxWidth="max-w-5xl">
      {/*
        BÁO GIÁ KHÔNG IN QUỐC HIỆU.
        Đây là tờ gửi khách NƯỚC NGOÀI (MERXX, YOTRIO) và soạn bằng tiếng Anh —
        đóng "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" lên đó là sai đối tượng đọc.
        Phần còn lại của khung (khối công ty, tiêu đề, khối định danh, chữ ký)
        vẫn dùng chung để nhìn ra là cùng một nhà phát hành.
      */}
      <PrintLetterhead
        company={company}
        date={new Date()}
        nationalHeading={tpl.national_heading}
        dateLabel={`Date: ${new Date().toLocaleDateString('en-GB')}`}
      />
      <PrintTitle vi={tpl.title_vi} en={tpl.title_en ?? undefined} />

      <PrintMeta
        rows={[
          ['To:', quote.customer_name],
          ['Valid date:', `From ${fmtD(quote.valid_from)} to ${fmtD(quote.valid_to)}`],
        ]}
        refs={[['Quotation No:', <b key="c">{quote.code}</b>]]}
      />

      <p className="mt-2 mb-1 text-[12px]">
        We are pleased to quote you the following items:
      </p>

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
                <td className="border border-black px-1 font-bold text-red-700">
                  {fmtMoney(effPrice(l))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-3 text-[13px]">
        <div className="font-bold text-black">Note:</div>
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
      <PrintSignatures
        cols={resolveSignatures(tpl.signatures, { company: company.company_name })}
      />
    </PrintPage>
  )
}
