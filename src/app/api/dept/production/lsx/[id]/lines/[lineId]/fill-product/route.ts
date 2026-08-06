import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'

/**
 * Sales bổ sung hồ sơ SP từ một dòng lệnh — chỉ điền trường hồ sơ đang trống
 * (xem lsxLinesService.fillProductFromLine). Trả về danh sách trường đã điền.
 */
export const POST = handle(
  async (
    _req: Request,
    { params }: { params: Promise<{ id: string; lineId: string }> },
  ) => {
    const user = await authService.requireUser()
    const { id, lineId } = await params
    return NextResponse.json(await lsxLinesService.fillProductFromLine(user, id, lineId))
  },
)
