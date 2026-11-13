import { NextResponse } from 'next/server'
import { BadRequest, handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { entryDocSubmitSchema } from '@/modules/dept/production/entries.schema'

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
 * Body tuỳ chọn: giờ công (0296) khi phiếu nháp chưa có — số chính thức phải có
 * giờ. Body rỗng vẫn hợp lệ (phiếu nháp đã mang giờ công).
 */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const text = (await req.text()).trim()
  let raw: unknown = {}
  if (text) {
    try {
      raw = JSON.parse(text)
    } catch {
      throw BadRequest('Invalid JSON body')
    }
  }
  const crew = entryDocSubmitSchema.parse(raw)
  await entriesService.submitDoc(user, id, crew)
  return NextResponse.json({ ok: true })
})
