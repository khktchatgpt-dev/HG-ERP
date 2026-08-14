import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'

type Params = { params: Promise<{ id: string }> }

/**
 * CHỐT LẠI ĐỊNH MỨC của lệnh theo BOM hiện hành (0142). Mặc định lệnh dùng ảnh
 * chụp lúc phát lệnh và đứng yên; đây là đường duy nhất để ăn theo bản BOM mới.
 * Quyền `production.lsx.bom_resnap` (Kế hoạch/Cung ứng + Giám đốc).
 */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const result = await lsxService.resnapBom(user, id)
  return NextResponse.json(result)
})
