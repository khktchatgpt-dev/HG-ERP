import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import { listLsxPrintLines } from '@/modules/dept/production/production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { filesService } from '@/modules/core/files/files.service'

type Params = { params: Promise<{ id: string }> }

/**
 * Hồ sơ LSX (đọc) — dùng cho panel "Hồ sơ sản xuất" ở màn Quản lý đơn hàng (GĐ):
 * `{ lsx, progress, lines }`. `lines` = dòng SP + thông số SX (tech_spec) + BOM
 * + ảnh (URL ký), KHÔNG kèm đơn giá bán (endpoint mở cho mọi NV — hồ sơ SX thuần).
 */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { lsx, progress } = await productionService.detail(user, id)

  const [printLines, orderLines] = await Promise.all([
    listLsxPrintLines(id, lsx.sales_order_id),
    ordersRepo.listLines(lsx.sales_order_id),
  ])
  const bomByLine = new Map(orderLines.map((ol) => [ol.id, ol.bom_status]))

  const fileIds = [
    ...new Set(printLines.map((p) => p.image_file_id).filter((x): x is string => !!x)),
  ]
  let imageUrls: Record<string, string> = {}
  try {
    if (fileIds.length) imageUrls = await filesService.getDownloadUrls(user, fileIds)
  } catch {
    /* ảnh lỗi không chặn hồ sơ */
  }

  const lines = printLines.map((pl) => ({
    product_code: pl.product_code,
    product_name: pl.name_vi,
    product_unit: pl.unit,
    qty: pl.qty,
    bom_status: bomByLine.get(pl.order_line_id) ?? 'none',
    image_url: pl.image_file_id ? (imageUrls[pl.image_file_id] ?? null) : null,
    spec: {
      machine: pl.tech_spec.machine ?? '',
      cushion: pl.tech_spec.cushion ?? '',
      paint: pl.tech_spec.paint ?? '',
      glass: pl.tech_spec.glass ?? '',
      wood: pl.tech_spec.wood ?? '',
    },
  }))

  return NextResponse.json({ lsx, progress, lines })
})
