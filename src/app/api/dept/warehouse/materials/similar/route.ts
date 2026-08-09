import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialSimilarQuerySchema } from '@/modules/dept/warehouse/warehouse.schema'

/**
 * Dò tên vật tư GẦN GIỐNG lúc đang khai (0124) — nguồn cho cảnh báo mềm trên
 * form. So trong cùng phạm vi nhóm với chặn cứng, bằng khoá + so mờ theo từ
 * (bắt "Buri/Bori", "7M/7 màu", "XT/xi trắng" — các ca thật trong sổ Cung ứng).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { name, group_name } = parseQuery(new URL(req.url), materialSimilarQuerySchema)
  const materials = await materialsService.similar(user, name, group_name ?? null)
  return NextResponse.json({ materials })
})
