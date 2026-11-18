import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productShowroomSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Tick "có mẫu ở showroom" / "đã treo thẻ" (0303) từ danh sách hoặc hồ sơ SP. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productShowroomSchema)
  const showroom = await productsService.setShowroom(user, id, input)
  return NextResponse.json({ showroom })
})
