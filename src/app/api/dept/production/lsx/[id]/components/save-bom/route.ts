import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { componentsService } from '@/modules/dept/production/components.service'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({ order_line_id: z.string().uuid() })

/**
 * Lưu bảng định hình của 1 dòng SP thành BOM KỸ THUẬT của SP (ghi đè BOM
 * hiện có; gộp chi tiết cùng vật tư; bom_status → done).
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { order_line_id } = await parseJson(req, bodySchema)
  const result = await componentsService.saveAsBom(user, id, order_line_id)
  return NextResponse.json(result)
})
