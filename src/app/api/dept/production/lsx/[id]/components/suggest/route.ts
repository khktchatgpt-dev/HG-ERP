import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { componentsService } from '@/modules/dept/production/components.service'
import { componentsSuggestQuerySchema } from '@/modules/dept/production/components.schema'

type Params = { params: Promise<{ id: string }> }

/** Gợi ý điền sẵn bảng chi tiết (không ghi DB): ?source=bom | previous. */
export const GET = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { source } = parseQuery(new URL(req.url), componentsSuggestQuerySchema)
  const lines = await componentsService.suggest(user, id, source)
  return NextResponse.json({ lines })
})
