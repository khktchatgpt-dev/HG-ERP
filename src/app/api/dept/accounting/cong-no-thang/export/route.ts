import { NextResponse } from 'next/server'
import { BadRequest, handle, NotFound } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { congNoThangService } from '@/modules/dept/accounting/cong-no-thang.service'
import {
  buildCongNoNccExcel,
  buildCongNoThangExcel,
  congNoNccFilename,
  congNoThangFilename,
} from '@/modules/dept/accounting/cong-no-thang-excel'

const MONTH = /^\d{4}-\d{2}$/

/**
 * Tải Excel công nợ NCC theo tháng.
 *   `?ky=YYYY-MM`                       — cả tháng (Màn 1)
 *   `?ncc=<id>&tu=YYYY-MM&den=YYYY-MM`  — một NCC trong khoảng tháng (Màn 2)
 * Quyền do service gác (`accounting.payable.view`).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const sp = new URL(req.url).searchParams

  const ncc = sp.get('ncc')
  if (ncc) {
    const book = await congNoThangService.soNcc(user, ncc)
    if (!book.supplier) throw NotFound('Không có phiếu nhập nào của nhà cung cấp này')
    const tu = MONTH.test(sp.get('tu') ?? '') ? sp.get('tu')! : '0000-00'
    const den = MONTH.test(sp.get('den') ?? '') ? sp.get('den')! : '9999-99'
    const sheet = book.sheet.filter((m) => m.month >= tu && m.month <= den)
    const months = sheet.map((m) => m.month)
    const buf = await buildCongNoNccExcel(book.supplier.name, sheet)
    return file(
      buf,
      congNoNccFilename(book.supplier.name, months.at(-1) ?? tu, months[0] ?? den),
    )
  }

  const ky = sp.get('ky')
  if (!ky || !MONTH.test(ky)) throw BadRequest('Thiếu tháng (?ky=YYYY-MM)')
  const { rows, docs } = await congNoThangService.excelThang(user, ky)
  return file(await buildCongNoThangExcel(ky, rows, docs), congNoThangFilename(ky))
})

function file(buf: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
}
