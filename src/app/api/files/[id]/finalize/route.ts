import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'
import { finalizeUploadSchema } from '@/modules/core/files/files.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, finalizeUploadSchema)
  await filesService.finalize(user, id, input.checksum)
  return NextResponse.json({ ok: true })
})
