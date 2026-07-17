import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import {
  productionRepo,
  listLsxPrintLines,
} from '@/modules/dept/production/production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { filesService } from '@/modules/core/files/files.service'
import { PrintToolbar } from '../../PrintToolbar'

/**
 * In phiếu LỆNH SẢN XUẤT theo mẫu Hoàng Gia: đầu phiếu (KH, đơn, ngày nhận/hoàn
 * thành, số LSX) + bảng dòng SP với thông số SX (máy/nệm/sơn/kính/gỗ, barcode,
 * tên Đức, đóng gói, mẫu showroom). HTML + print CSS khổ ngang.
 */
export default async function LsxPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const lsx = await productionRepo.findById(id)
  if (!lsx) redirect('/sales/tracking')

  const [lines, order, company] = await Promise.all([
    listLsxPrintLines(id, lsx.sales_order_id),
    ordersRepo.findById(lsx.sales_order_id),
    settingsService.getAll(),
  ])

  // Ảnh SP (cột Hình ảnh) — signed URL ngắn hạn, lỗi thì bỏ ảnh.
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
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const th = 'border border-black px-1 py-0.5'

  return (
    <div className="mx-auto max-w-6xl bg-white p-6 text-[12px] text-black print:p-0">
      <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>
      <PrintToolbar />

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
              <td>{lsx.customer_name}</td>
            </tr>
            <tr>
              <td className="pr-3 font-semibold">Đơn hàng số:</td>
              <td>{order?.customer_po_no || lsx.order_code}</td>
            </tr>
            <tr>
              <td className="pr-3 font-semibold">Ngày nhận:</td>
              <td>{fmtD(lsx.received_date ?? order?.created_at ?? null)}</td>
            </tr>
            <tr>
              <td className="pr-3 font-semibold">Ngày hoàn thành:</td>
              <td>{fmtD(lsx.completed_at)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h1 className="my-2 text-center text-xl font-bold">LỆNH SẢN XUẤT</h1>
      <div className="mb-2 text-center">
        <span className="border border-black px-4 py-1 font-semibold">
          SỐ: {lsx.code}
          {lsx.note ? ` (${lsx.note})` : ''}
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
              <td className={th}>{fmtD(lsx.ship_date)}</td>
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
