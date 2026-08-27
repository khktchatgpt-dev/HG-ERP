import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'

type Params = { params: Promise<{ id: string }> }

/** Xoá NGUYÊN PHIẾU báo sản lượng (dòng + header) — người lập hoặc GĐ/QL. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await entriesService.deleteDoc(user, id)
  return NextResponse.json({ ok: true })
})
