import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { lsxHeaderUpdateSchema } from '@/modules/dept/production/production.schema'
import { filesService } from '@/modules/core/files/files.service'

type Params = { params: Promise<{ id: string }> }

/**
 * Hồ sơ LSX (đọc) — panel "Hồ sơ sản xuất" khu GĐ + màn chi tiết lệnh:
 * `{ lsx, jobs, template, groups }`. Dòng lấy từ production_order_lines (0114),
 * spec là bộ cột của khách. KHÔNG kèm đơn giá bán (endpoint mở cho mọi NV).
 */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const [{ lsx, jobs }, sheet] = await Promise.all([
    lsxService.detail(user, id),
    lsxLinesService.sheet(user, id),
  ])

  const fileIds = [
    ...new Set(
      sheet.groups
        .flatMap((g) => g.lines.map((l) => l.image_file_id))
        .filter((x): x is string => !!x),
    ),
  ]
  let imageUrls: Record<string, string> = {}
  try {
    if (fileIds.length) imageUrls = await filesService.getDownloadUrls(user, fileIds)
  } catch {
    /* ảnh lỗi không chặn hồ sơ */
  }

  const groups = sheet.groups.map((g) => ({
    ...g,
    lines: g.lines.map((l) => ({
      ...l,
      image_url: l.image_file_id ? (imageUrls[l.image_file_id] ?? null) : null,
    })),
  }))

  return NextResponse.json({
    lsx,
    jobs,
    template: sheet.template,
    groups,
    totals: sheet.totals,
  })
})

/**
 * Sửa THÔNG TIN ĐẦU LỆNH (0117): số lệnh, ưu tiên, ngày nhận/hạn xuất,
 * container, ghi chú — xem lsxService.updateHeader.
 */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, lsxHeaderUpdateSchema)
  return NextResponse.json({ lsx: await lsxService.updateHeader(user, id, input) })
})
