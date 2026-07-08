import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { catalogUpdateSchema } from '@/modules/core/catalogs/catalogs.schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, catalogUpdateSchema)
  const item = await catalogsService.update(user, id, input)
  return NextResponse.json({ item })
})
