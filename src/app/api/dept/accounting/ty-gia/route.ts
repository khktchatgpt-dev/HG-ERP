import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { fxRatesService } from '@/modules/dept/accounting/fx-rates.service'
import {
  fxRateCreateSchema,
  fxRateUpdateSchema,
} from '@/modules/dept/accounting/fx-rates.schema'

/** Thêm một dòng tỷ giá (một ngoại tệ, một ngày, một tỷ giá). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, fxRateCreateSchema)
  return NextResponse.json(await fxRatesService.create(user, input))
})

/** Sửa dòng chưa chứng từ nào dùng. */
export const PATCH = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, fxRateUpdateSchema)
  return NextResponse.json(await fxRatesService.update(user, input))
})
