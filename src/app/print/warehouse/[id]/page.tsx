import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docsRepo } from '@/modules/dept/warehouse/stock.repo'
import { PrintToolbar } from '../../PrintToolbar'

/**
 * In phiếu kho theo mẫu 01-VT (nhập) / 02-VT (xuất) TT200 — 2 cột số lượng
 * "theo chứng từ" và "thực nhập/xuất", khung chữ ký. unit_cost ẩn GĐ1
 * (giá trị nhập/xuất — đặc tả để sau).
 */
export default async function WarehouseDocPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const doc = await docsRepo.findById(id)
  if (!doc) redirect('/warehouse/docs')
  const [lines, company] = await Promise.all([
    docsRepo.listLines(id),
    settingsService.getAll(),
  ])

  const isReceipt = doc.kind === 'receipt'
  const title = isReceipt ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO'
  const form = isReceipt ? '01-VT' : '02-VT'
  const d = new Date(doc.created_at)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const totalDoc = lines.reduce(
    (s, l) => s + (l.qty_ordered ?? l.qty + l.qty_rejected),
    0,
  )

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-[13px] text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <PrintToolbar />

      <div className="flex justify-between text-[12px]">
        <div>
          <div className="font-bold">{company.company_name}</div>
          {company.company_address && <div>{company.company_address}</div>}
        </div>
        <div className="text-right">
          <div className="font-bold">Mẫu số: {form}</div>
          <div className="text-[10px] italic">
            Ban hành theo Thông tư số 200/2014/TT-BTC
            <br />
            ngày 22/12/2014 của Bộ Tài chính
          </div>
        </div>
      </div>

      <h1 className="mt-4 text-center text-2xl font-bold">{title}</h1>
      <div className="text-center text-[12px]">
        Ngày {d.getDate()} tháng {d.getMonth() + 1} năm {d.getFullYear()}
      </div>
      <div className="mb-3 text-center text-[12px]">
        Số: <b className="font-mono">{doc.code}</b>
      </div>

      <table className="mb-2 text-[12px]">
        <tbody>
          <tr>
            <td className="pr-2">— Họ và tên người {isReceipt ? 'giao' : 'nhận'}:</td>
            <td className="font-semibold">{doc.counterparty ?? '……………………………'}</td>
          </tr>
          {!isReceipt && (
            <tr>
              <td className="pr-2">— Lý do xuất kho:</td>
              <td>{doc.reason ?? '……………………………'}</td>
            </tr>
          )}
          <tr>
            <td className="pr-2">— {isReceipt ? 'Nhập tại kho' : 'Xuất tại kho'}:</td>
            <td>Kho chính</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr className="font-semibold">
            <td rowSpan={2} className="border border-black px-1">
              STT
            </td>
            <td rowSpan={2} className="border border-black px-2">
              Tên, nhãn hiệu, quy cách, phẩm chất vật tư
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Mã hàng
            </td>
            <td rowSpan={2} className="border border-black px-1">
              ĐVT
            </td>
            <td colSpan={2} className="border border-black px-1">
              Số lượng
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Vị trí kệ
            </td>
            <td rowSpan={2} className="border border-black px-2">
              Ghi chú
            </td>
          </tr>
          <tr className="font-semibold">
            <td className="border border-black px-1">Theo chứng từ</td>
            <td className="border border-black px-1">
              {isReceipt ? 'Thực nhập' : 'Thực xuất'}
            </td>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td className="border border-black px-1">{i + 1}</td>
              <td className="border border-black px-2 text-left">{l.material_name}</td>
              <td className="border border-black px-1 font-mono text-[11px]">
                {l.material_code}
              </td>
              <td className="border border-black px-1">{l.material_unit}</td>
              <td className="border border-black px-1">
                {(l.qty_ordered ?? l.qty + l.qty_rejected).toLocaleString('vi-VN')}
              </td>
              <td className="border border-black px-1 font-semibold">
                {l.qty.toLocaleString('vi-VN')}
              </td>
              <td className="border border-black px-1">{l.shelf_location ?? ''}</td>
              <td className="border border-black px-2 text-left text-[11px]">
                {[l.qty_rejected > 0 ? `QC loại ${l.qty_rejected}` : null, l.note]
                  .filter(Boolean)
                  .join(' · ')}
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={4} className="border border-black px-2 text-right">
              Tổng cộng:
            </td>
            <td className="border border-black px-1">
              {totalDoc.toLocaleString('vi-VN')}
            </td>
            <td className="border border-black px-1">
              {totalQty.toLocaleString('vi-VN')}
            </td>
            <td className="border border-black px-1">×</td>
            <td className="border border-black px-1"></td>
          </tr>
        </tbody>
      </table>

      {doc.note && <div className="mt-2 text-[12px]">— Ghi chú: {doc.note}</div>}

      <div className="mt-8 grid grid-cols-4 gap-2 text-center text-[12px]">
        <div>
          <div className="font-semibold">Người lập phiếu</div>
          <div className="italic">(Ký, ghi rõ họ tên)</div>
          <div className="mt-16">{doc.created_by_name ?? ''}</div>
        </div>
        <div>
          <div className="font-semibold">
            Người {isReceipt ? 'giao hàng' : 'nhận hàng'}
          </div>
          <div className="italic">(Ký, ghi rõ họ tên)</div>
          <div className="mt-16">{doc.counterparty ?? ''}</div>
        </div>
        <div>
          <div className="font-semibold">Thủ kho</div>
          <div className="italic">(Ký, ghi rõ họ tên)</div>
        </div>
        <div>
          <div className="font-semibold">Kế toán trưởng</div>
          <div className="italic">(Ký, ghi rõ họ tên)</div>
        </div>
      </div>
    </div>
  )
}
