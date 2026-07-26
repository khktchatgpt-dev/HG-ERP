import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productNextCodeQuerySchema } from '@/modules/dept/technical/technical.schema'

/** Mã SP kế tiếp theo (loại, vật liệu khung) — form tạo SP điền sẵn thay cho gõ tay. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { type, material } = parseQuery(new URL(req.url), productNextCodeQuerySchema)
  const code = await productsService.nextCode(user, type, material)
  return NextResponse.json({ code })
})
