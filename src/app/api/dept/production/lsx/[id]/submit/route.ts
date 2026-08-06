import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'

/**
 * Sales gửi lệnh NHÁP sang bàn duyệt của GĐ (0117): draft → pending_approval,
 * đơn sang 'lsx_pending' và notify người duyệt — xem lsxService.submit.
 */
export const POST = handle(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await params
    return NextResponse.json({ lsx: await lsxService.submit(user, id) })
  },
)
