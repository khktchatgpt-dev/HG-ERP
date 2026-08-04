import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { lsxSheetSaveSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** Dòng + nhóm của lệnh (0114) — nguồn phiếu in và trục sản xuất. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await lsxLinesService.sheet(user, id))
})

/**
 * Sales lưu bản soạn: ghi đè trọn bộ nhóm + dòng. Lệnh đã duyệt thì mỗi lần lưu
 * là một BẢN CHỈNH SỬA (revision +1, đánh dấu dòng đổi cho phiếu in).
 */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, lsxSheetSaveSchema)
  const sheet = await lsxLinesService.save(user, id, input)
  return NextResponse.json(sheet)
})

/** Nạp lại dòng từ các đơn của lệnh (đơn mới gộp vào chưa có dòng). */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await lsxLinesService.seedFromOrders(id)
  return NextResponse.json(await lsxLinesService.sheet(user, id))
})
