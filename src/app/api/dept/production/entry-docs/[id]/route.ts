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

/**
 * Ghi CHÍNH THỨC phiếu nháp (chế độ không cần tổ trưởng xác nhận — 27/08).
 * Chưa nhận action nào khác: tầng duyệt bật lại thì mở rộng body ở đây.
 */
export const PATCH = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await entriesService.submitDoc(user, id)
  return NextResponse.json({ ok: true })
})
