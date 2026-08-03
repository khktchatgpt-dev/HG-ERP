import type { LsxPrintLine } from '@/modules/dept/production/production.repo'
import {
  PrintLetterhead,
  PrintMeta,
  PrintPage,
  PrintSignatures,
  PrintTitle,
} from '../PrintSheet'

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
    <PrintPage maxWidth="max-w-6xl">
      {watermark && (
        <div className="mb-3 border-2 border-dashed border-red-500 bg-red-50 py-1.5 text-center text-sm font-bold tracking-widest text-red-600 uppercase">
          {watermark}
        </div>
      )}

      <PrintLetterhead company={company} date={new Date()} />
      <PrintTitle vi="LỆNH SẢN XUẤT" en="PRODUCTION ORDER" />

      <PrintMeta
        rows={[
          ['Khách hàng:', header.customer_name],
          ['Đơn hàng số:', header.order_ref],
          ['Ngày nhận:', fmtD(header.received_date)],
          ['Ngày hoàn thành:', fmtD(header.completed_at)],
        ]}
        refs={[
          ['Số:', <b key="c">{header.code}</b>],
          ...(header.note ? ([['Ghi chú:', header.note]] as [string, string][]) : []),
        ]}
      />

      <p className="mt-2 text-[12px]">Đề nghị các bộ phận triển khai sản xuất:</p>

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

      <PrintSignatures
        cols={[
          { role: 'PHÒNG KẾ HOẠCH', hint: 'Ký, ghi rõ họ tên' },
          { role: 'QUẢN LÝ SẢN XUẤT', hint: 'Ký, ghi rõ họ tên' },
          { role: 'GIÁM ĐỐC', hint: 'Ký, ghi rõ họ tên, đóng dấu' },
        ]}
      />
    </PrintPage>
  )
}
