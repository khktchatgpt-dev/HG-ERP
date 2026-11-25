import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docsRepo } from '@/modules/dept/warehouse/stock.repo'
import {
  donCuaDongPo,
  nccCuaDon,
  thongTinVatTu,
} from '@/modules/dept/warehouse/bien-ban-kiem-tra.repo'
import { BienBanKiemTraSheet } from '../../BienBanKiemTraSheet'

export const metadata = { title: 'Biên bản kiểm tra đầu vào' }

/**
 * Phiếu nhập ĐÃ GHI SỔ → biên bản kiểm tra đầu vào (đi kèm 01-VT cùng số).
 * Phiếu không phải phiếu nhập thì về bản in thường.
 */
export default async function BienBanSauGhiSoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const doc = await docsRepo.findById(id)
  if (!doc) redirect('/warehouse/phieu-nhap')
  if (doc.kind !== 'receipt') redirect(`/print/warehouse/${id}`)

  const [lines, company] = await Promise.all([
    docsRepo.listLines(id),
    settingsService.getAll(),
  ])
  const poLineIds = lines.map((l) => l.po_line_id).filter((x): x is string => !!x)
  const [poIds, vt] = await Promise.all([
    donCuaDongPo(poLineIds),
    thongTinVatTu(lines.map((l) => l.material_id)),
  ])
  const ncc = await nccCuaDon(poIds)

  return (
    <BienBanKiemTraSheet
      head={{
        code: doc.code,
        // Ngày CHỨNG TỪ (không phải lúc bấm ghi sổ) — cùng luật bản in 01-VT.
        date: new Date(`${doc.doc_date.slice(0, 10)}T00:00:00`),
        ...ncc,
        supplier_doc_no: doc.supplier_doc_no,
        // Phiếu theo đơn hay ghi "người giao" = tên NCC: đó là công ty, không phải
        // người ký — để dòng chấm cho ghi tay tên tài xế / người giao thật.
        counterparty:
          doc.counterparty && doc.counterparty.trim() !== ncc.ncc
            ? doc.counterparty
            : null,
        receiver_name: doc.created_by_name,
      }}
      lines={lines.map((l) => ({
        id: l.id,
        code: l.material_code ?? '',
        name: l.material_name ?? '',
        spec: vt.get(l.material_id)?.spec ?? null,
        group: vt.get(l.material_id)?.group ?? null,
        unit: l.material_unit ?? '',
        // Dòng ngoài đơn không có SL đơn — để trống, không bịa bằng SL thực.
        qty_doc: l.qty_ordered,
        qty: l.qty + l.qty_rejected,
      }))}
      company={company}
    />
  )
}
