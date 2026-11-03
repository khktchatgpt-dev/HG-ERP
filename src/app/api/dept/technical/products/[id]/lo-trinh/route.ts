import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productRoutesSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Lưu lộ trình theo cụm / dòng rời của một SP (0288, B2) — cùng quyền sửa định mức. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productRoutesSchema)
  const result = await productsService.saveRoutes(user, id, input)
  return NextResponse.json(result)
})
