import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { boardQuerySchema } from '@/modules/dept/production/entries.schema'

/**
 * Bảng nhập theo công đoạn (?date=[&lsx=]) — chi tiết nhóm LỆNH → SP kèm số đã
 * ghi trong ngày; lsx giới hạn về một lệnh (màn nhập tách theo lệnh).
 * Đọc: mọi NV đã đăng nhập.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { date, lsx } = parseQuery(new URL(req.url), boardQuerySchema)
  const data = await entriesService.board(user, date, lsx)
  return NextResponse.json(data)
})
