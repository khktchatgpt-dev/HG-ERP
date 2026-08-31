import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'

type Params = { params: Promise<{ id: string }> }

/**
 * `?download=1` → URL ép tải về kèm ĐÚNG tên gốc. Không có tham số thì trả URL
 * xem trực tiếp (ảnh, PDF) như cũ — cùng endpoint phục vụ cả hai việc.
 */
export const GET = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const asAttachment = new URL(req.url).searchParams.get('download') === '1'
  const { url, expiresIn } = await filesService.getDownloadTarget(user, id, asAttachment)
  // `private` vì URL gắn quyền của chính user này — không được để CDN dùng chung.
  // max-age bám đúng hạn token: cache lâu hơn là phát ra URL đã chết.
  return NextResponse.json(
    { url },
    { headers: { 'cache-control': `private, max-age=${expiresIn}` } },
  )
})

/**
 * Nhãn của tài liệu SP (0181): ghi chú, ký hiệu phiên bản, cờ "bản đang dùng".
 * Chỉ ba trường này — nội dung file thì tải lên bản mới chứ không sửa tại chỗ.
 */
const patchSchema = z
  .object({
    rev: z.string().trim().max(50, 'Ký hiệu phiên bản tối đa 50 ký tự').nullable(),
    note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').nullable(),
    is_current: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Không có gì để cập nhật')

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, patchSchema)
  const file = await filesService.setProductFileMeta(user, id, input)
  return NextResponse.json({
    id: file.id,
    rev: file.rev,
    note: file.note,
    is_current: file.is_current,
  })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await filesService.delete(user, id)
  return NextResponse.json({ ok: true })
})
