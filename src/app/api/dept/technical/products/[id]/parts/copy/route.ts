import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productPartsCopySchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Chép định mức từ một sản phẩm khác sang sản phẩm này. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productPartsCopySchema)
  const result = await productsService.copyPartsFrom(user, id, input)
  return NextResponse.json(result, { status: 201 })
})
