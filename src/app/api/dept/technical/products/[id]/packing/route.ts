import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { packingService } from '@/modules/dept/technical/packing.service'
import { packingOptionInputSchema } from '@/modules/dept/technical/packing.schema'

type Params = { params: Promise<{ id: string }> }

/** Thêm một PHƯƠNG ÁN ĐÓNG GÓI (kèm kiện) cho sản phẩm. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, packingOptionInputSchema)
  const out = await packingService.create(user, id, input)
  return NextResponse.json(out, { status: 201 })
})
