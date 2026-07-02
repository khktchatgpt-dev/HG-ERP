import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import { userBulkImportSchema } from '@/modules/core/users/users.schema'

// Import hàng loạt user từ Excel/CSV. Client parse file → gửi mảng users.
// Response: { created: User[], skipped: [{ email, reason }] }
export const POST = handle(async (req: Request) => {
  const actor = await authService.requireUser()
  const input = await parseJson(req, userBulkImportSchema)
  const result = await usersService.bulkImport(actor, input.users)
  return NextResponse.json(result, { status: 201 })
})
