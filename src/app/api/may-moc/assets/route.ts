import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { assetCreateSchema } from '@/modules/core/assets/assets.schema'

/** Thêm máy / dụng cụ — tự cấp mã tem, gợi ý lịch bảo trì theo nhóm. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const asset = await assetsService.create(user, await parseJson(req, assetCreateSchema))
  return NextResponse.json({ asset }, { status: 201 })
})
