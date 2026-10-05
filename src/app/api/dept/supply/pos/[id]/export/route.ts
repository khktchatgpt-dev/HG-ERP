import { NextResponse } from 'next/server'
import { handle, NotFound } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPoPrint } from '@/modules/dept/supply/po-print.service'
import { buildPoExcel, poExcelFilename } from '@/modules/dept/supply/po-excel'

/**
 * Tải ĐƠN ĐẶT HÀNG dạng .xlsx — bày giống hệt phiếu in. Dữ liệu nạp qua
 * `loadPoPrint`, CHUNG với /print/supply/[id] (05/10/2026): tiêu đề, khối chữ
 * ký theo mẫu chứng từ, tên người lập, hẹn giao, lịch giao theo đợt. Ai xem
 * được phiếu thì tải được file.
 *
 * `?kho=doc|ngang` — khổ giấy đang chọn trên thanh in, để file mở ra in đúng
 * chiều người dùng vừa xem (bỏ trống = ngang như mẫu chuẩn).
 */
export const GET = handle(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await authService.requireUser()
    const { id } = await params

    const d = await loadPoPrint(id)
    if (!d) throw NotFound('Đơn đặt hàng không tồn tại')

    const kho = new URL(req.url).searchParams.get('kho')
    const buf = await buildPoExcel({
      company: d.company,
      tpl: d.tpl,
      po: d.po,
      supplier: d.supplier,
      lines: d.lines,
      shipments: d.shipments,
      orientation: kho === 'doc' ? 'portrait' : 'landscape',
    })

    const filename = poExcelFilename(d.po.code)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'cache-control': 'no-store',
      },
    })
  },
)
