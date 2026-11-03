import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { transferDocsService } from '@/modules/dept/production/transfer-docs.service'
import { transferSourceQuerySchema } from '@/modules/dept/production/transfer-docs.schema'

/** Dòng giao được từ một công đoạn của một lệnh: xong · đã giao · tồn. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), transferSourceQuerySchema)
  return NextResponse.json(await transferDocsService.source(user, q.lsx, q.stage))
})
