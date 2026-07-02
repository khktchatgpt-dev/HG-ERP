import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'
import { initUploadSchema } from '@/modules/core/files/files.schema'

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, initUploadSchema)
  const result = await filesService.initUpload(user, input)
  return NextResponse.json(result, { status: 201 })
})
