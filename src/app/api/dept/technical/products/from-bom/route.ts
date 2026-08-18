import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { bomAiService } from '@/modules/dept/technical/bom-ai.service'
import {
  bomAiCreateSchema,
  bomAiNewExtractSchema,
} from '@/modules/dept/technical/bom-ai.schema'

/**
 * TẠO SP MỚI TỪ FILE BOM — không nằm dưới `[id]` vì chưa có sản phẩm nào.
 *
 *   POST            → đọc file, trả bản nháp (thuộc tính SP + định mức)
 *   POST ?create=1  → tạo SP rồi ghi định mức
 *
 * Gộp hai việc vào một route theo tham số thay vì hai file: cùng một nghiệp vụ,
 * cùng một quyền, và bước 2 chỉ có nghĩa ngay sau bước 1.
 */
export const maxDuration = 120

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()

  if (new URL(req.url).searchParams.get('create') === '1') {
    const input = await parseJson(req, bomAiCreateSchema)
    const result = await bomAiService.createFromBom(user, input)
    return NextResponse.json(result, { status: 201 })
  }

  const input = await parseJson(req, bomAiNewExtractSchema)
  const draft = await bomAiService.extractForNewProduct(user, input)
  return NextResponse.json(draft)
})
