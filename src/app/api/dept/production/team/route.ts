import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'

const querySchema = z.object({ team: z.string().uuid().optional() })

/** Việc của tổ (màn tổ trưởng) — ?team= cho admin/manager chọn tổ. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { team } = parseQuery(new URL(req.url), querySchema)
  const board = await jobsService.teamBoard(user, { team })
  return NextResponse.json(board)
})
