import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { supplierGroupsSchema } from '@/modules/dept/supply/suppliers.schema'

type Params = { params: Promise<{ id: string }> }

/** Nhóm hàng NCC cung cấp (M4): GET id các nhóm, PUT đặt lại toàn bộ. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const group_ids = await suppliersService.listGroups(user, id)
  return NextResponse.json({ group_ids })
})

export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { group_ids } = await parseJson(req, supplierGroupsSchema)
  await suppliersService.setGroups(user, id, group_ids)
  return NextResponse.json({ ok: true })
})
