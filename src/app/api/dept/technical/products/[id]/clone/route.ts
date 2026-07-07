import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productCloneSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Tái sử dụng mẫu (FR-ENG-02): nhân bản SP + BOM cho khách khác. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productCloneSchema)
  const product = await productsService.clone(user, id, input)
  return NextResponse.json({ product }, { status: 201 })
})
