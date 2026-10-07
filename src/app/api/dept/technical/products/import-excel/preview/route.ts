import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'
import { importPreviewSchema } from '@/modules/dept/technical/product-import.schema'

export const maxDuration = 60

/** Soi trước file đã tải lên Storage — đọc + so từng dòng, KHÔNG ghi gì. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { path } = await parseJson(req, importPreviewSchema)
  return NextResponse.json(await productImportService.preview(user, path))
})
