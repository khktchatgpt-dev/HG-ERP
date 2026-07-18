import type { LsxPrintLine } from '@/modules/dept/production/production.repo'
import { PrintToolbar } from '../PrintToolbar'

/**
 * Phiếu LỆNH SẢN XUẤT mẫu Hoàng Gia (A4 ngang) — template dùng chung cho:
 *   - bản CHÍNH THỨC  /print/lsx/[id]           (lệnh đã phát)
 *   - bản XEM TRƯỚC   /print/lsx/preview/[orderId] (Sales dò trước khi phát —
 *     watermark rõ để bản in thử không bị dùng nhầm làm bản thật)
 */
export type LsxSheetHeader = {
  customer_name: string
  /** PO khách hoặc số đơn. */
  order_ref: string
  received_date: string | null
  completed_at: string | null
  code: string
  note: string | null
  ship_date: string | null
}

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '…')
const th = 'border border-black px-1 py-0.5'

export function LsxPrintSheet({
  company,
  header,
  lines,
  imageUrls,
  watermark,
}: {
  company: Record<string, string | null>
  header: LsxSheetHeader
  lines: LsxPrintLine[]
  imageUrls: Map<string, string>
  /** vd "BẢN XEM TRƯỚC — LỆNH CHƯA PHÁT". null = bản chính thức. */
  watermark?: string | null
}) {
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)

  return (
    <div className="mx-auto max-w-6xl bg-white p-6 text-[12px] text-black print:p-0">
      <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>
      <PrintToolbar />

      {watermark && (
        <div className="mb-3 border-2 border-dashed border-red-500 bg-red-50 py-1.5 text-center text-sm font-bold tracking-widest text-red-600 uppercase">
          {watermark}
        </div>
      )}

      {/* Đầu phiếu */}
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-lg font-bold">{company.company_name?.toUpperCase()}</div>
          {company.company_address && <div>{company.company_address}</div>}
          {company.company_phone && (
            <div className="text-xs">Tel: {company.company_phone}</div>
          )}
        </div>
        <table className="text-[12px]">
          <tbody>
            <tr>
              <td className="pr-3 font-semibold">Khách hàng:</td>
              <td>{header.customer_name}</td>
            </tr>
            <tr>
              <td className="pr-3 font-semibold">Đơn hàng số:</td>
              <td>{header.order_ref}</td>
            </tr>
            <tr>
              <td className="pr-3 font-semibold">Ngày nhận:</td>
              <td>{fmtD(header.received_date)}</td>
            </tr>
            <tr>
              <td className="pr-3 font-semibold">Ngày hoàn thành:</td>
              <td>{fmtD(header.completed_at)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h1 className="my-2 text-center text-xl font-bold">LỆNH SẢN XUẤT</h1>
      <div className="mb-2 text-center">
        <span className="border border-black px-4 py-1 font-semibold">
          SỐ: {header.code}
          {header.note ? ` (${header.note})` : ''}
        </span>
      </div>

      <table className="w-full border-collapse text-center text-[11px]">
        <thead>
          <tr className="bg-zinc-100 font-semibold print:bg-zinc-100">
            <td className={th}>STT</td>
            <td className={th}>Hình ảnh</td>
            <td className={th}>Mã SP</td>
            <td className={th}>Tên theo khách</td>
            <td className={th}>Tên tiếng Việt</td>
            <td className={th}>Shipping mark</td>
            <td className={th}>Barcode</td>
            <td className={th}>ĐVT</td>
            <td className={th}>SL</td>
            <td className={th}>Máy</td>
            <td className={th}>Nệm</td>
            <td className={th}>Sơn</td>
            <td className={th}>Kính</td>
            <td className={th}>Gỗ</td>
            <td className={th}>Đóng gói</td>
            <td className={th}>TG xuất</td>
            <td className={th}>Showroom</td>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.order_line_id}>
              <td className={th}>{i + 1}</td>
              <td className={th}>
                {l.image_file_id && imageUrls.get(l.image_file_id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrls.get(l.image_file_id)}
                    alt={l.name_vi}
                    className="mx-auto h-12 w-16 object-contain"
                  />
                ) : null}
              </td>
              <td className={`${th} font-mono`}>
                {l.product_code}
                {l.customer_item_code && (
                  <div className="text-[9px] text-zinc-500">{l.customer_item_code}</div>
                )}
              </td>
              <td className={`${th} text-left`}>{l.name_foreign ?? ''}</td>
              <td className={`${th} text-left`}>{l.name_vi}</td>
              <td className={`${th} text-left`}>
                {l.shipping_mark && (
                  <div className="whitespace-pre-wrap">{l.shipping_mark}</div>
                )}
              </td>
              <td className={`${th} font-mono`}>{l.barcode ?? ''}</td>
              <td className={th}>{l.unit}</td>
              <td className={`${th} font-semibold`}>{l.qty.toLocaleString('en-US')}</td>
              <td className={th}>{l.tech_spec.machine ?? ''}</td>
              <td className={th}>{l.tech_spec.cushion ?? ''}</td>
              <td className={th}>{l.tech_spec.paint ?? ''}</td>
              <td className={th}>{l.tech_spec.glass ?? ''}</td>
              <td className={th}>{l.tech_spec.wood ?? ''}</td>
              <td className={th}>
                {l.qty_per_carton != null
                  ? `${l.qty_per_carton} ${l.unit}/${l.pack_unit_label ?? 'thùng'}`
                  : ''}
              </td>
              <td className={th}>{fmtD(header.ship_date)}</td>
              <td className={th}>{l.showroom_sample ? '✓' : ''}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={`${th} text-right`} colSpan={7}>
              Tổng
            </td>
            <td className={th}>{totalQty.toLocaleString('en-US')}</td>
            <td className={th} colSpan={8}></td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-[11px] italic">
        Để đảm bảo thời hạn xuất hàng, đề nghị các bộ phận phối hợp giải quyết kịp thời
        các vấn đề liên quan.
      </p>
      <div className="mt-1 text-[11px]">
        Nơi nhận: Quản lý sản xuất, các tổ trưởng, trưởng bộ phận, kho vật tư, nguyên
        liệu, phòng kế hoạch, phòng kế toán.
      </div>

      <div className="mt-8 flex justify-end pr-16 text-center font-semibold">
        <div>Giám đốc</div>
      </div>
    </div>
  )
}
