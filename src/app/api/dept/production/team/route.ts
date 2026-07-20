import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { teamService } from '@/modules/dept/production/team.service'
import { teamBoardQuerySchema } from '@/modules/dept/production/production.schema'

/** Bảng việc của tổ (Kanban LSX × công đoạn) — ?stage= cho admin/manager. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { stage } = parseQuery(new URL(req.url), teamBoardQuerySchema)
  const board = await teamService.board(user, { stage })
  return NextResponse.json(board)
})
