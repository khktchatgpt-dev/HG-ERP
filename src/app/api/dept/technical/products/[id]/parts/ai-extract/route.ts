import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { bomAiService } from '@/modules/dept/technical/bom-ai.service'
import { bomAiExtractSchema } from '@/modules/dept/technical/bom-ai.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Đọc file BOM bằng AI → BẢN NHÁP định mức.
 *
 * Chỉ đọc, không ghi: người dùng soi bản nháp rồi lưu qua `.../parts/bulk`.
 * Gọi mô hình mất vài chục giây với file lớn nên route chạy trên Node runtime
 * với hạn dài hơn mặc định.
 */
export const maxDuration = 120

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, bomAiExtractSchema)
  const draft = await bomAiService.extract(user, id, input)
  return NextResponse.json(draft)
})
