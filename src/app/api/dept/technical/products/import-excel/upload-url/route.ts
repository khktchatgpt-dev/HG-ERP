import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'

/** URL ký để trình duyệt PUT file .xlsx thẳng lên Storage (né trần 4,5 MB của Vercel). */
export const POST = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await productImportService.uploadUrl(user))
})
