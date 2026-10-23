import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { assetCreateSchema } from '@/modules/core/assets/assets.schema'

/** Danh sách gọn máy còn trên sổ — ô tìm máy + hộp quét tem QR. */
export const GET = handle(async () => {
  // Ai đăng nhập cũng báo hỏng được, nên ai cũng tìm / quét được máy.
  const user = await authService.requireUser()
  return NextResponse.json(await assetsService.lookup(user))
})

/** Thêm máy / dụng cụ — tự cấp mã tem, gợi ý lịch bảo trì theo nhóm. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const asset = await assetsService.create(user, await parseJson(req, assetCreateSchema))
  return NextResponse.json({ asset }, { status: 201 })
})
