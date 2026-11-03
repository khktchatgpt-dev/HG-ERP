import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stageConfigService } from '@/modules/dept/production/stage-config.service'
import { stageConfigPatchSchema } from '@/modules/dept/production/stage-config.schema'

type Params = { params: Promise<{ code: string }> }

/** Sửa một công đoạn: nhãn · bậc đếm + ô lõi · tổ · ô riêng · mã lỗi · ngừng dùng. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { code } = await params
  const patch = await parseJson(req, stageConfigPatchSchema)
  return NextResponse.json(await stageConfigService.update(user, code, patch))
})
