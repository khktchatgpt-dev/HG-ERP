import { NextResponse } from 'next/server'
import { handle, NotFound } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { buildPoExcel, poExcelFilename } from '@/modules/dept/supply/po-excel'

/**
 * Tải ĐƠN ĐẶT HÀNG dạng .xlsx — bày giống hệt phiếu in (đơn ĐH chuẩn 08/2026:
 * tiêu đề vàng, khung Số ĐH, khối tổng, chữ ký). Cùng dữ liệu với
 * /print/supply/[id]; ai xem được phiếu thì tải được file.
 */
export const GET = handle(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await authService.requireUser()
    const { id } = await params

    const po = await posRepo.findById(id)
    if (!po) throw NotFound('Đơn đặt hàng không tồn tại')

    const [lines, supplier, company] = await Promise.all([
      posRepo.listLines(id),
      suppliersRepo.findById(po.supplier_id),
      settingsService.getAll(),
    ])

    const buf = await buildPoExcel({
      company,
      po: { ...po, template: po.template ?? 'simple' },
      supplier,
      lines,
    })

    const filename = poExcelFilename(po.code)
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
