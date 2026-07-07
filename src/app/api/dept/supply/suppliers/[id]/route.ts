import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { supplierUpdateSchema } from '@/modules/dept/supply/suppliers.schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, supplierUpdateSchema)
  const supplier = await suppliersService.update(user, id, input)
  return NextResponse.json({ supplier })
})
