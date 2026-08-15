import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'

/**
 * Dọn file mồ côi (khởi tạo upload nhưng không finalize quá 24h).
 * Guard nằm trong service (`cleanupOrphans` đòi role admin).
 */
export const POST = handle(async () => {
  const user = await authService.requireUser()
  const result = await filesService.cleanupOrphans(user)
  return NextResponse.json(result)
})
