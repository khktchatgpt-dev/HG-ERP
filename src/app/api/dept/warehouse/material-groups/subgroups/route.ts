import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialGroupsService } from '@/modules/dept/warehouse/material-groups.service'
import { materialSubGroupActionSchema } from '@/modules/dept/warehouse/material-groups.schema'

/**
 * Nhóm PHỤ — đổi tên / gộp / xoá. Không có bảng riêng (là cột text trên vật
 * tư) nên không có id để RESTful hoá; một POST với `action` là đủ và rõ.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, materialSubGroupActionSchema)
  if (input.action === 'rename') {
    const r = await materialGroupsService.renameSubGroup(
      user,
      input.group_name,
      input.from,
      input.to,
    )
    return NextResponse.json(r)
  }
  const r = await materialGroupsService.deleteSubGroup(user, input.group_name, input.name)
  return NextResponse.json(r)
})
