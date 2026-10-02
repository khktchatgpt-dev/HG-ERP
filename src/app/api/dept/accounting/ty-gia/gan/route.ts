import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { fxRatesService } from '@/modules/dept/accounting/fx-rates.service'
import { fxAssignSchema } from '@/modules/dept/accounting/fx-rates.schema'

/**
 * Gán tỷ giá cho chứng từ ngoại tệ đang thiếu. `dry: true` chỉ trả kế hoạch
 * (màn bày trước rồi mới bấm gán); `dry: false` ghi cứng lên chứng từ.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { dry } = await parseJson(req, fxAssignSchema)
  return NextResponse.json(await fxRatesService.assignMissing(user, dry))
})
