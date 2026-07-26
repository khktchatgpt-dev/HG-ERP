import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productPartUpdateSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string; partId: string }> }

/** Sửa một dòng định mức. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, partId } = await params
  const patch = await parseJson(req, productPartUpdateSchema)
  const part = await productsService.updatePart(user, id, partId, patch)
  return NextResponse.json({ part })
})

/** Xoá một dòng định mức. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, partId } = await params
  await productsService.removePart(user, id, partId)
  return NextResponse.json({ ok: true })
})
