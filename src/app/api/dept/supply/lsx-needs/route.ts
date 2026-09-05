import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxNeedsService } from '@/modules/dept/supply/lsx-needs.service'
import {
  lsxNeedsDeleteSchema,
  lsxNeedsUpsertSchema,
} from '@/modules/dept/supply/lsx-needs.schema'

const listQuery = z.object({ lsx: z.string().uuid() })

/** Bảng kê nhập tay của một lệnh (0184). */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { lsx } = parseQuery(new URL(req.url), listQuery)
  const rows = await lsxNeedsService.list(lsx)
  return NextResponse.json({ rows })
})

/** Ghi đè từng mã — gõ tay, "ghi đè định mức", hoặc dán từ Excel. */
export const PUT = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, lsxNeedsUpsertSchema)
  const rows = await lsxNeedsService.upsert(user, input)
  return NextResponse.json({ rows })
})

/** Bỏ dòng tay của một số mã. */
export const DELETE = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, lsxNeedsDeleteSchema)
  const rows = await lsxNeedsService.remove(user, input)
  return NextResponse.json({ rows })
})
