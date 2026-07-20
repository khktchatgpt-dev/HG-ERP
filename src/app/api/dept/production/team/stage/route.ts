import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { teamService } from '@/modules/dept/production/team.service'
import { teamStageSchema } from '@/modules/dept/production/production.schema'

/** Tổ đánh dấu thẻ việc: Bắt đầu / Xong công đoạn (quyền mềm theo tổ). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { lsx_id, ...input } = await parseJson(req, teamStageSchema)
  const lsx = await teamService.markStage(user, lsx_id, input)
  return NextResponse.json({ lsx })
})
