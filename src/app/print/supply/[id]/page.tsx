import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { PrintToolbar } from '../../PrintToolbar'

/**
 * In ĐƠN ĐẶT HÀNG gửi NCC — hợp nhất từ 3 mẫu thật của Hoàng Gia (nhôm / dây
 * nhựa / kính): quốc hiệu, kính gửi NCC, số ĐH + THAM CHIẾU LSX trên header,
 * bảng vật tư quy cách + ĐVT kép, dòng VAT gồm/chưa gồm, khung ký 2 bên.
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

  const d = new Date(po.created_at)
  const fmt = (n: number) => n.toLocaleString('vi-VN')
  const total = lines.reduce((s, l) => s + l.qty_ordered * (l.unit_price ?? 0), 0)
  const hasQty2 = lines.some((l) => l.qty2 != null)

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-[13px] text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
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

      <div className="mt-2 flex items-start justify-between">
        <table className="text-[12px]">
          <tbody>
            <tr>
              <td className="pr-2 align-top font-bold">Kính gửi:</td>
              <td>
                <b>{supplier?.name ?? po.supplier_name}</b>
                {supplier?.address && <div>Địa chỉ: {supplier.address}</div>}
                {supplier?.phone && <div>ĐT: {supplier.phone}</div>}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="border border-black px-3 py-1 text-center text-[12px]">
          <div className="font-bold">{po.code}</div>
          <div>
            LSX: <b>{po.lsx_code}</b>
          </div>
          {po.order_code && <div>Đơn hàng: {po.order_code}</div>}
        </div>
      </div>

      <p className="mt-2 text-[12px]">
        {company.company_name} cần đặt một số vật tư như sau:
      </p>

      <table className="mt-1 w-full border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr className="font-semibold">
            <td className="border border-black px-1">STT</td>
            <td className="border border-black px-2">Tên vật tư</td>
            <td className="border border-black px-1">Quy cách</td>
            <td className="border border-black px-1">ĐVT</td>
            <td className="border border-black px-1">Số lượng</td>
            {hasQty2 && <td className="border border-black px-1">SL quy đổi</td>}
            <td className="border border-black px-1">Đơn giá</td>
            <td className="border border-black px-1">Thành tiền</td>
            <td className="border border-black px-2">Ghi chú</td>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td className="border border-black px-1">{i + 1}</td>
              <td className="border border-black px-2 text-left">
                {l.material_name}
                <div className="font-mono text-[10px] text-zinc-600">
                  {l.material_code}
                </div>
              </td>
              <td className="border border-black px-1">{l.spec ?? ''}</td>
              <td className="border border-black px-1">{l.material_unit}</td>
              <td className="border border-black px-1 font-semibold">
                {fmt(l.qty_ordered)}
              </td>
              {hasQty2 && (
                <td className="border border-black px-1">
                  {l.qty2 != null ? `${fmt(l.qty2)} ${l.unit2 ?? ''}` : ''}
                </td>
              )}
              <td className="border border-black px-1">
                {l.unit_price != null ? fmt(l.unit_price) : ''}
              </td>
              <td className="border border-black px-1">
                {l.unit_price != null ? fmt(l.qty_ordered * l.unit_price) : ''}
              </td>
              <td className="border border-black px-2 text-left text-[11px]">
                {l.note ?? ''}
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={hasQty2 ? 6 : 5} className="border border-black px-2 text-right">
              Tổng cộng
            </td>
            <td className="border border-black px-1"></td>
            <td className="border border-black px-1">{fmt(total)}</td>
            <td className="border border-black px-1"></td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 flex flex-col gap-1 text-[12px]">
        <div>
          <b>
            Đơn giá trên {po.price_includes_vat ? 'ĐÃ bao gồm' : 'CHƯA bao gồm'} thuế VAT
            {po.vat_rate != null ? ` ${po.vat_rate}%` : ''}.
          </b>
        </div>
        {po.expected_at && (
          <div>
            Thời gian giao hàng:{' '}
            <b>{new Date(po.expected_at).toLocaleDateString('vi-VN')}</b>
          </div>
        )}
        {po.terms && <div>{po.terms}</div>}
        {po.note && <div className="italic">{po.note}</div>}
        <div className="italic">
          (Sau khi nhận đơn hàng xin vui lòng xác nhận lại cho công ty chúng tôi.)
        </div>
      </div>

      <div className="mt-10 flex justify-between text-center text-[12px] font-bold">
        <div className="w-1/2">ĐƠN VỊ CUNG CẤP XÁC NHẬN</div>
        <div className="w-1/2">{company.company_name?.toUpperCase()}</div>
      </div>
    </div>
  )
}
