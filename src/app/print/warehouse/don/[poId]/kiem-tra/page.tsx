import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import {
  dongConChoCuaDon,
  nccCuaDon,
} from '@/modules/dept/warehouse/bien-ban-kiem-tra.repo'
import { todayVn } from '@/lib/date-vn'
import { BienBanKiemTraSheet } from '../../../BienBanKiemTraSheet'

export const metadata = { title: 'Biên bản kiểm tra đầu vào' }

/**
 * Biên bản kiểm tra TRƯỚC khi ghi sổ (Q1, 25/11/2026): xe vừa tới, Kho in tờ
 * này cho QC cầm ra kiểm rồi mới gõ số vào phiếu nhập. Cột "SL còn chờ" = phần
 * đơn còn mở; "SL thực nhận" để trống. Chưa có số phiếu.
 */
export default async function BienBanTruocGhiSoPage({
  params,
}: {
  params: Promise<{ poId: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { poId } = await params

  const [ncc, lines, company] = await Promise.all([
    nccCuaDon([poId]),
    dongConChoCuaDon(poId),
    settingsService.getAll(),
  ])
  if (ncc.don.length === 0) redirect('/warehouse/nhap')

  return (
    <BienBanKiemTraSheet
      head={{
        code: null,
        date: new Date(`${todayVn(new Date())}T00:00:00`),
        ...ncc,
        supplier_doc_no: null,
        counterparty: null,
        receiver_name: user.name ?? null,
      }}
      lines={lines}
      company={company}
    />
  )
}
