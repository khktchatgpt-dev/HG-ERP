import { NextResponse } from 'next/server'
import { authService } from '@/modules/core/auth/auth.service'
import { accountService } from '@/modules/core/account/account.service'
import { AVATAR_MAX_BYTES, isAvatarMime } from '@/modules/core/account/account.schema'
import { BadRequest, handle } from '@/server/http'

/**
 * Ảnh đại diện đi bằng multipart chứ không qua luồng 3 bước (init → PUT signed
 * URL → finalize) của module files: ảnh ≤2MB, một request là xong, và không có
 * bản ghi `files` nào cần chốt.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw BadRequest('Chưa chọn ảnh')
  if (file.size > AVATAR_MAX_BYTES) throw BadRequest('Ảnh tối đa 2MB')
  if (!isAvatarMime(file.type)) throw BadRequest('Chỉ nhận ảnh JPG, PNG hoặc WEBP')

  const buffer = Buffer.from(await file.arrayBuffer())
  const updated = await accountService.setAvatar(user, { buffer, mime: file.type })
  return NextResponse.json({
    user: updated,
    avatar_url: await accountService.avatarUrl(updated),
  })
})

export const DELETE = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json({ user: await accountService.removeAvatar(user) })
})
