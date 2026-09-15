import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { binsService } from '@/modules/dept/warehouse/stock.service'
import { binUpdateSchema } from '@/modules/dept/warehouse/warehouse.schema'

export const PATCH = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const body = await parseJson(req, binUpdateSchema)
    await binsService.update(user, id, body)
    return NextResponse.json({ ok: true })
  },
)
