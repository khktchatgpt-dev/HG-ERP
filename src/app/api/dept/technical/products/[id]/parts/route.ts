import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productPartCreateSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Thêm một dòng định mức vào hồ sơ sản phẩm (0092). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productPartCreateSchema)
  const part = await productsService.addPart(user, id, input)
  return NextResponse.json({ part }, { status: 201 })
})
