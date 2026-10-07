import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'
import { importCommitSchema } from '@/modules/dept/technical/product-import.schema'

export const maxDuration = 120

/** Ghi MỘT lô (≤ 50 dòng). Server soi lại cả file; còn dòng lỗi thì không ghi gì. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, importCommitSchema)
  const written = await productImportService.commitChunk(user, input)
  return NextResponse.json({ written })
})
