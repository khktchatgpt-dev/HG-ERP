import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'
import { importFinishSchema } from '@/modules/dept/technical/product-import.schema'

/** Ghi xong → file đã điền mã + phiên bản mới, trả URL tải (15 phút). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, importFinishSchema)
  return NextResponse.json(await productImportService.finish(user, input))
})
