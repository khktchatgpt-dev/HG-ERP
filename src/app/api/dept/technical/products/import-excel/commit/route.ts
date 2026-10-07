import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'
import { importCommitSchema } from '@/modules/dept/technical/product-import.schema'

export const maxDuration = 120

/** Ghi MỘT lô (≤ 50 dòng sản phẩm hoặc ≤ 40 SP đóng gói). Server soi lại cả file; còn lỗi thì không ghi gì. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, importCommitSchema)
  // { written, packed } — dòng sản phẩm đã ghi + mã SP đã thay đóng gói.
  return NextResponse.json(await productImportService.commitChunk(user, input))
})
