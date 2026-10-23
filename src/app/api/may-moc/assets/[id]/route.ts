import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { assetUpdateSchema } from '@/modules/core/assets/assets.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa thông tin máy; đổi tổ = điều chuyển (DC); báo mất / thanh lý kèm lý do. */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json({
    asset: await assetsService.update(user, id, await parseJson(req, assetUpdateSchema)),
  })
})
