import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { apLedgerService } from '@/modules/dept/accounting/ap-ledger.service'
import {
  apLedgerExcelFilename,
  buildApLedgerExcel,
} from '@/modules/dept/accounting/ap-ledger-excel'

/**
 * Tải SỔ CÔNG NỢ PHẢI TRẢ (TK 331) của một kỳ dạng .xlsx — sổ tổng hợp + sổ
 * chi tiết có số dư luỹ kế.
 *
 * `?ky=YYYY-MM`. Sai định dạng thì BỎ QUA tham số (service tự lấy kỳ có giao
 * dịch gần nhất) chứ không ném lỗi — người dùng sửa URL bằng tay không đáng bị
 * trả về một trang lỗi.
 *
 * Quyền do `apLedgerService.overview` gác (`accounting.payable.view`), gọi qua
 * `fullBook` — không kiểm hai lần ở hai nơi rồi lệch nhau.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const ky = new URL(req.url).searchParams.get('ky')
  const month = ky && /^\d{4}-\d{2}$/.test(ky) ? ky : undefined

  const book = await apLedgerService.fullBook(user, month)
  const buf = await buildApLedgerExcel(book)
  const filename = apLedgerExcelFilename(book.month)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
