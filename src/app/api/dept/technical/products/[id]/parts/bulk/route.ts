import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productPartsBulkSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Thêm nhiều dòng định mức một lượt (lưới nhập / dán từ Excel). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productPartsBulkSchema)
  const result = await productsService.addParts(user, id, input)
  return NextResponse.json(result, { status: 201 })
})
