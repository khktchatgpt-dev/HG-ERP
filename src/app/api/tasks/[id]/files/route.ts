import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'

type Params = { params: Promise<{ id: string }> }

/** Tệp đính kèm của một việc. Tải lên / xoá đi qua `/api/files` như mọi tệp khác. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json({ files: await filesService.listForTask(user, id) })
})
