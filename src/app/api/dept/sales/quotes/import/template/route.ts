import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { handle, NotFound } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'

/**
 * Tải FILE MẪU báo giá. Phục vụ thẳng từ `docs/mau/` — file do
 * `scripts/make-quote-template.mjs` sinh ra, nên mẫu tải về luôn khớp với bộ đọc.
 */
export const GET = handle(async () => {
  await authService.requireUser()
  const path = join(process.cwd(), 'docs', 'mau', 'MAU_BAO_GIA_SP_MOI.xlsx')
  let buf: Buffer
  try {
    buf = await readFile(path)
  } catch {
    throw NotFound('Chưa có file mẫu — chạy: node scripts/make-quote-template.mjs')
  }
  return new Response(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="MAU_BAO_GIA_SP_MOI.xlsx"',
      'cache-control': 'no-store',
    },
  })
})
