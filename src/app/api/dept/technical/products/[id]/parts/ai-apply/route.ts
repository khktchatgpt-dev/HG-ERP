import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { bomAiService } from '@/modules/dept/technical/bom-ai.service'
import { bomAiApplySchema } from '@/modules/dept/technical/bom-ai.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Ghi bản nháp BOM đã được người dùng duyệt — cả bản nháp trong MỘT lượt.
 *
 * Tách khỏi `parts/bulk` (mỗi lượt một khối) vì chế độ `replace` phải xoá xong
 * mọi nhóm liên quan rồi mới ghi; chia nhỏ ra là khối sau xoá mất khối trước.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, bomAiApplySchema)
  const result = await bomAiService.apply(user, id, input)
  return NextResponse.json(result, { status: 201 })
})
